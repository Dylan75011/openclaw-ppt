// Skill: 一次性流式产出策划 Markdown 文档 + 结构化 JSON
// - 先输出 Markdown（用户实时看到，按 ## 边界推送预览）
// - 再输出 <plan_json>...</plan_json> 包裹的 JSON（供 build_ppt / review_strategy 使用）
const { callMinimaxStreamText } = require('../services/llmClients');
const { buildPlanDocPrompt } = require('../prompts/planDocWriter');
const { buildBeautifyPrompt } = require('../prompts/beautifyPlanDoc');
const { markdownToHtml } = require('../services/richText');
const { normalizeStrategizeResult } = require('../utils/structuredOutput');
const { buildFallbackStrategy } = require('./strategize');
const { buildFallbackMarkdown } = require('./writeDoc');

const PLAN_JSON_OPEN = '<plan_json>';
const PLAN_JSON_CLOSE = '</plan_json>';

// ─── <think> 实时过滤器 ──────────────────────────────────────────────
function createThinkStripper(onClean) {
  let buf = '';
  let inThink = false;
  return (delta) => {
    buf += delta;
    let out = '';
    let i = 0;
    while (i < buf.length) {
      if (!inThink) {
        const s = buf.indexOf('<think>', i);
        if (s === -1) { out += buf.slice(i); buf = ''; break; }
        out += buf.slice(i, s);
        inThink = true;
        i = s + 7;
      } else {
        const e = buf.indexOf('</think>', i);
        if (e === -1) { buf = buf.slice(i); break; }
        inThink = false;
        i = e + 8;
      }
    }
    if (out) onClean(out);
  };
}

// ─── 分流器：把 clean 流切成 markdown 段 和 json 段 ─────────────────
// 状态：
//   'md'    → 正在积累 markdown，寻找 <plan_json> 起始标签
//   'json'  → 正在积累 JSON 内容，寻找 </plan_json> 结束标签
//   'done'  → 已遇到 </plan_json>，忽略后续内容
function createSplitter({ onMarkdownDelta, onJsonDelta }) {
  let phase = 'md';
  let pending = '';  // 可能跨 chunk 的部分 tag
  const OPEN_LEN = PLAN_JSON_OPEN.length;
  const CLOSE_LEN = PLAN_JSON_CLOSE.length;

  return (clean) => {
    if (phase === 'done') return;
    pending += clean;

    while (pending.length > 0) {
      if (phase === 'md') {
        const openIdx = pending.indexOf(PLAN_JSON_OPEN);
        if (openIdx !== -1) {
          // 推出 tag 之前的 markdown
          if (openIdx > 0) onMarkdownDelta(pending.slice(0, openIdx));
          pending = pending.slice(openIdx + OPEN_LEN);
          phase = 'json';
          continue;
        }
        // 尚未遇到 <plan_json>：保留最后 OPEN_LEN-1 个字符，防止 tag 被切开
        if (pending.length > OPEN_LEN) {
          const safeEnd = pending.length - (OPEN_LEN - 1);
          onMarkdownDelta(pending.slice(0, safeEnd));
          pending = pending.slice(safeEnd);
        }
        break;
      }

      if (phase === 'json') {
        const closeIdx = pending.indexOf(PLAN_JSON_CLOSE);
        if (closeIdx !== -1) {
          if (closeIdx > 0) onJsonDelta(pending.slice(0, closeIdx));
          pending = '';
          phase = 'done';
          break;
        }
        if (pending.length > CLOSE_LEN) {
          const safeEnd = pending.length - (CLOSE_LEN - 1);
          onJsonDelta(pending.slice(0, safeEnd));
          pending = pending.slice(safeEnd);
        }
        break;
      }
    }
  };
}

// 尝试从文本中解析 JSON（容错处理）
function tryParseJson(raw) {
  const text = String(raw || '').trim();
  if (!text) return null;
  try { return JSON.parse(text); } catch {}
  // 兜底：提取第一个完整 { ... }
  const first = text.indexOf('{');
  const last = text.lastIndexOf('}');
  if (first !== -1 && last > first) {
    try { return JSON.parse(text.slice(first, last + 1)); } catch {}
  }
  return null;
}

/**
 * 一次性流式产出 markdown + structured plan
 * @param {{ orchestratorOutput, researchResults, userInput, round, onStatus, onSection }} input
 *   onSection(accumulatedMarkdown) — 每遇到 ## 边界或结束时回调，供调用方实时推送预览
 * @param {object} apiKeys  { minimaxApiKey, minimaxModel }
 * @returns {Promise<{ plan, markdown, html, degraded?: boolean, fallbackReason?: string }>}
 */
// 流空闲超时：连续 IDLE_MS 没收到任何 delta 就 abort（模型停摆）
// 总超时：TOTAL_MS 还没结束就 abort（防止永久挂起）
const STREAM_IDLE_MS = 30000;
const STREAM_TOTAL_MS = 180000;

// 美化阶段（较短）：idle 20s / total 90s
const BEAUTIFY_IDLE_MS = 20000;
const BEAUTIFY_TOTAL_MS = 90000;

/**
 * 对已经生成好的 markdown 再过一次 LLM，仅做排版重排。
 * - 流式期间通过 onSection(accumulated) 实时刷新右侧预览
 * - 严格保留原文信息，失败/超时则返回 null，调用方保留原版
 */
async function beautifyMarkdown(originalMarkdown, apiKeys, { onSection } = {}) {
  const { systemPrompt, userPrompt } = buildBeautifyPrompt(originalMarkdown);

  let accumulated = '';
  let lastPushAt = 0;

  const controller = new AbortController();
  let idleTimer = null;
  let totalTimer = null;
  let abortReason = '';

  const triggerAbort = (reason) => {
    if (controller.signal.aborted) return;
    abortReason = reason;
    console.warn(`[skill:generatePlanDoc] beautify ${reason}，主动中断`);
    try { controller.abort(new Error(reason)); } catch {}
  };
  const resetIdle = () => {
    if (controller.signal.aborted) return;
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => triggerAbort('beautify_idle_timeout'), BEAUTIFY_IDLE_MS);
  };
  totalTimer = setTimeout(() => triggerAbort('beautify_total_timeout'), BEAUTIFY_TOTAL_MS);
  resetIdle();

  const pushPreview = () => {
    if (typeof onSection !== 'function') return;
    if (accumulated.length <= lastPushAt) return;
    try { onSection(accumulated); } catch {}
    lastPushAt = accumulated.length;
  };

  const stripper = createThinkStripper((clean) => {
    accumulated += clean;
    const newContent = accumulated.slice(lastPushAt);
    const isFirstEmit = lastPushAt === 0 && accumulated.length >= 80;
    const hasSectionBoundary = /\n## /.test(newContent);
    if ((isFirstEmit || hasSectionBoundary) && accumulated.length > lastPushAt + 40) {
      pushPreview();
    }
  });

  try {
    await callMinimaxStreamText(
      [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
      {
        runtimeKey: apiKeys.minimaxApiKey,
        minimaxModel: apiKeys.minimaxModel,
        maxTokens: 8000,
        temperature: 0.2,
        signal: controller.signal
      },
      (delta) => {
        resetIdle();
        stripper(delta);
      }
    );
  } catch (err) {
    console.warn('[skill:generatePlanDoc] beautify 流式失败:', err?.message || err);
    if (controller.signal.aborted) return null;
  } finally {
    clearTimeout(idleTimer);
    clearTimeout(totalTimer);
  }

  const result = accumulated.trim();
  if (!result) return null;
  // 长度兜底：美化结果不应显著短于原文（否则可能丢信息）
  if (result.length < originalMarkdown.trim().length * 0.6) {
    console.warn(`[skill:generatePlanDoc] beautify 结果过短 (${result.length} vs ${originalMarkdown.length})，丢弃`);
    return null;
  }
  // 最终再刷新一次完整预览，保证尾部也被推到前端
  pushPreview();
  return result;
}

async function generatePlanDoc(input, apiKeys) {
  const { userInput = {}, round = 1, onStatus, onSection } = input || {};
  console.log('[skill:generatePlanDoc] 开始合并生成（markdown + JSON）...');

  const { systemPrompt, userPrompt } = buildPlanDocPrompt(input);

  let markdown = '';
  let jsonRaw = '';
  let lastSectionAt = 0;

  const emitSection = () => {
    if (typeof onSection === 'function' && markdown.length > lastSectionAt) {
      try { onSection(markdown); } catch {}
      lastSectionAt = markdown.length;
    }
  };

  const splitter = createSplitter({
    onMarkdownDelta: (delta) => {
      markdown += delta;
      const newContent = markdown.slice(lastSectionAt);
      // 首次达到阈值立即推一次，让右侧面板尽快有内容，不用等 \n## 边界
      const isFirstEmit = lastSectionAt === 0 && markdown.length >= 80;
      const hasSectionBoundary = /\n## /.test(newContent);
      if ((isFirstEmit || hasSectionBoundary) && markdown.length > lastSectionAt + 40) {
        emitSection();
      }
    },
    onJsonDelta: (delta) => { jsonRaw += delta; }
  });

  const stripper = createThinkStripper(splitter);

  // ── 空闲 / 总超时控制 ────────────────────────────────────────────
  const controller = new AbortController();
  let idleTimer = null;
  let totalTimer = null;
  let abortReason = '';

  const triggerAbort = (reason) => {
    if (controller.signal.aborted) return;
    abortReason = reason;
    console.warn(`[skill:generatePlanDoc] ${reason}，主动中断流`);
    try { controller.abort(new Error(reason)); } catch {}
  };
  const resetIdle = () => {
    if (controller.signal.aborted) return;
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => triggerAbort('stream_idle_timeout'), STREAM_IDLE_MS);
  };
  totalTimer = setTimeout(() => triggerAbort('stream_total_timeout'), STREAM_TOTAL_MS);
  resetIdle();

  const onDelta = (delta) => {
    resetIdle();
    stripper(delta);
  };

  let streamFailed = null;
  try {
    if (typeof onStatus === 'function') onStatus({ status: 'requesting' });
    await callMinimaxStreamText(
      [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
      {
        runtimeKey: apiKeys.minimaxApiKey,
        minimaxModel: apiKeys.minimaxModel,
        maxTokens: 8000,
        temperature: 0.4,
        signal: controller.signal
      },
      onDelta
    );
    emitSection();
    console.log(`[skill:generatePlanDoc] 流式生成完成，markdown=${markdown.length}字 json=${jsonRaw.length}字`);
  } catch (error) {
    streamFailed = controller.signal.aborted
      ? new Error(abortReason || 'stream_aborted')
      : error;
    console.warn('[skill:generatePlanDoc] 流式生成失败:', streamFailed.message);
    // 中断后，若已经积累了可用的 markdown，先 emit 出去不浪费
    emitSection();
    if (typeof onStatus === 'function') onStatus({ status: 'fallback_start', error: streamFailed });
  } finally {
    clearTimeout(idleTimer);
    clearTimeout(totalTimer);
  }

  // 解析 JSON
  let plan = null;
  let degraded = false;
  let fallbackReason = '';

  const parsed = tryParseJson(jsonRaw);
  if (parsed) {
    try {
      plan = normalizeStrategizeResult(parsed);
    } catch (err) {
      console.warn('[skill:generatePlanDoc] JSON 结构校验失败:', err.message);
      fallbackReason = `JSON 结构校验失败：${err.message}`;
    }
  } else if (jsonRaw.trim()) {
    fallbackReason = 'JSON 解析失败';
  } else if (streamFailed) {
    fallbackReason = streamFailed.message || String(streamFailed);
  } else {
    fallbackReason = '模型未输出 <plan_json> 段';
  }

  if (!plan) {
    console.warn('[skill:generatePlanDoc] 启用稳态兜底方案:', fallbackReason);
    plan = { ...buildFallbackStrategy({ ...input, round }), degraded: true, fallbackReason };
    degraded = true;
  }

  // markdown 兜底
  if (!markdown.trim()) {
    markdown = buildFallbackMarkdown(plan, userInput, null);
    emitSection();
  }

  // ── 美化阶段 ─────────────────────────────────────────────────────
  // 仅在正常路径下运行：非降级、流未中断、原 markdown 非空
  // 失败/超时则保留原版，不影响主链路
  const beautifyInput = markdown;
  if (!degraded && !streamFailed && beautifyInput.trim().length > 0) {
    console.log('[skill:generatePlanDoc] 进入美化阶段...');
    if (typeof onStatus === 'function') {
      try { onStatus({ status: 'beautifying' }); } catch {}
    }
    // 美化期间 onSection 会被持续回调，前端预览会渐进被新版覆盖
    const beautified = await beautifyMarkdown(beautifyInput, apiKeys, { onSection });
    if (beautified) {
      markdown = beautified;
      console.log(`[skill:generatePlanDoc] 美化完成 (${beautifyInput.length} → ${beautified.length} 字)`);
    } else {
      console.warn('[skill:generatePlanDoc] 美化失败，保留原始 markdown');
      // 回推一次原版，确保前端预览恢复到未美化版本（以防中途被部分流覆盖）
      if (typeof onSection === 'function') {
        try { onSection(markdown); } catch {}
      }
    }
  }

  const html = markdownToHtml(markdown);
  console.log('[skill:generatePlanDoc] 完成', degraded ? '(降级)' : '');
  return { plan, markdown, html, degraded, fallbackReason: degraded ? fallbackReason : '' };
}

module.exports = { generatePlanDoc };
