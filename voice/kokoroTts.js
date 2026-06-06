const { KokoroTTS } = require('kokoro-js');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');
const logger = require('pino')();

const FFMPEG_PATH = process.env.FFMPEG_PATH || 'ffmpeg';
const KOKORO_VOICE = process.env.KOKORO_VOICE || 'af_heart';

let ttsInstance = null;

async function getTTSInstance() {
  if (!ttsInstance) {
    logger.info('Loading Kokoro TTS model (first time, may take a moment)...');
    ttsInstance = await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', {
      dtype: 'q8',
      token: process.env.HF_TOKEN || null,
    });
    logger.info('Kokoro TTS model loaded');
  }
  return ttsInstance;
}

async function synthesizeKokoroSpeech(text) {
  const tts = await getTTSInstance();
  const audio = await tts.generate(text, { voice: KOKORO_VOICE });

  const tempId = crypto.randomUUID();
  const tempDir = path.join(os.tmpdir(), 'whatsapp-agent-voice');
  fs.mkdirSync(tempDir, { recursive: true });

  const wavPath = path.join(tempDir, `${tempId}.wav`);
  await audio.save(wavPath);

  return wavPath;
}

async function synthesizeKokoroWhatsAppVoiceNote(text) {
  const wavPath = await synthesizeKokoroSpeech(text);
  const oggPath = wavPath.replace('.wav', '.ogg');

  try {
    await convertToOpus(wavPath, oggPath);
    return { inputPath: wavPath, outputPath: oggPath };
  } finally {
    if (fs.existsSync(wavPath)) fs.unlinkSync(wavPath);
  }
}

function convertToOpus(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn(FFMPEG_PATH, [
      '-y',
      '-i', inputPath,
      '-c:a', 'libopus',
      '-b:a', '32k',
      '-vbr', 'on',
      '-application', 'voip',
      outputPath,
    ]);

    let stderr = '';
    ffmpeg.stderr.on('data', chunk => { stderr += chunk.toString(); });
    ffmpeg.on('error', err => reject(new Error(`ffmpeg error: ${err.message}`)));
    ffmpeg.on('close', code => {
      if (code === 0) return resolve();
      logger.error({ code, stderr }, 'ffmpeg opus conversion failed');
      reject(new Error('ffmpeg failed to convert kokoro audio'));
    });
  });
}

module.exports = {
  synthesizeKokoroWhatsAppVoiceNote,
};
