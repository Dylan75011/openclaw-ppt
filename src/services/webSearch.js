// 统一网页搜索服务：MiniMax Web Search（Token Plan）→ Tavily → DuckDuckGo（免费兜底）
const config = require('../config');

const SEARCH_TIMEOUT_MS = 10000;

// ─── MiniMax Coding Plan Search（Token Plan 专属，sk-cp- key 即可用）────────

async function searchWithMinimax(query, options = {}) {
  const apiKey = options.minimaxApiKey || config.minimaxApiKey;
  if (!apiKey) throw new Error('MiniMax API Key 未配置');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS);

  try {
    const response = await fetch('https://api.minimaxi.com/v1/coding_plan/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({ q: query }),
      signal: controller.signal
    });

    if (!response.ok) throw new Error(`MiniMax Search HTTP ${response.status}`);

    const data = await response.json();

    // 检查 API 层错误码
    const baseResp = data.base_resp || {};
    if (typeof baseResp.status_code === 'number' && baseResp.status_code !== 0) {
      throw new Error(`MiniMax Search API Error ${baseResp.status_code}: ${baseResp.status_msg}`);
    }

    const organic = data.organic || [];
    return organic.slice(0, options.maxResults || 5).map(r => ({
      title: r.title || '',
      url: r.link || '',
      snippet: r.snippet || '',
      date: r.date || ''
    }));
  } finally {
    clearTimeout(timer);
  }
}

// ─── Tavily ────────────────────────────────────────────────────────────────

async function searchWithTavily(query, options = {}) {
  const apiKey = options.tavilyApiKey || config.tavilyApiKey;
  if (!apiKey) throw new Error('Tavily API Key 未配置');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS);

  try {
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({ query, search_depth: 'basic', max_results: options.maxResults || 5 }),
      signal: controller.signal
    });

    if (!response.ok) throw new Error(`Tavily HTTP ${response.status}`);

    const data = await response.json();
    return (data.results || []).map(r => ({
      title: r.title || '',
      url: r.url || '',
      snippet: r.content || r.snippet || '',
      date: r.published_date || r.date || ''
    }));
  } finally {
    clearTimeout(timer);
  }
}

// ─── DuckDuckGo（免费，无需 Key）─────────────────────────────────────────

async function searchWithDDG(query, options = {}) {
  const maxResults = options.maxResults || 5;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS);

  try {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}&kl=cn-zh`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Referer': 'https://duckduckgo.com/',
        'Cache-Control': 'no-cache'
      },
      signal: controller.signal
    });

    if (!response.ok) throw new Error(`DDG HTTP ${response.status}`);

    const html = await response.text();
    return parseDDGHtml(html, maxResults);
  } finally {
    clearTimeout(timer);
  }
}

function parseDDGHtml(html, maxResults) {
  const results = [];

  // 匹配 result__a 链接（标题+URL）
  const linkRe = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
  // 匹配 result__snippet（可能是 <a> 或 <div>）
  const snippetRe = /<(?:a|div)[^>]+class="result__snippet[^"]*"[^>]*>([\s\S]*?)<\/(?:a|div)>/;

  // 按 result__body 分块，保证 title/snippet 一一对应
  const blockRe = /<div[^>]+class="[^"]*result__body[^"]*"[^>]*>([\s\S]*?)(?=<div[^>]+class="[^"]*result__body|$)/g;

  let blockMatch;
  while ((blockMatch = blockRe.exec(html)) !== null && results.length < maxResults) {
    const block = blockMatch[1];

    const linkMatch = linkRe.exec(block);
    linkRe.lastIndex = 0; // 重置，因为每次都从头匹配 block

    if (!linkMatch) continue;

    const rawUrl = linkMatch[1];
    const titleHtml = linkMatch[2];
    const snippetMatch = snippetRe.exec(block);
    const snippet = snippetMatch ? stripTags(snippetMatch[1]) : '';

    // 解码 DDG 重定向 URL
    let url = rawUrl;
    try {
      const uddg = new URL('https://duckduckgo.com' + rawUrl).searchParams.get('uddg');
      if (uddg) url = decodeURIComponent(uddg);
    } catch {
      // rawUrl 可能已经是绝对 URL
    }

    if (!url || url.startsWith('https://duckduckgo.com')) continue;

    results.push({
      title: stripTags(titleHtml),
      url,
      snippet,
      date: ''
    });
  }

  return results;
}

function stripTags(str) {
  return str.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#x27;/g, "'").trim();
}

// ─── 统一入口：自动降级 ──────────────────────────────────────────────────

/**
 * 搜索网页，自动降级：MiniMax Web Search → Tavily → DuckDuckGo → 空数组
 * @param {string} query
 * @param {object} options  { minimaxApiKey, tavilyApiKey, maxResults }
 * @returns {Promise<{results: Array, source: string|null, warning: string|null}>}
 */
async function search(query, options = {}) {
  // 1. 尝试 MiniMax Coding Plan Search（Token Plan 用户可直接使用 sk-cp- key）
  try {
    const results = await searchWithMinimax(query, options);
    if (results.length > 0) {
      console.log(`[webSearch] MiniMax 搜索成功: "${query}" → ${results.length} 条`);
      return { results, source: 'minimax', warning: null };
    }
  } catch (err) {
    console.warn(`[webSearch] MiniMax 失败，降级 Tavily: ${err.message}`);
  }

  // 2. 降级 Tavily
  try {
    const results = await searchWithTavily(query, options);
    if (results.length > 0) {
      console.log(`[webSearch] Tavily 搜索成功: "${query}" → ${results.length} 条`);
      return { results, source: 'tavily', warning: null };
    }
  } catch (err) {
    console.warn(`[webSearch] Tavily 失败，降级 DuckDuckGo: ${err.message}`);
  }

  // 3. 降级 DuckDuckGo
  try {
    const results = await searchWithDDG(query, options);
    if (results.length > 0) {
      console.log(`[webSearch] DuckDuckGo 搜索成功: "${query}" → ${results.length} 条`);
      return { results, source: 'ddg', warning: null };
    }
  } catch (err) {
    console.warn(`[webSearch] DuckDuckGo 也失败: ${err.message}`);
  }

  // 4. 兜底空数组
  return { results: [], source: null, warning: '搜索服务暂时不可用，将基于通用知识继续工作' };
}

module.exports = { search, searchWithMinimax, searchWithTavily, searchWithDDG };
