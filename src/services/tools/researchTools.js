// 网络研究工具：web_search, web_fetch
const { search: webSearch } = require('../webSearch');
const { fetchPage } = require('../webFetch');

async function execWebSearch(args, session, onEvent) {
  const searchResult = await webSearch(args.query, {
    minimaxApiKey: session.apiKeys.minimaxApiKey,
    tavilyApiKey: session.apiKeys.tavilyApiKey,
    maxResults: args.max_results || 8
  });

  if (!searchResult.results.length) {
    if (searchResult.warning) {
      onEvent('tool_progress', { message: searchResult.warning });
    }
    return { found: false, results: [], warning: searchResult.warning };
  }

  const results = searchResult.results;
  const summary = results.map((r, i) =>
    `[${i + 1}] ${r.title}\n${r.snippet}`
  ).join('\n\n');

  // 累积到 researchStore，供 run_strategy 强制引用，不依赖 Brain 的记忆
  if (!Array.isArray(session.researchStore)) session.researchStore = [];
  session.researchStore.push({
    query: args.query,
    timestamp: Date.now(),
    results: results.map(r => ({ title: r.title, url: r.url, snippet: r.snippet })),
    source: searchResult.source
  });

  onEvent('tool_progress', { message: `找到 ${results.length} 条结果（${searchResult.source}）` });

  const stripHtml = (s = '') => String(s)
    .replace(/<\/?[^>]+>/g, ' ')   // 去 HTML 标签
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();

  const extractDomain = (url = '') => {
    try { return new URL(url).hostname.replace(/^www\./, ''); }
    catch { return ''; }
  };

  const cleanedResults = results.map(r => ({
    title: stripHtml(r.title || ''),
    url: r.url || '',
    domain: extractDomain(r.url || ''),
    snippet: stripHtml(r.snippet || '')
  }));

  onEvent('artifact', {
    artifactType: 'research_result',
    payload: {
      focus: args.query,
      count: cleanedResults.length,
      source: searchResult.source,
      results: cleanedResults.slice(0, 8)
    }
  });

  return {
    found: true,
    count: results.length,
    summary,
    results: results.map(r => ({ title: r.title, url: r.url, snippet: r.snippet })),
    source: searchResult.source
  };
}

async function execWebFetch(args, session, onEvent) {
  const content = await fetchPage(args.url, {
    jinaApiKey: session.apiKeys.jinaApiKey,
    timeoutMs: 12000,
    maxLength: 3000
  });

  if (!content) return { success: false, content: '' };

  onEvent('tool_progress', { message: '页面内容已读取' });
  return { success: true, content };
}

module.exports = { execWebSearch, execWebFetch };
