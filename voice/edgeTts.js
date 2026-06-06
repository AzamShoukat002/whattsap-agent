const { MsEdgeTTS, OUTPUT_FORMAT } = require('msedge-tts');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');
const logger = require('pino')();

const EDGE_TTS_VOICE = process.env.EDGE_TTS_VOICE || 'ur-PK-UzmaNeural';
const FFMPEG_PATH = process.env.FFMPEG_PATH || 'ffmpeg';

async function synthesizeEdgeSpeech(text) {
  const tts = new MsEdgeTTS();
  await tts.setMetadata(EDGE_TTS_VOICE, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);

  const tempId = crypto.randomUUID();
  const tempDir = path.join(os.tmpdir(), 'whatsapp-agent-voice');
  const mp3Path = path.join(tempDir, `${tempId}.mp3`);

  fs.mkdirSync(tempDir, { recursive: true });

  await new Promise((resolve, reject) => {
    const { audioStream } = tts.toStream(text);
    const writeStream = fs.createWriteStream(mp3Path);

    audioStream.on('error', reject);
    writeStream.on('error', reject);
    writeStream.on('finish', resolve);

    audioStream.pipe(writeStream);
  });

  return mp3Path;
}

async function synthesizeEdgeWhatsAppVoiceNote(text) {
  const mp3Path = await synthesizeEdgeSpeech(text);
  const oggPath = mp3Path.replace('.mp3', '.ogg');

  try {
    await convertToOpus(mp3Path, oggPath);
    return { inputPath: mp3Path, outputPath: oggPath };
  } finally {
    if (fs.existsSync(mp3Path)) fs.unlinkSync(mp3Path);
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
      reject(new Error('ffmpeg failed to convert edge-tts audio'));
    });
  });
}

module.exports = {
  synthesizeEdgeWhatsAppVoiceNote,
};
