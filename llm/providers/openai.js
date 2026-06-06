async function generateOpenAIReply({ systemPrompt, customerMessage }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is required when LLM_PROVIDER=openai');
  }

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.LLM_MODEL || 'gpt-4.1-mini',
      temperature: Number(process.env.LLM_TEMPERATURE || 0.4),
      max_output_tokens: Number(process.env.LLM_MAX_OUTPUT_TOKENS || 300),
      text: {
        format: {
          type: 'text',
        },
      },
      input: [
        {
          role: 'system',
          content: [
            {
              type: 'input_text',
              text: systemPrompt,
            },
          ],
        },
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: customerMessage,
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI request failed with status ${response.status}: ${await response.text()}`);
  }

  const data = await response.json();
  const replyText = data.output_text?.trim() || extractOpenAIText(data);

  if (!replyText) {
    throw new Error('OpenAI returned an empty reply');
  }

  return replyText;
}

function extractOpenAIText(data) {
  if (!Array.isArray(data.output)) return '';

  return data.output
    .flatMap(item => item.content || [])
    .filter(item => item.type === 'output_text')
    .map(item => item.text || '')
    .join('\n')
    .trim();
}

module.exports = {
  generateOpenAIReply,
};
