require('dotenv').config();
const express = require('express');
const app = express();
const port = process.env.PORT || 3000; // พอร์ตที่เซิร์ฟเวอร์จะรัน

app.use(express.json());

// เส้นทางพื้นฐาน
app.get('/', (req, res) => {
  res.send('Google Sheets API Server - ใช้งานได้แล้ว!');
});

// ติดตั้ง Routers
const healthRouter = require('./routes/health');
const sheetsRouter = require('./routes/sheets');
const aiTyphonRouter = require('./routes/aiTyphon');
const authRouter = require('./routes/auth');

app.use('/', healthRouter);
app.use('/', sheetsRouter); // คง path เดิม เช่น /read, /write, /append, /test-connection
app.use('/ai-typhon', aiTyphonRouter); // กลุ่มเส้นทางของ Typhon AI
app.use('/auth', authRouter); // ระบบ PIN Login

// สั่งให้เซิร์ฟเวอร์เริ่มทำงาน
app.listen(port, () => {
  console.log(`\n🚀 เซิร์ฟเวอร์กำลังรันที่ http://localhost:${port}\n`);
  console.log('📋 API Endpoints:');
  console.log('  GET  /health          - ตรวจสุขภาพเซิร์ฟเวอร์');
  console.log('  GET  /test-connection - ทดสอบการเชื่อมต่อ Google Sheets');
  console.log('  GET  /read            - อ่านข้อมูลจาก Google Sheets');
  console.log('  POST /write           - เขียนข้อมูลลง Google Sheets');
  console.log('  POST /append          - เพิ่มข้อมูลต่อท้าย Google Sheets');
  console.log('  GET  /ai-typhon/ping  - ตรวจ config ของ Typhon AI');
  console.log('  POST /ai-typhon/generate - ตัวอย่าง generate ข้อความ');
  console.log('  POST /ai-typhon/proxy - Proxy เรียก Typhon API ใดๆ');
  console.log('  POST /ai-typhon/chat  - Chat completions (payload ตรง)');
  console.log('  POST /ai-typhon/session/:id/message - ส่งข้อความเข้า session แล้วให้ AI ตอบ');
  console.log('  GET  /ai-typhon/session/:id/history - ดูประวัติแชท');
  console.log('  DELETE /ai-typhon/session/:id       - ล้างประวัติแชท');
  console.log('  POST /auth/pin/login     - เข้าสู่ระบบด้วย PIN 6 หลักจาก Google Sheet');
  console.log('  GET  /auth/me            - ดูข้อมูลผู้ใช้จาก token');
  console.log('  POST /auth/logout        - ออกจากระบบ (revoke token)');
  console.log('\n💡 เริ่มต้นทดสอบที่: http://localhost:' + port + '/test-connection\n');
});