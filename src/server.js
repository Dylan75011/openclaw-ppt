// Luna PPT 生成服务
const express = require('express');
const path = require('path');
const fs = require('fs');
const config = require('./config');
const routes = require('./routes');
const browserBridge = require('./services/browserBridge');

// 加载环境变量
require('dotenv').config();

const app = express();

// 中间件
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// 静态文件
app.use(express.static(path.join(__dirname, '../public')));
app.use('/output', express.static(path.resolve('./output')));

// API路由
app.use('/api', routes);

// 浏览器桥状态探测端点
app.get('/api/browser-bridge/status', (req, res) => {
  res.json(browserBridge.status());
});

// 浏览器桥最近 op 调试端点：看每个 op 用了多久 / 是否还在卡
// 输出按时间倒序，inFlight=true 的就是还没回的；卡死的能看到 elapsedMs 已经几十秒
app.get('/api/browser-bridge/debug', (req, res) => {
  res.json({ recent: browserBridge.recent() });
});

// 小红书图片代理：xhs CDN 校验 Referer，浏览器从 luna webapp origin 直加载会 403
// 这里 Node 后端用 `Referer: xiaohongshu.com` 拉图，把字节流回前端 <img>
// 用 allowlist 防开放代理风险
const XHS_IMAGE_HOSTS = [/(?:^|\.)xhscdn\.com$/i, /(?:^|\.)xiaohongshu\.com$/i];
const XHS_IMAGE_MAX_BYTES = 8 * 1024 * 1024;
const XHS_IMAGE_TIMEOUT_MS = 15_000;

app.get('/api/xhs-image', async (req, res) => {
  const url = String(req.query.url || '').trim();
  if (!url) {
    res.status(400).json({ error: 'url required' });
    return;
  }
  let parsed;
  try { parsed = new URL(url); }
  catch {
    res.status(400).json({ error: 'invalid url' });
    return;
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    res.status(400).json({ error: 'protocol not allowed' });
    return;
  }
  if (!XHS_IMAGE_HOSTS.some((re) => re.test(parsed.hostname))) {
    res.status(403).json({ error: 'host not allowed' });
    return;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), XHS_IMAGE_TIMEOUT_MS);
  try {
    const upstream = await fetch(url, {
      headers: {
        'Referer': 'https://www.xiaohongshu.com/',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'
      },
      signal: controller.signal
    });
    clearTimeout(timer);
    if (!upstream.ok) {
      res.status(upstream.status).json({ error: `upstream HTTP ${upstream.status}` });
      return;
    }
    const contentLength = parseInt(upstream.headers.get('content-length') || '0', 10);
    if (contentLength && contentLength > XHS_IMAGE_MAX_BYTES) {
      res.status(413).json({ error: 'image too large' });
      return;
    }
    const buf = Buffer.from(await upstream.arrayBuffer());
    if (buf.length > XHS_IMAGE_MAX_BYTES) {
      res.status(413).json({ error: 'image too large' });
      return;
    }
    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'image/webp');
    // 浏览器端缓存 10 分钟，避免同一张图反复打 xhs CDN（CDN URL 短期签名也大致这个量级）
    res.setHeader('Cache-Control', 'public, max-age=600');
    res.send(buf);
  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') {
      res.status(504).json({ error: 'upstream timeout' });
      return;
    }
    console.warn('[xhs-image] fetch failed:', url.slice(-60), err.message);
    res.status(502).json({ error: err.message });
  }
});

// 启动浏览器桥 WebSocket 服务器（端口可通过 BROWSER_BRIDGE_PORT 覆盖）
browserBridge.start({ port: parseInt(process.env.BROWSER_BRIDGE_PORT || '3399', 10) });

// 确保输出目录存在
const outputDir = path.resolve(config.outputDir);
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
  console.log(`创建输出目录: ${outputDir}`);
}

// 确保 data/docs 目录存在
const dataDir = path.resolve('./data/docs');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
  console.log(`创建数据目录: ${dataDir}`);
}

// 主页
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// 启动服务
const PORT = config.port;
const HOST = process.env.HOST || '0.0.0.0';
app.listen(PORT, HOST, () => {
  console.log(`
╔═══════════════════════════════════════════════╗
║                                               ║
║   Luna PPT 服务已启动                      ║
║                                               ║
║   本地访问: http://localhost:${PORT}             ║
║   IPv4访问: http://127.0.0.1:${PORT}           ║
║   API状态:  http://localhost:${PORT}/api/health ║
║                                               ║
║   按 Ctrl+C 停止服务                          ║
║                                               ║
╚═══════════════════════════════════════════════╝
  `);
});

module.exports = app;
