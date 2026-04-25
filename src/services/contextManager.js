const TOOL_TRUNCATION_CONFIG = {
  web_search:    { maxChars: 3000, compactable: true },
  web_fetch:     { maxChars: 4000, compactable: true },
  search_images: { maxChars: 2000, compactable: true },
  run_strategy:  { maxChars: Infinity, compactable: false },
  build_ppt:     { maxChars: Infinity, compactable: false },
  update_brief:  { maxChars: Infinity, compactable: false },
  read_workspace_doc:    { maxChars: 3000, compactable: true },
  save_to_workspace:     { maxChars: 2000, compactable: true },
  update_workspace_doc:  { maxChars: 2000, compactable: true },
  generate_image:         { maxChars: 1500, compactable: true },
  review_uploaded_images: { maxChars: 2000, compactable: true },
  write_todos: { maxChars: 800, compactable: true },
};

const DEFAULT_TRUNCATION = { maxChars: 1000, compactable: true };

const CONTEXT_TOKEN_WARN = 30000;

function estimateTokens(text) {
  return Math.ceil((text || '').length * 0.4);
}

function truncateToolResult(toolName, content) {
  if (typeof content !== 'string') return content;
  const config = TOOL_TRUNCATION_CONFIG[toolName] || DEFAULT_TRUNCATION;
  if (content.length <= config.maxChars) return content;
  const preview = content.slice(0, config.maxChars);
  return `${preview}\n...[${toolName} 结果已截断，保留前 ${config.maxChars} 字符]`;
}

function isCompactableTool(toolName) {
  const config = TOOL_TRUNCATION_CONFIG[toolName] || DEFAULT_TRUNCATION;
  return config.compactable;
}

function compressOldMessages(olderMessages) {
  if (!olderMessages.length) return [];

  const summaryParts = [];
  const toolCallSummaries = [];

  for (const msg of olderMessages) {
    if (msg.role === 'user') {
      const text = typeof msg.content === 'string' ? msg.content : '';
      if (text.length > 0) {
        summaryParts.push(`用户：${text.slice(0, 80)}${text.length > 80 ? '...' : ''}`);
      }
    } else if (msg.role === 'assistant') {
      const text = typeof msg.content === 'string' ? msg.content : '';
      if (text && text.trim()) {
        summaryParts.push(`助手：${text.slice(0, 80)}${text.length > 80 ? '...' : ''}`);
      }
      if (Array.isArray(msg.tool_calls)) {
        for (const tc of msg.tool_calls) {
          const fnName = tc.function?.name || tc.name || 'unknown';
          toolCallSummaries.push(fnName);
        }
      }
    }
  }

  if (!summaryParts.length && !toolCallSummaries.length) return [];

  const lines = ['[历史对话摘要]'];
  if (summaryParts.length) {
    lines.push(...summaryParts);
  }
  if (toolCallSummaries.length) {
    lines.push(`已执行工具：${toolCallSummaries.join(' → ')}`);
  }

  return [{
    role: 'system',
    content: lines.join('\n')
  }];
}

function extractKeyState(session) {
  const parts = [];

  if (session.brief) {
    const b = session.brief;
    const briefLines = ['[当前任务简报]'];
    if (b.brand) briefLines.push(`品牌：${b.brand}`);
    if (b.eventType) briefLines.push(`活动类型：${b.eventType}`);
    if (b.topic) briefLines.push(`主题：${b.topic}`);
    if (b.goal) briefLines.push(`目标：${b.goal}`);
    if (b.audience) briefLines.push(`受众：${b.audience}`);
    if (b.style) briefLines.push(`风格：${b.style}`);
    if (Array.isArray(b.assumptions) && b.assumptions.length) {
      briefLines.push(`假设：${b.assumptions.join('；')}`);
    }
    parts.push(briefLines.join('\n'));
  }

  if (session.bestPlan) {
    const p = session.bestPlan;
    const planLines = ['[当前策划方案摘要]'];
    if (p.planTitle) planLines.push(`标题：${p.planTitle}`);
    if (p.coreStrategy) planLines.push(`核心策略：${p.coreStrategy.slice(0, 120)}`);
    if (Array.isArray(p.highlights) && p.highlights.length) {
      planLines.push(`亮点：${p.highlights.slice(0, 3).join('；')}`);
    }
    parts.push(planLines.join('\n'));
  }

  return parts.length ? parts.join('\n\n') : null;
}

module.exports = {
  TOOL_TRUNCATION_CONFIG,
  DEFAULT_TRUNCATION,
  CONTEXT_TOKEN_WARN,
  estimateTokens,
  truncateToolResult,
  isCompactableTool,
  compressOldMessages,
  extractKeyState,
};
