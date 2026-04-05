const { chromium } = require('@playwright/test');
const { spawn } = require('child_process');
const http = require('http');

const PORT = 3000;
const BASE_URL = `http://localhost:${PORT}`;

function startServer() {
  return new Promise((resolve, reject) => {
    const server = spawn('node', ['src/server.js'], {
      cwd: process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe']
    });

    server.stdout.on('data', (data) => {
      const output = data.toString();
      console.log(output);
      if (output.includes('已启动') || output.includes('started')) {
        setTimeout(resolve, 1000);
      }
    });

    server.stderr.on('data', (data) => {
      console.error(`Server stderr: ${data}`);
    });

    setTimeout(() => resolve(server), 2000);
  });
}

function checkServer() {
  return new Promise((resolve) => {
    http.get(`${BASE_URL}/api/health`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log('API Health:', data);
        resolve(true);
      });
    }).on('error', () => resolve(false));
  });
}

async function runTest() {
  console.log('🚀 启动 Luna PPT 服务...');
  const server = await startServer();

  console.log('✅ 服务已启动，等待健康检查...');
  const isReady = await checkServer();
  if (!isReady) {
    console.error('❌ 服务健康检查失败');
    server.kill();
    process.exit(1);
  }

  console.log('✅ 服务健康检查通过');
  console.log('🌐 启动浏览器...');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('console', msg => console.log(`[Browser ${msg.type()}]:`, msg.text()));
  page.on('pageerror', err => console.error('[Browser Error]:', err.message));

  try {
    console.log('📄 访问主页...');
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });

    const title = await page.title();
    console.log(`✅ 页面标题: ${title}`);

    const bodyText = await page.locator('body').innerText();
    console.log(`✅ 页面内容加载成功 (${bodyText.length} 字符)`);

    console.log('✅ 浏览器自动化测试完成');
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    await browser.close();
    server.kill();
    process.exit(1);
  }

  await browser.close();
  server.kill();
  console.log('🧹 服务器已关闭');
  console.log('\n✅ 所有测试通过!');
}

runTest().catch(err => {
  console.error('测试异常:', err);
  process.exit(1);
});