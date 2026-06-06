const logger = require('pino')();
const { downloadMediaMessage } = require('@whiskeysockets/baileys');

function getAudioMessageContent(message) {
  return message.message?.audioMessage
    || message.message?.ephemeralMessage?.message?.audioMessage
    || message.message?.viewOnceMessageV2?.message?.audioMessage
    || message.message?.viewOnceMessage?.message?.audioMessage
    || null;
}

function isVoiceNoteMessage(message) {
  return Boolean(getAudioMessageContent(message));
}

async function downloadAudioBuffer(socket, message) {
  return downloadMediaMessage(
    message,
    'buffer',
    {},
    {
      logger,
      reuploadRequest: socket.updateMediaMessage,
    }
  );
}

module.exports = {
  downloadAudioBuffer,
  getAudioMessageContent,
  isVoiceNoteMessage,
};
