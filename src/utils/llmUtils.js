// LLM 调用工具：重试、JSON 解析，供 Agent 和 Skill 共用
const { callMinimax, callDeepseekReasoner } = require('../services/llmClients');

const RETRY_LIMIT = 2;
const RETRY_DELAY_MS = 2000;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 从文本中提取 JSON
 * 兼容：<think>...</think> 推理标签、markdown 代码块、裸 JSON
 */
function extractJson(text) {
  text = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonStr = codeBlockMatch ? codeBlockMatch[1] : text;
  return JSON.parse(jsonStr.trim());
}

/**
 * 调用 LLM，带重试
 * @param {Array} messages
 * @param {{
 *   model?: 'minimax' | 'deepseek-reasoner',
 *   runtimeKey?: string,
 *   minimaxModel?: string,
 *   name?: string,
 *   maxTokens?: number,
 *   temperature?: number
 * }} options
 */
async function callLLM(messages, options = {}) {
  const { model = 'minimax', runtimeKey, minimaxModel, name = 'llm', ...rest } = options;

  let lastError;
  for (let attempt = 0; attempt <= RETRY_LIMIT; attempt++) {
    try {
      if (model === 'deepseek-reasoner') {
        return await callDeepseekReasoner(messages, { runtimeKey, ...rest });
      } else {
        return await callMinimax(messages, { runtimeKey, minimaxModel, ...rest });
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

/**
 * 调用 LLM 并强制解析 JSON 输出，带重试
 * JSON 解析失败时追加提示消息后重新请求
 */
async function callLLMJson(messages, options = {}) {
  const { name = 'llm', ...rest } = options;
  let msgs = messages;
  let lastError;

  for (let attempt = 0; attempt <= RETRY_LIMIT; attempt++) {
    try {
      const text = await callLLM(msgs, { name, ...rest });
      return extractJson(text);
    } catch (err) {
      lastError = err;
      if (attempt < RETRY_LIMIT) {
        console.warn(`[${name}] JSON 解析失败 (${attempt + 1}/${RETRY_LIMIT})，重新请求:`, err.message);
        // 解析失败时以用户追问的形式追加约束，避免出现非法的连续 assistant 消息。
        msgs = [
          ...msgs,
          { role: 'user', content: '上次输出无法解析为 JSON。请重新输出，并且只返回合法 JSON，不要包含任何额外文字或代码块。' }
        ];
      }
    }
  }
  throw new Error(`[${name}] JSON 解析失败（已重试 ${RETRY_LIMIT} 次）: ${lastError.message}`);
}

module.exports = { callLLM, callLLMJson, extractJson };
