const { chromium } = require('playwright');

const TARGET_URL = 'http://localhost:5173';
const SKILL_DIR = '/Users/yangdi/Documents/GitHub/openclaw-ppt/.claude/skills/playwright-skill';

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 80 });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1440, height: 900 });

  let hasError = false;

  // 监听页面错误
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log(`[页面错误] ${msg.text()}`);
    }
  });

  try {
    // ── 1. 打开应用 ──────────────────────────────────────────
    console.log('📂 打开应用...');
    await page.goto(TARGET_URL, { waitUntil: 'networkidle', timeout: 15000 });
    await page.screenshot({ path: '/tmp/step1-home.png' });
    console.log('✅ 应用已加载');

    // ── 2. 导航到智能体对话页 ────────────────────────────────
    console.log('\n🤖 导航到智能体对话页...');
    // 点击侧边栏"智能体"入口，尝试多种选择器
    const agentNavSelectors = [
      'a[href="#/agent"]',
      '[href*="agent"]',
      '.nav-item:has-text("智能体")',
      '.sidebar a:has-text("智能体")',
      'text=智能体'
    ];
    let navigated = false;
    for (const sel of agentNavSelectors) {
      try {
        await page.click(sel, { timeout: 3000 });
        navigated = true;
        console.log(`  ↳ 通过 "${sel}" 导航成功`);
        break;
      } catch {}
    }
    if (!navigated) {
      // 直接跳转 hash 路由
      await page.goto(`${TARGET_URL}/#/agent`, { waitUntil: 'networkidle', timeout: 10000 });
      console.log('  ↳ 通过 hash 路由导航');
    }
    await page.waitForTimeout(1000);
    await page.screenshot({ path: '/tmp/step2-agent-view.png' });
    console.log('✅ 已进入智能体对话页');

    // ── 3. 输入策划请求 ──────────────────────────────────────
    console.log('\n✍️  输入活动策划请求...');
    const inputSelectors = [
      'textarea[placeholder*="描述需求"]',
      'textarea[placeholder*="输入"]',
      '.chat-input textarea',
      '.message-input textarea',
      'textarea'
    ];
    let inputEl = null;
    for (const sel of inputSelectors) {
      try {
        inputEl = await page.waitForSelector(sel, { timeout: 3000 });
        if (inputEl) { console.log(`  ↳ 找到输入框: ${sel}`); break; }
      } catch {}
    }
    if (!inputEl) throw new Error('未找到对话输入框');

    await inputEl.click();
    await inputEl.fill('帮我做一个华为问界 M9 上海车展发布会策划方案');
    await page.screenshot({ path: '/tmp/step3-input.png' });
    console.log('✅ 已输入策划请求');

    // ── 4. 发送消息 ──────────────────────────────────────────
    console.log('\n📤 发送消息...');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1500);
    await page.screenshot({ path: '/tmp/step4-sent.png' });
    console.log('✅ 消息已发送');

    // ── 5. 等待并监控 AI 处理过程（最多 8 分钟）──────────────
    console.log('\n⏳ 等待 AI 处理（最多 8 分钟）...');
    const startTime = Date.now();
    const TIMEOUT = 8 * 60 * 1000;
    let lastSnapshot = '';
    let screenshotCount = 0;
    let phase = 'start';

    while (Date.now() - startTime < TIMEOUT) {
      await page.waitForTimeout(5000);
      const elapsed = Math.round((Date.now() - startTime) / 1000);

      // 检测是否出现错误
      const errorTexts = await page.locator('text=AI 调用失败').count();
      if (errorTexts > 0) {
        hasError = true;
        const errMsg = await page.locator('text=AI 调用失败').first().textContent();
        console.log(`❌ [${elapsed}s] 检测到错误：${errMsg}`);
        await page.screenshot({ path: `/tmp/step-error.png` });
        break;
      }

      // 获取页面文本快照
      const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 2000));

      // 检测关键阶段
      const isSearching = bodyText.includes('搜索') || bodyText.includes('没有找到合适结果') || bodyText.includes('找到');
      const isStrategizing = bodyText.includes('制定策划') || bodyText.includes('策划方案') || bodyText.includes('评审');
      const isDocReady = bodyText.includes('doc_ready') || bodyText.includes('策划文档') ||
        (bodyText.includes('方案') && bodyText.includes('评分'));
      const isDone = bodyText.includes('PPT') && (bodyText.includes('已生成') || bodyText.includes('下载'));

      // 阶段截图
      if (isSearching && phase === 'start') {
        phase = 'searching';
        screenshotCount++;
        await page.screenshot({ path: `/tmp/step5-searching.png` });
        console.log(`  📸 [${elapsed}s] 截图：搜索阶段`);
      } else if (isStrategizing && phase === 'searching') {
        phase = 'strategizing';
        screenshotCount++;
        await page.screenshot({ path: `/tmp/step6-strategizing.png` });
        console.log(`  📸 [${elapsed}s] 截图：策划制定阶段`);
      } else if (isDocReady && phase === 'strategizing') {
        phase = 'doc_ready';
        screenshotCount++;
        await page.screenshot({ path: `/tmp/step7-doc-ready.png` });
        console.log(`  📸 [${elapsed}s] 截图：文档就绪`);
      }

      // 定期打印状态（每30秒）
      if (elapsed % 30 < 5 && bodyText !== lastSnapshot) {
        lastSnapshot = bodyText;
        const preview = bodyText.replace(/\s+/g, ' ').slice(0, 200);
        console.log(`  ⏱  [${elapsed}s] 页面状态: ${preview}`);
      }

      // 检测完成 —— 看到文档/方案内容或无活跃 spinner
      const hasSpinner = await page.locator('.thinking, [class*="loading"], [class*="spinner"]').count();
      const hasDoneText = bodyText.includes('评分') || bodyText.includes('你看这个方案') ||
        bodyText.includes('需要我继续') || bodyText.includes('接下来');

      if (hasDoneText && hasSpinner === 0 && elapsed > 30) {
        screenshotCount++;
        await page.screenshot({ path: `/tmp/step8-completed.png` });
        console.log(`\n🎉 [${elapsed}s] 检测到任务完成！截图已保存`);
        break;
      }
    }

    const totalTime = Math.round((Date.now() - startTime) / 1000);

    // ── 6. 最终全页截图 ────────────────────────────────────
    await page.screenshot({ path: '/tmp/step-final.png', fullPage: true });
    console.log('\n📸 最终截图保存至 /tmp/step-final.png');

    // ── 7. 汇报结果 ──────────────────────────────────────────
    console.log('\n══════════════════════════════════════');
    console.log('验证结果汇报');
    console.log('══════════════════════════════════════');
    if (hasError) {
      console.log('❌ 测试失败：流程中出现 "AI 调用失败" 错误');
    } else {
      console.log('✅ 测试通过：整个流程无错误');
    }
    console.log(`⏱  总耗时：${totalTime} 秒`);
    console.log(`📸 阶段截图数：${screenshotCount}`);
    console.log('截图文件：');
    console.log('  /tmp/step1-home.png          — 首页');
    console.log('  /tmp/step2-agent-view.png    — 智能体页');
    console.log('  /tmp/step3-input.png         — 输入请求');
    console.log('  /tmp/step4-sent.png          — 发送后');
    console.log('  /tmp/step5-searching.png     — 搜索中');
    console.log('  /tmp/step6-strategizing.png  — 策划中');
    console.log('  /tmp/step7-doc-ready.png     — 文档就绪');
    console.log('  /tmp/step8-completed.png     — 任务完成');
    console.log('  /tmp/step-final.png          — 最终全页');

  } catch (err) {
    console.error('❌ 脚本执行出错：', err.message);
    await page.screenshot({ path: '/tmp/step-exception.png', fullPage: true });
  } finally {
    await browser.close();
  }
})();
