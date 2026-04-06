const FONTS = "'Geist', 'SF Pro Display', 'PingFang SC', 'Noto Sans SC', system-ui, sans-serif";

const SLIDE_CSS = `
*,*::before,*::after{box-sizing:border-box}*{margin:0;padding:0}
.slide{width:960px;height:540px;position:relative;overflow:hidden;font-family:var(--font-body);color:var(--text)}

/* immersive_cover */
.ic{display:flex;align-items:center}
.ic-content{position:relative;z-index:2;height:100%;display:flex;flex-direction:column;justify-content:center;padding:0 80px;}
.ic-brand{font-size:13px;font-weight:500;color:var(--accent);letter-spacing:0.15em;text-transform:uppercase;margin-bottom:20px;}
.ic-title{font-size:56px;font-weight:900;line-height:1.1;letter-spacing:-0.02em;margin-bottom:16px;max-width:700px;}
.ic-subtitle{font-size:22px;color:rgba(255,255,255,0.72);line-height:1.5;margin-bottom:32px;max-width:600px;}
.ic-meta{display:flex;gap:24px;font-size:14px;color:rgba(255,255,255,0.5);}
.ic-accent-bar{position:absolute;left:0;top:0;bottom:0;width:4px;}
.ic-corner{position:absolute;border-radius:50%;}

/* bento_grid */
.bento{display:flex;flex-direction:column}
.bento-inner{position:relative;z-index:2;padding:40px 48px;height:100%;}
.bento-title{font-size:28px;font-weight:700;margin-bottom:28px;padding-bottom:16px;border-bottom:1px solid var(--border);}
.bento-grid{display:grid;gap:16px;}
.bento-2{grid-template-columns:repeat(2,1fr)}
.bento-3{grid-template-columns:repeat(3,1fr)}
.bento-4{grid-template-columns:repeat(4,1fr)}
.bento-card{display:flex;flex-direction:column;gap:12px;padding:24px;border-radius:var(--radius-lg);border:1px solid var(--border);}
.bc-tag{font-size:11px;font-weight:700;color:var(--accent);letter-spacing:0.1em;text-transform:uppercase;}
.bc-title{font-size:18px;font-weight:700;line-height:1.3;}
.bc-desc{font-size:13px;color:var(--text-muted);line-height:1.6;flex:1;}
.bc-metrics{display:flex;gap:16px;margin-top:8px;}
.bc-metrics>div{text-align:center}
.bc-metrics .dc-value{font-size:24px;font-weight:900;color:var(--primary)}

/* split_content */
.split{display:grid;grid-template-columns:1fr 1fr;height:100%}
.split-inner{position:relative;z-index:2;display:grid;grid-template-columns:1fr 1fr;height:100%}
.split-left,.split-right{padding:48px;display:flex;flex-direction:column;border-right:1px solid var(--border)}
.split-right{border-right:none}
.split h2{font-size:24px;font-weight:700;margin-bottom:20px}
.split ul{list-style:none;flex:1}

/* timeline_flow */
.timeline{display:flex;flex-direction:column}
.timeline-inner{position:relative;z-index:2;padding:40px 48px;height:100%;display:flex;flex-direction:column}
.timeline h2{font-size:26px;font-weight:700;margin-bottom:28px}
.timeline-row{display:flex;gap:16px;flex:1;align-items:stretch}
.tl-phase{flex:1;border-radius:var(--radius-lg);overflow:hidden;border:1px solid var(--border)}
.tl-phase-header{padding:12px 16px}
.tl-phase-header div:first-child{font-size:12px;color:rgba(255,255,255,0.6);margin-bottom:4px}
.tl-phase-header div:last-child{font-size:15px;font-weight:700;color:#fff}
.tl-phase-body{padding:16px}
.tl-phase-body ul{list-style:none}
.tl-phase-body li{font-size:12px;line-height:1.6;padding:4px 0;padding-left:12px;position:relative}

/* minimal_text */
.minimal{display:flex;flex-direction:column}
.minimal-inner{position:relative;z-index:2;height:100%;display:flex;flex-direction:column;justify-content:center;padding:64px 96px}
.minimal h2{font-size:42px;font-weight:900;line-height:1.15;letter-spacing:-0.02em;margin-bottom:16px;max-width:700px}
.minimal p{font-size:15px;color:var(--text-muted);line-height:1.8;max-width:580px}
.minimal .highlight{margin-top:32px;padding:20px 24px;border-radius:var(--radius-md);border-left:3px solid var(--accent);max-width:520px}

/* data_cards */
.data{display:flex;flex-direction:column}
.data-inner{position:relative;z-index:2;padding:40px 48px;height:100%;display:flex;flex-direction:column;justify-content:center}
.data h2{font-size:26px;font-weight:700;margin-bottom:32px}
.data-grid{display:grid;gap:20px}
.dc-card{background:var(--surface);border-radius:var(--radius-lg);padding:24px;border:1px solid var(--border);text-align:center}
.dc-value{font-size:36px;font-weight:900;color:var(--primary);line-height:1;margin-bottom:8px}

/* image_statement */
.image-statement{display:grid;grid-template-columns:1.2fr .8fr;height:100%}
.is-copy,.is-visual{position:relative;z-index:2}

/* editorial_quote */
.editorial{display:grid;grid-template-columns:1.15fr .85fr;height:100%}

/* asymmetrical_story */
.story{display:grid;grid-template-columns:1.15fr .85fr;height:100%}

/* end_card */
.end{display:flex;flex-direction:column;align-items:center;justify-content:center}
.end-inner{position:relative;z-index:2;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:48px}
.end h1{font-size:56px;font-weight:900;line-height:1.1;margin-bottom:16px}
.end p{font-size:20px;color:rgba(255,255,255,0.62);margin-bottom:32px}
.end div{font-size:14px;color:rgba(255,255,255,0.4);letter-spacing:0.1em}

/* toc */
.toc{display:grid;grid-template-columns:240px 1fr;height:100%}
.toc-sidebar{background:var(--primary);padding:48px 32px;display:flex;flex-direction:column;justify-content:center}
.toc-sidebar .toc-label{font-size:11px;color:rgba(255,255,255,0.5);letter-spacing:0.12em;text-transform:uppercase;margin-bottom:12px}
.toc-sidebar .toc-title{font-size:36px;font-weight:900;color:#fff;line-height:1.1}
.toc-sidebar .toc-line{width:32px;height:2px;background:rgba(255,255,255,0.3);margin-top:20px}
.toc-content{padding:48px 56px;display:flex;flex-direction:column;justify-content:center}
.toc-item{padding:12px 0;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:16px}
.toc-item span:first-child{font-size:20px;font-weight:900;color:var(--primary);opacity:0.5;min-width:32px}
.toc-item span:last-child{font-size:15px;font-weight:500}

/* structured composition */
.structured{display:block}
.sc-canvas{position:absolute;inset:0;z-index:2;display:grid;align-content:start}
.sc-layer{position:relative;z-index:1;min-width:0;min-height:0}
.sc-region{position:relative;z-index:2;display:flex;min-width:0;min-height:0}
.sc-stack{display:flex;width:100%;min-height:100%;height:auto}
.sc-block{display:flex;flex-direction:column;min-width:0}
`;

const DESIGN_TOKENS = {
  dark_tech: {
    colors: {
      primary: '#2563EB',
      secondary: '#0F172A',
      accent: '#C0A062',
      bg: '#0A0F1A',
      bgAlt: '#111827',
      surface: '#1E293B',
      text: '#F8FAFC',
      textMuted: '#94A3B8',
      border: 'rgba(255,255,255,0.08)',
    },
    typography: {
      fontDisplay: FONTS,
      fontBody: FONTS,
      weightNormal: 400,
      weightMedium: 500,
      weightBold: 700,
      weightBlack: 800,
    },
    spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48, xxxl: 64 },
    radius: { sm: 4, md: 8, lg: 16, xl: 24, full: 9999 },
    shadow: {
      sm: '0 2px 8px rgba(0,0,0,0.3)',
      md: '0 8px 24px rgba(0,0,0,0.4)',
      lg: '0 20px 48px rgba(0,0,0,0.5)',
      glow: '0 0 60px rgba(37,99,235,0.2)',
      accentGlow: '0 0 40px rgba(192,160,98,0.3)',
    },
  },
  light_minimal: {
    colors: {
      primary: '#2563EB',
      secondary: '#1E293B',
      accent: '#C0A062',
      bg: '#FFFFFF',
      bgAlt: '#F8FAFC',
      surface: '#F1F5F9',
      text: '#0F172A',
      textMuted: '#64748B',
      border: 'rgba(0,0,0,0.08)',
    },
    typography: {
      fontDisplay: FONTS,
      fontBody: FONTS,
      weightNormal: 400,
      weightMedium: 500,
      weightBold: 700,
      weightBlack: 800,
    },
    spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48, xxxl: 64 },
    radius: { sm: 4, md: 8, lg: 16, xl: 24, full: 9999 },
    shadow: {
      sm: '0 1px 3px rgba(0,0,0,0.06)',
      md: '0 4px 12px rgba(0,0,0,0.08)',
      lg: '0 12px 32px rgba(0,0,0,0.12)',
      glow: '0 0 40px rgba(37,99,235,0.1)',
      accentGlow: '0 0 30px rgba(192,160,98,0.15)',
    },
  },
  warm_premium: {
    colors: {
      primary: '#92400E',
      secondary: '#1C1917',
      accent: '#D97706',
      bg: '#FAF7F2',
      bgAlt: '#F5F0E8',
      surface: '#FFFFFF',
      text: '#1C1917',
      textMuted: '#78716C',
      border: 'rgba(28,25,23,0.1)',
    },
    typography: {
      fontDisplay: FONTS,
      fontBody: FONTS,
      weightNormal: 400,
      weightMedium: 500,
      weightBold: 700,
      weightBlack: 800,
    },
    spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48, xxxl: 64 },
    radius: { sm: 4, md: 8, lg: 16, xl: 24, full: 9999 },
    shadow: {
      sm: '0 1px 4px rgba(28,25,23,0.06)',
      md: '0 4px 16px rgba(28,25,23,0.1)',
      lg: '0 16px 40px rgba(28,25,23,0.12)',
      glow: '0 0 40px rgba(217,119,6,0.12)',
      accentGlow: '0 0 30px rgba(146,64,14,0.15)',
    },
  },
};

function esc(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function toPercent(value, fallback) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return `${clamp(value, 0, 100)}%`;
  }
  if (typeof value === 'string' && value.trim()) return value.trim();
  return fallback;
}

function toPx(value, fallback = 0) {
  if (typeof value === 'number' && Number.isFinite(value)) return `${Math.max(0, value)}px`;
  if (typeof value === 'string' && value.trim()) return value.trim();
  return `${fallback}px`;
}

function toPercentNumber(value, fallback = 0) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return clamp(value, 0, 100);
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = parseFloat(value);
    if (Number.isFinite(parsed)) return clamp(parsed, 0, 100);
  }
  return fallback;
}

function hasStructuredComposition(page) {
  return Boolean(
    page?.composition || page?.compositionSpec ||
    (Array.isArray(page?.regions) && page.regions.length) ||
    (Array.isArray(page?.textBlocks) && page.textBlocks.length) ||
    page?.imagePlacement
  );
}

function buildCssVars(style) {
  const t = style.tokens;
  return Object.entries({
    '--primary': t.colors.primary,
    '--secondary': t.colors.secondary,
    '--accent': t.colors.accent,
    '--bg': t.colors.bg,
    '--bg-alt': t.colors.bgAlt,
    '--surface': t.colors.surface,
    '--text': t.colors.text,
    '--text-muted': t.colors.textMuted,
    '--border': t.colors.border,
    '--font-display': t.typography.fontDisplay,
    '--font-body': t.typography.fontBody,
    '--weight-normal': t.typography.weightNormal,
    '--weight-medium': t.typography.weightMedium,
    '--weight-bold': t.typography.weightBold,
    '--weight-black': t.typography.weightBlack,
    '--radius-sm': t.radius.sm + 'px',
    '--radius-md': t.radius.md + 'px',
    '--radius-lg': t.radius.lg + 'px',
    '--radius-xl': t.radius.xl + 'px',
    '--shadow-sm': t.shadow.sm,
    '--shadow-md': t.shadow.md,
    '--shadow-lg': t.shadow.lg,
    '--shadow-glow': t.shadow.glow,
    '--shadow-accent-glow': t.shadow.accentGlow,
  }).map(([k, v]) => `${k}:${v}`).join(';');
}

function shouldUseBackground(page) {
  return Boolean(page?.bgImage) && page?.imageStrategy?.useBackground !== false && (page?.imageStrategy?.treatment || 'ambient-texture') !== 'none';
}

function resolveOverlay(page, fallback = 0.42) {
  if (typeof page?.imageStrategy?.overlay === 'number') return page.imageStrategy.overlay;
  if (typeof page?.imageAnalysis?.recommendedOverlay === 'number') return page.imageAnalysis.recommendedOverlay;
  return fallback;
}

function resolveTextPlacement(page, fallback = 'left') {
  return page?.imageStrategy?.textPlacement
    || page?.imageAnalysis?.safestTextPlacement
    || fallback;
}

function renderBackgroundLayers(page, options = {}) {
  if (!shouldUseBackground(page)) return '';

  const treatment = page?.imageStrategy?.treatment || options.fallbackTreatment || 'ambient-texture';
  const overlay = resolveOverlay(page, options.defaultOverlay ?? 0.42);
  const placement = resolveTextPlacement(page, options.defaultPlacement || 'left');
  const focal = page?.imageStrategy?.focalPoint || 'center';
  const positionMap = {
    left: '20% center',
    right: '80% center',
    center: 'center center',
    'left-center': '26% center',
    'right-center': '74% center',
    top: 'center 24%',
    bottom: 'center 76%',
  };
  const bgPosition = positionMap[focal] || positionMap.center;
  const imageStyle = `position:absolute;inset:0;background-image:url('${page.bgImage}');background-size:cover;background-position:${bgPosition};`;

  const fadeDirection = placement === 'right'
    ? '90deg'
    : placement === 'left'
      ? '270deg'
      : placement === 'top'
        ? '180deg'
        : '0deg';

  switch (treatment) {
    case 'full-bleed-dark':
      return `
  <div style="${imageStyle}opacity:0.9;filter:saturate(1.08) contrast(1.06) brightness(0.88);"></div>
  <div style="position:absolute;left:0;top:0;bottom:0;width:54%;background:linear-gradient(90deg, rgba(9,14,22,${Math.max(0.62, overlay - 0.02).toFixed(2)}) 0%, rgba(9,14,22,${Math.max(0.28, overlay - 0.2).toFixed(2)}) 62%, rgba(9,14,22,0.06) 100%);"></div>
  <div style="position:absolute;inset:0;background:linear-gradient(180deg, rgba(9,14,22,0.06) 0%, rgba(9,14,22,0.28) 100%);"></div>`;
    case 'editorial-fade':
      return `
  <div style="${imageStyle}opacity:0.74;filter:saturate(1.08) contrast(1.08) brightness(0.82);"></div>
  <div style="position:absolute;left:0;top:0;bottom:0;width:52%;background:linear-gradient(90deg, rgba(9,14,22,${Math.max(0.72, overlay + 0.1).toFixed(2)}) 0%, rgba(9,14,22,${Math.max(0.28, overlay - 0.18).toFixed(2)}) 72%, rgba(9,14,22,0.04) 100%);"></div>
  <div style="position:absolute;inset:0;background:linear-gradient(180deg, rgba(10,14,24,0.04) 0%, rgba(10,14,24,0.18) 100%);"></div>`;
    case 'split-atmosphere':
      return `
  <div style="${imageStyle}opacity:0.62;filter:saturate(1.06) contrast(1.08) brightness(0.84);"></div>
  <div style="position:absolute;left:0;top:0;bottom:0;width:54%;background:linear-gradient(90deg, rgba(9,14,22,${Math.max(0.68, overlay + 0.18).toFixed(2)}) 0%, rgba(9,14,22,${Math.max(0.36, overlay).toFixed(2)}) 68%, rgba(9,14,22,0.08) 100%);"></div>
  <div style="position:absolute;inset:0;background:linear-gradient(110deg, rgba(9,14,22,0.02) 0%, rgba(9,14,22,0.12) 54%, rgba(9,14,22,0.24) 100%);"></div>`;
    case 'dark-paneled':
      return `
  <div style="${imageStyle}opacity:0.58;filter:saturate(1) contrast(1.06) brightness(0.82);"></div>
  <div style="position:absolute;inset:0;background:linear-gradient(90deg, rgba(9,14,22,${Math.max(0.54, overlay - 0.04).toFixed(2)}) 0%, rgba(9,14,22,${Math.max(0.22, overlay - 0.2).toFixed(2)}) 56%, rgba(9,14,22,0.08) 100%);"></div>`;
    case 'subtle-grid':
      return `
  <div style="${imageStyle}opacity:0.18;filter:grayscale(0.04) saturate(0.92) contrast(1.04);"></div>
  <div style="position:absolute;inset:0;background:linear-gradient(180deg, rgba(9,14,22,${Math.max(0.32, overlay - 0.16).toFixed(2)}) 0%, rgba(9,14,22,${Math.max(0.18, overlay - 0.26).toFixed(2)}) 100%);"></div>
  <div style="position:absolute;inset:18px;border:1px solid rgba(255,255,255,0.06);pointer-events:none;"></div>`;
    case 'quiet-finale':
      return `
  <div style="${imageStyle}opacity:0.74;filter:saturate(1.04) contrast(1.05);"></div>
  <div style="position:absolute;inset:0;background:radial-gradient(circle at center, rgba(9,14,22,${Math.max(0.08, overlay - 0.2).toFixed(2)}) 0%, rgba(9,14,22,${Math.max(0.28, overlay - 0.14).toFixed(2)}) 56%, rgba(9,14,22,${Math.max(0.46, overlay).toFixed(2)}) 100%);"></div>`;
    case 'dim-atmosphere':
      return `
  <div style="${imageStyle}opacity:0.54;filter:saturate(1.06) contrast(1.06) brightness(0.82);"></div>
  <div style="position:absolute;inset:0;background:linear-gradient(180deg, rgba(9,14,22,${Math.max(0.18, overlay - 0.4).toFixed(2)}) 0%, rgba(9,14,22,${Math.max(0.34, overlay - 0.22).toFixed(2)}) 58%, rgba(9,14,22,${Math.max(0.52, overlay - 0.06).toFixed(2)}) 100%);"></div>
  <div style="position:absolute;left:0;right:0;bottom:0;height:34%;background:linear-gradient(180deg, rgba(9,14,22,0) 0%, rgba(9,14,22,0.22) 18%, rgba(9,14,22,0.56) 100%);"></div>`;
    case 'ambient-texture':
    default:
      return `
  <div style="${imageStyle}opacity:0.18;filter:saturate(1) contrast(1.05);"></div>
  <div style="position:absolute;inset:0;background:linear-gradient(135deg, rgba(9,14,22,${Math.max(0.14, overlay - 0.2).toFixed(2)}) 0%, rgba(9,14,22,${Math.max(0.08, overlay - 0.28).toFixed(2)}) 100%);"></div>
  <div style="position:absolute;inset:18px;border:1px solid rgba(255,255,255,0.06);pointer-events:none;"></div>`;
  }
}

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

function buildStructuredGridSpec(spec = {}) {
  const regionList = Array.isArray(spec.regions) ? spec.regions : [];
  const items = [
    ...regionList,
    ...(((spec.imagePlacement?.mode || 'background') === 'background' || !spec.imagePlacement) ? [] : [spec.imagePlacement]),
  ].filter(Boolean);

  const xStops = [0, 100];
  const yStops = [0, 100];

  items.forEach((item) => {
    const x = toPercentNumber(item.x, 0);
    const y = toPercentNumber(item.y, 0);
    const w = toPercentNumber(item.w, 100);
    const h = toPercentNumber(item.h, 100);
    xStops.push(x, clamp(x + w, 0, 100));
    yStops.push(y, clamp(y + h, 0, 100));
  });

  const normalizeStops = (values) => values
    .map(value => Math.round(value * 100) / 100)
    .sort((a, b) => a - b)
    .filter((value, index, list) => index === 0 || Math.abs(value - list[index - 1]) > 0.25);

  const cols = normalizeStops(xStops);
  const rows = normalizeStops(yStops);
  const colTracks = cols.slice(0, -1).map((start, index) => Math.max(1, cols[index + 1] - start));
  const rowTracks = rows.slice(0, -1).map((start, index) => Math.max(1, rows[index + 1] - start));

  return { cols, rows, colTracks, rowTracks };
}

function resolveStructuredGridPlacement(item = {}, gridSpec) {
  const cols = gridSpec?.cols || [0, 100];
  const rows = gridSpec?.rows || [0, 100];
  const x = toPercentNumber(item.x, 0);
  const y = toPercentNumber(item.y, 0);
  const w = toPercentNumber(item.w, 100);
  const h = toPercentNumber(item.h, 100);
  const endX = clamp(x + w, 0, 100);
  const endY = clamp(y + h, 0, 100);

  const findLine = (stops, target, fallback) => {
    const rounded = Math.round(target * 100) / 100;
    const exact = stops.findIndex(value => Math.abs(value - rounded) <= 0.25);
    return (exact >= 0 ? exact : fallback) + 1;
  };

  const colStart = findLine(cols, x, 0);
  const colEnd = Math.max(colStart + 1, findLine(cols, endX, cols.length - 1));
  const rowStart = findLine(rows, y, 0);
  const rowEnd = Math.max(rowStart + 1, findLine(rows, endY, rows.length - 1));

  return { colStart, colEnd, rowStart, rowEnd };
}

function renderStructuredGridCanvas(gridSpec, contentHtml = '') {
  const colTemplate = (gridSpec.colTracks.length ? gridSpec.colTracks : [100])
    .map(track => `minmax(0, ${track}fr)`)
    .join(' ');
  const rowTemplate = (gridSpec.rowTracks.length ? gridSpec.rowTracks : [100])
    .map(track => `minmax(${Math.max(16, Math.round(5.4 * track))}px, auto)`)
    .join(' ');

  return `<div class="sc-canvas" style="grid-template-columns:${colTemplate};grid-template-rows:${rowTemplate};">${contentHtml}</div>`;
}

function normalizeBlocks(page = {}) {
  if (Array.isArray(page.textBlocks) && page.textBlocks.length) return page.textBlocks;
  const blocks = [];
  const facts = Array.isArray(page.facts) ? page.facts : [];
  const metrics = Array.isArray(page.metrics) ? page.metrics : [];
  const points = Array.isArray(page.points) ? page.points : [];
  const phases = Array.isArray(page.phases) ? page.phases : [];
  if (page.eyebrow) blocks.push({ region: 'header', kind: 'eyebrow', text: page.eyebrow });
  if (page.title) blocks.push({ region: 'header', kind: 'title', text: page.title });
  if (page.subtitle) blocks.push({ region: 'header', kind: 'subtitle', text: page.subtitle });
  if (page.story || page.body) blocks.push({ region: 'body', kind: 'body', text: page.story || page.body });
  if (page.quote) blocks.push({ region: 'quote', kind: 'quote', text: page.quote });
  if (points.length) blocks.push({ region: 'rail', kind: 'numbered-list', items: points });
  if (facts.length) blocks.push({ region: 'facts', kind: 'fact-list', items: facts });
  if (metrics.length) blocks.push({ region: 'stats', kind: 'stats', items: metrics });
  if (phases.length) blocks.push({ region: 'timeline', kind: 'timeline', items: phases });
  if (Array.isArray(page.leftItems) && page.leftItems.length) {
    blocks.push({ region: 'left', kind: 'fact-list', title: page.leftTitle || '', items: page.leftItems });
  }
  if (Array.isArray(page.rightItems) && page.rightItems.length) {
    blocks.push({ region: 'right', kind: 'fact-list', title: page.rightTitle || '', items: page.rightItems });
  }
  return blocks;
}

function getPageRole(page = {}) {
  return page?.visualIntent?.role || page?.layout || page?.type || 'content';
}

function chooseListVariant(page, block) {
  const role = getPageRole(page);
  const count = Array.isArray(block?.items) ? block.items.length : 0;
  const longest = Math.max(0, ...(block?.items || []).map(item => String(item || '').length));
  if (role === 'cover') return count <= 3 ? 'quiet-lines' : 'side-notes';
  if (role === 'manifesto') return longest > 28 ? 'compact-notes' : 'side-notes';
  if (role === 'highlights') return 'floating-tags';
  if (role === 'team') return 'team-cards';
  if (role === 'closing') return 'quiet-lines';
  if (role === 'section' && count <= 4) return longest > 26 ? 'compact-notes' : 'side-notes';
  if (role === 'toc' || role === 'comparison') return 'editorial-list';
  return longest > 28 ? 'compact-notes' : 'editorial-list';
}

function chooseStatsVariant(page) {
  const role = getPageRole(page);
  if (role === 'metrics') return 'ledger';
  if (role === 'highlights') return 'staggered-notes';
  if (role === 'comparison') return 'annotation-strip';
  return 'strip';
}

function chooseTimelineVariant(page) {
  const role = getPageRole(page);
  return role === 'timeline' ? 'editorial-steps' : 'cards';
}

function getTypeScale(page = {}, block = {}) {
  const role = getPageRole(page);
  const kind = block.kind || 'body';
  const scales = {
    cover: {
      title: 48,
      subtitle: 16,
      body: 13,
      quote: 28,
      fact: 13,
      metric: 34,
      eyebrow: 11,
    },
    manifesto: {
      title: 38,
      subtitle: 15,
      body: 14,
      quote: 25,
      fact: 13,
      metric: 32,
      eyebrow: 11,
    },
    highlights: {
      title: 40,
      subtitle: 15,
      body: 13,
      quote: 24,
      fact: 12,
      metric: 30,
      eyebrow: 11,
    },
    section: {
      title: 40,
      subtitle: 15,
      body: 14,
      quote: 22,
      fact: 12,
      metric: 30,
      eyebrow: 11,
    },
    timeline: {
      title: 30,
      subtitle: 13,
      body: 13,
      quote: 22,
      fact: 12,
      metric: 28,
      eyebrow: 11,
    },
    metrics: {
      title: 36,
      subtitle: 14,
      body: 13,
      quote: 22,
      fact: 12,
      metric: 32,
      eyebrow: 11,
    },
    team: {
      title: 34,
      subtitle: 14,
      body: 13,
      quote: 22,
      fact: 12,
      metric: 28,
      eyebrow: 11,
    },
    comparison: {
      title: 36,
      subtitle: 14,
      body: 13,
      quote: 22,
      fact: 12,
      metric: 28,
      eyebrow: 11,
    },
    closing: {
      title: 42,
      subtitle: 15,
      body: 13,
      quote: 24,
      fact: 12,
      metric: 28,
      eyebrow: 11,
    },
    toc: {
      title: 36,
      subtitle: 14,
      body: 13,
      quote: 20,
      fact: 14,
      metric: 28,
      eyebrow: 11,
    },
    content: {
      title: 38,
      subtitle: 15,
      body: 14,
      quote: 22,
      fact: 12,
      metric: 30,
      eyebrow: 11,
    },
  };
  const scale = scales[role] || scales.content;
  if (kind === 'eyebrow') return scale.eyebrow;
  if (kind === 'title') return scale.title;
  if (kind === 'subtitle') return scale.subtitle;
  if (kind === 'quote') return scale.quote;
  if (kind === 'stats') return scale.metric;
  if (kind === 'fact-list' || kind === 'numbered-list' || kind === 'timeline') return scale.fact;
  return scale.body;
}

function chooseRegionStyle(page, region, blocks) {
  const role = getPageRole(page);
  if (!blocks.length) return { surface: 'none', padding: region.padding };
  if (region.name === 'header' || region.name === 'body' || region.name === 'statement' || region.name === 'quote') {
    return { surface: 'none', padding: region.padding };
  }
  if (region.name === 'timeline') {
    return { surface: 'none', padding: region.padding };
  }
  if (role === 'highlights' && region.name === 'stats') {
    return { surface: 'rule', padding: 0 };
  }
  if (role === 'team' && region.name === 'facts') {
    return { surface: 'none', padding: 0 };
  }
  if (role === 'metrics' && region.name === 'stats') {
    return { surface: 'rule', padding: 0 };
  }
  if (role === 'comparison') {
    return { surface: 'rule', padding: 0 };
  }
  if (role === 'cover' || role === 'manifesto') {
    return { surface: 'edge-fade', padding: 0 };
  }
  if (role === 'section') {
    return { surface: 'ghost', padding: 0 };
  }
  if (role === 'highlights' || role === 'metrics' || role === 'team') {
    return { surface: 'none', padding: 0 };
  }
  if (role === 'timeline') {
    return { surface: 'rule', padding: 0 };
  }
  return { surface: 'ghost', padding: 0 };
}

function renderStructuredBlock(block, style, page = {}) {
  const accent = style.tokens.colors.accent;
  const typeSize = getTypeScale(page, block);
  switch (block.kind) {
    case 'eyebrow':
      return `<div class="sc-block" style="font-size:${block.size || typeSize}px;font-weight:var(--weight-bold);letter-spacing:0.14em;text-transform:uppercase;color:${accent};">${esc(block.text)}</div>`;
    case 'title':
      return `<div class="sc-block" style="font-size:${block.size || typeSize}px;font-weight:var(--weight-black);line-height:1.04;letter-spacing:-0.035em;color:var(--text);text-wrap:balance;">${esc(block.text)}</div>`;
    case 'subtitle':
      return `<div class="sc-block" style="font-size:${block.size || typeSize}px;line-height:${block.lineHeight || 1.6};color:var(--text-muted);max-width:100%;text-wrap:pretty;">${esc(block.text)}</div>`;
    case 'body':
      return `<div class="sc-block" style="font-size:${block.size || typeSize}px;line-height:${block.lineHeight || 1.75};color:${block.strong ? 'var(--text)' : 'var(--text-muted)'};max-width:100%;text-wrap:pretty;display:-webkit-box;-webkit-line-clamp:${block.clamp || 6};-webkit-box-orient:vertical;overflow:hidden;">${esc(block.text)}</div>`;
    case 'quote':
      return `<div class="sc-block" style="padding-left:18px;border-left:2px solid ${accent};font-size:${block.size || typeSize}px;line-height:${block.lineHeight || 1.42};color:#fff;text-wrap:balance;display:-webkit-box;-webkit-line-clamp:${block.clamp || 5};-webkit-box-orient:vertical;overflow:hidden;">${esc(block.text)}</div>`;
    case 'fact-list': {
      const variant = block.variant || chooseListVariant(page, block);
      const factSize = block.size || typeSize;
      if (variant === 'quiet-lines') {
        return `${block.title ? `<div class="sc-block" style="font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:${accent};margin-bottom:10px;">${esc(block.title)}</div>` : ''}${(block.items || []).map((item, index) => `
          <div class="sc-block" style="padding:${index === 0 ? '0 0 10px 0' : '10px 0'};border-top:${index === 0 ? 'none' : '1px solid rgba(255,255,255,0.08)'};">
            <div style="font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:${accent};margin-bottom:6px;">Point ${String(index + 1).padStart(2, '0')}</div>
            <div style="font-size:${factSize}px;line-height:${block.lineHeight || 1.58};color:var(--text);display:-webkit-box;-webkit-line-clamp:${block.clamp || 3};-webkit-box-orient:vertical;overflow:hidden;">${esc(item)}</div>
          </div>`).join('')}`;
      }
      if (variant === 'side-notes') {
        return `${(block.items || []).map((item, index) => `
          <div class="sc-block" style="display:grid;grid-template-columns:54px 1fr;gap:10px;align-items:start;padding:${index === 0 ? '0 0 10px 0' : '10px 0'};border-top:${index === 0 ? 'none' : '1px solid rgba(255,255,255,0.08)'};">
            <div style="font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:${accent};padding-top:2px;">0${index + 1}</div>
            <div style="font-size:${factSize}px;line-height:${block.lineHeight || 1.58};color:var(--text);display:-webkit-box;-webkit-line-clamp:${block.clamp || 3};-webkit-box-orient:vertical;overflow:hidden;">${esc(item)}</div>
          </div>`).join('')}`;
      }
      if (variant === 'compact-notes') {
        return `${(block.items || []).map((item, index) => `
          <div class="sc-block" style="padding:${index === 0 ? '0 0 8px 0' : '8px 0'};">
            <div style="font-size:${factSize}px;line-height:${block.lineHeight || 1.5};color:var(--text);display:-webkit-box;-webkit-line-clamp:${block.clamp || 2};-webkit-box-orient:vertical;overflow:hidden;">${esc(item)}</div>
          </div>`).join('')}`;
      }
      if (variant === 'floating-tags') {
        const columns = (block.items || []).length >= 5 ? 3 : 2;
        return `<div class="sc-block" style="display:grid;grid-template-columns:repeat(${columns},minmax(0,1fr));gap:20px 24px;align-content:flex-start;width:100%;">
          ${(block.items || []).map((item, index) => `
            <div style="display:grid;grid-template-columns:30px 1fr;gap:12px;align-items:start;padding-top:${index < columns ? '0' : '8px'};border-top:${index < columns ? '1px solid rgba(255,255,255,0.12)' : '1px solid rgba(255,255,255,0.08)'};">
              <span style="font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:${accent};padding-top:2px;flex-shrink:0;">${String(index + 1).padStart(2, '0')}</span>
              <span style="font-size:${factSize + 1}px;line-height:${block.lineHeight || 1.55};color:var(--text);display:-webkit-box;-webkit-line-clamp:${block.clamp || 3};-webkit-box-orient:vertical;overflow:hidden;">${esc(item)}</span>
            </div>`).join('')}
        </div>`;
      }
      if (variant === 'team-cards') {
        const columns = (block.items || []).length >= 5 ? 3 : 2;
        return `<div class="sc-block" style="display:grid;grid-template-columns:repeat(${columns},minmax(0,1fr));gap:18px;width:100%;">
          ${(block.items || []).map((item, index) => `
            <div style="min-height:132px;padding:18px 16px 16px;background:linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.04));border:1px solid rgba(255,255,255,0.14);box-shadow:0 10px 24px rgba(0,0,0,0.14);display:flex;flex-direction:column;gap:12px;">
              <div style="font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:${accent};">${String(index + 1).padStart(2, '0')}</div>
              <div style="font-size:${factSize + 1}px;line-height:${block.lineHeight || 1.62};color:var(--text);display:-webkit-box;-webkit-line-clamp:${block.clamp || 4};-webkit-box-orient:vertical;overflow:hidden;">${esc(item)}</div>
            </div>`).join('')}
        </div>`;
      }
      return `${block.title ? `<div class="sc-block" style="font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:${accent};margin-bottom:10px;">${esc(block.title)}</div>` : ''}${(block.items || []).map((item, index) => `
        <div class="sc-block" style="padding:${index === 0 ? '0' : '12px 0 0'} 0;border-top:${index === 0 ? 'none' : '1px solid rgba(255,255,255,0.08)'};">
          <div style="font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:${accent};margin-bottom:7px;">Point ${String(index + 1).padStart(2, '0')}</div>
          <div style="font-size:${factSize}px;line-height:${block.lineHeight || 1.6};color:var(--text);display:-webkit-box;-webkit-line-clamp:${block.clamp || 3};-webkit-box-orient:vertical;overflow:hidden;">${esc(item)}</div>
        </div>`).join('')}`;
    }
    case 'numbered-list':
      return (block.items || []).map((item, index) => `
        <div class="sc-block" style="display:grid;grid-template-columns:34px 1fr;gap:14px;padding:12px 0;border-top:${index === 0 ? 'none' : '1px solid var(--border)'};">
          <div style="font-size:13px;color:${accent};font-weight:var(--weight-bold);">${String(index + 1).padStart(2, '0')}</div>
          <div style="font-size:14px;line-height:1.7;color:var(--text);">${esc(item)}</div>
        </div>`).join('');
    case 'timeline': {
      const variant = block.variant || chooseTimelineVariant(page);
      if (variant === 'runway') {
        return `<div class="sc-block" style="display:grid;grid-template-columns:repeat(${Math.min((block.items || []).length, 4) || 1},1fr);gap:18px;align-items:stretch;width:100%;">
          ${(block.items || []).map((item, index) => `
            <div style="display:flex;flex-direction:column;min-height:220px;padding:14px 8px 0;border-top:1px solid rgba(255,255,255,0.12);">
              <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
                <div style="width:28px;height:28px;border-radius:50%;display:grid;place-items:center;border:1px solid rgba(192,160,98,0.35);color:${accent};font-size:11px;font-weight:var(--weight-bold);">${String(index + 1).padStart(2, '0')}</div>
                <div style="font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:rgba(255,255,255,0.54);">${esc(item.date || '')}</div>
              </div>
              <div style="font-size:20px;line-height:1.15;font-weight:var(--weight-bold);color:var(--text);margin-bottom:10px;">${esc(item.name || '')}</div>
              <div style="display:flex;flex-direction:column;gap:8px;margin-top:auto;">
                ${(item.tasks || []).map(task => `<div style="font-size:13px;line-height:1.6;color:var(--text-muted);">${esc(task)}</div>`).join('')}
              </div>
            </div>`).join('')}
        </div>`;
      }
      if (variant === 'editorial-steps') {
        return `<div class="sc-block" style="display:flex;flex-direction:column;gap:10px;width:100%;">
          ${(block.items || []).map((item, index) => `
            <div style="display:grid;grid-template-columns:124px 138px 1fr;gap:16px;padding:12px 0;border-top:${index === 0 ? '1px solid rgba(255,255,255,0.14)' : '1px solid rgba(255,255,255,0.08)'};align-items:start;">
              <div style="font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:${accent};padding-top:5px;line-height:1.65;word-break:keep-all;overflow-wrap:normal;">${esc(item.date || `Step ${index + 1}`)}</div>
              <div>
                <div style="font-size:15px;line-height:1.22;font-weight:var(--weight-bold);color:var(--text);margin-bottom:0;">${esc(item.name || '')}</div>
              </div>
              <div>
                ${(item.tasks || []).map(task => `<div style="font-size:13px;line-height:1.6;color:var(--text-muted);">${esc(task)}</div>`).join('')}
              </div>
            </div>`).join('')}
        </div>`;
      }
      return `<div class="sc-block" style="display:grid;grid-template-columns:repeat(${Math.min((block.items || []).length, 4) || 1},1fr);gap:16px;align-items:stretch;width:100%;">
        ${(block.items || []).map((item, index) => `
          <div style="display:flex;flex-direction:column;min-height:220px;background:rgba(9,14,22,0.58);border:1px solid rgba(255,255,255,0.1);border-radius:18px;padding:18px 18px 16px;backdrop-filter:blur(10px);">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;">
              <div style="width:26px;height:26px;border-radius:50%;display:grid;place-items:center;background:rgba(192,160,98,0.14);color:${accent};font-size:11px;font-weight:var(--weight-bold);">${String(index + 1).padStart(2, '0')}</div>
              <div style="font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:rgba(255,255,255,0.54);">${esc(item.date || '')}</div>
            </div>
            <div style="font-size:20px;line-height:1.2;font-weight:var(--weight-bold);color:var(--text);margin-bottom:12px;">${esc(item.name || '')}</div>
            <div style="display:flex;flex-direction:column;gap:10px;margin-top:auto;">
              ${(item.tasks || []).map(task => `<div style="font-size:13px;line-height:1.65;color:var(--text-muted);padding-top:10px;border-top:1px solid rgba(255,255,255,0.08);">${esc(task)}</div>`).join('')}
            </div>
          </div>`).join('')}
      </div>`;
    }
    case 'stats': {
      const variant = block.variant || chooseStatsVariant(page);
      const metricSize = block.size || typeSize;
      if (variant === 'ledger') {
        return (block.items || []).map((item, index) => `
          <div class="sc-block" style="padding:${index === 0 ? '0 0 14px 0' : '14px 0'};border-top:${index === 0 ? 'none' : '1px solid rgba(255,255,255,0.08)'};">
            <div style="display:flex;align-items:end;justify-content:space-between;gap:18px;">
              <div style="font-size:${metricSize}px;font-weight:var(--weight-black);color:var(--text);line-height:1;">${esc(item.value || '')}</div>
              ${item.sub ? `<div style="font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:${accent};">${esc(item.sub)}</div>` : ''}
            </div>
            ${item.label ? `<div style="font-size:12px;line-height:1.55;color:var(--text-muted);margin-top:8px;">${esc(item.label)}</div>` : ''}
          </div>`).join('');
      }
      if (variant === 'annotation-strip') {
        return `<div class="sc-block" style="display:grid;grid-template-columns:repeat(${Math.min((block.items || []).length, 3) || 1},1fr);gap:18px;align-items:start;width:100%;">
          ${(block.items || []).map((item, index) => `
            <div style="padding-top:16px;border-top:${index === 0 ? '1px solid rgba(255,255,255,0.14)' : '1px solid rgba(255,255,255,0.08)'};">
              <div style="font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:${accent};margin-bottom:10px;">${esc(item.label || `Item ${index + 1}`)}</div>
              <div style="font-size:${metricSize}px;font-weight:var(--weight-black);color:var(--text);line-height:1;margin-bottom:8px;">${esc(item.value || '')}</div>
              ${item.sub ? `<div style="font-size:12px;line-height:1.5;color:var(--text-muted);">${esc(item.sub)}</div>` : ''}
            </div>`).join('')}
        </div>`;
      }
      if (variant === 'staggered-notes') {
        return `<div class="sc-block" style="display:grid;grid-template-columns:repeat(${Math.min((block.items || []).length, 3) || 1},1fr);gap:22px;width:100%;">
          ${(block.items || []).map((item, index) => `
            <div style="padding-top:${8 + (index % 2) * 18}px;">
              <div style="font-size:${metricSize}px;font-weight:var(--weight-black);color:var(--text);line-height:1;">${esc(item.value || '')}</div>
              <div style="width:24px;height:1px;background:rgba(192,160,98,0.7);margin:12px 0 10px;"></div>
              <div style="font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:rgba(255,255,255,0.52);margin-bottom:8px;">${esc(item.sub || item.label || '')}</div>
              ${item.label ? `<div style="font-size:12px;line-height:1.58;color:var(--text-muted);">${esc(item.label)}</div>` : ''}
            </div>`).join('')}
        </div>`;
      }
      if (variant === 'strip') {
        return (block.items || []).map((item, index) => `
          <div class="sc-block" style="padding:18px 0;border-top:${index === 0 ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(255,255,255,0.08)'};">
            <div style="font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:rgba(255,255,255,0.5);margin-bottom:8px;">${esc(item.label || '')}</div>
            <div style="display:flex;align-items:baseline;gap:10px;">
              <div style="font-size:${metricSize}px;font-weight:var(--weight-black);color:var(--text);line-height:1;">${esc(item.value || '')}</div>
              ${item.sub ? `<div style="font-size:12px;color:var(--text-muted);">${esc(item.sub)}</div>` : ''}
            </div>
          </div>`).join('');
      }
      return (block.items || []).map((item) => `
        <div class="sc-block" style="padding:22px 10px 16px 0;">
          ${item.label ? `<div style="font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:var(--text-muted);margin-bottom:10px;">${esc(item.label)}</div>` : ''}
          <div style="font-size:${metricSize}px;font-weight:var(--weight-black);color:var(--text);line-height:1;">${esc(item.value || '')}</div>
          ${item.sub ? `<div style="font-size:12px;color:var(--text-muted);margin-top:10px;">${esc(item.sub)}</div>` : ''}
        </div>`).join('');
    }
    default:
      return block.text ? `<div class="sc-block" style="font-size:14px;line-height:1.7;color:var(--text);">${esc(block.text)}</div>` : '';
  }
}

function renderStructuredRegion(page, region, blocks, style, gridSpec) {
  if (!blocks.length) return '';
  const minH = toPercent(region.h, '100%');
  const regionStyle = chooseRegionStyle(page, region, blocks);
  const pad = toPx(regionStyle.padding, region.panel ? 22 : 0);
  const gap = toPx(region.gap, 12);
  const alignMap = { start: 'flex-start', center: 'center', end: 'flex-end', stretch: 'stretch' };
  const justifyMap = { start: 'flex-start', center: 'center', end: 'flex-end', stretch: 'space-between' };
  const stack = region.stack || 'vertical';
  const contentHtml = blocks.map(block => renderStructuredBlock(block, style, page)).join('');
  const panelStyle = region.panel === 'glass-dark'
    ? 'background:rgba(9,14,22,0.62);border:1px solid rgba(255,255,255,0.12);backdrop-filter:blur(12px);box-shadow:0 18px 36px rgba(0,0,0,0.22);'
    : region.panel === 'soft'
      ? 'background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.08);'
      : '';
  const surfaceStyle = regionStyle.surface === 'edge-fade'
    ? 'border-left:1px solid rgba(255,255,255,0.12);padding-left:18px;'
    : regionStyle.surface === 'ghost'
      ? 'border-top:1px solid rgba(255,255,255,0.08);padding-top:12px;'
      : regionStyle.surface === 'rule'
        ? 'border-bottom:1px solid rgba(255,255,255,0.08);padding-bottom:10px;'
        : '';
  const innerStyle = stack === 'grid'
    ? `display:grid;grid-template-columns:repeat(${region.columns || 3},1fr);gap:${gap};align-content:${justifyMap[region.valign || 'start']};`
    : `display:flex;flex-direction:${stack === 'horizontal' ? 'row' : 'column'};gap:${gap};justify-content:${justifyMap[region.valign || 'start']};align-items:${alignMap[region.align || 'start']};`;
  const placement = resolveStructuredGridPlacement(region, gridSpec);

  return `<div class="sc-region" style="grid-column:${placement.colStart} / ${placement.colEnd};grid-row:${placement.rowStart} / ${placement.rowEnd};align-self:start;min-height:${minH};height:auto;padding:${pad};overflow:visible;${panelStyle}${surfaceStyle}">
    <div class="sc-stack" style="${innerStyle}">${contentHtml}</div>
  </div>`;
}

function renderStructuredImageLayer(spec, page, gridSpec) {
  if (!page?.bgImage || page?.imageStrategy?.useBackground === false) return '';
  if ((spec?.mode || 'background') === 'background') return '';
  const radius = toPx(spec.radius, 24);
  const fit = spec.fit || 'cover';
  const shadow = spec.shadow || '0 24px 48px rgba(0,0,0,0.24)';
  const placement = resolveStructuredGridPlacement(spec, gridSpec);
  return `<div class="sc-layer" style="grid-column:${placement.colStart} / ${placement.colEnd};grid-row:${placement.rowStart} / ${placement.rowEnd};align-self:stretch;border-radius:${radius};overflow:hidden;box-shadow:${shadow};">
    <div style="position:absolute;inset:0;background-image:url('${page.bgImage}');background-size:${fit};background-position:center;"></div>
    <div style="position:absolute;inset:0;background:linear-gradient(180deg, rgba(9,14,22,0.04), rgba(9,14,22,0.18));"></div>
  </div>`;
}

function renderStructuredSlide(page, style) {
  const spec = mergeStructuredSpec(page);
  const blocks = normalizeBlocks(page);
  const gridSpec = buildStructuredGridSpec(spec);
  const imageLayer = renderStructuredImageLayer(spec.imagePlacement, page, gridSpec);
  const regions = (spec.regions || []).map(region => {
    const regionBlocks = blocks.filter(block => (block.region || 'body') === region.name);
    return renderStructuredRegion(page, region, regionBlocks, style, gridSpec);
  }).join('');
  const canvas = renderStructuredGridCanvas(gridSpec, `${imageLayer}${regions}`);
  return `<div class="slide structured" style="${buildCssVars(style)};background:var(--bg);">
  ${renderBackgroundLayers(page, { fallbackTreatment: page?.imageStrategy?.treatment || 'ambient-texture', defaultOverlay: 0.34, defaultPlacement: 'left' })}
  ${canvas}
</div>`;
}

const LAYOUTS = {
  immersive_cover(page, style) {
    const t = style.tokens;
    const { title, subtitle, brand, date, location } = page;
    const accentColor = t.colors.accent;
    const primaryColor = t.colors.primary;

    return `<div class="slide ic" style="${buildCssVars(style)};background:var(--bg);">
  ${renderBackgroundLayers(page, { fallbackTreatment: 'full-bleed-dark', defaultOverlay: 0.46, defaultPlacement: 'left' })}
  <div class="ic-content" style="position:relative;z-index:2;height:100%;display:flex;flex-direction:column;justify-content:center;padding:0 78px;width:58%;">
    ${brand ? `<div class="ic-brand" style="font-size:13px;font-weight:var(--weight-medium);color:${accentColor};letter-spacing:0.22em;text-transform:uppercase;margin-bottom:22px;">${esc(brand)}</div>` : ''}
    <div style="width:96px;height:1px;background:linear-gradient(90deg, rgba(192,160,98,0.88), rgba(192,160,98,0));margin-bottom:28px;"></div>
    <h1 class="ic-title" style="font-size:58px;font-weight:var(--weight-black);color:#fff;line-height:1.02;letter-spacing:-0.035em;margin-bottom:18px;max-width:520px;text-wrap:balance;">${esc(title)}</h1>
    ${subtitle ? `<p class="ic-subtitle" style="font-size:20px;color:rgba(255,255,255,0.74);line-height:1.6;margin-bottom:36px;max-width:430px;">${esc(subtitle)}</p>` : ''}
    <div class="ic-meta" style="display:flex;gap:18px;font-size:13px;color:rgba(255,255,255,0.56);align-items:center;">
      ${date ? `<span>${esc(date)}</span>` : ''}
      ${(date && location) ? `<span style="width:4px;height:4px;border-radius:50%;background:rgba(255,255,255,0.3);"></span>` : ''}
      ${location ? `<span>${esc(location)}</span>` : ''}
    </div>
  </div>
  <div style="position:absolute;right:60px;bottom:58px;z-index:2;max-width:230px;padding-top:16px;border-top:1px solid rgba(255,255,255,0.12);font-size:12px;line-height:1.7;color:rgba(255,255,255,0.62);letter-spacing:0.02em;">A cinematic launch narrative shaped around the selected key visual.</div>
  <div class="ic-accent-bar" style="position:absolute;left:0;top:0;bottom:0;width:4px;background:linear-gradient(180deg,${primaryColor} 0%,${accentColor} 100%);"></div>
  <div class="ic-corner" style="position:absolute;right:-80px;bottom:-80px;width:320px;height:320px;border-radius:50%;background:${primaryColor};opacity:0.06;"></div>
</div>`;
  },

  bento_grid(page, style) {
    const t = style.tokens;
    const { title, cards, columns } = page;
    const cardCount = cards?.length || 3;
    const cols = columns || (cardCount <= 3 ? cardCount : 3);
    const gridClass = cols === 2 ? 'bento-2' : cols === 3 ? 'bento-3' : 'bento-4';

    const cardsHtml = (cards || []).map((card, i) => `
    <div class="bento-card" style="background:var(--surface);border-radius:var(--radius-lg);padding:24px;border:1px solid var(--border);display:flex;flex-direction:column;gap:12px;">
      ${card.tag ? `<div class="bc-tag" style="font-size:11px;font-weight:var(--weight-bold);color:${t.colors.accent};letter-spacing:0.1em;text-transform:uppercase;">${esc(card.tag)}</div>` : ''}
      <div class="bc-title" style="font-size:18px;font-weight:var(--weight-bold);color:var(--text);line-height:1.3;">${esc(card.title)}</div>
      ${card.description ? `<div class="bc-desc" style="font-size:13px;color:var(--text-muted);line-height:1.6;flex:1;">${esc(card.description)}</div>` : ''}
      ${card.metrics ? `<div class="bc-metrics" style="display:flex;gap:16px;margin-top:8px;">${card.metrics.map(m => `<div style="text-align:center;"><div style="font-size:24px;font-weight:var(--weight-black);color:var(--primary);">${esc(m.value)}</div><div style="font-size:11px;color:var(--text-muted);margin-top:2px;">${esc(m.label)}</div></div>`).join('')}</div>` : ''}
    </div>`).join('');

    return `<div class="slide bento ${gridClass}" style="${buildCssVars(style)};background:var(--bg);">
  ${renderBackgroundLayers(page, { fallbackTreatment: 'ambient-texture', defaultOverlay: 0.34, defaultPlacement: 'left' })}
  <div class="bento-inner" style="position:relative;z-index:2;padding:40px 48px;">
    ${title ? `<h2 class="bento-title" style="font-size:28px;font-weight:var(--weight-bold);color:var(--text);margin-bottom:28px;padding-bottom:16px;border-bottom:1px solid var(--border);">${esc(title)}</h2>` : ''}
    <div class="bento-grid" style="display:grid;grid-template-columns:repeat(${cols},1fr);gap:16px;">
      ${cardsHtml}
    </div>
  </div>
</div>`;
  },

  split_content(page, style) {
    const t = style.tokens;
    const { title, leftTitle, leftItems, rightTitle, rightItems } = page;

    const leftItemsHtml = (leftItems || []).map(item =>
      `<li style="font-size:14px;color:var(--text);line-height:1.7;padding:10px 0;border-bottom:1px solid var(--border);display:flex;align-items:flex-start;gap:12px;">
        <span style="width:6px;height:6px;background:var(--primary);border-radius:50%;margin-top:8px;flex-shrink:0;"></span>
        <span>${esc(item)}</span>
      </li>`
    ).join('');

    const rightItemsHtml = (rightItems || []).map(item =>
      `<li style="font-size:14px;color:var(--text);line-height:1.7;padding:10px 0;border-bottom:1px solid var(--border);display:flex;align-items:flex-start;gap:12px;">
        <span style="width:6px;height:6px;background:var(--accent);border-radius:50%;margin-top:8px;flex-shrink:0;"></span>
        <span>${esc(item)}</span>
      </li>`
    ).join('');

    return `<div class="slide split" style="${buildCssVars(style)};background:var(--bg);">
  ${renderBackgroundLayers(page, { fallbackTreatment: 'dark-paneled', defaultOverlay: 0.48, defaultPlacement: 'split' })}
  <div class="split-inner" style="position:relative;z-index:2;display:grid;grid-template-columns:1fr 1fr;height:100%;">
    <div class="split-left" style="padding:48px;display:flex;flex-direction:column;border-right:1px solid var(--border);">
      <div style="height:4px;width:48px;background:var(--primary);margin-bottom:24px;"></div>
      <h2 style="font-size:24px;font-weight:var(--weight-bold);color:var(--text);margin-bottom:20px;">${esc(leftTitle || title)}</h2>
      <ul style="list-style:none;flex:1;">${leftItemsHtml}</ul>
    </div>
    <div class="split-right" style="padding:48px;display:flex;flex-direction:column;">
      <div style="height:4px;width:48px;background:var(--accent);margin-bottom:24px;"></div>
      <h2 style="font-size:24px;font-weight:var(--weight-bold);color:var(--text);margin-bottom:20px;">${esc(rightTitle)}</h2>
      <ul style="list-style:none;flex:1;">${rightItemsHtml}</ul>
    </div>
  </div>
</div>`;
  },

  timeline_flow(page, style) {
    const t = style.tokens;
    const { title, phases } = page;

    const phasesHtml = (phases || []).map((phase, i) => `
    <div class="tl-phase" style="flex:1;background:rgba(30,41,59,0.84);backdrop-filter:blur(12px);border-radius:var(--radius-lg);overflow:hidden;border:1px solid rgba(255,255,255,0.12);box-shadow:0 18px 34px rgba(0,0,0,0.18);">
      <div class="tl-phase-header" style="padding:12px 16px;background:rgba(15,23,42,0.88);border-bottom:1px solid rgba(255,255,255,0.08);">
        <div style="font-size:12px;color:rgba(255,255,255,0.6);margin-bottom:4px;">${esc(phase.date || '')}</div>
        <div style="font-size:15px;font-weight:var(--weight-bold);color:#fff;">${esc(phase.name)}</div>
      </div>
      <div class="tl-phase-body" style="padding:16px;">
        <ul style="list-style:none;">
          ${(phase.tasks || []).map(task => `<li style="font-size:12px;color:var(--text);line-height:1.6;padding:4px 0;padding-left:12px;position:relative;">
            <span style="position:absolute;left:0;top:10px;width:4px;height:4px;background:var(--primary);border-radius:50%;"></span>
            ${esc(task)}
          </li>`).join('')}
        </ul>
      </div>
    </div>`).join('');

    return `<div class="slide timeline" style="${buildCssVars(style)};background:var(--bg);">
  ${renderBackgroundLayers(page, { fallbackTreatment: 'dim-atmosphere', defaultOverlay: 0.44, defaultPlacement: 'center' })}
  <div class="timeline-inner" style="position:relative;z-index:2;padding:40px 48px;height:100%;display:flex;flex-direction:column;">
    ${title ? `<h2 style="font-size:28px;font-weight:var(--weight-black);color:var(--text);margin-bottom:10px;letter-spacing:-0.02em;">${esc(title)}</h2>` : ''}
    <div style="font-size:12px;letter-spacing:0.16em;text-transform:uppercase;color:rgba(255,255,255,0.46);margin-bottom:24px;">Launch Sequence</div>
    <div class="timeline-row" style="display:flex;gap:16px;flex:1;align-items:stretch;">
      ${phasesHtml}
    </div>
  </div>
</div>`;
  },

  minimal_text(page, style) {
    const t = style.tokens;
    const { title, subtitle, body, highlight } = page;

    return `<div class="slide minimal" style="${buildCssVars(style)};background:var(--bg);">
  ${renderBackgroundLayers(page, { fallbackTreatment: 'editorial-fade', defaultOverlay: 0.38, defaultPlacement: 'left' })}
  <div class="minimal-inner" style="position:relative;z-index:2;height:100%;display:flex;flex-direction:column;justify-content:center;padding:64px 96px;">
    ${title ? `<h2 style="font-size:42px;font-weight:var(--weight-black);color:var(--text);line-height:1.15;letter-spacing:-0.02em;margin-bottom:16px;max-width:700px;">${esc(title)}</h2>` : ''}
    ${subtitle ? `<p style="font-size:18px;color:var(--text-muted);line-height:1.6;margin-bottom:24px;max-width:560px;">${esc(subtitle)}</p>` : ''}
    ${body ? `<p style="font-size:15px;color:var(--text-muted);line-height:1.8;max-width:580px;">${esc(body)}</p>` : ''}
    ${highlight ? `<div style="margin-top:32px;padding:20px 24px;background:var(--surface);border-radius:var(--radius-md);border-left:3px solid var(--accent);max-width:520px;">
      <p style="font-size:15px;color:var(--text);line-height:1.7;font-style:italic;">${esc(highlight)}</p>
    </div>` : ''}
  </div>
</div>`;
  },

  data_cards(page, style) {
    const t = style.tokens;
    const { title, metrics } = page;

    const metricsHtml = (metrics || []).map(m => `
    <div class="dc-card" style="background:var(--surface);border-radius:var(--radius-lg);padding:24px;border:1px solid var(--border);text-align:center;">
      ${m.label ? `<div style="font-size:12px;color:var(--text-muted);margin-bottom:8px;text-transform:uppercase;letter-spacing:0.08em;">${esc(m.label)}</div>` : ''}
      <div class="dc-value" style="font-size:36px;font-weight:var(--weight-black);color:var(--primary);line-height:1;margin-bottom:8px;">${esc(m.value)}</div>
      ${m.sub ? `<div style="font-size:12px;color:var(--text-muted);">${esc(m.sub)}</div>` : ''}
    </div>`).join('');

    return `<div class="slide data" style="${buildCssVars(style)};background:var(--bg);">
  ${renderBackgroundLayers(page, { fallbackTreatment: 'subtle-grid', defaultOverlay: 0.5, defaultPlacement: 'center' })}
  <div class="data-inner" style="position:relative;z-index:2;padding:40px 48px;height:100%;display:flex;flex-direction:column;justify-content:center;">
    ${title ? `<h2 style="font-size:26px;font-weight:var(--weight-bold);color:var(--text);margin-bottom:32px;">${esc(title)}</h2>` : ''}
    <div class="data-grid" style="display:grid;grid-template-columns:repeat(${metrics?.length || 3},1fr);gap:20px;">
      ${metricsHtml}
    </div>
  </div>
</div>`;
  },

  image_statement(page, style) {
    const { title, subtitle, body, eyebrow, kicker, imageMeta } = page;

    return `<div class="slide image-statement" style="${buildCssVars(style)};background:linear-gradient(135deg,var(--bg) 0%, var(--secondary) 100%);">
  ${renderBackgroundLayers(page, { fallbackTreatment: 'full-bleed-dark', defaultOverlay: 0.34, defaultPlacement: 'left' })}
  <div class="is-copy" style="padding:56px 48px 56px 60px;display:flex;flex-direction:column;justify-content:space-between;">
    <div>
      ${eyebrow ? `<div style="font-size:11px;font-weight:var(--weight-bold);letter-spacing:0.14em;text-transform:uppercase;color:var(--accent);margin-bottom:20px;">${esc(eyebrow)}</div>` : ''}
      <h1 style="font-size:48px;font-weight:var(--weight-black);line-height:1.05;letter-spacing:-0.03em;color:#fff;max-width:460px;">${esc(title || '')}</h1>
      ${subtitle ? `<p style="margin-top:18px;font-size:17px;line-height:1.65;color:rgba(255,255,255,0.72);max-width:420px;">${esc(subtitle)}</p>` : ''}
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:18px;align-items:end;">
      ${body ? `<p style="font-size:13px;line-height:1.8;color:rgba(255,255,255,0.58);max-width:280px;">${esc(body)}</p>` : '<div></div>'}
      ${kicker ? `<div style="justify-self:end;max-width:220px;padding-top:18px;border-top:1px solid rgba(255,255,255,0.14);font-size:13px;line-height:1.7;color:#F8FAFC;">${esc(kicker)}</div>` : '<div></div>'}
    </div>
  </div>
  <div class="is-visual" style="position:relative;">
    <div style="position:absolute;top:44px;right:44px;bottom:44px;left:12px;border:1px solid rgba(255,255,255,0.1);background:linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02));backdrop-filter:blur(2px);"></div>
    ${imageMeta?.query ? `<div style="position:absolute;right:52px;bottom:52px;font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:rgba(255,255,255,0.42);">${esc(imageMeta.query)}</div>` : ''}
  </div>
</div>`;
  },

  editorial_quote(page, style) {
    const { title, subtitle, quote, facts } = page;
    const factList = facts || [];
    const factFontSize = factList.length > 5 ? 12 : 13;
    const factPadding = factList.length > 5 ? '10px 0' : '14px 0';
    const factsHtml = factList.map((item, index) => `
      <div style="padding:${factPadding};border-top:${index === 0 ? 'none' : '1px solid var(--border)'};">
        <div style="font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:var(--accent);margin-bottom:6px;">Point ${String(index + 1).padStart(2, '0')}</div>
        <div style="font-size:${factFontSize}px;line-height:1.65;color:var(--text);">${esc(item)}</div>
      </div>`).join('');

    return `<div class="slide editorial" style="${buildCssVars(style)};background:var(--bg);">
  ${renderBackgroundLayers(page, { fallbackTreatment: 'editorial-fade', defaultOverlay: 0.28, defaultPlacement: 'left' })}
  <div style="padding:58px 44px 52px 58px;display:flex;flex-direction:column;justify-content:space-between;position:relative;z-index:2;">
    <div>
      <div style="width:56px;height:4px;background:linear-gradient(90deg,var(--accent),transparent);margin-bottom:24px;"></div>
      <h2 style="font-size:42px;font-weight:var(--weight-black);line-height:1.08;letter-spacing:-0.03em;color:var(--text);max-width:420px;">${esc(title || '')}</h2>
      ${subtitle ? `<p style="margin-top:16px;font-size:16px;line-height:1.7;color:var(--text-muted);max-width:420px;">${esc(subtitle)}</p>` : ''}
    </div>
    ${quote ? `<div style="max-width:430px;padding-left:18px;border-left:2px solid var(--accent);font-size:24px;line-height:1.42;color:#fff;text-wrap:balance;">${esc(quote)}</div>` : ''}
  </div>
  <div style="padding:58px 40px 40px 26px;display:flex;align-items:flex-end;position:relative;z-index:2;">
    <div style="margin-left:auto;width:100%;max-width:296px;padding:22px 24px;background:rgba(11,18,32,0.58);border:1px solid rgba(255,255,255,0.12);box-shadow:0 18px 36px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.08);backdrop-filter:blur(14px);">
      ${factsHtml}
    </div>
  </div>
</div>`;
  },

  asymmetrical_story(page, style) {
    const { eyebrow, title, story, points } = page;
    const pointList = points || [];
    const pointFontSize = pointList.length > 5 ? 13 : 14;
    const pointPadding = pointList.length > 5 ? '9px 0' : '12px 0';
    const pointsHtml = pointList.map((item, index) => `
      <div style="display:grid;grid-template-columns:34px 1fr;gap:14px;padding:${pointPadding};border-top:1px solid var(--border);">
        <div style="font-size:13px;color:var(--accent);font-weight:var(--weight-bold);">${String(index + 1).padStart(2, '0')}</div>
        <div style="font-size:${pointFontSize}px;line-height:1.65;color:var(--text);">${esc(item)}</div>
      </div>`).join('');

    return `<div class="slide story" style="${buildCssVars(style)};background:linear-gradient(135deg,var(--bg) 0%, var(--bg-alt) 100%);">
  ${renderBackgroundLayers(page, { fallbackTreatment: 'split-atmosphere', defaultOverlay: 0.28, defaultPlacement: 'left' })}
  <div style="position:relative;z-index:2;padding:56px 36px 48px 58px;display:flex;flex-direction:column;justify-content:space-between;">
    <div>
      ${eyebrow ? `<div style="font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:var(--accent);margin-bottom:22px;">${esc(eyebrow)}</div>` : ''}
      <h2 style="font-size:46px;font-weight:var(--weight-black);line-height:1.02;letter-spacing:-0.035em;color:var(--text);max-width:430px;">${esc(title || '')}</h2>
      ${story ? `<p style="margin-top:20px;font-size:16px;line-height:1.75;color:var(--text-muted);max-width:420px;">${esc(story)}</p>` : ''}
    </div>
  </div>
  <div style="position:relative;z-index:2;padding:104px 54px 54px 24px;display:flex;align-items:flex-end;">
    <div style="margin-left:auto;width:100%;max-width:314px;background:rgba(9,14,22,0.64);border:1px solid rgba(255,255,255,0.1);padding:22px 24px 10px;backdrop-filter:blur(8px);">
      ${pointsHtml}
    </div>
  </div>
</div>`;
  },

  end_card(page, style) {
    const t = style.tokens;
    const { title, subtitle, brand } = page;

    return `<div class="slide end" style="${buildCssVars(style)};background:var(--secondary);">
  ${renderBackgroundLayers(page, { fallbackTreatment: 'quiet-finale', defaultOverlay: 0.3, defaultPlacement: 'center' })}
  <div class="end-inner" style="position:relative;z-index:2;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:48px;">
    <h1 style="font-size:56px;font-weight:var(--weight-black);color:#fff;line-height:1.1;margin-bottom:16px;">${esc(title || '感谢观看')}</h1>
    ${subtitle ? `<p style="font-size:20px;color:rgba(255,255,255,0.62);margin-bottom:32px;">${esc(subtitle)}</p>` : ''}
    ${brand ? `<div style="font-size:14px;color:rgba(255,255,255,0.4);letter-spacing:0.1em;">${esc(brand)}</div>` : ''}
  </div>
  <div style="position:absolute;top:0;left:0;right:0;height:4px;background:linear-gradient(90deg,var(--primary) 0%,var(--accent) 100%);"></div>
  <div style="position:absolute;left:-100px;bottom:-100px;width:350px;height:350px;border-radius:50%;background:var(--primary);opacity:0.05;"></div>
  <div style="position:absolute;right:-60px;top:-60px;width:220px;height:220px;border-radius:50%;background:var(--accent);opacity:0.04;"></div>
</div>`;
  },

  toc(page, style) {
    const t = style.tokens;
    const { title, items } = page;

    const itemsHtml = (items || []).map((item, i) => `
    <div class="toc-item" style="padding:14px 0;border-bottom:1px solid var(--border);display:flex;align-items:flex-start;gap:18px;">
      <span style="font-size:20px;font-weight:var(--weight-black);color:var(--primary);opacity:0.5;min-width:32px;">${String(i + 1).padStart(2, '0')}</span>
      <span style="display:block;flex:1;min-width:0;font-size:18px;line-height:1.45;color:var(--text);font-weight:var(--weight-medium);word-break:keep-all;overflow-wrap:normal;white-space:normal;">${esc(item.title || item)}</span>
    </div>`).join('');

    return `<div class="slide toc" style="${buildCssVars(style)};background:var(--bg);">
  ${renderBackgroundLayers(page, { fallbackTreatment: 'none', defaultOverlay: 0, defaultPlacement: 'right' })}
  <div class="toc-inner" style="position:relative;z-index:2;display:grid;grid-template-columns:220px 1fr;height:100%;">
    <div class="toc-sidebar" style="background:var(--primary);padding:48px 28px;display:flex;flex-direction:column;justify-content:center;">
      <div style="font-size:11px;color:rgba(255,255,255,0.5);letter-spacing:0.12em;text-transform:uppercase;margin-bottom:12px;">Contents</div>
      <div style="font-size:36px;font-weight:var(--weight-black);color:#fff;line-height:1.1;">目录</div>
      <div style="width:32px;height:2px;background:rgba(255,255,255,0.3);margin-top:20px;"></div>
    </div>
    <div class="toc-content" style="padding:42px 64px 42px 48px;display:flex;flex-direction:column;justify-content:center;">
      ${itemsHtml}
    </div>
  </div>
</div>`;
  },
};

function getLayoutFn(layout) {
  return LAYOUTS[layout] || LAYOUTS.bento_grid;
}

function renderSlide({ layout, style: styleName, content, theme }) {
  const baseStyle = DESIGN_TOKENS[styleName] || DESIGN_TOKENS.dark_tech;
  const layoutFn = getLayoutFn(layout);
  const themePrimary = theme?.primary || '';
  const themeSecondary = theme?.secondary || '';
  const styleDef = {
    ...baseStyle,
    colors: {
      ...baseStyle.colors,
      ...(themePrimary ? { primary: themePrimary } : {}),
      ...(themeSecondary ? { secondary: themeSecondary } : {}),
    },
  };

  const pageData = {
    title: content?.title || content?.mainTitle || '',
    subtitle: content?.subtitle || '',
    mainTitle: content?.mainTitle || content?.title || '',
    brand: content?.brand || theme?.brand || '',
    date: content?.date || theme?.date || '',
    location: content?.location || '',
    bgImage: content?.bgImagePath || theme?.bgImage || '',
    visualStyle: theme?.visualStyle || 'gradient_overlay',
    ...content,
  };

  const style = { tokens: styleDef };
  if (hasStructuredComposition(pageData)) {
    return renderStructuredSlide(pageData, style);
  }

  return layoutFn(pageData, style);
}

function renderAllSlides({ pages, theme, globalStyle }) {
  return pages.map(page => {
    const layout = page.layout || page.type || 'bento_grid';
    const styleName = page.style || globalStyle || 'dark_tech';
    return renderSlide({ layout, style: styleName, content: page, theme });
  });
}

module.exports = {
  DESIGN_TOKENS,
  LAYOUTS,
  renderSlide,
  renderAllSlides,
  esc,
  buildCssVars,
  SLIDE_CSS,
};
