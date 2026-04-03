// Brain Agent 路由
const express = require('express');
const router  = express.Router();
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const agentSession = require('../services/agentSession');
const brainAgent   = require('../agents/brainAgent');
const { executeTool } = require('../services/toolRegistry');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024, files: 4 }
});

function safeJsonParse(value, fallback = {}) {
  if (!value) return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function ensureAgentImageDir() {
  const dir = path.resolve('./output/agent-inputs');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function toPublicAttachments(attachments = []) {
  return attachments.map((item) => ({
    id: item.id,
    name: item.name,
    mimeType: item.mimeType,
    size: item.size,
    url: item.url
  }));
}

async function persistUploadedImages(files = []) {
  if (!Array.isArray(files) || files.length === 0) return [];
  const outputDir = ensureAgentImageDir();
  const attachments = [];

  for (const file of files) {
    if (!String(file.mimetype || '').startsWith('image/')) {
      throw new Error(`仅支持图片文件，收到：${file.originalname || file.mimetype}`);
    }
    const ext = path.extname(file.originalname || '').toLowerCase()
      || (file.mimetype === 'image/png' ? '.png'
        : file.mimetype === 'image/webp' ? '.webp'
        : '.jpg');
    const baseName = path.basename(file.originalname || `image${ext}`, ext).replace(/[^\w\u4e00-\u9fa5-]+/g, '_').slice(0, 40) || 'image';
    const fileName = `agent_${Date.now()}_${Math.random().toString(16).slice(2, 8)}_${baseName}${ext}`;
    const localPath = path.join(outputDir, fileName);
    await fs.promises.writeFile(localPath, file.buffer);
    attachments.push({
      id: `att_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
      name: file.originalname || fileName,
      mimeType: file.mimetype || 'image/jpeg',
      size: file.size || 0,
      url: `/output/agent-inputs/${fileName}`,
      localPath
    });
  }

  return attachments;
}

/**
 * POST /api/agent/start
 * 用户发送新消息，启动 Brain 循环
 */
router.post('/start', upload.array('images', 4), async (req, res) => {
  try {
    const { message, spaceId, sessionId: existingSessionId } = req.body;
    const apiKeys = safeJsonParse(req.body.apiKeys, {});
    const attachments = await persistUploadedImages(req.files || []);

    if ((!message || !message.trim()) && attachments.length === 0) {
      return res.status(400).json({ success: false, message: '消息或图片不能为空' });
    }

    // 如果传入了 sessionId 且 session 处于可复用状态，继续使用该 session
    let session = null;
    if (existingSessionId) {
      const existing = agentSession.getSession(existingSessionId);
      if (existing && (existing.status === 'idle' || existing.status === 'failed')) {
        session = existing;
        session.stopRequested = false;
        session.doneEmitted = false;
        session.eventBacklog = [];
        if (apiKeys) Object.assign(session.apiKeys, apiKeys);
      }
    }

    if (!session) {
      session = agentSession.createSession({
        apiKeys: apiKeys || {},
        spaceId: spaceId || ''
      });
    }

    const onEvent = (eventType, data) => {
      if (eventType === 'done') session.doneEmitted = true;
      agentSession.pushEvent(session.sessionId, eventType, data);
    };

    brainAgent.run(session, message?.trim() || '', onEvent, { attachments }).catch(err => {
      console.error('[agent/start] error:', err);
      agentSession.pushEvent(session.sessionId, 'error', { message: err.message });
      session.status = 'failed';
    });

    res.json({
      success: true,
      sessionId: session.sessionId,
      streamUrl: `/api/agent/stream/${session.sessionId}`,
      attachments: toPublicAttachments(attachments)
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || '启动失败' });
  }
});

/**
 * GET /api/agent/stream/:sessionId   (SSE)
 * 订阅会话的实时事件流
 */
router.get('/stream/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  const session = agentSession.getSession(sessionId);

  if (!session) {
    return res.status(404).json({ success: false, message: '会话不存在' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  agentSession.addSseClient(sessionId, res);

  // 心跳保活
  const heartbeat = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, 20000);

  req.on('close', () => {
    clearInterval(heartbeat);
    agentSession.removeSseClient(sessionId, res);
  });
});

/**
 * POST /api/agent/:sessionId/reply
 * 用户回答了 ask_user 的问题，恢复 Brain 循环
 */
router.post('/:sessionId/reply', upload.array('images', 4), async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { reply } = req.body;
    const apiKeys = safeJsonParse(req.body.apiKeys, {});
    const attachments = await persistUploadedImages(req.files || []);

    const session = agentSession.getSession(sessionId);
    if (!session) {
      return res.status(404).json({ success: false, message: '会话不存在' });
    }
    if (session.status !== 'waiting_for_user') {
      return res.status(400).json({ success: false, message: `会话状态不正确：${session.status}` });
    }
    if ((!reply || !reply.trim()) && attachments.length === 0) {
      return res.status(400).json({ success: false, message: '回复或图片不能为空' });
    }

    if (apiKeys) Object.assign(session.apiKeys, apiKeys);
    session.stopRequested = false;

    session.eventBacklog = [];

    const onEvent = (eventType, data) => {
      if (eventType === 'done') session.doneEmitted = true;
      agentSession.pushEvent(sessionId, eventType, data);
    };

    brainAgent.resume(session, reply?.trim() || '', onEvent, { attachments }).catch(err => {
      console.error('[agent/reply] error:', err);
      agentSession.pushEvent(sessionId, 'error', { message: err.message });
      session.status = 'failed';
    });

    res.json({
      success: true,
      streamUrl: `/api/agent/stream/${sessionId}`,
      attachments: toPublicAttachments(attachments)
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || '回复失败' });
  }
});

router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ success: false, message: `图片上传失败：${err.message}` });
  }
  if (err) {
    return res.status(500).json({ success: false, message: err.message || '请求处理失败' });
  }
  return next();
});

/**
 * POST /api/agent/:sessionId/build-ppt
 * 基于当前会话里已确认的策划文档生成 PPT
 */
router.post('/:sessionId/build-ppt', (req, res) => {
  const { sessionId } = req.params;
  const { docContent, apiKeys } = req.body || {};
  const session = agentSession.getSession(sessionId);

  if (!session) {
    return res.status(404).json({ success: false, message: '会话不存在' });
  }
  if (!session.bestPlan || !session.userInput) {
    return res.status(400).json({ success: false, message: '当前会话还没有可用于生成 PPT 的方案文档' });
  }

  if (apiKeys) Object.assign(session.apiKeys, apiKeys);
  if (typeof docContent === 'string' && docContent.trim()) {
    session.docHtml = docContent;
  }

  const onEvent = (eventType, data) => {
    if (eventType === 'done') session.doneEmitted = true;
    agentSession.pushEvent(sessionId, eventType, data);
  };

  session.status = 'running';
  session.doneEmitted = false;
  session.stopRequested = false;

  executeTool('build_ppt', { note: session.docHtml || '' }, session, onEvent)
    .then(() => {
      if (session.status === 'running') {
        session.status = 'idle';
      }
    })
    .catch((err) => {
      console.error('[agent/build-ppt] error:', err);
      agentSession.pushEvent(sessionId, 'error', { message: err.message });
      session.status = 'failed';
    });

  res.json({
    success: true,
    streamUrl: `/api/agent/stream/${sessionId}`
  });
});

/**
 * POST /api/agent/:sessionId/stop
 * 停止当前会话
 */
router.post('/:sessionId/stop', (req, res) => {
  const { sessionId } = req.params;
  const session = agentSession.getSession(sessionId);

  if (session) {
    session.stopRequested = true;
    session.status = 'idle';
    session.doneEmitted = true;
    session.eventBacklog = [];
    agentSession.pushEvent(sessionId, 'error', { message: '用户已停止任务' });
  }

  res.json({ success: true });
});

module.exports = router;
