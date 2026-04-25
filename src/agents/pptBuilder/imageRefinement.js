const { analyzePagesForLayout } = require('../../services/imageAnalyzer');
const { summarizeText } = require('./textProcessing');
const { stabilizePages, computeDynamicRegions } = require('./pageStabilizer');

// 图片就绪后的二次精修：仅用代码化路径（analyzePagesForLayout + applyProgrammaticImageAwareLayout），
// 不再走第二次 LLM。原因：第二次 callLLMJson(16k) 延迟高/失败面大，而真正能稳定提升质量的改动
// （textPlacement / overlay / regions / 文案 clamp）都能从 imageAnalysis 推出。
async function refinePagesWithImages({ plan, userInput, result, imageMap }, agent) {
  const pages = Array.isArray(result?.pages) ? result.pages : [];
  if (!pages.length) return;

  const hasAnyImage = Object.keys(imageMap).some(k => {
    if (k === 'pages') return Object.keys(imageMap.pages || {}).length > 0;
    return !!imageMap[k];
  });
  if (!hasAnyImage) return;

  const pagesWithImages = pages.map((page, index) => {
    const layout = page.layout || page.type || 'bento_grid';
    const bgCategory = (layout === 'immersive_cover' || layout === 'cover') ? 'cover'
      : (layout === 'end_card' || layout === 'end') ? 'end'
      : 'content';
    const useBackground = page?.imageStrategy?.useBackground !== false;
    const pageImage = imageMap?.pages?.[index];
    const bgImagePath = useBackground
      ? (pageImage?.localPath || imageMap?.[bgCategory] || '')
      : '';
    return { ...page, bgImagePath };
  });

  const imageAnalyses = await analyzePagesForLayout(pagesWithImages);
  if (!imageAnalyses.some(Boolean)) return;

  for (let i = 0; i < pages.length; i++) {
    const analysis = imageAnalyses[i];
    if (!analysis) continue;
    pages[i].imageAnalysis = analysis;
    if (pages[i].imageStrategy) {
      if (!pages[i].imageStrategy.textPlacement || pages[i].imageStrategy.textPlacement === 'auto') {
        pages[i].imageStrategy.textPlacement = analysis.safestTextPlacement;
      }
      if (typeof pages[i].imageStrategy.overlay !== 'number') {
        pages[i].imageStrategy.overlay = analysis.recommendedOverlay;
      }
    }
  }

  applyProgrammaticImageAwareLayout(pages, agent);
  result.pages = stabilizePages(pages);
}

function applyProgrammaticImageAwareLayout(pages = [], agent) {
  for (const page of pages) {
    const analysis = page?.imageAnalysis;
    const placement = analysis?.safestTextPlacement || page?.imageStrategy?.textPlacement || 'left';
    const role = page?.visualIntent?.role || page?.layout || 'content';
    const longestFact = Math.max(0, ...((page?.facts || []).map(item => String(item || '').length)));

    if (page.imageStrategy && analysis) {
      page.imageStrategy.textPlacement = placement;
      page.imageStrategy.overlay = analysis.recommendedOverlay;
    }

    if (Array.isArray(page.textBlocks)) {
      page.textBlocks = page.textBlocks.map((block) => {
        if (block.kind === 'body' || block.kind === 'subtitle') {
          const text = String(block.text || '').trim();
          // 只在极端情况（>300字）才截断，防止渲染溢出
          const maxChars = 300;
          return {
            ...block,
            text: text.length > maxChars ? summarizeText(text, 240) : text,
            clamp: block.kind === 'body' ? (role === 'section' ? 9 : role === 'timeline' ? 6 : 7) : block.clamp,
          };
        }
        if (block.kind === 'fact-list') {
          const compactItems = (block.items || []).map((item) => {
            const text = String(item || '').trim();
            // 单条超过80字才截，确保概念表述完整
            const limit = 80;
            if (text.length <= limit) return text;
            return summarizeText(text, 68);
          }).slice(0, role === 'highlights' ? 8 : role === 'section' ? 6 : 6);
          return {
            ...block,
            items: compactItems,
            variant: role === 'highlights'
              ? 'floating-tags'
              : role === 'section'
              ? (longestFact > 26 ? 'compact-notes' : 'side-notes')
              : role === 'manifesto'
                ? (longestFact > 28 ? 'compact-notes' : 'side-notes')
                : role === 'comparison'
                  ? 'compact-notes'
                : 'editorial-list'
          };
        }
        if (block.kind === 'stats') {
          return {
            ...block,
            variant: block.variant || (role === 'metrics'
              ? 'ledger'
              : role === 'highlights'
                ? 'staggered-notes'
                : 'annotation-strip')
          };
        }
        if (block.kind === 'timeline') {
          return {
            ...block,
            variant: 'editorial-steps'
          };
        }
        return block;
      });
    }

    if (page.composition === 'hero-asymmetric') {
      page.regions = computeDynamicRegions(page);
    }

    if (page.composition === 'manifesto-center') {
      page.regions = placement === 'right'
        ? [
            { name: 'header', x: 50, y: 14, w: 28, h: 18, stack: 'vertical', gap: 10, align: 'start', valign: 'start' },
            { name: 'quote', x: 42, y: 38, w: 34, h: 26, stack: 'vertical', gap: 10, align: 'start', valign: 'start' },
            { name: 'facts', x: 10, y: 48, w: 22, h: 22, stack: 'vertical', gap: 10, align: 'stretch', valign: 'start' }
          ]
        : [
            { name: 'header', x: 8, y: 14, w: 30, h: 18, stack: 'vertical', gap: 10, align: 'start', valign: 'start' },
            { name: 'quote', x: 8, y: 40, w: 34, h: 26, stack: 'vertical', gap: 10, align: 'start', valign: 'start' },
            { name: 'facts', x: 66, y: 48, w: 20, h: 22, stack: 'vertical', gap: 10, align: 'stretch', valign: 'start' }
          ];
    }

    if (page.composition === 'annotation-runway') {
      page.regions = computeDynamicRegions(page);
    }

    if (page.composition === 'staggered-metrics' || page.composition === 'budget-table' || page.composition === 'kpi-ledger') {
      page.regions = computeDynamicRegions(page);
    }

    if (page.composition === 'compare-columns' || page.composition === 'risk-matrix') {
      page.regions = computeDynamicRegions(page);
    }

    if (page.composition === 'ledger-split') {
      page.regions = computeDynamicRegions(page);
    }

    if (page.composition === 'highlights-board' || page.composition === 'team-grid') {
      page.regions = computeDynamicRegions(page);
    }

    if ((page.composition === 'schedule-strip') || (role === 'timeline' && (!Array.isArray(page.regions) || !page.regions.length || page.composition === 'split-editorial'))) {
      page.regions = computeDynamicRegions(page);
    }
  }
}

module.exports = {
  refinePagesWithImages,
  applyProgrammaticImageAwareLayout,
};
