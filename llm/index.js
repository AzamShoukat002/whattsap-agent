const { generateAnthropicReply } = require('./providers/anthropic');
const { generateOpenAIReply } = require('./providers/openai');
const { generateGeminiReply } = require('./providers/gemini');
const { generateOllamaReply } = require('./providers/ollama');

function getLlmProvider() {
  return (process.env.LLM_PROVIDER || 'anthropic').toLowerCase();
}

async function generateTextReply({ systemPrompt, customerMessage }) {
  const provider = getLlmProvider();

  if (provider === 'ollama') {
    return generateOllamaReply({ systemPrompt, customerMessage });
  }

  if (provider === 'openai') {
    return generateOpenAIReply({ systemPrompt, customerMessage });
  }

  if (provider === 'gemini' || provider === 'google') {
    return generateGeminiReply({ systemPrompt, customerMessage });
  }

  return generateAnthropicReply({ systemPrompt, customerMessage });
}

module.exports = {
  generateTextReply,
  getLlmProvider,
};
