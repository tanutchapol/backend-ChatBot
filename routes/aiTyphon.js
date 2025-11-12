/**
 * aiTyphonRouter.js
 * Route สำหรับ proxy, text generation และ chat completions ผ่าน Typhon API
 */

const express = require('express');
const router = express.Router();
const {
  proxyRequest,
  generateText,
  chatCompletions,
} = require('../services/aiTyphonService');
const { verifyToken } = require('../services/authService');
const { appendChatEntries } = require('../services/chatLogService');

// Helper: จัดการ error แบบรวม
const handleError = (res, err, statusOverride) => {
  const status = statusOverride || err.status || 500;
  console.error('❌ Typhon Error:', err.message);
  res.status(status).json({
    success: false,
    error: err.message,
    upstream: err.data || null,
    attempts: err.attempts || null,
  });
};

// 🩵 Ping เพื่อตรวจสอบ config
router.get('/ping', (req, res) => {
  const info = {
    hasBaseUrl: !!process.env.AITYPHON_BASE_URL,
    hasApiKey: !!process.env.AITYPHON_API_KEY,
    model: process.env.AITYPHON_MODEL || 'default-model',
  };

  if (!info.hasBaseUrl || !info.hasApiKey) {
    return res.status(400).json({
      success: false,
      message: '❌ Missing Typhon config',
      info,
      requiredEnv: ['AITYPHON_BASE_URL', 'AITYPHON_API_KEY'],
    });
  }

  res.json({ success: true, message: '✅ Typhon config ready', info });
});

// ✨ Text Generation (ข้อความทั่วไป)
router.post('/generate', async (req, res) => {
  try {
    const { prompt, options } = req.body || {};
    if (!prompt) {
      return res.status(400).json({
        success: false,
        error: 'Missing prompt',
        example: { prompt: 'Write a poem about technology' },
      });
    }

    const result = await generateText(prompt, options);
    res.json({ success: true, result });
  } catch (err) {
    handleError(res, err);
  }
});

// 💬 Chat Completions (เหมือน OpenAI)
router.post('/chat', async (req, res) => {
  try {
    const payload = req.body || {};
    if (!payload || (!Array.isArray(payload.messages) && !payload.prompt)) {
      return res.status(400).json({
        success: false,
        error: 'Body must include messages[] or prompt',
        example: {
          model:
            process.env.AITYPHON_MODEL ||
            'typhoon-v2.5-30b-a3b-instruct',
          messages: [{ role: 'user', content: 'Say hello in Thai' }],
          temperature: 0.7,
          max_tokens: 2048,
          top_p: 0.9,
          repetition_penalty: 1.1,
          stream: false,
        },
      });
    }

    const result = await chatCompletions(payload);
    res.json({
      success: true,
      pathUsed: result.pathUsed,
      result: result.data,
    });
  } catch (err) {
    handleError(res, err);
  }
});

// 🔄 Generic Proxy
router.post('/proxy', async (req, res) => {
  try {
    const { method = 'POST', path = '/', data, params } = req.body || {};
    if (!path.startsWith('/')) {
      return res
        .status(400)
        .json({ success: false, error: 'Path must start with "/"' });
    }

    const result = await proxyRequest(method, path, data, params);
    res.json({ success: true, result });
  } catch (err) {
    handleError(res, err);
  }
});

// 🚫 GET /proxy → แจ้งวิธีใช้ที่ถูกต้อง
router.get('/proxy', (req, res) => {
  res.status(405).json({
    success: false,
    message: 'Use POST /ai-typhon/proxy with JSON body',
    howTo: 'Send method, path, data, params in JSON body',
    example: {
      method: 'POST',
      path: '/v1/chat/completions',
      data: {
        model: process.env.AITYPHON_MODEL || 'your-model',
        messages: [{ role: 'user', content: 'Say hello in Thai' }],
      },
    },
  });
});

module.exports = router;

// ----------------------------
// Session-based chat endpoints
// ----------------------------
// Simple in-memory session store: Map<sessionId, messages[]>
// Each message: { role: 'system'|'user'|'assistant', content: string }
const sessions = new Map();
function requireAuth(req, res, next) {
  const h = req.headers['authorization'] || req.headers['Authorization'];
  let token = null;
  if (h && typeof h === 'string' && h.startsWith('Bearer ')) token = h.substring(7).trim();
  if (!token && req.headers['x-auth-token']) token = String(req.headers['x-auth-token']).trim();
  const user = verifyToken(token);
  if (!user) return res.status(401).json({ success: false, error: 'Unauthorized' });
  req.user = user;
  next();
}

function getSessionMessages(sessionId) {
  if (!sessions.has(sessionId)) sessions.set(sessionId, []);
  return sessions.get(sessionId);
}

function extractAssistantText(apiResponse) {
  // Try OpenAI-like shape first
  if (apiResponse && Array.isArray(apiResponse.choices) && apiResponse.choices[0]) {
    const msg = apiResponse.choices[0].message;
    if (msg && typeof msg.content === 'string') return msg.content;
  }
  // Fallbacks (extend here if provider returns different shapes)
  if (apiResponse && typeof apiResponse.output_text === 'string') return apiResponse.output_text;
  if (apiResponse && typeof apiResponse.text === 'string') return apiResponse.text;
  return '';
}

// POST /ai-typhon/session/:id/message
// Body: { content: string, system?: string, model?, temperature?, max_tokens?, top_p?, repetition_penalty?, stream? }
router.post('/session/:id/message', requireAuth, async (req, res) => {
  const sessionId = req.params.id;
  const {
    content,
    role = 'user',
    system,
    model,
    temperature,
    max_tokens,
    top_p,
    repetition_penalty,
    stream,
  } = req.body || {};

  if (!content || typeof content !== 'string') {
    return res.status(400).json({ success: false, error: 'content is required (string)' });
  }

  try {
    const messages = getSessionMessages(sessionId);
    // Inject system prompt once at the beginning if provided and not already set
    if (system && !messages.find(m => m.role === 'system')) {
      messages.push({ role: 'system', content: system });
    }
    // Add user (or specified role) message
    messages.push({ role, content });

    const options = { model, temperature, max_tokens, top_p, repetition_penalty, stream };
    // Build payload with full history
    const payload = {
      model: model || process.env.AITYPHON_MODEL,
      messages,
      temperature,
      max_tokens,
      top_p,
      repetition_penalty,
      stream,
    };

    const result = await chatCompletions(payload);
    const reply = extractAssistantText(result.data);
    if (reply) {
      messages.push({ role: 'assistant', content: reply });
    }

    // Persist to Google Sheets (best-effort)
    try {
      const timestamp = new Date().toISOString();
      const userId = (req.user && (req.user.id || req.user.name || req.user.pin)) || '';
      const modelUsed = payload.model || process.env.AITYPHON_MODEL || '';
      const pathUsed = result.pathUsed || '';
      await appendChatEntries([
        { timestamp, sessionId, userId, role: role, content, model: modelUsed, pathUsed },
        { timestamp: new Date().toISOString(), sessionId, userId, role: 'assistant', content: reply, model: modelUsed, pathUsed },
      ]);
    } catch (e) {
      console.warn('⚠️  Failed to append chat entries to Google Sheets:', e.message);
    }

    res.json({
      success: true,
      sessionId,
      pathUsed: result.pathUsed,
      reply,
      historySize: messages.length,
      raw: result.data,
    });
  } catch (err) {
    handleError(res, err);
  }
});

// GET /ai-typhon/session/:id/history
router.get('/session/:id/history', requireAuth, (req, res) => {
  const sessionId = req.params.id;
  const messages = getSessionMessages(sessionId);
  res.json({ success: true, sessionId, messages });
});

// DELETE /ai-typhon/session/:id (clear session)
router.delete('/session/:id', requireAuth, (req, res) => {
  const sessionId = req.params.id;
  const existed = sessions.delete(sessionId);
  res.json({ success: true, sessionId, cleared: existed });
});
