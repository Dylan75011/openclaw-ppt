const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const PptBuilderAgent = require('../src/agents/pptBuilderAgent');
const ImageAgent = require('../src/agents/imageAgent');
const { generatePPT } = require('../src/services/pptGenerator');
const { renderToHtml, wrapForScreenshot } = require('../src/services/previewRenderer');
const { getRunAssetDir } = require('../src/services/outputPaths');

async function main() {
  const runId = 'huawei-aito-dynamic-bones-polish-v3';
  const source = require('../output/huawei-aito-structured-run.json');
  const plan = source.extractedPlan;
  const userInput = {
    brand: '华为问界',
    topic: '新车发布会',
    eventType: '新品发布会',
    goal: '新品发布与品牌提升',
    style: '高端、电影感、科技豪华'
  };

  const builder = new PptBuilderAgent({});
  const imageAgent = new ImageAgent({});

  const initial = builder.buildStructuredFallback({ plan, userInput });
  const outline = initial.pages.map((page, index) => ({
    pageIndex: index,
    pageTitle: page.title,
    title: page.title,
    role: page?.visualIntent?.role,
    layout: page.layout,
    composition: page.composition,
    facts: page.facts || [],
    metrics: page.metrics || [],
    phases: page.phases || []
  }));

  const imageMap = await imageAgent.run({ plan, userInput, taskId: runId, pptOutline: outline });
  const pptData = await builder.run({ plan, userInput, imageMap });
  pptData.runId = runId;

  const previewsDir = getRunAssetDir(runId, 'previews');
  fs.mkdirSync(previewsDir, { recursive: true });
  for (const name of fs.readdirSync(previewsDir)) {
    fs.rmSync(path.join(previewsDir, name), { force: true, recursive: true });
  }

  const htmlSlides = renderToHtml(pptData);
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-dev-shm-usage']
  });
  const browserPage = await browser.newPage();
  await browserPage.setViewport({ width: 960, height: 540, deviceScaleFactor: 2 });

  const picks = [0, 2, 3, 7, 10, 11, 12, 13];
  const previewFiles = [];

  for (const idx of picks) {
    const bgImagePath = pptData.pages[idx]?.bgImagePath || null;
    const fullHtml = wrapForScreenshot(htmlSlides[idx], bgImagePath);
    await browserPage.setContent(fullHtml, { waitUntil: 'domcontentloaded', timeout: 15000 });
    if (bgImagePath) {
      await browserPage.waitForFunction(
        () => document.querySelectorAll('img').length === 0 ||
          Array.from(document.querySelectorAll('img')).every(img => img.complete),
        { timeout: 5000 }
      ).catch(() => {});
    }

    const file = path.join(previewsDir, `page_${String(idx + 1).padStart(2, '0')}.png`);
    await browserPage.screenshot({ path: file, type: 'png' });
    previewFiles.push(file);
  }

  await browserPage.close();
  await browser.close();

  const ppt = await generatePPT(pptData, 'ppt_dynamic_bones_polish_v3.pptx', { runId });
  const summary = {
    ppt: ppt.filepath,
    previewFiles,
    pageCount: pptData.pages.length
  };
  fs.writeFileSync(path.join(path.dirname(previewsDir), 'run-summary.json'), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
