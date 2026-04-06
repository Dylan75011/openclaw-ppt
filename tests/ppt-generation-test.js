const { chromium } = require('playwright');

const TARGET_URL = 'http://localhost:5173';
const SCREENSHOT_DIR = '/Users/yangdi/Documents/GitHub/luna-ppt/tests/screenshots';

(async () => {
  const browser = await chromium.launch({ 
    headless: false,
    slowMo: 200
  });
  const page = await browser.newPage();

  try {
    console.log('🎬 完整PPT生成流程测试\n');
    
    // 1. 访问应用
    console.log('1️⃣  访问应用');
    await page.goto(TARGET_URL, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);
    console.log('   ✅ 页面加载完成');
    await page.screenshot({ path: `${SCREENSHOT_DIR}/01-home.png`, fullPage: true });
    
    // 2. 点击智能助手
    console.log('\n2️⃣  打开智能助手');
    await page.locator('button:has-text("智能助手")').click();
    await page.waitForTimeout(2000);
    console.log('   ✅ 智能助手已打开');
    await page.screenshot({ path: `${SCREENSHOT_DIR}/02-assistant.png`, fullPage: true });
    
    // 3. 输入需求
    console.log('\n3️⃣  输入PPT需求');
    const textarea = page.locator('textarea').first();
    await textarea.click();
    await page.waitForTimeout(500);
    
    const requirement = '帮我生成一个公司年会策划PPT，包含开场致辞、年度回顾、员工表彰、节目表演、抽奖环节、晚宴安排等内容';
    await textarea.fill(requirement);
    console.log('   ✅ 需求已输入');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/03-input.png`, fullPage: true });
    
    // 4. 发送
    console.log('\n4️⃣  发送需求');
    const sendButtons = await page.locator('button:has(svg)').all();
    let sent = false;
    
    for (const btn of sendButtons) {
      try {
        if (await btn.isVisible() && await btn.isEnabled()) {
          // 检查按钮是否在输入框附近（通常发送按钮在textarea附近）
          const box = await btn.boundingBox();
          if (box && box.y > 100) {
            await btn.click();
            sent = true;
            console.log('   ✅ 已发送');
            break;
          }
        }
      } catch (e) {}
    }
    
    if (!sent) {
      await page.keyboard.press('Enter');
      console.log('   ✅ 已按Enter发送');
    }
    
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/04-sent.png`, fullPage: true });
    
    // 5. 等待生成
    console.log('\n5️⃣  等待PPT生成（60秒）');
    for (let i = 1; i <= 12; i++) {
      await page.waitForTimeout(5000);
      console.log(`   [${i * 5}s] 生成中...`);
      
      if (i % 3 === 0) {
        await page.screenshot({ 
          path: `${SCREENSHOT_DIR}/05-gen-${i * 5}s.png`, 
          fullPage: true 
        });
      }
    }
    
    // 6. 最终结果
    console.log('\n6️⃣  查看最终结果');
    await page.screenshot({ path: `${SCREENSHOT_DIR}/06-final.png`, fullPage: true });
    
    console.log('\n✅ 测试完成');
    console.log(`\n📁 截图保存在: ${SCREENSHOT_DIR}`);
    console.log('   - 01-home.png');
    console.log('   - 02-assistant.png');
    console.log('   - 03-input.png');
    console.log('   - 04-sent.png');
    console.log('   - 05-gen-*.png');
    console.log('   - 06-final.png');
    
    console.log('\n⏳ 保持浏览器打开30秒...');
    await page.waitForTimeout(30000);
    
  } catch (error) {
    console.error('\n❌ 错误:', error.message);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/error.png`, fullPage: true });
  } finally {
    await browser.close();
    console.log('\n🔚 浏览器已关闭');
  }
})();