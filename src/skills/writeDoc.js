// Skill: 将策划方案转化为 Markdown 文档并渲染为 Tiptap 兼容的 HTML
const { callLLM } = require('../utils/llmUtils');
const { buildDocWriterPrompt } = require('../prompts/docWriter');

/**
 * 将 LLM 输出的 Markdown 转换为 Tiptap 兼容的 HTML
 */
function markdownToHtml(md) {
  let html = md
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .trim();

  const lines = html.split('\n');
  const result = [];
  let inTable = false;
  let tableRows = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.trim().startsWith('|')) {
      if (!inTable) { inTable = true; tableRows = []; }
      if (/^\|[\s\-|]+\|$/.test(line.trim())) continue;
      const cells = line.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());
      tableRows.push(cells);
      continue;
    } else if (inTable) {
      inTable = false;
      const [header, ...body] = tableRows;
      const thead = header ? `<thead><tr>${header.map(c => `<th>${esc(c)}</th>`).join('')}</tr></thead>` : '';
      const tbody = body.map(row => `<tr>${row.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('');
      result.push(`<table>${thead}<tbody>${tbody}</tbody></table>`);
      tableRows = [];
    }

    if (/^### (.+)/.test(line)) {
      result.push(`<h3>${inlineParse(line.replace(/^### /, ''))}</h3>`);
    } else if (/^## (.+)/.test(line)) {
      result.push(`<h2>${inlineParse(line.replace(/^## /, ''))}</h2>`);
    } else if (/^# (.+)/.test(line)) {
      result.push(`<h1>${inlineParse(line.replace(/^# /, ''))}</h1>`);
    } else if (/^- (.+)/.test(line)) {
      result.push(`<li>${inlineParse(line.replace(/^- /, ''))}</li>`);
    } else if (line.trim() === '') {
      result.push('');
    } else {
      result.push(`<p>${inlineParse(line)}</p>`);
    }
  }

  if (inTable && tableRows.length) {
    const [header, ...body] = tableRows;
    const thead = header ? `<thead><tr>${header.map(c => `<th>${esc(c)}</th>`).join('')}</tr></thead>` : '';
    const tbody = body.map(row => `<tr>${row.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('');
    result.push(`<table>${thead}<tbody>${tbody}</tbody></table>`);
  }

  return result.join('\n')
    .replace(/(<li>[\s\S]*?<\/li>\n?)+/g, m => `<ul>${m}</ul>`);
}

function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function inlineParse(text) {
  return esc(text)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>');
}

/**
 * @param {{ plan, userInput, reviewFeedback }} input
 * @param {object} apiKeys  { minimaxApiKey, minimaxModel }
 * @returns {Promise<{ markdown: string, html: string }>}
 */
async function writeDoc({ plan, userInput, reviewFeedback }, apiKeys) {
  console.log('[skill:writeDoc] 开始生成策划文档...');
  const { systemPrompt, userPrompt } = buildDocWriterPrompt(plan, userInput, reviewFeedback);
  const markdown = await callLLM(
    [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
    {
      model: 'minimax',
      runtimeKey: apiKeys.minimaxApiKey,
      minimaxModel: apiKeys.minimaxModel,
      maxTokens: 6000,
      temperature: 0.4,
      name: 'writeDoc'
    }
  );
  const html = markdownToHtml(markdown);
  console.log('[skill:writeDoc] 文档生成完成');
  return { markdown, html };
}

module.exports = { writeDoc };
