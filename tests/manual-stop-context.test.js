const { chromium } = require('@playwright/test');
const { spawn } = require('child_process');
const http = require('http');

const PORT = Number(process.env.TEST_PORT || 3100 + Math.floor(Math.random() * 200));
const BASE_URL = `http://localhost:${PORT}`;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function httpRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const req = http.request(`${BASE_URL}${path}`, {
      method,
      headers: payload ? {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      } : {}
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data || '{}'));
        } catch (error) {
          reject(error);
        }
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function checkServer() {
  try {
    const health = await httpRequest('GET', '/api/health');
    return !!health?.success;
  } catch {
    return false;
  }
}

async function startServer() {
  const server = spawn('node', ['src/server.js'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(PORT),
      OPENCLAW_MOCK_AGENT_HOLD: '1'
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  server.stdout.on('data', (data) => process.stdout.write(data.toString()));
  server.stderr.on('data', (data) => process.stderr.write(data.toString()));

  for (let i = 0; i < 20; i += 1) {
    if (await checkServer()) return server;
    await wait(500);
  }

  server.kill();
  throw new Error('测试服务启动失败');
}

function stopServer(server) {
  return new Promise((resolve) => {
    if (!server || server.killed) {
      resolve();
      return;
    }
    server.once('exit', () => resolve());
    server.kill('SIGTERM');
    setTimeout(resolve, 2000);
  });
}

async function ensureWorkspace() {
  const tree = await httpRequest('GET', '/api/workspace');
  const spaces = tree?.data?.spaces || [];
  if (spaces.length) return spaces[0].id;

  const created = await httpRequest('POST', '/api/workspace/space', { name: '回归测试空间' });
  return created?.node?.id;
}

async function runTest() {
  let server = await startServer();
  const spaceId = await ensureWorkspace();
  if (!spaceId) throw new Error('未能创建测试工作空间');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const startPayloads = [];
  const startResponses = [];

  page.on('request', async (request) => {
    if (!request.url().includes('/api/agent/start') || request.method() !== 'POST') return;
    const form = request.postData() || '';
    const sessionIdMatch = form.match(/name="sessionId"\r\n\r\n([^\r\n]+)/);
    const messageMatch = form.match(/name="message"\r\n\r\n([^\r\n]*)/);
    startPayloads.push({
      sessionId: sessionIdMatch ? sessionIdMatch[1] : '',
      message: messageMatch ? messageMatch[1] : ''
    });
  });

  page.on('response', async (response) => {
    if (!response.url().includes('/api/agent/start')) return;
    try {
      startResponses.push(await response.json());
    } catch {}
  });

  try {
    await page.goto(`${BASE_URL}/#/agent`, { waitUntil: 'networkidle' });
    await page.waitForSelector('textarea', { timeout: 10000 });

    await page.evaluate((targetSpaceId) => {
      const match = [...document.querySelectorAll('.arco-select-option')].find((item) => item.getAttribute('data-value') === targetSpaceId);
      if (match) match.click();
    }, spaceId).catch(() => {});

    const textarea = page.locator('textarea').first();
    const sendBtn = page.locator('.send-btn');

    await textarea.fill('第一轮需求，用于建立上下文');
    await sendBtn.click();

    await page.waitForSelector('.stop-btn', { timeout: 10000 });
    await page.waitForTimeout(500);

    if (!startResponses[0]?.sessionId) {
      throw new Error('第一次发送后未拿到 sessionId');
    }

    await page.locator('.stop-btn').click();
    await page.waitForFunction(() => document.body.innerText.includes('已终止当前任务。'), { timeout: 10000 });

    await textarea.fill('继续补充第二轮需求');
    await sendBtn.click();

    await page.waitForFunction(() => document.querySelectorAll('.bubble-wrap.user').length >= 2, { timeout: 10000 });
    await page.waitForTimeout(800);

    const firstSessionId = startResponses[0].sessionId;
    const secondPayload = startPayloads[1];
    const secondResponse = startResponses[1];

    if (!secondPayload) {
      throw new Error('未捕获到第二次 /api/agent/start 请求');
    }
    if (secondPayload.sessionId !== firstSessionId) {
      throw new Error(`上下文未复用：第二次请求 sessionId=${secondPayload.sessionId || '(空)'}，第一次返回 sessionId=${firstSessionId}`);
    }
    if (secondResponse?.sessionId !== firstSessionId) {
      throw new Error(`后端未复用同一 session：第二次返回 ${secondResponse?.sessionId || '(空)'}，期望 ${firstSessionId}`);
    }

    console.log('✅ 手动中止后继续发送，仍复用了同一 session 上下文');
  } finally {
    await browser.close();
    await stopServer(server);
  }
}

runTest()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(`❌ manual-stop-context.test 失败: ${error.message}`);
    process.exit(1);
  });
