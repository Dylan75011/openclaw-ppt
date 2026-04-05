const { chromium } = require('playwright');
const helpers = require('/Users/yangdi/Documents/GitHub/openclaw-ppt/.skills/playwright-skill/lib/helpers');

const TARGET_URL = 'http://localhost:5173';
const API_URL = 'http://localhost:3000';

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 30 });
  const page = await browser.newPage();

  const sessionCapture = helpers.captureSessionStream(page, '/api/session/');
  const apiMonitor = helpers.interceptStreamingResponse(page, '/api/agent/', (chunk) => {
    if (chunk.body) {
      const body = chunk.body;
      if (body.stage) {
        process.stdout.write(`\n   [Stage] ${body.stage}`);
      }
      if (body.artifacts?.length) {
        process.stdout.write(` | [Artifacts] ${body.artifacts.length}`);
      }
      if (body.sessionId && !sessionCapture.sessionId()) {
        process.stdout.write(` | [Session] ${body.sessionId.substring(0, 8)}...`);
      }
    }
  });

  try {
    console.log('=== Agent完整流程测试 ===\n');

    console.log('1. 打开页面...');
    await page.goto(TARGET_URL, { waitUntil: 'networkidle', timeout: 15000 });
    console.log('   页面标题:', await page.title());

    console.log('\n2. 进入智能体界面...');
    await page.locator('text=智能体').click();
    await page.waitForTimeout(800);

    console.log('3. 新建对话...');
    await page.locator('.conversation-create-btn').click();
    await page.waitForTimeout(500);

    console.log('4. 发送任务...');
    await page.locator('.chat-textarea textarea').fill('帮我为小米做一个大型新品发布会PPT');
    await page.locator('.send-btn').click();
    console.log('   消息已发送');

    console.log('\n5. 等待澄清问题...');
    let clarified = false;
    for (let i = 0; i < 30; i++) {
      await page.waitForTimeout(1000);
      const input = page.locator('.clarification-input input, .chat-textarea textarea').first();
      const inputVisible = await input.isVisible().catch(() => false);
      const placeholder = await input.getAttribute('placeholder').catch(() => '');
      if (inputVisible && placeholder.includes('请回答')) {
        console.log(`   检测到澄清输入框 (${i+1}秒)`);
        clarified = true;
        break;
      }
      process.stdout.write(`\r   等待中...${i+1}秒`);
    }
    console.log('');

    if (clarified) {
      console.log('\n6. 回答澄清问题...');
      await page.locator('.clarification-input input, .chat-textarea textarea').first().fill('小米15手机新品发布会');
      await page.locator('.send-btn').click();
      console.log('   已回答');
    }

    console.log('\n7. 等待完整方案生成...');
    let lastChunkCount = 0;
    let stableCount = 0;
    const maxWait = 180;

    for (let i = 0; i < maxWait; i++) {
      await page.waitForTimeout(1000);

      const chunkCount = apiMonitor.chunks.length;
      const artifactCount = await page.locator('.artifact-msg-card').count();
      const toolCount = await page.locator('.tool-call-card').count();

      const panels = {
        taskBrief: await page.locator('.task-brief-panel').isVisible().catch(() => false),
        research: await page.locator('.research-panel').isVisible().catch(() => false),
        planDraft: await page.locator('.plan-draft-panel').isVisible().catch(() => false),
        sections: await page.locator('.sections-panel').isVisible().catch(() => false),
        ppt: await page.locator('.ppt-preview-panel').isVisible().catch(() => false)
      };

      if (i % 5 === 0 || chunkCount !== lastChunkCount) {
        console.log(`\n   [${i+1}秒] chunks=${chunkCount}, artifacts=${artifactCount}, tools=${toolCount}`);
        console.log(`   面板: 任务=${panels.taskBrief}, 研究=${panels.research}, 草稿=${panels.planDraft}, 章节=${panels.sections}, PPT=${panels.ppt}`);
        lastChunkCount = chunkCount;
      }

      const allPanelsVisible = panels.taskBrief && panels.research && panels.planDraft && panels.sections && panels.ppt;
      if (allPanelsVisible && chunkCount > 0 && chunkCount === lastChunkCount) {
        stableCount++;
        if (stableCount >= 5) {
          console.log(`\n   ✅ 检测到流程稳定完成（${stableCount}次确认）`);
          break;
        }
      } else {
        stableCount = 0;
      }
    }

    console.log('\n8. 最终状态...');
    console.log('   Session ID:', sessionCapture.sessionId() || '未知');
    console.log('   API Chunks:', apiMonitor.chunks.length);
    console.log('   产出物卡片:', await page.locator('.artifact-msg-card').count());
    console.log('   工具调用:', await page.locator('.tool-call-card').count());

    await page.screenshot({ path: '/tmp/agent-flow-final.png', fullPage: true });
    console.log('\n   截图已保存到 /tmp/agent-flow-final.png');

    console.log('\n=== 测试完成 ===');

  } catch (error) {
    console.error('\n❌ 测试失败:', error.message);
    await page.screenshot({ path: '/tmp/agent-error.png', fullPage: true });
  } finally {
    sessionCapture.stop();
    apiMonitor.stop();
    await browser.close();
  }
})();