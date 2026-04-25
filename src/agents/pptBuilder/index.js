const BaseAgent = require('../baseAgent');
const { buildPptBuilderPrompt } = require('../../prompts/pptBuilder');
const { stabilizePages } = require('./pageStabilizer');
const { refinePagesWithImages } = require('./imageRefinement');
const { buildStructuredFallback } = require('./fallbackBuilder');

class PptBuilderAgent extends BaseAgent {
  constructor(apiKeys = {}) {
    super('PptBuilderAgent', 'minimax', apiKeys);
  }

  async run({ plan, userInput, docContent, imageMap = {}, onOutlineReady, onPageReady }) {
    console.log('[PptBuilderAgent] 开始生成 PPT...');
    const { systemPrompt, userPrompt } = buildPptBuilderPrompt(plan, userInput);
    let result;
    try {
      result = await this.callLLMJson(
        [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
        { maxTokens: 16000, temperature: 0.22 }
      );
    } catch (err) {
      console.warn('[PptBuilderAgent] 首轮结构化 JSON 生成失败，回退到程序化结构化版式:', err.message);
      result = buildStructuredFallback({ plan, userInput, docContent }, this);
    }

    const theme = result.theme || {};
    theme.globalStyle = result.globalStyle || 'dark_tech';
    result.pages = stabilizePages(Array.isArray(result.pages) ? result.pages : []);
    const pages = result.pages || [];
    const total = pages.length;
    console.log(`[PptBuilderAgent] 生成完成，共 ${total} 页`);

    if (typeof onOutlineReady === 'function') {
      await onOutlineReady(result, total);
    }

    await refinePagesWithImages({ plan, userInput, result, imageMap }, this);

    const processedPages = [];

    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      const layout = page.layout || page.type || 'bento_grid';
      const style = page.style || result.globalStyle || 'dark_tech';

      console.log(`[PptBuilderAgent] 处理第 ${i + 1}/${total} 页：${layout}`);

      // 注入背景图
      const bgCategory = (layout === 'immersive_cover' || layout === 'cover') ? 'cover'
        : (layout === 'end_card' || layout === 'end') ? 'end'
        : 'content';
      const pageImage = imageMap?.pages?.[i];
      const useBackground = page?.imageStrategy?.useBackground !== false;
      if (useBackground && pageImage?.localPath) {
        page.bgImagePath = pageImage.localPath;
        if (pageImage?.insertMode && page?.imagePlacement) {
          page.imagePlacement = { ...page.imagePlacement, mode: pageImage.insertMode };
        }
        page.imageMeta = {
          query: pageImage.query || '',
          treatment: pageImage.treatment || '',
          source: pageImage.source || '',
          sceneType: pageImage.sceneType || '',
          assetType: pageImage.assetType || '',
          insertMode: pageImage.insertMode || ''
        };
      } else if (useBackground && imageMap[bgCategory]) {
        page.bgImagePath = imageMap[bgCategory];
      } else {
        delete page.bgImagePath;
        delete page.imageMeta;
      }

      // 兼容旧渲染器：同时设置 type，确保无 layout 字段时也能渲染
      page.type = layout;

      processedPages.push(page);

      if (typeof onPageReady === 'function') {
        onPageReady(page, i, total, theme);
      }
      // 让事件循环有机会将 SSE 事件真正发出，实现逐页流式预览
      await new Promise(r => setImmediate(r));
    }

    console.log(`[PptBuilderAgent] 全部 ${processedPages.length} 页处理完成`);
    return {
      title: result.title || plan?.planTitle || 'PPT',
      globalStyle: result.globalStyle || 'dark_tech',
      theme: { ...theme, globalStyle: result.globalStyle },
      pages: processedPages
    };
  }
}

module.exports = PptBuilderAgent;
