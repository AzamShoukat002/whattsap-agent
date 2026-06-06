async function generateGeminiReply({ systemPrompt, customerMessage }) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY or GOOGLE_API_KEY is required when LLM_PROVIDER=gemini');
  }

  const model = process.env.LLM_MODEL || 'gemini-2.5-flash';
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: {
      'x-goog-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      system_instruction: {
        parts: [
          {
            text: systemPrompt,
          },
        ],
      },
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: customerMessage,
            },
          ],
        },
      ],
      generationConfig: {
        temperature: Number(process.env.LLM_TEMPERATURE || 0.4),
        maxOutputTokens: Number(process.env.LLM_MAX_OUTPUT_TOKENS || 300),
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Gemini request failed with status ${response.status}: ${await response.text()}`);
  }

  const data = await response.json();
  const replyText = data.candidates?.[0]?.content?.parts?.map(part => part.text || '').join('\n').trim();

  if (!replyText) {
    throw new Error('Gemini returned an empty reply');
  }

  return replyText;
}

module.exports = {
  generateGeminiReply,
};
