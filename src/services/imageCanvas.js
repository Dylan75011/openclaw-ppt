const { toOutputUrl } = require('./outputPaths');

function normalizeImageItem(image = {}, extra = {}) {
  const localPath = String(image?.localPath || '').trim();
  const previewUrl = image?.previewUrl || (localPath ? toOutputUrl(localPath) : (image?.thumb || image?.url || ''));
  return {
    id: image?.id || `${extra.scope || 'img'}_${Math.random().toString(16).slice(2, 8)}`,
    previewUrl,
    localPath,
    source: image?.source || (image?.isAI ? 'minimax' : 'pexels'),
    selected: !!image?.selected,
    score: Number.isFinite(Number(image?.score)) ? Number(image.score) : null,
    originQuery: image?.originQuery || '',
    query: image?.query || '',
    prompt: image?.prompt || '',
    sceneType: image?.sceneType || extra.sceneType || '',
    assetType: image?.assetType || extra.assetType || '',
    insertMode: image?.insertMode || extra.insertMode || '',
    pageIndex: Number.isInteger(image?.pageIndex) ? image.pageIndex : (Number.isInteger(extra.pageIndex) ? extra.pageIndex : null),
    pageTitle: image?.pageTitle || extra.pageTitle || '',
    role: image?.role || extra.role || '',
    analysis: image?.analysis || null
  };
}

function buildGlobalSection(category, images = []) {
  const normalized = (Array.isArray(images) ? images : []).map((image) => normalizeImageItem(image, { scope: category }));
  if (!normalized.length) return null;
  return {
    id: `global_${category}`,
    kind: 'global',
    title: category === 'cover' ? '封面氛围图' : category === 'end' ? '结尾氛围图' : '通用内容氛围图',
    subtitle: category === 'cover' ? '封面候选' : category === 'end' ? '结尾页候选' : '通用背景候选',
    category,
    selectedImageId: normalized[0]?.id || '',
    images: normalized.map((item, index) => ({ ...item, selected: index === 0 || item.selected }))
  };
}

function buildPageSection(pool = {}, selectedPages = new Map(), visualPages = new Map()) {
  const pageIndex = Number.isInteger(pool?.pageIndex) ? pool.pageIndex : null;
  const selectedPage = pageIndex !== null ? selectedPages.get(pageIndex) : null;
  const visualPage = pageIndex !== null ? visualPages.get(pageIndex) : null;
  const pageTitle = pool?.pageTitle || selectedPage?.pageTitle || visualPage?.pageTitle || `第 ${(pageIndex ?? 0) + 1} 页`;
  const images = (Array.isArray(pool?.images) ? pool.images : []).map((image) => normalizeImageItem(image, {
    scope: 'page',
    pageIndex,
    pageTitle,
    role: pool?.role || selectedPage?.role || '',
    sceneType: pool?.sceneType || selectedPage?.sceneType || visualPage?.sceneType || '',
    assetType: pool?.assetType || selectedPage?.assetType || visualPage?.assetType || '',
    insertMode: pool?.insertMode || selectedPage?.insertMode || visualPage?.insertMode || ''
  }));
  return {
    id: `page_${pageIndex}`,
    kind: 'page',
    pageIndex,
    pageTitle,
    role: pool?.role || selectedPage?.role || '',
    sceneType: pool?.sceneType || selectedPage?.sceneType || visualPage?.sceneType || '',
    assetType: pool?.assetType || selectedPage?.assetType || visualPage?.assetType || '',
    insertMode: pool?.insertMode || selectedPage?.insertMode || visualPage?.insertMode || '',
    query: pool?.query || selectedPage?.query || '',
    prompt: images.find(item => item.prompt)?.prompt || '',
    reason: pool?.reason || selectedPage?.reason || visualPage?.reason || '',
    shotIntent: pool?.shotIntent || selectedPage?.shotIntent || visualPage?.shotIntent || '',
    selectedImageId: pool?.selectedImageId || selectedPage?.id || images.find(item => item.selected)?.id || '',
    images
  };
}

function buildImageCanvasPayload(imageCandidates = {}, visualPlan = null, pptOutline = null) {
  const visualPages = new Map(
    (Array.isArray(visualPlan?.pages) ? visualPlan.pages : [])
      .filter(item => Number.isInteger(item?.pageIndex))
      .map(item => [item.pageIndex, item])
  );
  const selectedPages = new Map(
    (Array.isArray(imageCandidates?.pages) ? imageCandidates.pages : [])
      .filter(item => Number.isInteger(item?.pageIndex))
      .map(item => [item.pageIndex, item])
  );
  const pagePools = Array.isArray(imageCandidates?.pageCandidatePools) ? imageCandidates.pageCandidatePools : [];
  const pageSections = pagePools.map(pool => buildPageSection(pool, selectedPages, visualPages));
  const globalSections = ['cover', 'content', 'end']
    .map(category => buildGlobalSection(category, imageCandidates?.[category]))
    .filter(Boolean);
  const sections = [...pageSections, ...globalSections].filter(section => Array.isArray(section.images) && section.images.length);
  const allImages = sections.flatMap(section => section.images);
  const coveredPages = pageSections.filter(section => section.images.length).length;
  const selectedImages = allImages.filter(item => item.selected).length;
  const generatedImages = allImages.filter(item => item.source === 'minimax').length;
  const searchedImages = allImages.filter(item => item.source === 'pexels').length;

  return {
    artifactKey: 'current_image_canvas',
    title: '图片画布',
    summary: {
      totalImages: allImages.length,
      selectedImages,
      generatedImages,
      searchedImages,
      coveredPages
    },
    styleGuide: visualPlan?.globalStyleGuide || {},
    sections,
    pages: pageSections,
    globals: globalSections,
    outlineTitle: pptOutline?.title || '',
    totalPages: Array.isArray(pptOutline?.pages) ? pptOutline.pages.length : pageSections.length,
    updatedAt: Date.now()
  };
}

function buildImageSearchPayload({
  query = '',
  intent = '',
  images = [],
  title = '',
  summary = ''
} = {}) {
  const normalized = (Array.isArray(images) ? images : []).map((image, index) =>
    normalizeImageItem(image, {
      scope: 'search',
      pageTitle: title || '图片搜索结果',
      role: 'reference'
    })
  );

  const selectedImages = normalized.filter(item => item.selected).length;
  const generatedImages = normalized.filter(item => item.source === 'minimax').length;
  const searchedImages = normalized.filter(item => item.source === 'pexels').length;

  return {
    artifactKey: `image_search_${Date.now()}`,
    title: title || `找图结果：${query || '未命名任务'}`,
    query,
    intent,
    summaryText: summary || '',
    summary: {
      totalImages: normalized.length,
      selectedImages,
      generatedImages,
      searchedImages,
      coveredPages: normalized.length ? 1 : 0
    },
    sections: normalized.length
      ? [{
          id: 'search_results',
          kind: 'global',
          title: title || '图片搜索结果',
          subtitle: intent || '根据当前需求筛选的候选图',
          category: 'search',
          selectedImageId: normalized[0]?.id || '',
          images: normalized.map((item, index) => ({ ...item, selected: index === 0 || item.selected }))
        }]
      : [],
    pages: [],
    globals: [],
    updatedAt: Date.now()
  };
}

module.exports = { buildImageCanvasPayload, buildImageSearchPayload };
