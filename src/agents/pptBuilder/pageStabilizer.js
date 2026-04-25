const {
  estimateTextWeight,
  summarizeText,
  trimLine,
  inferPageRole,
  stableLayoutForRole,
  STABLE_LAYOUTS,
} = require('./textProcessing');

function sanitizeList(items, { maxItems = 8, maxWeight = 56 } = {}) {
  return (Array.isArray(items) ? items : [])
    .map(item => trimLine(item, maxWeight))
    .filter(Boolean)
    .slice(0, maxItems);
}

function stabilizePage(page = {}, index = 0, total = 0) {
  const next = { ...page };
  const role = inferPageRole(next, index, total);
  const targetLayout = STABLE_LAYOUTS.has(next.layout || next.type)
    ? (next.layout || next.type)
    : stableLayoutForRole(role, index, total);

  next.layout = targetLayout;
  next.type = targetLayout;
  next.style = next.style || 'dark_tech';
  next.title = trimLine(next.title || (index === 1 && role === 'toc' ? '目录' : ''), 32);
  next.subtitle = trimLine(next.subtitle, role === 'cover' ? 80 : 60);
  next.quote = trimLine(next.quote, role === 'manifesto' ? 140 : role === 'closing' ? 100 : 80);
  next.body = trimLine(next.body || next.story, role === 'section' ? 160 : 120);
  next.story = next.body || next.story || '';
  next.facts = sanitizeList(next.facts, {
    maxItems: role === 'highlights' ? 8 : 6,
    maxWeight: 56
  });
  next.leftItems = sanitizeList(next.leftItems, { maxItems: 6, maxWeight: 48 });
  next.rightItems = sanitizeList(next.rightItems, { maxItems: 6, maxWeight: 48 });
  next.metrics = (Array.isArray(next.metrics) ? next.metrics : [])
    .slice(0, 8)
    .map((item) => ({
      ...item,
      value: trimLine(item?.value, 24),
      label: trimLine(item?.label, 36),
      sub: trimLine(item?.sub, 28)
    }));
  next.phases = (Array.isArray(next.phases) ? next.phases : []).slice(0, 10).map((phase) => ({
    ...phase,
    date: trimLine(phase?.date, 24),
    name: trimLine(phase?.name, 28),
    tasks: sanitizeList(phase?.tasks, { maxItems: 5, maxWeight: 36 })
  }));

  if (Array.isArray(next.textBlocks)) {
    next.textBlocks = next.textBlocks.map((block) => {
      const normalized = { ...block };
      if (typeof normalized.text === 'string') {
        const maxWeight = normalized.kind === 'title'
          ? 36
          : normalized.kind === 'quote'
            ? (role === 'manifesto' ? 140 : 100)
            : normalized.kind === 'body'
              ? (role === 'section' ? 160 : 120)
              : 60;
        normalized.text = trimLine(normalized.text, maxWeight);
      }
      if (Array.isArray(normalized.items)) {
        if (normalized.kind === 'stats') {
          normalized.items = normalized.items.slice(0, 8).map((item) => ({
            ...item,
            value: trimLine(item?.value, 24),
            label: trimLine(item?.label, 36),
            sub: trimLine(item?.sub, 28)
          })).filter(item => item.value || item.label);
        } else if (normalized.kind === 'timeline') {
          normalized.items = normalized.items.slice(0, 10).map((item) => ({
            ...item,
            date: trimLine(item?.date, 24),
            name: trimLine(item?.name, 28),
            tasks: sanitizeList(item?.tasks, { maxItems: 5, maxWeight: 36 })
          })).filter(item => item.date || item.name || (Array.isArray(item.tasks) && item.tasks.length));
        } else {
          normalized.items = sanitizeList(normalized.items, {
            maxItems: role === 'highlights' ? 8 : 6,
            maxWeight: 56
          });
        }
      }
      return normalized;
    }).filter(block => block.text || (Array.isArray(block.items) && block.items.length));
  }

  if (!next.visualIntent) next.visualIntent = {};
  next.visualIntent.role = role;
  return next;
}

function stabilizePages(pages = []) {
  return pages.map((page, index) => stabilizePage(page, index, pages.length));
}

function computeDynamicRegions(page = {}) {
  const role = page?.visualIntent?.role || page?.layout || 'content';
  const placement = page?.imageAnalysis?.safestTextPlacement || page?.imageStrategy?.textPlacement || 'left';
  const titleWeight = estimateTextWeight(page?.title || '');
  const quoteWeight = estimateTextWeight(page?.quote || page?.subtitle || page?.story || page?.body || '');
  const factCount = Array.isArray(page?.facts) ? page.facts.length : 0;
  const timelineCount = Array.isArray(page?.phases) ? page.phases.length : 0;
  const metricCount = Array.isArray(page?.metrics) ? page.metrics.length : 0;

  if (role === 'cover') {
    return placement === 'right'
      ? [
          { name: 'header', x: 48, y: 12, w: 36, h: titleWeight > 18 ? 24 : 20, stack: 'vertical', gap: 10, align: 'start', valign: 'start' },
          { name: 'body', x: 48, y: 46, w: 28, h: 16, stack: 'vertical', gap: 10, align: 'start', valign: 'start' },
          { name: 'rail', x: 10, y: 18, w: 22, h: Math.min(46, 22 + factCount * 6), stack: 'vertical', gap: 10, align: 'stretch', valign: 'start' }
        ]
      : [
          { name: 'header', x: 7, y: 12, w: 38, h: titleWeight > 18 ? 24 : 20, stack: 'vertical', gap: 10, align: 'start', valign: 'start' },
          { name: 'body', x: 7, y: 46, w: 30, h: 16, stack: 'vertical', gap: 10, align: 'start', valign: 'start' },
          { name: 'rail', x: 64, y: 18, w: 22, h: Math.min(46, 22 + factCount * 6), stack: 'vertical', gap: 10, align: 'stretch', valign: 'start' }
        ];
  }

  if (role === 'manifesto') {
    const quoteHeight = quoteWeight > 42 ? 38 : quoteWeight > 28 ? 32 : 26;
    const factsY = Math.min(54, 22 + Math.max(0, quoteHeight - 26));
    return placement === 'right'
      ? [
          { name: 'header', x: 48, y: 12, w: 24, h: 16, stack: 'vertical', gap: 8, align: 'start', valign: 'start' },
          { name: 'quote', x: 40, y: 32, w: 36, h: quoteHeight, stack: 'vertical', gap: 10, align: 'start', valign: 'start' },
          { name: 'facts', x: 10, y: factsY, w: 24, h: 20 + factCount * 6, stack: 'vertical', gap: 10, align: 'stretch', valign: 'start' }
        ]
      : [
          { name: 'header', x: 8, y: 12, w: 24, h: 16, stack: 'vertical', gap: 8, align: 'start', valign: 'start' },
          { name: 'quote', x: 8, y: 32, w: 38, h: quoteHeight, stack: 'vertical', gap: 10, align: 'start', valign: 'start' },
          { name: 'facts', x: 58, y: factsY, w: 28, h: 20 + factCount * 6, stack: 'vertical', gap: 10, align: 'stretch', valign: 'start' }
        ];
  }

  if (role === 'highlights') {
    const twoCol = factCount > 3;
    return [
      { name: 'header', x: 7, y: 10, w: 34, h: 15, stack: 'vertical', gap: 8, align: 'start', valign: 'start' },
      { name: 'facts', x: 7, y: 27, w: 84, h: twoCol ? 42 : 30, stack: twoCol ? 'grid' : 'vertical', columns: factCount >= 5 ? 3 : (twoCol ? 2 : undefined), gap: twoCol ? 20 : 14, align: 'stretch', valign: 'start' }
    ];
  }

  if (role === 'timeline') {
    const headerHeight = 13;
    const timelineHeight = Math.min(62, 28 + timelineCount * 10);
    return [
      { name: 'header', x: 7, y: 8, w: 36, h: headerHeight, stack: 'vertical', gap: 8, align: 'start', valign: 'start' },
      { name: 'timeline', x: 7, y: 23, w: 86, h: timelineHeight, stack: 'vertical', gap: 0, align: 'stretch', valign: 'stretch' }
    ];
  }

  if (role === 'metrics') {
    const rightWidth = metricCount >= 3 ? 36 : 30;
    return placement === 'right'
      ? [
          { name: 'header', x: 46, y: 10, w: 28, h: 16, stack: 'vertical', gap: 8, align: 'start', valign: 'start' },
          { name: 'left', x: 46, y: 34, w: 30, h: 34, stack: 'vertical', gap: 12, align: 'stretch', valign: 'start' },
          { name: 'right', x: 8, y: 22, w: rightWidth, h: 42, stack: 'vertical', gap: 12, align: 'stretch', valign: 'start' }
        ]
      : [
          { name: 'header', x: 8, y: 10, w: 28, h: 16, stack: 'vertical', gap: 8, align: 'start', valign: 'start' },
          { name: 'left', x: 8, y: 34, w: 30, h: 34, stack: 'vertical', gap: 12, align: 'stretch', valign: 'start' },
          { name: 'right', x: 52, y: 20, w: rightWidth, h: 42, stack: 'vertical', gap: 12, align: 'stretch', valign: 'start' }
        ];
  }

  if (role === 'team') {
    return [
      { name: 'header', x: 7, y: 10, w: 30, h: 14, stack: 'vertical', gap: 8, align: 'start', valign: 'start' },
      { name: 'facts', x: 7, y: 28, w: 84, h: 44, stack: 'grid', columns: factCount >= 5 ? 3 : 2, gap: 18, align: 'stretch', valign: 'start' }
    ];
  }

  if (role === 'comparison') {
    return [
      { name: 'header', x: 7, y: 10, w: 30, h: 12, stack: 'vertical', gap: 8, align: 'start', valign: 'start' },
      { name: 'left', x: 7, y: 22, w: 38, h: 56, stack: 'vertical', gap: 10, align: 'stretch', valign: 'start' },
      { name: 'right', x: 56, y: 22, w: 32, h: 56, stack: 'vertical', gap: 10, align: 'stretch', valign: 'start' }
    ];
  }

  if (role === 'closing') {
    return placement === 'right'
      ? [
          { name: 'header', x: 48, y: 12, w: 26, h: 16, stack: 'vertical', gap: 8, align: 'start', valign: 'start' },
          { name: 'quote', x: 42, y: 34, w: 34, h: 24, stack: 'vertical', gap: 10, align: 'start', valign: 'start' },
          { name: 'facts', x: 10, y: 24, w: 24, h: 18, stack: 'vertical', gap: 10, align: 'stretch', valign: 'start' }
        ]
      : [
          { name: 'header', x: 8, y: 12, w: 26, h: 16, stack: 'vertical', gap: 8, align: 'start', valign: 'start' },
          { name: 'quote', x: 8, y: 34, w: 34, h: 24, stack: 'vertical', gap: 10, align: 'start', valign: 'start' },
          { name: 'facts', x: 58, y: 22, w: 26, h: 18, stack: 'vertical', gap: 10, align: 'stretch', valign: 'start' }
        ];
  }

  if (role === 'section') {
    const headerWidth = quoteWeight > 34 ? 40 : 36;
    const railHeight = 20 + factCount * 8;
    return placement === 'right'
      ? [
          { name: 'header', x: 44, y: 12, w: headerWidth, h: 20, stack: 'vertical', gap: 10, align: 'start', valign: 'start' },
          { name: 'body', x: 44, y: 38, w: 32, h: quoteWeight > 36 ? 28 : 24, stack: 'vertical', gap: 10, align: 'start', valign: 'start' },
          { name: 'rail', x: 8, y: 18, w: 24, h: railHeight, stack: 'vertical', gap: 10, align: 'stretch', valign: 'start' }
        ]
      : [
          { name: 'header', x: 7, y: 12, w: headerWidth, h: 20, stack: 'vertical', gap: 10, align: 'start', valign: 'start' },
          { name: 'body', x: 7, y: 38, w: 34, h: quoteWeight > 36 ? 28 : 24, stack: 'vertical', gap: 10, align: 'start', valign: 'start' },
          { name: 'rail', x: 64, y: 18, w: 22, h: railHeight, stack: 'vertical', gap: 10, align: 'stretch', valign: 'start' }
        ];
  }

  return page.regions || [];
}

module.exports = {
  stabilizePages,
  computeDynamicRegions,
};
