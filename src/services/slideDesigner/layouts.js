const { esc, buildCssVars } = require('./utils');
const { renderBackgroundLayers } = require('./backgrounds');

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

module.exports = { LAYOUTS, getLayoutFn };
