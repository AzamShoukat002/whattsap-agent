const Anthropic = require('@anthropic-ai/sdk').default;

function getAnthropicClient() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is required when LLM_PROVIDER=anthropic');
  }

  return new Anthropic({ apiKey });
}

async function generateAnthropicReply({ systemPrompt, customerMessage }) {
  const client = getAnthropicClient();
  const response = await client.messages.create({
    model: process.env.LLM_MODEL || 'claude-sonnet-4-20250514',
    max_tokens: Number(process.env.LLM_MAX_OUTPUT_TOKENS || 300),
    temperature: Number(process.env.LLM_TEMPERATURE || 0.4),
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: customerMessage,
      },
    ],
  });

  const replyText = response.content.find(item => item.type === 'text')?.text?.trim();
  if (!replyText) {
    throw new Error('Anthropic returned an empty reply');
  }

  return replyText;
}

module.exports = {
  generateAnthropicReply,
};
