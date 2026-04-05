const { chromium } = require('playwright');

const TARGET_URL = 'http://localhost:5173';

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 100 });
  const page = await browser.newPage();

  console.log('1. 访问 Agent 页面...');
  await page.goto(`${TARGET_URL}/agent`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(3000);

  console.log('2. 检查页面标题:', await page.title());

  console.log('3. 等待页面加载...');
  await page.waitForTimeout(3000);

  console.log('   检查页面元素...');
  const body = await page.locator('body');
  const bodyVisible = await body.isVisible();
  console.log('   body可见:', bodyVisible);

  const appEl = await page.locator('#app');
  const appVisible = await appEl.isVisible();
  console.log('   #app可见:', appVisible);

  const mainContent = await page.locator('.app-content');
  const mainVisible = await mainContent.isVisible().catch(() => false);
  console.log('   .app-content可见:', mainVisible);

  const siderEl = await page.locator('.app-sider');
  const siderVisible = await siderEl.isVisible().catch(() => false);
  console.log('   .app-sider可见:', siderVisible);

  console.log('3. 检查路由是否正确...');
  console.log('   当前URL:', page.url());

  const textarea = await page.locator('textarea').first();
  if (await textarea.isVisible()) {
    console.log('4. 输入测试消息...');
    await textarea.fill('帮我策划一个电动车发布会活动');

    console.log('5. 点击发送按钮...');
    const sendBtn = await page.locator('button:has-text("发送")').first();
    if (await sendBtn.isVisible()) {
      await sendBtn.click();
    } else {
      await textarea.press('Enter');
    }

    console.log('6. 等待agent响应...');
    await page.waitForTimeout(8000);

    console.log('7. 截图保存...');
    await page.screenshot({ path: '/tmp/agent-result.png', fullPage: true });
    console.log('   截图已保存: /tmp/agent-result.png');

    const messages = await page.locator('.bubble-wrap').count();
    console.log(`   检测到 ${messages} 条消息`);

  } else {
    console.log('   输入框未找到，检查DOM...');
    const html = await page.content();
    console.log('   HTML长度:', html.length);
    await page.screenshot({ path: '/tmp/agent-debug.png', fullPage: true });
  }

  await browser.close();
  console.log('测试完成');
})();