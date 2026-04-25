// tab 管理：per-host 串行锁 + tab 存在性校验 + 模式复用
// 目标是消除 xiaohongshu.js 里单全局 lastSearchTabId 的竞态

const locks = new Map(); // key -> Promise

// 简单的串行锁：同一 key 下的 fn 依次执行
export async function withLock(key, fn) {
  const prev = locks.get(key) || Promise.resolve();
  let release;
  const cur = new Promise((r) => { release = r; });
  const chained = prev.then(() => cur);
  locks.set(key, chained);
  await prev;
  try {
    return await fn();
  } finally {
    release();
    if (locks.get(key) === chained) locks.delete(key);
  }
}

export async function tabStillAlive(tabId) {
  if (tabId == null) return false;
  try {
    const tab = await chrome.tabs.get(tabId);
    return !!tab;
  } catch {
    return false;
  }
}

// 找一个匹配 urlPattern 的 tab；找不到则 null（不自动创建，由调用方决定）
export async function findTabByPattern(urlPattern) {
  const tabs = await chrome.tabs.query({ url: urlPattern });
  return tabs[0] || null;
}

// Chrome 在用户拖拽 tab / 窗口过渡时会抛 "Tabs cannot be edited right now"
// 这类错误短暂出现就恢复，做几次退避重试即可
export async function tabsUpdateWithRetry(tabId, updateInfo, { retries = 5, baseDelayMs = 250 } = {}) {
  let lastErr;
  for (let i = 0; i < retries; i += 1) {
    try {
      return await chrome.tabs.update(tabId, updateInfo);
    } catch (err) {
      lastErr = err;
      const transient = /cannot be edited right now|user may be dragging/i.test(err?.message || '');
      if (!transient) throw err;
      await new Promise((r) => setTimeout(r, baseDelayMs * (i + 1)));
    }
  }
  throw lastErr;
}

export function waitForTabComplete(tabId, timeoutMs = 20000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      reject(new Error('页面加载超时'));
    }, timeoutMs);
    const listener = (updatedId, info) => {
      if (updatedId === tabId && info.status === 'complete') {
        clearTimeout(timer);
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    };
    chrome.tabs.onUpdated.addListener(listener);
  });
}
