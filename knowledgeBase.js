const fs = require('fs');
const path = require('path');
const logger = require('pino')();

const DATA_DIR = path.join(__dirname, 'data');
let cachedKnowledgeBase = '';
let lastLoadTime = 0;
const RELOAD_INTERVAL = 10 * 60 * 1000; // 10 minutes

function loadAllDataFiles() {
  try {
    const files = fs.readdirSync(DATA_DIR).filter(file => file.endsWith('.json'));
    let formattedData = '';

    for (const file of files) {
      try {
        const filePath = path.join(DATA_DIR, file);
        const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        formattedData += `\n## ${file.replace('.json', '').toUpperCase()}\n`;
        formattedData += JSON.stringify(content, null, 2);
      } catch (err) {
        logger.warn({ file, error: err.message }, 'Failed to load data file');
      }
    }

    cachedKnowledgeBase = formattedData;
    lastLoadTime = Date.now();
    logger.info('Knowledge base loaded successfully');
    return formattedData;
  } catch (err) {
    logger.error({ error: err.message }, 'Error loading knowledge base');
    return cachedKnowledgeBase;
  }
}

function getKnowledgeBase() {
  const now = Date.now();
  if (now - lastLoadTime > RELOAD_INTERVAL) {
    logger.info('Reloading knowledge base (10-minute interval)');
    loadAllDataFiles();
  }
  return cachedKnowledgeBase;
}

function reloadKnowledgeBase() {
  logger.info('Manual knowledge base reload triggered');
  return loadAllDataFiles();
}

// Initial load on module import
loadAllDataFiles();

module.exports = {
  getKnowledgeBase,
  reloadKnowledgeBase,
};
