// 小红书搜索 + 模态抓取：
//  - 搜索：后台打开/复用搜索结果 tab，滚动抽卡片
//  - 正文：复用同一个搜索 tab，按 noteId 点开页内弹窗（detail modal）抽正文
//    直接新开 tab 访问 /explore/{id} 会触发二维码墙，只能走 SPA 弹窗这条路

import { withLock, findTabByPattern, waitForTabComplete, tabsUpdateWithRetry } from '../lib/tabManager.js';

const SEARCH_URL = (q) =>
  `https://www.xiaohongshu.com/search_result?keyword=${encodeURIComponent(q)}&source=web_search_result_notes&type=51`;

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

function noteIdFromUrl(url) {
  const m = (url || '').match(/\/(?:search_result|explore|discovery\/item)\/([0-9a-f]{16,})/i);
  return m ? m[1] : null;
}

// 下面这个函数会被序列化后在页面上下文中执行，不要引用外部符号
function pageExtract(maxResults) {
  function scrollAndWait(times = 3, step = 800, delay = 600) {
    return new Promise(async (resolve) => {
      for (let i = 0; i < times; i += 1) {
        window.scrollBy(0, step);
        await new Promise((r) => setTimeout(r, delay + Math.random() * 300));
      }
      resolve();
    });
  }

  function text(el) { return (el?.innerText || el?.textContent || '').trim().replace(/\s+/g, ' '); }

  function noteIdOf(href) {
    const m = href && href.match(/\/(?:search_result|explore|discovery\/item)\/([0-9a-f]{16,})/i);
    return m ? m[1] : null;
  }

  function extractCards() {
    const anchors = Array.from(document.querySelectorAll('a[href*="/search_result/"], a[href*="/explore/"], a[href*="/discovery/item/"]'));

    // xhs 搜索结果页同一 noteId 会出现多个 anchor：有的是 /explore/{id} 不带 query，有的是
    // /search_result/{id}?xsec_token=...&xsec_source=...。无 token 的 URL 直 navigate 会被重定向
    // 到 /explore 首页（不是 404 而是 redirect），笔记打不开。这里按 noteId 优先选带 token 的 anchor。
    const bestAnchorById = new Map();
    for (const a of anchors) {
      const href = a.href;
      const noteId = noteIdOf(href);
      if (!noteId) continue;
      const rect = a.getBoundingClientRect();
      if (rect.width < 10 || rect.height < 10) continue;
      const existing = bestAnchorById.get(noteId);
      const thisHasToken = /xsec_token=/.test(href);
      if (!existing) {
        bestAnchorById.set(noteId, a);
      } else if (thisHasToken && !/xsec_token=/.test(existing.href)) {
        bestAnchorById.set(noteId, a); // 替换为带 token 的
      }
    }

    const cards = [];
    for (const [noteId, a] of bestAnchorById.entries()) {
      const href = a.href;
      // 该 noteId 在 DOM 里完全没有带 token 的 anchor —— 直接跳过，不让 brain 拿到坏 URL
      // （之前测试里这种 URL 跑 read_notes 必中 note_not_found / 重定向）
      if (!/xsec_token=/.test(href)) continue;

      const card = a.closest('section') || a.closest('div.note-item') || a.closest('div[class*="note" i]') || a.closest('div') || a;
      const titleEl = card.querySelector('.title, .note-title, [class*="title" i]:not([class*="author" i])');
      const authorEl = card.querySelector('.author, .name, [class*="author" i], [class*="user" i]');
      const countEl = card.querySelector('.count, [class*="count" i], [class*="like" i]');
      const imgEl = card.querySelector('img');
      const title = text(titleEl) || text(a);
      if (!title) continue;

      cards.push({
        noteId,
        title,
        url: href, // 永远带 xsec_token（上面的 filter 保证）
        author: text(authorEl),
        stats: text(countEl),
        cover: imgEl?.src || ''
      });
      if (cards.length >= maxResults) break;
    }
    return cards;
  }

  return scrollAndWait(3).then(extractCards);
}

// 下面这些函数被 chrome.scripting 单独注入，拆成短作业，避免"点击触发导航 → isolated world 被炸 → 长 Promise 永不 resolve"

// 点卡片：在 capture-phase preventDefault 一次锚点默认跳转，让 React onClick 正常开弹窗
// 卡片不在当前视口时，滚动 + 等待虚拟列表渲染后重查
async function pageClickCard(noteId) {
  const findVisible = () => {
    const anchors = Array.from(document.querySelectorAll(`a[href*="${noteId}"]`));
    return anchors.find((a) => {
      const r = a.getBoundingClientRect();
      return r.width >= 10 && r.height >= 10;
    });
  };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  let visible = findVisible();
  if (!visible) {
    const maxSteps = 8;
    for (let i = 0; i < maxSteps; i += 1) {
      const before = document.documentElement.scrollHeight;
      window.scrollBy(0, window.innerHeight * 0.9);
      await sleep(500 + Math.random() * 300);
      visible = findVisible();
      if (visible) break;
      const atBottom = window.innerHeight + window.scrollY >= before - 10;
      if (atBottom) break;
    }
  }
  if (!visible) return { clicked: false, reason: 'card not on page' };

  visible.scrollIntoView({ block: 'center' });
  await sleep(200);

  const blocker = (e) => {
    const a = e.target && e.target.closest && e.target.closest(`a[href*="${noteId}"]`);
    if (a) e.preventDefault();
  };
  document.addEventListener('click', blocker, true);
  try {
    const card = visible.closest('section') || visible.closest('[class*="note-item" i]') || visible.parentElement;
    const img = card && card.querySelector('img');
    const target = img || card || visible;
    target.click();
  } finally {
    setTimeout(() => document.removeEventListener('click', blocker, true), 1500);
  }
  return { clicked: true };
}

// 等弹窗出现并抽正文：超时返回 notOpened
// 两阶段：
//   1) 等 #detail-desc 出现任何文本（说明 React 已经 mount 了 body）
//   2) 等 desc 文本长度稳定（连续 N 次轮询不变），避免流式渲染时只抓到半截
// 顺带把笔记类型、图片 URL、视频封面都抓回去——小红书很多正文在图里
function pageWaitAndExtract(timeoutMs, directMode) {
  return new Promise((resolve) => {
    const deadline = Date.now() + (timeoutMs || 12000);
    const text = (el) => (el?.innerText || el?.textContent || '').trim().replace(/\s+/g, ' ');
    const POLL_MS = 200;
    const STABLE_POLLS = 3;
    // 直开模式下整页就是"模态"，所以一开始就把"模态出现时间"标记掉，让降级超时也能触发
    let modalSeenAt = directMode ? Date.now() : 0;
    let lastLen = -1;
    let stableCount = 0;

    const detectNoteType = (modalRoot) => {
      if (!modalRoot) return 'unknown';
      // video 标签存在就是视频帖，即使图片也同时存在（首图就是封面）
      if (modalRoot.querySelector('video')) return 'video';
      // swiper 里有图就是图文帖
      if (modalRoot.querySelector('.swiper-slide img, .media-container img, [class*="slider" i] img')) return 'image';
      return 'unknown';
    };

    const extractImages = (modalRoot) => {
      if (!modalRoot) return [];
      const imgs = Array.from(modalRoot.querySelectorAll(
        '.swiper-slide img, .media-container img, [class*="note-slider" i] img, [class*="note-image" i] img'
      ));
      const urls = imgs
        .map((img) => {
          const r = img.getBoundingClientRect();
          // 过滤头像、tag 小图
          if (r.width < 100 || r.height < 100) return null;
          return img.currentSrc || img.src || '';
        })
        .filter((u) => u && /^https?:/.test(u) && !/avatar|emoji/i.test(u));
      // 小红书一条图文帖最多 18 张，留 20 的余量；swiper loop 模式会克隆 slide，依赖 Set 按 URL 去重
      return Array.from(new Set(urls)).slice(0, 20);
    };

    const extractVideoPoster = (modalRoot) => {
      if (!modalRoot) return '';
      const video = modalRoot.querySelector('video');
      if (video?.poster) return video.poster;
      // 小红书用 xgplayer，封面走 CSS background-image 挂在 .xgplayer-poster 上
      const posterEl = modalRoot.querySelector('.xgplayer-poster, [class*="poster" i]');
      if (posterEl) {
        const bg = getComputedStyle(posterEl).backgroundImage;
        const m = bg && bg.match(/url\(["']?([^"')]+)["']?\)/);
        if (m && /^https?:/.test(m[1])) return m[1];
      }
      const imgPoster = modalRoot.querySelector('[class*="poster" i] img, [class*="cover" i] img');
      return imgPoster?.src || '';
    };

    const snapshot = (extra = {}) => {
      const desc = document.getElementById('detail-desc');
      const title = document.getElementById('detail-title');
      // 直开模式：用 desc 的祖先节点作为根，避免推荐流的图片/标签混入
      let modalRoot = document.getElementById('noteContainer') || document.querySelector('.note-detail-mask');
      if (!modalRoot) {
        modalRoot = directMode
          ? (desc?.closest('[class*="note-content" i], [class*="note-container" i], main, article') || document.body)
          : document;
      }
      const tagEls = Array.from(modalRoot.querySelectorAll('a.tag, a[href*="/search_result"][href*="%23"], [class*="hash-tag" i]'));
      const tags = Array.from(new Set(tagEls.map((el) => text(el)).filter((t) => t && t.length < 30))).slice(0, 10);
      const noteType = detectNoteType(modalRoot);
      return {
        opened: true,
        title: text(title),
        body: (desc?.innerText || '').trim().slice(0, 4000),
        tags,
        noteType,
        images: extractImages(modalRoot),
        videoPoster: noteType === 'video' ? extractVideoPoster(modalRoot) : '',
        ...extra
      };
    };

    const check = () => {
      const desc = document.getElementById('detail-desc');
      const title = document.getElementById('detail-title');
      let modalRoot = document.getElementById('noteContainer') || document.querySelector('.note-detail-mask');
      // 直开模式下没有 modal，把 desc 的祖先当作 root；纯粹用于触发 modalSeenAt（计算降级超时）
      if (!modalRoot && directMode && desc) {
        modalRoot = desc.closest('[class*="note-content" i], [class*="note-container" i], main, article') || document.body;
      }
      const descLen = desc ? text(desc).length : 0;
      const titleText = title ? text(title) : '';

      if (modalRoot && !modalSeenAt) modalSeenAt = Date.now();

      if (descLen > 0) {
        if (descLen === lastLen) stableCount += 1;
        else stableCount = 0;
        lastLen = descLen;
      }

      const bodyStable = descLen > 0 && stableCount >= STABLE_POLLS;
      // 降级：弹窗开了 >= 6s 仍然没 desc（纯图帖 / 视频无字幕 / 反爬），照样认结果
      const degraded = modalSeenAt && Date.now() - modalSeenAt > 6000 && titleText.length > 0 && descLen === 0;

      if (bodyStable) {
        resolve(snapshot());
      } else if (degraded) {
        resolve(snapshot({ degraded: true }));
      } else if (Date.now() > deadline) {
        if (modalSeenAt) resolve(snapshot({ timedOut: true }));
        else resolve({ opened: false, title: titleText, body: '', tags: [], images: [], noteType: 'unknown', timedOut: true });
      } else {
        setTimeout(check, POLL_MS);
      }
    };
    check();
  });
}

// 关弹窗：优先点关闭按钮，再 ESC，再 history.back
function pageCloseModal() {
  return new Promise((resolve) => {
    const closeBtn = document.querySelector('.note-detail-mask [class*="close" i], .close-box, .close-circle');
    if (closeBtn) {
      closeBtn.click();
    } else {
      const opts = { key: 'Escape', code: 'Escape', keyCode: 27, which: 27, bubbles: true, cancelable: true };
      document.body.dispatchEvent(new KeyboardEvent('keydown', opts));
      document.dispatchEvent(new KeyboardEvent('keydown', opts));
    }
    const deadline = Date.now() + 2000;
    const triedBack = { v: false };
    const poll = () => {
      const stillOpen = document.getElementById('noteContainer') || document.querySelector('.note-detail-mask');
      if (!stillOpen) return resolve({ closed: true });
      if (Date.now() > deadline && !triedBack.v) {
        triedBack.v = true;
        try { window.history.back(); } catch {}
      }
      if (Date.now() > deadline + 1500) return resolve({ closed: false });
      setTimeout(poll, 100);
    };
    poll();
  });
}

// 单个 noteId 的抓取流程：点击 → 等弹窗抽正文 → 关弹窗
// 拆成三个短 executeScript，中途被页面导航炸掉也不会拖到上游 120s 超时
async function extractOneNote(tabId, noteId) {
  // Step 1: 点击卡片（capture-phase 阻默认跳转，让 React onClick 开弹窗）
  let clickResult;
  try {
    const [{ result } = {}] = await chrome.scripting.executeScript({
      target: { tabId },
      func: pageClickCard,
      args: [noteId]
    });
    clickResult = result;
  } catch (err) {
    return { noteId, error: `click inject failed: ${err.message}` };
  }
  if (!clickResult?.clicked) {
    return { noteId, error: clickResult?.reason || 'click failed' };
  }

  // Step 2: 等弹窗出现，抽标题/正文/tags
  let extractResult;
  try {
    const [{ result } = {}] = await chrome.scripting.executeScript({
      target: { tabId },
      func: pageWaitAndExtract,
      args: [8000]
    });
    extractResult = result;
  } catch (err) {
    // isolated world 被导航炸了的情况会在这里抛，不致命，继续关弹窗
    return { noteId, error: `extract inject failed: ${err.message}` };
  }

  // Step 3: 关弹窗（不管抽到没抽到都要关，避免阻塞下一条）
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: pageCloseModal
    });
  } catch {}

  if (!extractResult?.opened) {
    return { noteId, error: 'modal not opened' };
  }
  return {
    noteId,
    title: extractResult.title || '',
    body: extractResult.body || '',
    tags: extractResult.tags || [],
    noteType: extractResult.noteType || 'unknown',
    images: extractResult.images || [],
    videoPoster: extractResult.videoPoster || '',
    degraded: !!extractResult.degraded,
    timedOut: !!extractResult.timedOut
  };
}

// 把任意一个小红书笔记 URL 规范成可直开的 /explore/{id}（保留 xsec_token 等查询参数）
function canonicalNoteUrl(originalUrl, noteId) {
  try {
    const u = new URL(originalUrl);
    if (!/xiaohongshu\.com$/.test(u.hostname.replace(/^www\./, ''))) {
      return `https://www.xiaohongshu.com/explore/${noteId}`;
    }
    if (/^\/explore\//.test(u.pathname)) return originalUrl;
    // /search_result/{id}, /discovery/item/{id} → /explore/{id}，xsec 参数原样保留
    const newUrl = new URL(`https://www.xiaohongshu.com/explore/${noteId}`);
    u.searchParams.forEach((v, k) => newUrl.searchParams.set(k, v));
    return newUrl.toString();
  } catch {
    return `https://www.xiaohongshu.com/explore/${noteId}`;
  }
}

// 假定 tab 已经导航到了目标 /explore/{id}，注入 pageWaitAndExtract 拿正文
// 默认 6s 超时（连续 3 次 desc 文本稳定就放行，正常情况 1-3s 完成）
async function extractFromLoadedTab(tabId, noteId, timeoutMs = 6000) {
  // 进入轮询前先识别两种"无效页"，避免无意义地走完 6s
  //   ① title 含"页面不见了"——xhs 显式 404（无效 noteId、私密、被删等）
  //   ② URL 被重定向到 /explore 裸路径（不再含 noteId）——多半是无 xsec_token 直 navigate 被踢
  try {
    const [{ result } = {}] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => ({ title: document.title || '', path: location.pathname || '' })
    });
    if (result) {
      if (/页面不见了|访问的页面|404\b/i.test(result.title)) {
        return { noteId, error: `note_not_found (xhs: ${result.title.slice(0, 50)})` };
      }
      // 浏览器到达页时 URL 不再包含 noteId（被 xhs 重定向走了）
      if (!result.path.includes(noteId)) {
        return { noteId, error: `redirected_no_token (path=${result.path})` };
      }
    }
  } catch {}

  let result;
  try {
    const [{ result: r } = {}] = await chrome.scripting.executeScript({
      target: { tabId },
      func: pageWaitAndExtract,
      args: [timeoutMs, true]
    });
    result = r;
  } catch (err) {
    return { noteId, error: `extract inject failed: ${err.message}` };
  }
  if (!result?.opened) {
    return { noteId, error: 'page not loaded', timedOut: true };
  }
  // title/body/images 全空 ≈ 反爬遮罩或登录墙
  if (!result.title && !result.body && (!result.images || result.images.length === 0)) {
    return { noteId, error: 'login_required_or_blocked', timedOut: !!result.timedOut };
  }
  return {
    noteId,
    title: result.title || '',
    body: result.body || '',
    tags: result.tags || [],
    noteType: result.noteType || 'unknown',
    images: result.images || [],
    videoPoster: result.videoPoster || '',
    degraded: !!result.degraded,
    timedOut: !!result.timedOut
  };
}

// 孤儿 tab 跟踪：service worker 在 await 中途被 Chrome 杀掉时，finally 跑不到
// 把 tab id 写进 chrome.storage.session（survives worker restart），worker 复活时按表清扫
const LUNA_TEMP_TABS_KEY = 'lunaTempTabs';  // value: { [tabId]: createdAtMs }

async function rememberLunaTab(tabId) {
  const { [LUNA_TEMP_TABS_KEY]: tabs = {} } = await chrome.storage.session.get(LUNA_TEMP_TABS_KEY);
  tabs[tabId] = Date.now();
  await chrome.storage.session.set({ [LUNA_TEMP_TABS_KEY]: tabs });
}

async function forgetLunaTab(tabId) {
  const { [LUNA_TEMP_TABS_KEY]: tabs = {} } = await chrome.storage.session.get(LUNA_TEMP_TABS_KEY);
  if (tabs[tabId] != null) {
    delete tabs[tabId];
    await chrome.storage.session.set({ [LUNA_TEMP_TABS_KEY]: tabs });
  }
}

// maxAgeMs=0 表示无视时间全清；定期调用时传 60_000 只清"超过 60s 还没 forget"的孤儿
export async function sweepOrphanTabs(maxAgeMs = 0) {
  const { [LUNA_TEMP_TABS_KEY]: tabs = {} } = await chrome.storage.session.get(LUNA_TEMP_TABS_KEY);
  const now = Date.now();
  const targets = [];
  for (const [idStr, createdAt] of Object.entries(tabs)) {
    if (maxAgeMs === 0 || now - createdAt > maxAgeMs) targets.push(parseInt(idStr, 10));
  }
  if (targets.length === 0) return 0;
  console.log(`[luna-xhs] sweepOrphanTabs: 关闭 ${targets.length} 个孤儿 tab (maxAgeMs=${maxAgeMs})`);
  for (const id of targets) {
    try {
      await chrome.tabs.remove(id);
    } catch (err) {
      console.warn(`[luna-xhs] sweep close tab ${id} 失败: ${err.message}`);
    }
    delete tabs[id];
  }
  await chrome.storage.session.set({ [LUNA_TEMP_TABS_KEY]: tabs });
  return targets.length;
}

// 单条笔记直开抓取：开一个独立后台 tab → navigate → extract → close
// 抽出来供 readNotesByUrls 的 worker 复用。整体 worst case ≈ 12+0.6+6 = 18.6s
async function fetchOneNoteInOwnTab(originalUrl, noteId) {
  const navUrl = canonicalNoteUrl(originalUrl, noteId);
  let tab;
  try {
    tab = await chrome.tabs.create({ url: navUrl, active: false });
    await rememberLunaTab(tab.id);
    await waitForTabComplete(tab.id, 12000);
    // 等 React 把详情页 mount 完成。500-800ms 实测够（小红书首屏快）
    await sleep(500 + Math.random() * 300);
    return await extractFromLoadedTab(tab.id, noteId);
  } catch (err) {
    return { noteId, error: `navigate failed: ${err.message}` };
  } finally {
    if (tab?.id != null) {
      try {
        await chrome.tabs.remove(tab.id);
      } catch (err) {
        console.warn(`[luna-xhs] 关闭 tab ${tab.id} 失败: ${err.message}`);
      }
      try { await forgetLunaTab(tab.id); } catch {}
    }
  }
}

// 按 URL 批量抓笔记正文：每条笔记独立后台 tab，3 路并发跑
// 关键改动：
//   - 串行 → 并发（之前 3 条串行经常逼近 120s bridge timeout，现在 3 条 ≈ 20s）
//   - 每条独立 tab：单条卡住不影响其他；不复用 tab 也避免 SPA 状态污染
//   - waitForTabComplete 20s → 12s，pageWaitAndExtract 10s → 6s（实测够用）
// 不再依赖"必须先 browser_search"，给 agent 一个孤立 URL 也能用
export async function readNotesByUrls(urls) {
  return withLock('xhs:direct_read', async () => {
    const ids = [];
    const urlById = new Map();
    for (const u of urls) {
      const id = noteIdFromUrl(u);
      if (id && !urlById.has(id)) {
        ids.push(id);
        urlById.set(id, u);
      }
    }
    if (ids.length === 0) {
      return { notes: [], warning: '未从 URL 中解析到 noteId' };
    }

    const CONCURRENCY = Math.min(3, ids.length);
    const byId = new Map();
    let cursor = 0;

    const worker = async (workerIdx) => {
      while (true) {
        const myIdx = cursor++;
        if (myIdx >= ids.length) break;
        const id = ids[myIdx];
        const originalUrl = urlById.get(id);
        const n = await fetchOneNoteInOwnTab(originalUrl, id);
        byId.set(id, n);
        console.log(`[luna-xhs] worker=${workerIdx} ${myIdx + 1}/${ids.length} noteId=${id} bodyLen=${(n.body || '').length} ${n.error ? 'err=' + n.error : 'ok'}`);
      }
    };

    await Promise.all(
      Array.from({ length: CONCURRENCY }, (_, i) => worker(i))
    );

    const out = urls.map((url) => {
      const id = noteIdFromUrl(url);
      const n = id ? byId.get(id) : null;
      return {
        url,
        noteId: id,
        title: n?.title || '',
        body: n?.body || '',
        tags: n?.tags || [],
        noteType: n?.noteType || 'unknown',
        images: n?.images || [],
        videoPoster: n?.videoPoster || '',
        ...(n?.error ? { error: n.error } : {})
      };
    });
    return { notes: out };
  });
}

export async function enrichCardsWithBody(cards, topN = 5, tabId) {
  const targets = cards.slice(0, topN);
  const ids = targets.map((c) => c.noteId).filter(Boolean);
  if (ids.length === 0 || tabId == null) return cards;

  for (let i = 0; i < ids.length; i += 1) {
    const id = ids[i];
    console.log(`[luna-xhs] enrich ${i + 1}/${ids.length} noteId=${id}`);
    const n = await extractOneNote(tabId, id);
    const c = targets.find((x) => x.noteId === id);
    if (c && !n.error) {
      c.body = n.body || '';
      c.tags = n.tags || [];
      c.noteType = n.noteType || 'unknown';
      c.images = n.images || [];
      c.videoPoster = n.videoPoster || '';
      if (n.title && !c.title) c.title = n.title;
    }
    if (i < ids.length - 1) await sleep(600 + Math.random() * 400);
  }
  return cards;
}

async function findOrCreateTab() {
  const existing = await findTabByPattern('https://*.xiaohongshu.com/*');
  if (existing) return { tab: existing, created: false };
  const tab = await chrome.tabs.create({ url: 'https://www.xiaohongshu.com/', active: false });
  await waitForTabComplete(tab.id, 20000);
  return { tab, created: true };
}

export async function searchXiaohongshu(query, maxResults = 10, fetchBodyTopN = 0) {
  if (!query) throw new Error('query empty');
  return withLock('xhs:search_tab', async () => {
    const { tab } = await findOrCreateTab();

    await tabsUpdateWithRetry(tab.id, { url: SEARCH_URL(query) });
    await waitForTabComplete(tab.id, 20000);
    await sleep(1500 + Math.random() * 800);

    const [{ result: results } = {}] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: pageExtract,
      args: [maxResults]
    });

    if (!results || results.length === 0) {
      const [{ result: loginRequired } = {}] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => Boolean(document.querySelector('[class*="login" i]') &&
                            (document.body.innerText || '').includes('登录'))
      });
      if (loginRequired) {
        return { results: [], reason: 'login_required', warning: '小红书需要登录，请在该标签页手动登录后重试' };
      }
      return { results: [], reason: 'empty', warning: '未抽取到结果，可能是页面结构变化' };
    }

    const topN = Math.max(0, Math.min(results.length, fetchBodyTopN));
    if (topN > 0) {
      await enrichCardsWithBody(results, topN, tab.id);
    }

    for (const r of results) {
      if (r.body) {
        r.snippet = r.body.slice(0, 500);
      } else {
        r.snippet = [r.author, r.stats].filter(Boolean).join(' · ');
      }
    }

    return { results };
  });
}
