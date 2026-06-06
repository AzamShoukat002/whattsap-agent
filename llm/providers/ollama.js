const http = require('http');

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.LLM_MODEL || 'qwen2.5:3b';

async function generateOllamaReply({ systemPrompt, customerMessage }) {
  const body = JSON.stringify({
    model: OLLAMA_MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: customerMessage },
    ],
    stream: false,
    options: {
      temperature: Number(process.env.LLM_TEMPERATURE || 0.4),
      num_predict: Number(process.env.LLM_MAX_OUTPUT_TOKENS || 300),
    },
  });

  return new Promise((resolve, reject) => {
    const url = new URL('/api/chat', OLLAMA_BASE_URL);
    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port || 11434,
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      },
      res => {
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            const text = parsed?.message?.content?.trim();
            if (!text) return reject(new Error('Ollama returned empty reply'));
            resolve(text);
          } catch (err) {
            reject(new Error(`Ollama response parse error: ${err.message}`));
          }
        });
      }
    );
    req.on('error', err => reject(new Error(`Ollama connection error: ${err.message}`)));
    req.write(body);
    req.end();
  });
}

module.exports = { generateOllamaReply };
