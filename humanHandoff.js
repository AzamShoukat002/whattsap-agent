const logger = require('pino')();

const handoffSet = new Set();

const HANDOFF_PHRASES = [
  'need human',
  'human agent',
  'real person',
  'talk to human',
  'talk to a human',
  'speak to human',
  'speak to a human',
  'speak to someone',
  'connect me to human',
  'connect me to a human',
  'live agent',
  'talk to agent',
  'talk to a real person',
  'customer support agent',
  'human support',
  'manual support',
  'banda chahiye',
  'insan se baat',
  'representative chahiye',
];

function shouldHandoff(messageContent) {
  const lowerContent = messageContent.toLowerCase();
  return HANDOFF_PHRASES.some(phrase => lowerContent.includes(phrase));
}

function isHandedOff(phoneNumber) {
  return handoffSet.has(phoneNumber);
}

function addToHandoff(phoneNumber) {
  handoffSet.add(phoneNumber);
  logger.info({ phoneNumber }, 'Customer added to handoff set');
}

function removeFromHandoff(phoneNumber) {
  handoffSet.delete(phoneNumber);
  logger.info({ phoneNumber }, 'Customer removed from handoff set');
}

async function handleHandoff(client, customerJid, ownerNumber, normalizedPhoneNumber) {
  try {
    const customerMessage = "Let me connect you with our team, they'll be with you shortly!";
    await client.sendMessage(customerJid, { text: customerMessage });

    const ownerAlert = `Customer ${normalizedPhoneNumber} needs human support. Please respond.`;
    await client.sendMessage(ownerNumber, { text: ownerAlert });

    addToHandoff(normalizedPhoneNumber);

    logger.info({ phoneNumber: normalizedPhoneNumber, ownerNumber }, 'Handoff triggered');
  } catch (err) {
    logger.error({ phoneNumber: normalizedPhoneNumber, error: err.message }, 'Error handling handoff');
  }
}

module.exports = {
  shouldHandoff,
  isHandedOff,
  addToHandoff,
  removeFromHandoff,
  handleHandoff,
};
