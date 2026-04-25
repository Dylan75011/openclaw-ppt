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

module.exports = {
  esc,
  clamp,
  toPercent,
  toPx,
  toPercentNumber,
  hasStructuredComposition,
  buildCssVars,
  shouldUseBackground,
  resolveOverlay,
  resolveTextPlacement,
};
