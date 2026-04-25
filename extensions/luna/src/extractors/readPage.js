// 通用：读取某个 URL 的可见正文
// 策略：打开后台标签 → 等待 complete → 注入脚本（含 shadow DOM + iframe 穿透）读取正文
// 注意：executeScript 的 func 会被序列化到页面 context，不能引用外部闭包变量
//       所有 helper 必须写在 pageExtract 内部

import { waitForTabComplete } from '../lib/tabManager.js';

function pageExtract() {
  // ---- shadow DOM + 同源 iframe 深度遍历（抄自 opencode-browser） ----
  const MAX_DEPTH = 6;

  function collectShadowRoots(root, out, depth) {
    if (depth > MAX_DEPTH || !root) return;
    // root 自己如果有 shadowRoot（element 节点）
    if (root.shadowRoot) {
      out.push(root.shadowRoot);
      collectAll(root.shadowRoot, out, depth + 1);
    }
    // 遍历子元素
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
    let node;
    while ((node = walker.nextNode())) {
      if (node.shadowRoot) {
        out.push(node.shadowRoot);
        collectAll(node.shadowRoot, out, depth + 1);
      }
    }
  }

  function collectAll(root, out, depth) {
    collectShadowRoots(root, out, depth);
  }

  function collectIframes(doc, out, depth) {
    if (depth > MAX_DEPTH) return;
    const frames = doc.querySelectorAll('iframe, frame');
    for (const f of frames) {
      try {
        const inner = f.contentDocument;
        if (inner) {
          out.push(inner);
          collectIframes(inner, out, depth + 1);
        }
      } catch { /* 跨域 iframe 访问不到，跳过 */ }
    }
  }

  // 收集所有可遍历的根节点
  const roots = [document];
  collectIframes(document, roots, 0);
  const shadowRoots = [];
  collectAll(document, shadowRoots, 0);
  for (const sr of shadowRoots) roots.push(sr);

  // ---- 正文抽取：优先 article/main，退化到 body ----
  function pickMain(root) {
    return root.querySelector?.('article, main, [role="main"]') || null;
  }

  // 先在主文档找 main 区域；shadow roots 用于补充文本
  const mainEl = pickMain(document) || document.body;
  const mainText = (mainEl.innerText || '').trim();

  // shadow DOM 里的文本补到尾部（去重由调用方保证）
  let shadowText = '';
  for (const sr of shadowRoots) {
    try {
      const host = sr.host;
      if (host && mainEl.contains(host)) continue; // 主区域已包含
      const t = (host?.innerText || '').trim();
      if (t) shadowText += '\n\n' + t;
    } catch {}
  }

  // 同源 iframe 文本
  let frameText = '';
  for (const doc of roots.slice(1)) {
    try {
      const el = pickMain(doc) || doc.body;
      const t = (el?.innerText || '').trim();
      if (t) frameText += '\n\n[iframe] ' + t;
    } catch {}
  }

  const combined = [mainText, shadowText, frameText]
    .filter(Boolean)
    .join('\n\n')
    .replace(/\n{3,}/g, '\n\n');

  return {
    title: document.title || '',
    url: location.href,
    content: combined.slice(0, 12000)
  };
}

export async function readPage(url) {
  if (!url) throw new Error('url empty');
  const tab = await chrome.tabs.create({ url, active: false });
  try {
    await waitForTabComplete(tab.id, 25000);
    await new Promise((r) => setTimeout(r, 1200));
    const [{ result } = {}] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: pageExtract
    });
    if (!result || !result.content) {
      return { title: '', url, content: '', reason: 'empty' };
    }
    return result;
  } finally {
    try { await chrome.tabs.remove(tab.id); } catch {}
  }
}
