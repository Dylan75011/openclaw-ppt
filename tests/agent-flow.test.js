const { chromium } = require('@playwright/test');
const http = require('http');

const PORT = 3000;
const BASE_URL = `http://localhost:${PORT}`;
const TEST_MESSAGE = '帮我为小米做一个大型新品发布会PPT，要科技感强一些';

function checkServer() {
  return new Promise((resolve) => {
    http.get(`${BASE_URL}/api/health`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', () => resolve(null));
  });
}

async function runTest() {
  console.log('🔍 检查服务状态...');
  const health = await checkServer();
  if (!health) {
    console.error('❌ 服务未启动，请先运行 npm start');
    process.exit(1);
  }
  console.log(`✅ 服务运行中 (${health.version})`);

  console.log('🌐 启动浏览器...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1400, height: 900 }
  });
  const page = await context.newPage();

  const errors = [];
  page.on('pageerror', err => errors.push(`PAGE ERROR: ${err.message}`));

  try {
    console.log('📄 访问主页...');
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    console.log('✅ 页面加载完成');

    console.log('🔄 切换到智能体页面...');
    const menuItems = await page.locator('.arco-menu-item').all();
    await menuItems[1].click();
    await page.waitForTimeout(2000);
    console.log('✅ 已切换到智能体页面');

    console.log('⏳ 等待输入框出现...');
    await page.waitForSelector('textarea', { timeout: 10000 });
    console.log('✅ 找到输入框');

    const textarea = page.locator('textarea').first();
    await textarea.fill(TEST_MESSAGE);
    console.log(`✅ 已输入消息: "${TEST_MESSAGE.slice(0, 20)}..."`);

    await page.waitForTimeout(500);

    const sendBtn = page.locator('.send-btn');
    const isDisabled = await sendBtn.getAttribute('disabled');
    console.log(`✅ 发送按钮状态: ${isDisabled === null ? '可用' : '禁用'}`);

    console.log('🚀 点击发送按钮，启动 Agent 流程...');
    await sendBtn.click();
    console.log('✅ 已发送消息');

    console.log('⏳ 等待 Agent 响应（最多 5 分钟）...');

    const startTime = Date.now();
    const maxDuration = 5 * 60 * 1000;
    let lastToolCallCount = 0;

    while (Date.now() - startTime < maxDuration) {
      await page.waitForTimeout(2000);

      const state = await page.evaluate(() => {
        const toolCallCards = document.querySelectorAll('.tool-call-card');
        const messages = document.querySelectorAll('.bubble-wrap');
        const wsDone = document.querySelector('.ws-done');
        const wsExecution = document.querySelector('.ws-execution');
        const hasStrategyPreview = !!document.querySelector('.strategy-preview');
        const hasSlideViewer = !!document.querySelector('.slide-viewer');
        const hasDoneLabel = !!document.querySelector('.done-label');
        const stopBtn = document.querySelector('.stop-btn');
        const textarea = document.querySelector('textarea');

        return {
          toolCallCount: toolCallCards.length,
          messageCount: messages.length,
          workspaceState: wsDone ? 'done' : (wsExecution ? 'execution' : 'unknown'),
          hasStrategyPreview,
          hasSlideViewer,
          hasDoneLabel,
          isRunning: !!stopBtn,
          inputEnabled: textarea && !textarea.disabled
        };
      });

      if (state.toolCallCount > lastToolCallCount) {
        console.log(`📦 工具调用: ${state.toolCallCount} (${['web_search', 'web_fetch', 'run_strategy', 'build_ppt'][state.toolCallCount - 1] || 'tool'})`);
        lastToolCallCount = state.toolCallCount;
      }

      if (state.hasStrategyPreview) {
        console.log('📋 方案预览已出现');
      }

      if (state.hasSlideViewer) {
        console.log('🎨 PPT 预览已出现');
      }

      if (state.hasDoneLabel || (state.inputEnabled && state.messageCount > 1)) {
        console.log('✅ Agent 流程已完成');
        break;
      }

      if (!state.isRunning && state.messageCount > 1) {
        console.log('✅ Agent 流程已完成（检测到输入框恢复）');
        break;
      }
    }

    const finalState = await page.evaluate(() => {
      const toolCallCards = document.querySelectorAll('.tool-call-card');
      const messages = document.querySelectorAll('.bubble-wrap');
      const wsDone = document.querySelector('.ws-done');
      const hasStrategyPreview = !!document.querySelector('.strategy-preview');
      const hasSlideViewer = !!document.querySelector('.slide-viewer');
      const artifactTimeline = !!document.querySelector('.artifact-timeline');
      const planSections = document.querySelectorAll('.section-live-item');
      const highlightCards = document.querySelectorAll('.highlight-card');

      return {
        workspaceState: wsDone ? 'done' : 'unknown',
        messageCount: messages.length,
        toolCallCount: toolCallCards.length,
        hasStrategyPreview,
        hasSlideViewer,
        hasArtifactTimeline: artifactTimeline,
        planSectionCount: planSections.length,
        highlightCount: highlightCards.length
      };
    });

    console.log('\n📊 最终状态:');
    console.log(`  - 工作区状态: ${finalState.workspaceState}`);
    console.log(`  - 消息数量: ${finalState.messageCount}`);
    console.log(`  - 工具调用: ${finalState.toolCallCount}`);
    console.log(`  - 有方案预览: ${finalState.hasStrategyPreview}`);
    console.log(`  - 有 PPT 预览: ${finalState.hasSlideViewer}`);
    console.log(`  - 有产出时间线: ${finalState.hasArtifactTimeline}`);
    console.log(`  - 方案章节数: ${finalState.planSectionCount}`);
    console.log(`  - 亮点数: ${finalState.highlightCount}`);

    if (errors.length > 0) {
      console.log('\n⚠️ 页面错误:');
      errors.forEach(e => console.log(`  - ${e}`));
    }

    const success = finalState.toolCallCount > 0 && finalState.messageCount > 1;
    console.log(`\n${success ? '✅' : '❌'} 测试${success ? '通过' : '未通过'}`);

  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    await browser.close();
    process.exit(1);
  }

  await browser.close();
  console.log('🧹 浏览器已关闭');
}

runTest().catch(err => {
  console.error('测试异常:', err);
  process.exit(1);
});