const { google } = require('googleapis');

// ตั้งค่า Google Sheets API client
const auth = new google.auth.GoogleAuth({
  keyFile: 'credentials.json',
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth });

// ฟังก์ชันอ่านข้อมูลจาก Google Sheets
async function readSheetData(spreadsheetId, range) {
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
  });
  return response.data.values;
}

// ฟังก์ชันเขียนข้อมูลลง Google Sheets
async function writeSheetData(spreadsheetId, range, values) {
  const response = await sheets.spreadsheets.values.update({
    spreadsheetId,
    range,
    valueInputOption: 'USER_ENTERED',
    resource: { values },
  });
  return response.data;
}

// ฟังก์ชันเพิ่มข้อมูลต่อท้าย Google Sheets
async function appendSheetData(spreadsheetId, range, values) {
  const response = await sheets.spreadsheets.values.append({
    spreadsheetId,
    range,
    valueInputOption: 'USER_ENTERED',
    resource: { values },
  });
  return response.data;
}

module.exports = {
  readSheetData,
  writeSheetData,
  appendSheetData,
};
