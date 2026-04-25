// LLM 调用工具：重试、JSON 解析，供 Agent 和 Skill 共用
const fs = require('fs');
const path = require('path');
const { callMinimax, callDeepseekReasoner, callMinimaxStreamText } = require('../services/llmClients');
const { StructuredOutputValidationError } = require('./structuredOutput');

const RETRY_LIMIT = 2;
const RETRY_DELAY_MS = 2000;
const DEBUG_DIR = path.resolve(process.cwd(), 'data/llm-debug');

class LLMTimeoutError extends Error {
  constructor(message) {
    super(message);
    this.name = 'LLMTimeoutError';
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function withTimeout(promise, timeoutMs, label = 'llm', onTimeout = null) {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) return promise;
  let timer = null;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      if (typeof onTimeout === 'function') {
        try { onTimeout(); } catch {}
      }
      reject(new LLMTimeoutError(`[${label}] 请求超时（>${timeoutMs}ms）`));
    }, timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

function stripCodeFences(text = '') {
  const value = String(text || '').trim();
  const fenced = value.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return fenced ? fenced[1].trim() : value;
}

function findBalancedJsonSlice(text = '') {
  const value = String(text || '');
  const start = value.search(/[\[{]/);
  if (start === -1) return '';

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = start; i < value.length; i++) {
    const char = value[i];
    if (inString) {
      if (escape) {
        escape = false;
      } else if (char === '\\') {
        escape = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === '{' || char === '[') depth += 1;
    if (char === '}' || char === ']') {
      depth -= 1;
      if (depth === 0) return value.slice(start, i + 1).trim();
    }
  }

  return value.slice(start).trim();
}

function sanitizeJsonCandidate(text = '') {
  return String(text || '')
    .trim()
    .replace(/^\uFEFF/, '')
    .replace(/^[`]+|[`]+$/g, '')
    .replace(/,\s*([}\]])/g, '$1');
}

function mergeExtraOptions(baseExtra = {}, patchExtra = {}) {
  return { ...(baseExtra || {}), ...(patchExtra || {}) };
}

function summarizeError(error) {
  if (!error) return 'unknown error';
  if (error instanceof StructuredOutputValidationError) {
    return [error.message, ...(error.issues || [])].join('; ');
  }
  return error.message || String(error);
}

function notifyStatus(onStatus, status, payload = {}) {
  if (typeof onStatus !== 'function') return;
  try {
    onStatus({ status, ...payload });
  } catch {}
}

function writeDebugSnapshot(name, payload) {
  try {
    fs.mkdirSync(DEBUG_DIR, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${stamp}-${String(name || 'llm').replace(/[^a-z0-9_-]/gi, '_')}.json`;
    fs.writeFileSync(path.join(DEBUG_DIR, filename), `${JSON.stringify(payload, null, 2)}\n`);
  } catch (error) {
    console.warn(`[${name}] 写入调试快照失败:`, error.message);
  }
}

/**
 * 从文本中提取 JSON
 * 兼容：<think>...</think> 推理标签、markdown 代码块、裸 JSON
 */
function extractJson(text) {
  const cleaned = String(text || '').replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  const candidates = [
    cleaned,
    stripCodeFences(cleaned),
    findBalancedJsonSlice(stripCodeFences(cleaned)),
    sanitizeJsonCandidate(stripCodeFences(cleaned)),
    sanitizeJsonCandidate(findBalancedJsonSlice(stripCodeFences(cleaned)))
  ].filter(Boolean);

  let lastError = null;
  for (const candidate of [...new Set(candidates)]) {
    try {
      return JSON.parse(candidate);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error('无法解析 JSON');
}

function validateStructuredResult(result, validate) {
  if (!validate) return result;
  return validate(result);
}

/**
 * 调用 LLM，带重试
 *
 * options.streaming = true（仅 minimax）：用流式 API 累积全文本返回，
 * 适合 maxTokens 较大（>3000）的场景，彻底规避整体超时问题。
 */
async function callLLM(messages, options = {}) {
  const { model = 'minimax', runtimeKey, minimaxModel, name = 'llm', timeoutMs, streaming, ...rest } = options;

  // ── 流式累积模式（MiniMax 长文本，不需要整体超时）────────────────────────────
  if (streaming && model === 'minimax') {
    let lastError;
    for (let attempt = 0; attempt <= RETRY_LIMIT; attempt++) {
      try {
        let accumulated = '';
        await callMinimaxStreamText(
          messages,
          { runtimeKey, minimaxModel, maxTokens: rest.maxTokens, temperature: rest.temperature, extra: rest.extra },
          (chunk) => { accumulated += chunk; }
        );
        return accumulated;
      } catch (err) {
        lastError = err;
        if (attempt < RETRY_LIMIT) {
          console.warn(`[${name}] 流式调用失败 (${attempt + 1}/${RETRY_LIMIT})，${RETRY_DELAY_MS}ms 后重试:`, err.message);
          await sleep(RETRY_DELAY_MS);
        }
      }
    }
    throw new Error(`[${name}] LLM 流式调用失败（已重试 ${RETRY_LIMIT} 次）: ${lastError.message}`);
  }

  // ── 阻塞式调用（小输出 / DeepSeek）──────────────────────────────────────────
  let lastError;
  for (let attempt = 0; attempt <= RETRY_LIMIT; attempt++) {
    const controller = timeoutMs > 0 ? new AbortController() : null;
    const signal = controller?.signal;
    try {
      if (model === 'deepseek-reasoner') {
        return await withTimeout(
          callDeepseekReasoner(messages, { runtimeKey, signal, ...rest }),
          timeoutMs,
          name,
          () => controller?.abort()
        );
      } else {
        return await withTimeout(
          callMinimax(messages, { runtimeKey, minimaxModel, signal, ...rest }),
          timeoutMs,
          name,
          () => controller?.abort()
        );
      }
    } catch (err) {
      lastError = err;
      if (attempt < RETRY_LIMIT) {
        console.warn(`[${name}] 调用失败 (${attempt + 1}/${RETRY_LIMIT})，${RETRY_DELAY_MS}ms 后重试:`, err.message);
        await sleep(RETRY_DELAY_MS);
      }
    }
  }
  throw new Error(`[${name}] LLM 调用失败（已重试 ${RETRY_LIMIT} 次）: ${lastError.message}`);
}

async function repairJsonOutput(rawText, options = {}) {
  const {
    model = 'minimax',
    runtimeKey,
    minimaxModel,
    temperature = 0,
    maxTokens = 4096,
    timeoutMs,
    extra,
    name = 'llm',
    repairHint = ''
  } = options;

  const repairMessages = [
    {
      role: 'system',
      content: '你是 JSON 修复器。你的任务是把用户提供的内容修复成合法 JSON，只修格式，不改语义，不补充解释，不输出代码块。'
    },
    {
      role: 'user',
      content:
        `请把下面内容修复为合法 JSON。` +
        `${repairHint ? `\n\n结构要求：${repairHint}` : ''}` +
        `\n\n原始内容如下：\n${rawText}`
    }
  ];

  const text = await callLLM(repairMessages, {
    model,
    runtimeKey,
    minimaxModel,
    temperature,
    maxTokens: Math.min(maxTokens, 4096),
    timeoutMs,
    extra: mergeExtraOptions(extra, { response_format: { type: 'json_object' } }),
    name: `${name}:repair`
  });

  return extractJson(text);
}

/**
 * 调用 LLM 并强制解析 JSON 输出，带重试
 * JSON 解析失败时追加提示消息后重新请求
 */
async function callLLMJson(messages, options = {}) {
  const {
    name = 'llm',
    validate,
    repairHint = '',
    debugLabel = name,
    onStatus,
    fallback,
    ...rest
  } = options;
  let msgs = messages;
  let lastError;
  let lastRawText = '';

  for (let attempt = 0; attempt <= RETRY_LIMIT; attempt++) {
    try {
      notifyStatus(onStatus, 'requesting', { attempt: attempt + 1 });
      const text = await callLLM(msgs, {
        name,
        ...rest,
        extra: mergeExtraOptions(rest.extra, { response_format: { type: 'json_object' } })
      });
      lastRawText = String(text || '');
      notifyStatus(onStatus, 'received', { attempt: attempt + 1, rawText: lastRawText });
      const parsed = extractJson(lastRawText);
      notifyStatus(onStatus, 'validating', { attempt: attempt + 1 });
      return validateStructuredResult(parsed, validate);
    } catch (err) {
      lastError = err;
      notifyStatus(onStatus, 'parse_failed', {
        attempt: attempt + 1,
        error: summarizeError(err)
      });
      if (lastRawText) {
        try {
          notifyStatus(onStatus, 'repairing', { attempt: attempt + 1 });
          const repaired = await repairJsonOutput(lastRawText, { ...rest, name, repairHint });
          notifyStatus(onStatus, 'validating', { attempt: attempt + 1, repaired: true });
          return validateStructuredResult(repaired, validate);
        } catch (repairError) {
          lastError = repairError;
          notifyStatus(onStatus, 'repair_failed', {
            attempt: attempt + 1,
            error: summarizeError(repairError)
          });
          writeDebugSnapshot(`${debugLabel}-repair-failed`, {
            attempt: attempt + 1,
            error: summarizeError(repairError),
            rawText: lastRawText,
            repairHint
          });
        }
      }

      if (attempt < RETRY_LIMIT) {
        console.warn(`[${name}] JSON 解析失败 (${attempt + 1}/${RETRY_LIMIT})，重新请求:`, summarizeError(lastError));
        notifyStatus(onStatus, 'retrying', {
          attempt: attempt + 2,
          previousAttempt: attempt + 1,
          error: summarizeError(lastError)
        });
        msgs = [
          ...msgs,
          {
            role: 'user',
            content:
              '上次输出无法通过结构化校验。请重新输出，并且只返回合法 JSON，不要包含任何额外文字或代码块。' +
              `\n问题摘要：${summarizeError(lastError)}` +
              (repairHint ? `\n结构要求：${repairHint}` : '')
          }
        ];
        lastRawText = '';
      }
    }
  }
  if (typeof fallback === 'function') {
    notifyStatus(onStatus, 'fallback_start', { error: summarizeError(lastError) });
    try {
      return fallback({ rawText: lastRawText, error: lastError });
    } catch (fallbackError) {
      lastError = fallbackError;
      notifyStatus(onStatus, 'fallback_failed', { error: summarizeError(fallbackError) });
    }
  }
  writeDebugSnapshot(`${debugLabel}-final-failure`, {
    error: summarizeError(lastError),
    rawText: lastRawText,
    repairHint
  });
  throw new Error(`[${name}] JSON 解析失败（已重试 ${RETRY_LIMIT} 次）: ${summarizeError(lastError)}`);
}

module.exports = { callLLM, callLLMJson, extractJson, LLMTimeoutError };
