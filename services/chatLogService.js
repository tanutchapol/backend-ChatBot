const { appendSheetData } = require('./sheetsService');

const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID;
const CHAT_SHEET_NAME = process.env.CHAT_SHEET_NAME || 'Chats';

function ensureConfigured() {
  if (!SPREADSHEET_ID) throw new Error('GOOGLE_SPREADSHEET_ID is not set in .env');
}

// entry: { timestamp, sessionId, userId, role, content, model, pathUsed }
async function appendChatEntries(entries = []) {
  ensureConfigured();
  if (!Array.isArray(entries) || entries.length === 0) return { appended: 0 };
  const values = entries.map(e => [
    e.timestamp || new Date().toISOString(),
    e.sessionId || '',
    e.userId || '',
    e.role || '',
    e.content || '',
    e.model || '',
    e.pathUsed || '',
  ]);
  const range = `${CHAT_SHEET_NAME}!A:G`;
  const result = await appendSheetData(SPREADSHEET_ID, range, values);
  return { appended: values.length, result };
}

module.exports = {
  appendChatEntries,
};
