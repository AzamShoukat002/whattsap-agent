const logger = require('pino')();
const { downloadAudioBuffer, getAudioMessageContent, isVoiceNoteMessage } = require('./messageAudio');
const { hasOpenAIAudioConfig, isVoiceReplyEnabled } = require('./config');
const { safeDelete, synthesizeWhatsAppVoiceNote, transcribeAudio } = require('./openaiAudio');
const { synthesizeEdgeWhatsAppVoiceNote } = require('./edgeTts');
const { synthesizeKokoroWhatsAppVoiceNote } = require('./kokoroTts');
const { synthesizeElevenLabsWhatsAppVoiceNote } = require('./elevenLabsTts');

const TTS_PROVIDER = (process.env.TTS_PROVIDER || 'openai').toLowerCase();

async function synthesizeVoiceNote(text) {
  if (TTS_PROVIDER === 'edge') {
    return synthesizeEdgeWhatsAppVoiceNote(text);
  }
  if (TTS_PROVIDER === 'kokoro') {
    return synthesizeKokoroWhatsAppVoiceNote(text);
  }
  if (TTS_PROVIDER === 'elevenlabs') {
    return synthesizeElevenLabsWhatsAppVoiceNote(text);
  }
  return synthesizeWhatsAppVoiceNote(text);
}

async function processVoiceMessage({
  socket,
  message,
  generateReply,
  rewriteReplyForVoice,
  history,
  knowledgeBase,
  storeName,
}) {
  if (TTS_PROVIDER !== 'edge' && !hasOpenAIAudioConfig()) {
    throw new Error('OPENAI_API_KEY is not configured for voice support');
  }

  const audioMessage = getAudioMessageContent(message);
  const mimeType = audioMessage?.mimetype || 'audio/ogg; codecs=opus';
  const audioBuffer = await downloadAudioBuffer(socket, message);
  const transcript = await transcribeAudio(audioBuffer, mimeType);

  logger.info({ transcript }, 'Voice note transcribed');

  const replyText = await generateReply(transcript, history, knowledgeBase, storeName);
  const spokenReplyText = isVoiceReplyEnabled()
    ? await rewriteReplyForVoice(replyText, transcript, storeName)
    : replyText;

  const result = {
    transcript,
    replyText,
    spokenReplyText,
    voiceNoteFilePath: null,
  };

  if (isVoiceReplyEnabled()) {
    const voiceNoteFile = await synthesizeVoiceNote(spokenReplyText);
    result.voiceNoteFilePath = voiceNoteFile.outputPath;
  }

  return result;
}

module.exports = {
  isVoiceNoteMessage,
  processVoiceMessage,
  safeDelete,
};
