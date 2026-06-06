const fs = require('fs');
const path = require('path');
const logger = require('pino')();

const SESSIONS_DIR = path.join(__dirname, 'sessions');
const MAX_MESSAGES = 20;

// Ensure sessions directory exists
if (!fs.existsSync(SESSIONS_DIR)) {
  fs.mkdirSync(SESSIONS_DIR, { recursive: true });
}

function getSessionFilePath(phoneNumber) {
  // Sanitize phone number for filename
  const sanitized = phoneNumber.replace(/[^0-9]/g, '');
  return path.join(SESSIONS_DIR, `${sanitized}.json`);
}

function getHistory(phoneNumber) {
  try {
    const filePath = getSessionFilePath(phoneNumber);
    if (!fs.existsSync(filePath)) {
      return [];
    }
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    return data.messages || [];
  } catch (err) {
    logger.warn({ phoneNumber, error: err.message }, 'Error reading session history');
    return [];
  }
}

function saveMessage(phoneNumber, role, content) {
  try {
    const filePath = getSessionFilePath(phoneNumber);
    let sessionData = { phoneNumber, messages: [] };

    if (fs.existsSync(filePath)) {
      sessionData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }

    // Add new message
    sessionData.messages.push({
      role,
      content,
      timestamp: new Date().toISOString(),
    });

    // Keep only last MAX_MESSAGES
    if (sessionData.messages.length > MAX_MESSAGES) {
      sessionData.messages = sessionData.messages.slice(-MAX_MESSAGES);
    }

    fs.writeFileSync(filePath, JSON.stringify(sessionData, null, 2));
    logger.debug({ phoneNumber, role }, 'Message saved to session');
  } catch (err) {
    logger.error({ phoneNumber, error: err.message }, 'Error saving message to session');
  }
}

function clearHistory(phoneNumber) {
  try {
    const filePath = getSessionFilePath(phoneNumber);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      logger.info({ phoneNumber }, 'Session history cleared');
    }
  } catch (err) {
    logger.error({ phoneNumber, error: err.message }, 'Error clearing session history');
  }
}

function getAllSessions() {
  try {
    const files = fs.readdirSync(SESSIONS_DIR).filter(f => f.endsWith('.json'));
    const sessions = [];
    for (const file of files) {
      const filePath = path.join(SESSIONS_DIR, file);
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      sessions.push({
        phoneNumber: data.phoneNumber,
        messageCount: data.messages.length,
        lastMessage: data.messages.length > 0 ? data.messages[data.messages.length - 1].timestamp : null,
      });
    }
    return sessions;
  } catch (err) {
    logger.error({ error: err.message }, 'Error listing all sessions');
    return [];
  }
}

module.exports = {
  getHistory,
  saveMessage,
  clearHistory,
  getAllSessions,
};
