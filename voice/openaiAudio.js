const logger = require('pino')();
const { Blob } = require('buffer');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');
const { getOpenAIConfig } = require('./config');

async function transcribeAudio(audioBuffer, mimeType) {
  const config = getOpenAIConfig();
  const form = new FormData();
  const extension = getExtensionFromMimeType(mimeType);
  const fileName = `voice-note.${extension}`;

  form.append('model', config.transcriptionModel);
  form.append('response_format', 'text');
  if (config.transcriptionLanguage) {
    form.append('language', config.transcriptionLanguage);
  }
  if (config.transcriptionPrompt) {
    form.append('prompt', config.transcriptionPrompt);
  }
  form.append('file', new Blob([audioBuffer], { type: mimeType }), fileName);

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: form,
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error({ status: response.status, errorText }, 'OpenAI transcription failed');
    throw new Error(`Transcription failed with status ${response.status}`);
  }

  return (await response.text()).trim();
}

async function synthesizeSpeech(text) {
  const config = getOpenAIConfig();
  const response = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: config.ttsModel,
      voice: config.ttsVoice,
      input: text,
      instructions: config.ttsInstructions,
      response_format: 'mp3',
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error({ status: response.status, errorText }, 'OpenAI speech synthesis failed');
    throw new Error(`Speech synthesis failed with status ${response.status}`);
  }

  return Buffer.from(await response.arrayBuffer());
}

async function synthesizeWhatsAppVoiceNote(text) {
  const speechBuffer = await synthesizeSpeech(text);
  return createOpusVoiceNoteFile(speechBuffer);
}

async function createOpusVoiceNoteFile(mp3Buffer) {
  const config = getOpenAIConfig();
  const tempId = crypto.randomUUID();
  const tempDir = path.join(os.tmpdir(), 'whatsapp-agent-voice');
  const inputPath = path.join(tempDir, `${tempId}.mp3`);
  const outputPath = path.join(tempDir, `${tempId}.ogg`);

  fs.mkdirSync(tempDir, { recursive: true });
  fs.writeFileSync(inputPath, mp3Buffer);

  try {
    await runFfmpeg(config.ffmpegPath, inputPath, outputPath);
    return {
      inputPath,
      outputPath,
    };
  } finally {
    safeDelete(inputPath);
  }
}

function runFfmpeg(ffmpegPath, inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn(ffmpegPath, [
      '-y',
      '-i',
      inputPath,
      '-c:a',
      'libopus',
      '-b:a',
      '32k',
      '-vbr',
      'on',
      '-application',
      'voip',
      outputPath,
    ]);

    let stderr = '';

    ffmpeg.stderr.on('data', chunk => {
      stderr += chunk.toString();
    });

    ffmpeg.on('error', err => {
      logger.error({ error: err.message, ffmpegPath }, 'Failed to start ffmpeg');
      reject(new Error(`Unable to start ffmpeg at ${ffmpegPath}`));
    });

    ffmpeg.on('close', code => {
      if (code === 0) {
        resolve();
        return;
      }

      logger.error({ code, stderr }, 'ffmpeg conversion failed');
      reject(new Error('ffmpeg failed to convert audio for WhatsApp voice note'));
    });
  });
}

function safeDelete(filePath) {
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

function getExtensionFromMimeType(mimeType = '') {
  if (mimeType.includes('ogg')) return 'ogg';
  if (mimeType.includes('webm')) return 'webm';
  if (mimeType.includes('mpeg')) return 'mp3';
  if (mimeType.includes('mp4')) return 'mp4';
  return 'wav';
}

module.exports = {
  safeDelete,
  synthesizeSpeech,
  synthesizeWhatsAppVoiceNote,
  transcribeAudio,
};
