const { DESIGN_TOKENS, SLIDE_CSS } = require('./tokens');
const { esc, buildCssVars, hasStructuredComposition } = require('./utils');
const { LAYOUTS, getLayoutFn } = require('./layouts');
const { renderStructuredSlide } = require('./structuredEngine');

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
