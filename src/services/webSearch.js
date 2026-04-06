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

// ─── 结果质量评分 ────────────────────────────────────────────────────────

// 权威域名加分（这些域名内容通常可靠）
const TRUSTED_DOMAINS = /36kr\.com|huxiu\.com|36kr|techcrunch|bloomberg|reuters|theverge|wired|arstechnica|36氪|虎嗅|界面新闻|36kr|latepost|晚点|caixin|财新|yicai|第一财经|pingwest|品玩|sspai|少数派|guokr|果壳|zhihu\.com\/p|mp\.weixin|baijiahao\.baidu|people\.com|xinhuanet|chinadaily/i;
const SPAM_SIGNALS   = /download|free|crack|porn|casino|lottery|彩票|成人|外挂|破解|刷单|兼职赚钱|快速致富/i;

function scoreResult(result, query) {
  let score = 0;
  const title   = (result.title   || '').toLowerCase();
  const snippet = (result.snippet || '').toLowerCase();
  const url     = (result.url     || '').toLowerCase();
  const queryTerms = query.toLowerCase().split(/\s+/).filter(Boolean);

  // 1. 标题相关性（最高 30 分）
  const titleHits = queryTerms.filter(t => title.includes(t)).length;
  score += Math.min(30, titleHits * 10);

  // 2. Snippet 相关性（最高 20 分）
  const snippetHits = queryTerms.filter(t => snippet.includes(t)).length;
  score += Math.min(20, snippetHits * 7);

  // 3. Snippet 内容质量：长度适中（最高 15 分）
  const snippetLen = snippet.length;
  if (snippetLen > 60)  score += 10;
  if (snippetLen > 120) score += 5;

  // 4. 权威域名（最高 15 分）
  if (TRUSTED_DOMAINS.test(url) || TRUSTED_DOMAINS.test(result.siteName || '')) score += 15;

  // 5. 时效性（最高 10 分）
  if (result.date) {
    const year = String(result.date).match(/202[3-9]|2030/)?.[0];
    if (year) score += year >= '2025' ? 10 : year >= '2024' ? 6 : 3;
  }

  // 6. URL 质量：https、无过多参数（最高 5 分）
  if (url.startsWith('https')) score += 3;
  if ((url.match(/[?&]/g) || []).length <= 2) score += 2;

  // 7. 垃圾信号（扣分）
  if (SPAM_SIGNALS.test(title) || SPAM_SIGNALS.test(url)) score -= 30;

  return Math.max(0, score);
}

/**
 * 多源结果合并、去重、评分，返回最优 N 条
 */
function mergeAndRank(allResults, query, maxResults = 8) {
  // URL 去重（保留先出现的，同 URL 给予多源加分）
  const seen   = new Map(); // url → item
  const counts = new Map(); // url → provider count

  for (const item of allResults) {
    const key = (item.url || '').split('?')[0].replace(/\/$/, '').toLowerCase();
    if (!key) continue;
    counts.set(key, (counts.get(key) || 0) + 1);
    if (!seen.has(key)) seen.set(key, item);
  }

  const deduped = [...seen.entries()].map(([key, item]) => ({
    ...item,
    _multiSourceBonus: (counts.get(key) || 1) > 1 ? 8 : 0
  }));

  // 评分排序
  const scored = deduped.map(item => ({
    ...item,
    _score: scoreResult(item, query) + item._multiSourceBonus
  })).sort((a, b) => b._score - a._score);

  return scored.slice(0, maxResults).map(({ _score, _multiSourceBonus, source, siteName, ...rest }) => rest);
}

// ─── 统一入口：并行多源 + 质量评分 ─────────────────────────────────────

/**
 * 并行拉取多个搜索源，合并评分后返回最优结果
 * @param {string} query
 * @param {object} options  { minimaxApiKey, tavilyApiKey, maxResults }
 * @returns {Promise<{results: Array, source: string|null, warning: string|null}>}
 */
async function search(query, options = {}) {
  const maxResults = options.maxResults || 8;
  const tasks = [];

  // 并行发起所有可用搜索源
  tasks.push(
    searchWithMinimax(query, options)
      .then(r => r.map(x => ({ ...x, source: 'minimax' })))
      .catch(err => { console.warn(`[webSearch] MiniMax 失败: ${err.message}`); return []; })
  );

  if (options.tavilyApiKey || config.tavilyApiKey) {
    tasks.push(
      searchWithTavily(query, options)
        .then(r => r.map(x => ({ ...x, source: 'tavily' })))
        .catch(err => { console.warn(`[webSearch] Tavily 失败: ${err.message}`); return []; })
    );
  }

  const allResults = (await Promise.all(tasks)).flat();

  if (allResults.length > 0) {
    const ranked = mergeAndRank(allResults, query, maxResults);
    const sources = [...new Set(allResults.filter(r => r.source).map(r => r.source))];
    console.log(`[webSearch] 多源合并: ${allResults.length} 条 → 评分后取 ${ranked.length} 条 (${sources.join('+')})`);
    return { results: ranked, source: sources.join('+'), warning: null };
  }

  // 所有主力源失败，降级 DuckDuckGo
  try {
    const results = await searchWithDDG(query, options);
    if (results.length > 0) {
      console.log(`[webSearch] DuckDuckGo 兜底: "${query}" → ${results.length} 条`);
      return { results, source: 'ddg', warning: null };
    }
  } catch (err) {
    console.warn(`[webSearch] DuckDuckGo 也失败: ${err.message}`);
  }

  return { results: [], source: null, warning: '搜索服务暂时不可用，将基于通用知识继续工作' };
}

module.exports = { search, searchWithMinimax, searchWithTavily, searchWithDDG };
