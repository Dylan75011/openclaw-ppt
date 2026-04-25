const { shouldUseBackground, resolveOverlay, resolveTextPlacement } = require('./utils');

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

module.exports = { renderBackgroundLayers };
