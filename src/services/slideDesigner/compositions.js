function resolveCompositionPresetKey(raw) {
  const key = typeof raw === 'string'
    ? raw.trim().toLowerCase()
    : (raw?.mode || raw?.name || 'editorial-left');

  const aliases = {
    'left-weighted': 'hero-asymmetric',
    'hero-layered': 'hero-asymmetric',
    'hero-split': 'hero-asymmetric',
    'hero-left': 'hero-asymmetric',
    'sidebar': 'split-editorial',
    'split': 'compare-columns',
    'split-columns': 'compare-columns',
    'two-column': 'compare-columns',
    'editorial': 'annotation-runway',
    'editorial-right': 'annotation-runway',
    'mosaic': 'highlights-board',
    'board': 'highlights-board',
    'stat-grid': 'staggered-metrics',
    'data-narrative': 'kpi-ledger',
    'metrics-ledger': 'kpi-ledger',
    'flow': 'schedule-strip',
    'timeline-strip': 'annotation-runway',
    'editorial-centered': 'manifesto-center',
    'centered-minimal': 'manifesto-center',
    'centered-close': 'manifesto-center',
    'closing-center': 'manifesto-center',
    'staff-grid': 'team-grid',
    'org-grid': 'team-grid',
  };

  if (aliases[key]) return aliases[key];
  if (/hero|cover|lead/.test(key)) return 'hero-asymmetric';
  if (/budget|cost/.test(key)) return 'budget-table';
  if (/ledger|kpi|metric|stat|data/.test(key)) return 'kpi-ledger';
  if (/risk|compare|versus|matrix|split/.test(key)) return 'risk-matrix';
  if (/timeline|schedule|flow|runway/.test(key)) return 'schedule-strip';
  if (/team|staff|crew/.test(key)) return 'team-grid';
  if (/grid|board|mosaic|highlight/.test(key)) return 'highlights-board';
  if (/quote|manifesto|center/.test(key)) return 'manifesto-center';
  if (/editorial|aside|sidebar/.test(key)) return 'split-editorial';
  return key || 'editorial-left';
}

function getCompositionPreset(page = {}) {
  const raw = page.compositionSpec || page.composition || page.visualIntent?.composition || 'editorial-left';
  const key = resolveCompositionPresetKey(raw);
  const presets = {
    'editorial-left': {
      regions: [
        { name: 'header', x: 6, y: 10, w: 42, h: 38, stack: 'vertical', gap: 16, align: 'start', valign: 'start' },
        { name: 'statement', x: 6, y: 64, w: 42, h: 18, stack: 'vertical', gap: 10, align: 'start', valign: 'end' },
        { name: 'facts', x: 66, y: 46, w: 24, h: 32, stack: 'vertical', gap: 10, align: 'stretch', valign: 'start' }
      ],
      imagePlacement: { mode: 'background', emphasis: 'atmosphere' }
    },
    'hero-asymmetric': {
      regions: [
        { name: 'header', x: 7, y: 12, w: 52, h: 42, stack: 'vertical', gap: 18, align: 'start', valign: 'start' },
        { name: 'body', x: 7, y: 62, w: 34, h: 18, stack: 'vertical', gap: 12, align: 'start', valign: 'end' },
        { name: 'rail', x: 72, y: 16, w: 16, h: 52, stack: 'vertical', gap: 10, align: 'stretch', valign: 'start' }
      ],
      imagePlacement: { mode: 'background', emphasis: 'hero' }
    },
    'split-editorial': {
      regions: [
        { name: 'left', x: 6, y: 10, w: 38, h: 72, stack: 'vertical', gap: 14, align: 'start', valign: 'start' },
        { name: 'right', x: 58, y: 18, w: 28, h: 56, stack: 'vertical', gap: 14, align: 'stretch', valign: 'start' }
      ],
      imagePlacement: { mode: 'background', emphasis: 'split' }
    },
    'stat-wall': {
      regions: [
        { name: 'header', x: 7, y: 10, w: 44, h: 18, stack: 'vertical', gap: 10, align: 'start', valign: 'start' },
        { name: 'stats', x: 7, y: 34, w: 86, h: 42, stack: 'grid', columns: 3, gap: 16, align: 'stretch', valign: 'stretch' }
      ],
      imagePlacement: { mode: 'background', emphasis: 'texture' }
    },
    'staggered-metrics': {
      regions: [
        { name: 'header', x: 7, y: 10, w: 40, h: 18, stack: 'vertical', gap: 10, align: 'start', valign: 'start' },
        { name: 'stats', x: 7, y: 30, w: 84, h: 44, stack: 'grid', columns: 3, gap: 22, align: 'stretch', valign: 'start' }
      ],
      imagePlacement: { mode: 'background', emphasis: 'texture' }
    },
    'highlights-board': {
      regions: [
        { name: 'header', x: 7, y: 10, w: 34, h: 18, stack: 'vertical', gap: 10, align: 'start', valign: 'start' },
        { name: 'facts', x: 7, y: 32, w: 84, h: 42, stack: 'vertical', gap: 16, align: 'stretch', valign: 'start' }
      ],
      imagePlacement: { mode: 'background', emphasis: 'texture' }
    },
    'annotation-runway': {
      regions: [
        { name: 'header', x: 7, y: 12, w: 30, h: 18, stack: 'vertical', gap: 10, align: 'start', valign: 'start' },
        { name: 'body', x: 7, y: 44, w: 38, h: 24, stack: 'vertical', gap: 10, align: 'start', valign: 'start' },
        { name: 'facts', x: 58, y: 18, w: 30, h: 44, stack: 'vertical', gap: 12, align: 'stretch', valign: 'start' }
      ],
      imagePlacement: { mode: 'background', emphasis: 'split' }
    },
    'compare-columns': {
      regions: [
        { name: 'header', x: 7, y: 10, w: 34, h: 18, stack: 'vertical', gap: 10, align: 'start', valign: 'start' },
        { name: 'left', x: 7, y: 28, w: 38, h: 46, stack: 'vertical', gap: 12, align: 'stretch', valign: 'start' },
        { name: 'right', x: 56, y: 28, w: 32, h: 46, stack: 'vertical', gap: 12, align: 'stretch', valign: 'start' }
      ],
      imagePlacement: { mode: 'background', emphasis: 'split' }
    },
    'ledger-split': {
      regions: [
        { name: 'header', x: 7, y: 10, w: 34, h: 18, stack: 'vertical', gap: 10, align: 'start', valign: 'start' },
        { name: 'left', x: 7, y: 36, w: 36, h: 34, stack: 'vertical', gap: 12, align: 'stretch', valign: 'start' },
        { name: 'right', x: 52, y: 24, w: 34, h: 42, stack: 'vertical', gap: 12, align: 'stretch', valign: 'start' }
      ],
      imagePlacement: { mode: 'background', emphasis: 'texture' }
    },
    'budget-table': {
      regions: [
        { name: 'header', x: 7, y: 10, w: 30, h: 16, stack: 'vertical', gap: 8, align: 'start', valign: 'start' },
        { name: 'left', x: 7, y: 32, w: 26, h: 40, stack: 'vertical', gap: 12, align: 'stretch', valign: 'start' },
        { name: 'right', x: 38, y: 22, w: 50, h: 50, stack: 'vertical', gap: 12, align: 'stretch', valign: 'start', panel: 'soft' }
      ],
      imagePlacement: { mode: 'background', emphasis: 'texture' }
    },
    'risk-matrix': {
      regions: [
        { name: 'header', x: 7, y: 10, w: 32, h: 14, stack: 'vertical', gap: 8, align: 'start', valign: 'start' },
        { name: 'left', x: 7, y: 28, w: 38, h: 48, stack: 'vertical', gap: 12, align: 'stretch', valign: 'start', panel: 'soft' },
        { name: 'right', x: 54, y: 28, w: 34, h: 48, stack: 'vertical', gap: 12, align: 'stretch', valign: 'start', panel: 'soft' }
      ],
      imagePlacement: { mode: 'background', emphasis: 'split' }
    },
    'team-grid': {
      regions: [
        { name: 'header', x: 7, y: 10, w: 30, h: 14, stack: 'vertical', gap: 8, align: 'start', valign: 'start' },
        { name: 'facts', x: 7, y: 28, w: 84, h: 44, stack: 'grid', columns: 2, gap: 18, align: 'stretch', valign: 'start' }
      ],
      imagePlacement: { mode: 'background', emphasis: 'texture' }
    },
    'schedule-strip': {
      regions: [
        { name: 'header', x: 7, y: 8, w: 32, h: 14, stack: 'vertical', gap: 8, align: 'start', valign: 'start' },
        { name: 'timeline', x: 7, y: 24, w: 86, h: 52, stack: 'vertical', gap: 0, align: 'stretch', valign: 'stretch' }
      ],
      imagePlacement: { mode: 'background', emphasis: 'split' }
    },
    'kpi-ledger': {
      regions: [
        { name: 'header', x: 7, y: 10, w: 28, h: 15, stack: 'vertical', gap: 8, align: 'start', valign: 'start' },
        { name: 'left', x: 7, y: 32, w: 24, h: 38, stack: 'vertical', gap: 12, align: 'stretch', valign: 'start' },
        { name: 'right', x: 38, y: 22, w: 50, h: 48, stack: 'vertical', gap: 18, align: 'stretch', valign: 'start' }
      ],
      imagePlacement: { mode: 'background', emphasis: 'texture' }
    },
    'manifesto-center': {
      regions: [
        { name: 'header', x: 10, y: 14, w: 34, h: 20, stack: 'vertical', gap: 10, align: 'start', valign: 'start' },
        { name: 'quote', x: 10, y: 40, w: 44, h: 28, stack: 'vertical', gap: 10, align: 'start', valign: 'start' },
        { name: 'facts', x: 66, y: 18, w: 22, h: 42, stack: 'vertical', gap: 12, align: 'stretch', valign: 'start' }
      ],
      imagePlacement: { mode: 'background', emphasis: 'editorial' }
    }
  };
  return presets[key] || presets['editorial-left'];
}

function mergeStructuredSpec(page = {}) {
  const preset = getCompositionPreset(page);
  const incoming = typeof page.composition === 'object' ? page.composition : {};
  return {
    ...preset,
    ...incoming,
    imagePlacement: {
      ...(preset.imagePlacement || {}),
      ...(page.imagePlacement || {}),
      ...(incoming.imagePlacement || {}),
    },
    regions: Array.isArray(page.regions) && page.regions.length ? page.regions : (incoming.regions || preset.regions || []),
  };
}

module.exports = {
  resolveCompositionPresetKey,
  getCompositionPreset,
  mergeStructuredSpec,
};
