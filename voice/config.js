function isVoiceReplyEnabled() {
  return process.env.VOICE_REPLY_ENABLED === 'true';
}

function hasOpenAIAudioConfig() {
  return Boolean(process.env.OPENAI_API_KEY);
}

function getOpenAIConfig() {
  const configuredVoice = process.env.OPENAI_TTS_VOICE;
  const voiceGender = (process.env.OPENAI_TTS_VOICE_GENDER || 'neutral').toLowerCase();

  return {
    apiKey: process.env.OPENAI_API_KEY,
    transcriptionModel: process.env.OPENAI_TRANSCRIPTION_MODEL || 'gpt-4o-mini-transcribe',
    transcriptionLanguage: process.env.OPENAI_TRANSCRIPTION_LANGUAGE || '',
    transcriptionPrompt: process.env.OPENAI_TRANSCRIPTION_PROMPT || '',
    ttsModel: process.env.OPENAI_TTS_MODEL || 'gpt-4o-mini-tts',
    ttsVoice: configuredVoice || getVoiceByGender(voiceGender),
    ttsInstructions:
      process.env.OPENAI_TTS_INSTRUCTIONS
      || 'Speak naturally like a real WhatsApp support person. Use warm human pacing, slight conversational pauses, and avoid sounding synthetic or overly cheerful.',
    ffmpegPath: process.env.FFMPEG_PATH || 'ffmpeg',
  };
}

function getVoiceByGender(voiceGender) {
  if (voiceGender === 'male') return 'cedar';
  if (voiceGender === 'female') return 'marin';
  return 'alloy';
}

module.exports = {
  isVoiceReplyEnabled,
  hasOpenAIAudioConfig,
  getOpenAIConfig,
};
