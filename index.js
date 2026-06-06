require('dotenv').config();

const express = require('express');
const QRCode = require('qrcode-terminal');
const logger = require('pino')();

const { makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const { DisconnectReason, isJidBroadcast } = require('@whiskeysockets/baileys');

const { generateReply, rewriteReplyForVoice } = require('./agent');
const { getKnowledgeBase, reloadKnowledgeBase } = require('./knowledgeBase');
const { getHistory, saveMessage, clearHistory, getAllSessions } = require('./sessionManager');
const { shouldHandoff, isHandedOff, removeFromHandoff, handleHandoff } = require('./humanHandoff');
const { isVoiceNoteMessage, processVoiceMessage, safeDelete } = require('./voice');

const app = express();
const PORT = process.env.PORT || 3000;
const OWNER_NUMBER = process.env.OWNER_NUMBER;
const LLM_PROVIDER = (process.env.LLM_PROVIDER || 'anthropic').toLowerCase();

if (!OWNER_NUMBER) {
  logger.error('OWNER_NUMBER not set in .env file');
  process.exit(1);
}

// if (LLM_PROVIDER === 'anthropic' && !process.env.ANTHROPIC_API_KEY) {
//   logger.error('ANTHROPIC_API_KEY not set in .env file');
//   process.exit(1);
// }

// if (LLM_PROVIDER === 'openai' && !process.env.OPENAI_API_KEY) {
//   logger.error('OPENAI_API_KEY not set in .env file');
//   process.exit(1);
// }

// if ((LLM_PROVIDER === 'gemini' || LLM_PROVIDER === 'google') && !process.env.GEMINI_API_KEY && !process.env.GOOGLE_API_KEY) {
//   logger.error('GEMINI_API_KEY or GOOGLE_API_KEY not set in .env file');
//   process.exit(1);
// }

let socket = null;
let isSocketReady = false;
const startTime = Date.now();

function normalizePhoneNumber(jid = '') {
  return jid
    .replace('@s.whatsapp.net', '')
    .replace('@lid', '')
    .replace(/:[0-9]+$/, '');
}

function getSenderJid(message) {
  return message.key.participant || message.key.remoteJid;
}

function extractTextMessage(message) {
  return message.message?.conversation || message.message?.extendedTextMessage?.text || '';
}

function getStoreNameFromKnowledgeBase(knowledgeBase) {
  const storeMatch = knowledgeBase.match(/"store_name":\s*"([^"]+)"/);
  return storeMatch ? storeMatch[1] : 'Our Store';
}

async function sendTypingPresence(senderJid) {
  await socket.presenceSubscribe(senderJid);
  await socket.sendPresenceUpdate('typing', senderJid);
}

async function sendDelayedTextReply(senderJid, reply) {
  await sendTypingPresence(senderJid);
  const delay = Math.random() * 2000 + 1000;
  await new Promise(resolve => setTimeout(resolve, delay));
  await socket.sendMessage(senderJid, { text: reply });
}

async function sendVoiceReply(senderJid, voiceNoteFilePath) {
  await socket.presenceSubscribe(senderJid);
  await socket.sendPresenceUpdate('recording', senderJid);
  const delay = Math.random() * 1200 + 800;
  await new Promise(resolve => setTimeout(resolve, delay));
  try {
    await socket.sendMessage(senderJid, {
      audio: { url: voiceNoteFilePath },
      mimetype: 'audio/ogg; codecs=opus',
      ptt: true,
    });
  } finally {
    safeDelete(voiceNoteFilePath);
  }
}

app.use(express.json());

async function initializeWhatsApp() {
  try {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

    socket = makeWASocket({
      auth: state,
      printQRInTerminal: true,
    });

    socket.ev.on('connection.update', async connection => {
      const { connection: conn, lastDisconnect, qr } = connection;

      if (qr) {
        logger.info('Scan this QR code with WhatsApp:');
        QRCode.generate(qr, { small: true });
      }

      if (conn === 'open') {
        isSocketReady = true;
        logger.info('WhatsApp bot is now online');
      }

      if (conn === 'close') {
        isSocketReady = false;
        const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
        logger.warn(
          { shouldReconnect, statusCode: lastDisconnect?.error?.output?.statusCode },
          'WhatsApp connection closed'
        );

        if (shouldReconnect) {
          setTimeout(() => {
            initializeWhatsApp();
          }, 3000);
        }
      }
    });

    socket.ev.on('creds.update', saveCreds);

    socket.ev.on('messages.upsert', async ({ messages }) => {
      for (const message of messages) {
        if (message.key.fromMe) continue;
        if (isJidBroadcast(message.key.remoteJid)) {
          logger.info('Ignoring broadcast message');
          continue;
        }

        const senderJid = getSenderJid(message);
        const senderNumber = normalizePhoneNumber(senderJid);

        if (senderNumber === OWNER_NUMBER) {
          logger.info('Ignoring owner message');
          continue;
        }

        if (isHandedOff(senderNumber)) {
          logger.info({ senderNumber }, 'Customer is handed off, ignoring message');
          continue;
        }

        try {
          const history = getHistory(senderNumber);
          const knowledgeBase = getKnowledgeBase();
          const storeName = getStoreNameFromKnowledgeBase(knowledgeBase);
          const messageText = extractTextMessage(message);

          if (messageText) {
            logger.info({ senderNumber, message: messageText }, 'Incoming text message');
            saveMessage(senderNumber, 'user', messageText);

            if (shouldHandoff(messageText)) {
              logger.info({ senderNumber }, 'Handoff trigger detected');
              await handleHandoff(socket, senderJid, `${OWNER_NUMBER}@s.whatsapp.net`, senderNumber);
              continue;
            }

            const reply = await generateReply(messageText, history, knowledgeBase, storeName);
            saveMessage(senderNumber, 'assistant', reply);
            await sendDelayedTextReply(senderJid, reply);
            logger.info({ senderNumber, reply }, 'Text reply sent');
            continue;
          }

          if (isVoiceNoteMessage(message)) {
            logger.info({ senderNumber }, 'Incoming voice note');

            const voiceResult = await processVoiceMessage({
              socket,
              message,
              generateReply,
              rewriteReplyForVoice,
              history,
              knowledgeBase,
              storeName,
            });

            saveMessage(senderNumber, 'user', `[Voice Note] ${voiceResult.transcript}`);

            if (shouldHandoff(voiceResult.transcript)) {
              logger.info({ senderNumber }, 'Voice handoff trigger detected');
              await handleHandoff(socket, senderJid, `${OWNER_NUMBER}@s.whatsapp.net`, senderNumber);
              continue;
            }

            saveMessage(senderNumber, 'assistant', voiceResult.replyText);

            if (voiceResult.voiceNoteFilePath) {
              await sendVoiceReply(senderJid, voiceResult.voiceNoteFilePath);
              logger.info({ senderNumber }, 'Voice reply sent');
            } else {
              await sendDelayedTextReply(senderJid, voiceResult.replyText);
              logger.info({ senderNumber }, 'Voice-to-text reply sent');
            }

            continue;
          }

          logger.debug({ senderNumber }, 'Skipping unsupported message type');
        } catch (err) {
          logger.error({ senderNumber, error: err.message }, 'Error processing message');

          try {
            await socket.sendMessage(senderJid, {
              text: 'Sorry, I encountered an error. Please try again.',
            });
          } catch (sendErr) {
            logger.error({ senderNumber, error: sendErr.message }, 'Failed to send error message');
          }
        }
      }
    });
  } catch (err) {
    logger.error({ error: err.message }, 'Error initializing WhatsApp');
    setTimeout(() => {
      initializeWhatsApp();
    }, 5000);
  }
}

app.get('/health', (req, res) => {
  const uptime = Date.now() - startTime;
  res.json({
    status: 'ok',
    uptime: `${Math.floor(uptime / 1000)}s`,
    whatsappStatus: isSocketReady ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString(),
  });
});

app.get('/sessions', (req, res) => {
  const sessions = getAllSessions();
  res.json({
    total: sessions.length,
    sessions,
  });
});

app.get('/sessions/:number', (req, res) => {
  const history = getHistory(req.params.number);
  res.json({
    phoneNumber: req.params.number,
    messages: history,
  });
});

app.delete('/sessions/:number', (req, res) => {
  clearHistory(req.params.number);
  res.json({ success: true, message: 'Session cleared' });
});

app.post('/reset-handoff/:number', (req, res) => {
  removeFromHandoff(req.params.number);
  res.json({ success: true, message: 'Customer re-enabled for bot' });
});

app.post('/reload-knowledge', (req, res) => {
  const updated = reloadKnowledgeBase();
  res.json({ success: true, message: 'Knowledge base reloaded', size: updated.length });
});

app.use((err, req, res, next) => {
  logger.error({ error: err.message, stack: err.stack }, 'Unhandled error');
  res.status(500).json({ error: 'Internal server error' });
});

async function start() {
  try {
    await initializeWhatsApp();

    app.listen(PORT, () => {
      logger.info({ port: PORT }, `Express server running on port ${PORT}`);
      logger.info('Waiting for WhatsApp QR code...');
    });
  } catch (err) {
    logger.error({ error: err.message }, 'Fatal error during startup');
    process.exit(1);
  }
}

start();
