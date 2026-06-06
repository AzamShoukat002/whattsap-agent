const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const https = require('https');
const { spawn } = require('child_process');
const logger = require('pino')();

const FFMPEG_PATH = process.env.FFMPEG_PATH || 'ffmpeg';

// Default: "Rachel" - natural American female voice
// Find more voice IDs at: https://elevenlabs.io/app/voice-library
const ELEVENLABS_VOICE_ID = process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM';
const ELEVENLABS_MODEL = process.env.ELEVENLABS_MODEL || 'eleven_turbo_v2_5';

async function synthesizeElevenLabsSpeech(text) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error('ELEVENLABS_API_KEY is not set in .env');

  const body = JSON.stringify({
    text,
    model_id: ELEVENLABS_MODEL,
    voice_settings: {
      stability: 0.4,
      similarity_boost: 0.75,
      style: 0.3,
      use_speaker_boost: true,
    },
  });

  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.elevenlabs.io',
      path: `/v1/text-to-speech/${ELEVENLABS_VOICE_ID}`,
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'Accept': 'audio/mpeg',
      },
    };

    const req = https.request(options, res => {
      if (res.statusCode !== 200) {
        let errData = '';
        res.on('data', chunk => { errData += chunk; });
        res.on('end', () => reject(new Error(`ElevenLabs API error ${res.statusCode}: ${errData}`)));
        return;
      }

      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    });

    req.on('error', err => reject(new Error(`ElevenLabs request failed: ${err.message}`)));
    req.write(body);
    req.end();
  });
}

async function synthesizeElevenLabsWhatsAppVoiceNote(text) {
  const mp3Buffer = await synthesizeElevenLabsSpeech(text);

  const tempId = crypto.randomUUID();
  const tempDir = path.join(os.tmpdir(), 'whatsapp-agent-voice');
  fs.mkdirSync(tempDir, { recursive: true });

  const mp3Path = path.join(tempDir, `${tempId}.mp3`);
  const oggPath = path.join(tempDir, `${tempId}.ogg`);

  fs.writeFileSync(mp3Path, mp3Buffer);

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
      reject(new Error('ffmpeg failed to convert elevenlabs audio'));
    });
  });
}

module.exports = {
  synthesizeElevenLabsWhatsAppVoiceNote,
};
