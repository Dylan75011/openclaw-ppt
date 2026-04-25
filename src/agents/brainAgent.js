// Brain Agent：ReAct 循环（Reason → Act → Observe → Reason...）
const { callMinimaxWithToolsStream } = require('../services/llmClients');
const { TOOL_DEFINITIONS, executeTool, getToolDisplay } = require('../services/toolRegistry');
const { validateAskUserArgs } = require('../services/tools/askUserValidator');
const { analyzeAgentImages } = require('../services/visionMcp');
const { buildBrainSystemPrompt } = require('../prompts/brain');
const { classifyTaskIntentWithLLM } = require('../services/intentClassifier');
const {
  createExecutionPlan,
  buildExecutionPlanContextBlock,
  createTaskSpec,
  buildTaskSpecContextBlock
} = require('../services/taskPlanner');
const { buildRouteToolSequence } = require('../services/routeExecutor');
const wm = require('../services/workspaceManager');
const { TimeoutError, AbortError } = require('../utils/abortx');

const MAX_TURNS = 15;

// 每个工具的"前台等待预算"——超过就转后台，把控制权立刻还给模型。
// 不是工具本身的截止时间：底层调用可能继续跑完，我们只是不再阻塞主循环。
const TOOL_BUDGET_MS = {
  build_ppt:           120_000,
  generate_image:       60_000,
  search_images:        25_000,
  web_fetch:            25_000,
  web_search:           20_000,
  browser_search:       30_000,
  browser_read_page:    25_000,
  browser_read_notes:   30_000,
  analyze_note_images:  30_000,
  run_strategy:         90_000,
  review_strategy:      60_000,
  challenge_brief:      30_000,
  propose_concept:      30_000,
  approve_concept:      15_000,
  review_uploaded_images: 30_000
};
const TOOL_BUDGET_DEFAULT_MS = 30_000;
// LLM 流式：超过 N 秒没新 chunk 就视为卡死并 abort
const LLM_STREAM_IDLE_MS = 30_000;
// 用户停止信号的轮询间隔（毫秒）
const STOP_POLL_INTERVAL_MS = 500;

const {
  CONTEXT_TOKEN_WARN,
  estimateTokens,
  truncateToolResult,
  isCompactableTool,
  compressOldMessages,
  extractKeyState,
} = require('../services/contextManager');

/**
 * 流式输出中实时过滤 <think>...</think> 块
 * 保留 7 个字符的缓冲区以处理跨 chunk 的标签边界
 */
class ThinkFilter {
  constructor() {
    this.buf = '';
    this.inThink = false;
  }

  push(delta) {
    this.buf += delta;
    let out = '';

    while (this.buf.length > 0) {
      if (this.inThink) {
        const end = this.buf.indexOf('</think>');
        if (end !== -1) {
          this.buf = this.buf.slice(end + 8);
          this.inThink = false;
        } else {
          // 仍在 think 块内，保留末尾以防 </think> 被截断
          if (this.buf.length > 50) this.buf = this.buf.slice(-9);
          break;
        }
      } else {
        const start = this.buf.indexOf('<think>');
        if (start !== -1) {
          out += this.buf.slice(0, start);
          this.buf = this.buf.slice(start + 7);
          this.inThink = true;
        } else {
          // 无 think 块 — 安全输出，末尾保留 6 字符防截断
          const safe = this.buf.length > 7 ? this.buf.slice(0, -7) : '';
          out += safe;
          this.buf = this.buf.slice(safe.length);
          break;
        }
      }
    }
    return out;
  }

  flush() {
    // 流结束，输出剩余缓冲
    const remaining = this.buf;
    const wasInThink = this.inThink;
    this.buf = '';
    this.inThink = false;
    // 若仍在 think 块内（标签未关闭），buffer 内容是思考过程，直接丢弃
    if (wasInThink) return '';
    return remaining.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
  }
}

function isStopRequested(session) {
  return !!session?.stopRequested;
}

function isInternalThinking(text) {
  if (!text || typeof text !== 'string') return false;
  
  const trimmedText = text.trim();
  
  if (trimmedText.startsWith('<think>') || trimmedText.includes('</think>')) {
    return true;
  }
  
  const internalPatterns = [
    /^(让我想想|我先思考|我思考一下|我来分析一下)/,
    /^步骤[是为：:]/,
    /^计划如下/,
    /^首先[，,]/,
    /^(根据|按照).*规则/,
    /^(用户只提供了|已知条件是)/
  ];
  
  if (internalPatterns.some(pattern => pattern.test(trimmedText))) {
    return true;
  }
  
  return false;
}

function stripThinkingBlocks(text) {
  const startTag = '<think>';
  const endTag = '</think>';
  let result = '';
  let current = text;
  while (true) {
    const startIdx = current.indexOf(startTag);
    if (startIdx === -1) {
      result += current;
      break;
    }
    result += current.slice(0, startIdx);
    const endIdx = current.indexOf(endTag, startIdx + startTag.length);
    if (endIdx === -1) {
      break;
    }
    current = current.slice(endIdx + endTag.length);
  }
  return result.trim();
}

function buildMessages(session) {
  const spaceContextWithLastDoc = session.spaceContext
    ? {
        ...session.spaceContext,
        lastSavedDocId: session.lastSavedDocId || null,
        lastSavedDocName: session.lastSavedDocName || null
      }
    : null;

  const compactSummary = extractKeyState(session);

  const systemPrompt = buildBrainSystemPrompt(
    spaceContextWithLastDoc,
    session.executionPlan || null,
    session.taskSpec || null,
    session.routeToolSequence || [],
    compactSummary,
    Array.isArray(session.askedQuestions) ? session.askedQuestions : []
  );

  const toolNameMap = buildToolNameMap(session.messages);

  const trimmed = session.messages.map((message, idx) => {
    const next = {
      role: message.role,
      content: message.content
    };
    // 清洗 tool_calls：确保 arguments 始终是合法 JSON 字符串，
    // 防止 MiniMax 截断或生成非法 JSON 后被 API 以 400 拒绝
    if (message.tool_calls) {
      next.tool_calls = message.tool_calls.map(tc => {
        const raw = tc.function?.arguments ?? '{}';
        let safeArgs = raw;
        try { JSON.parse(raw); } catch { safeArgs = '{}'; }
        return { ...tc, function: { ...tc.function, arguments: safeArgs } };
      });
    }
    if (message.tool_call_id) next.tool_call_id = message.tool_call_id;

    if (message.role === 'tool' && typeof message.content === 'string') {
      const toolName = toolNameMap[idx] || 'unknown';
      next.content = truncateToolResult(toolName, message.content);
    }
    return next;
  });

  const totalTokens = estimateTokens(systemPrompt)
    + trimmed.reduce((sum, m) => sum + estimateTokens(JSON.stringify(m)), 0);

  if (totalTokens > CONTEXT_TOKEN_WARN && trimmed.length > 6) {
    let splitIndex = trimmed.length - 6;

    const firstRecentMsg = trimmed[splitIndex];
    if (firstRecentMsg.role === 'tool') {
      for (let i = splitIndex - 1; i >= 0; i--) {
        const msg = trimmed[i];
        if (msg.role === 'assistant' && msg.tool_calls) {
          if (msg.tool_calls.some(tc => tc.id === firstRecentMsg.tool_call_id)) {
            splitIndex = i;
            break;
          }
        }
      }
    }

    const recent = trimmed.slice(splitIndex);
    const older  = trimmed.slice(0, splitIndex);

    const compressed = compressOldMessages(older);

    return [{ role: 'system', content: systemPrompt }, ...compressed, ...recent];
  }

  return [{ role: 'system', content: systemPrompt }, ...trimmed];
}

function buildToolNameMap(messages) {
  const map = {};
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (msg.role === 'assistant' && Array.isArray(msg.tool_calls)) {
      for (const tc of msg.tool_calls) {
        const fnName = tc.function?.name || tc.name;
        for (let j = i + 1; j < messages.length; j++) {
          if (messages[j].role === 'tool' && messages[j].tool_call_id === tc.id) {
            map[j] = fnName;
            break;
          }
        }
      }
    }
  }
  return map;
}

function canCallBuildPpt(session) {
  return !!session?.bestPlan && !!session?.userInput;
}

function toPublicAttachments(attachments = []) {
  return attachments.map((item) => ({
    id: item.id,
    name: item.name,
    mimeType: item.mimeType,
    size: item.size,
    url: item.url,
    analysis: item.analysis || '',
    error: item.error || ''
  }));
}

function appendSessionAttachments(session, attachments = []) {
  if (!attachments.length) return;
  const existing = Array.isArray(session.attachments) ? session.attachments : [];
  const next = [...existing];
  attachments.forEach((item) => {
    if (!next.find((entry) => entry.id === item.id)) {
      next.push({ ...item });
    }
  });
  session.attachments = next;
}

function buildImageContextBlock(attachments = []) {
  const usable = attachments.filter((item) => item.analysis || item.error);
  if (!usable.length) return '';

  return [
    '以下是用户本轮上传图片，已通过 MiniMax MCP understand_image 分析，可视为用户提供的视觉上下文：',
    ...usable.map((item, index) => {
      if (item.analysis) {
        return `[图片${index + 1}：${item.name || '未命名图片'}]\n${item.analysis}`;
      }
      return `[图片${index + 1}：${item.name || '未命名图片'}]\n分析失败：${item.error}`;
    })
  ].join('\n\n');
}

// 单份文档注入的最大字符数（约 2000 token）
const DOC_TEXT_MAX_CHARS = 8000;

function buildDocumentContextBlock(documents = []) {
  if (!documents || !documents.length) return '';

  const parts = documents.map((doc, index) => {
    if (doc.error) {
      return `[文档${index + 1}：${doc.name}]\n解析失败：${doc.error}`;
    }
    const pageInfo = doc.pages ? `，共 ${doc.pages} 页` : '';
    const truncated = doc.text.length > DOC_TEXT_MAX_CHARS;
    const text = truncated ? doc.text.slice(0, DOC_TEXT_MAX_CHARS) + '\n...[内容已截断，仅展示前段]' : doc.text;
    return `[文档${index + 1}：${doc.name}${pageInfo}]\n${text}`;
  });

  return [
    '以下是用户上传的文档内容，请结合这些文档完成任务：',
    ...parts
  ].join('\n\n---\n\n');
}

function buildWorkspaceDocContextBlock(workspaceDocs = []) {
  if (!workspaceDocs || !workspaceDocs.length) return '';
  const parts = workspaceDocs.map((doc, index) =>
    `[空间文档${index + 1}：${doc.name}（${doc.docType === 'ppt' ? 'PPT' : '文档'}）]\n${doc.text || '（内容为空）'}`
  );
  return [
    '以下是用户从工作空间中引用的文档，作为本次任务的背景上下文：',
    ...parts
  ].join('\n\n---\n\n');
}

async function runAutoRoutePrelude(session, onEvent, context = {}) {
  const routeToolSequence = buildRouteToolSequence(session.taskSpec, {
    planItems: session.planItems,
    workspaceDocs: context.workspaceDocs || []
  });
  session.routeToolSequence = routeToolSequence;

  onEvent('route_update', {
    taskMode: session.taskSpec?.taskMode || '',
    primaryRoute: session.taskSpec?.primaryRoute || '',
    fallbackRoutes: session.taskSpec?.fallbackRoutes || [],
    toolSequence: routeToolSequence.map((step) => ({
      toolName: step.toolName,
      autoExecutable: step.autoExecutable,
      reason: step.reason || ''
    }))
  });

  const autoSteps = routeToolSequence.filter((step) => step.autoExecutable);
  if (!autoSteps.length) return;

  const assistantToolCalls = autoSteps.map((step, index) => ({
    id: `route_auto_${Date.now()}_${index}`,
    type: 'function',
    function: {
      name: step.toolName,
      arguments: JSON.stringify(step.args || {})
    }
  }));

  session.messages.push({
    role: 'assistant',
    content: null,
    tool_calls: assistantToolCalls
  });

  for (let index = 0; index < autoSteps.length; index += 1) {
    const step = autoSteps[index];
    const toolCall = assistantToolCalls[index];
    onEvent('tool_call', {
      tool: step.toolName,
      display: getToolDisplay(step.toolName, step.args || {}),
      toolCallId: toolCall.id,
      auto: true,
      reason: step.reason || ''
    });
    const toolResult = await executeTool(step.toolName, step.args || {}, session, onEvent);
    onEvent('tool_result', buildToolResultEvent(step.toolName, toolResult));
    session.messages.push({
      role: 'tool',
      tool_call_id: toolCall.id,
      content: JSON.stringify(toolResult)
    });
  }
}


function toIntentMeta(type = 'chat') {
  const map = {
    chat: {
      label: '普通对话',
      hint: ''
    },
    image_search: {
      label: '找图配图',
      hint: '用户当前主要意图是”找图/配图/图片参考”。优先调用 search_images，除非用户明确要案例、数据或行业信息，否则不要改走 web_search。'
    },
    image_generate: {
      label: 'AI生图',
      hint: '用户想用 AI 生成全新图片，或修改/替换已有图片。调用 generate_image，不要用 search_images 代替。'
    },
    research: {
      label: '信息搜索',
      hint: '用户当前主要意图是“搜索信息/案例/关键事实”。优先调用 web_search；只有值得深读的页面再调用 web_fetch。'
    },
    doc_edit: {
      label: '文档修改',
      hint: '用户当前主要意图是”基于现有文档修改/续写/润色”。优先读取并更新文档，不要默认重走完整 research -> strategy 流程。'
    },
    strategy: {
      label: '方案策划',
      hint: '用户当前主要意图是“做策划方案”。信息足够时直接推进 update_brief -> write_todos -> web_search -> run_strategy。'
    },
    ppt: {
      label: 'PPT生成',
      hint: '用户当前主要意图是“生成或修改 PPT”。如果还没有方案，先确认依据；如果已有方案，再判断是否进入 build_ppt。'
    }
  };

  return map[type] || map.chat;
}

// 工具直达模式（前端"+"按钮锁定的工具）→ 强制意图
// 跳过 LLM 分类，直接告诉 brain 用指定工具
const FORCE_TOOL_INTENT_MAP = {
  generate_image: {
    type: 'image_generate',
    label: 'AI生图',
    hint: '【用户已手动选择"生图"工具】请直接调用 generate_image 生成图片。不要走 web_search / search_images / 策划 / PPT 等流程。如果用户描述不够具体，可以基于已知信息合理发挥；只有在描述完全无法推断主题时才用 ask_user 追问一句。'
  },
  build_ppt: {
    type: 'ppt',
    label: 'PPT',
    hint: '【用户已手动选择"PPT"工具】请根据当前会话状态智能决定：如果已有完整策划方案（session.bestPlan），直接调用 build_ppt 生成/重生成；如果没有方案但已有足够上下文（上传的文档/空间引用/历史消息），先最小化地走 update_brief → run_strategy 拿到方案，再立即 build_ppt，不要再反复追问研究方向。跳过意图澄清。'
  },
  web_search: {
    type: 'research',
    label: '网页搜索',
    hint: '【用户已手动选择"网页搜索"工具】请直接调用 web_search 搜资料。不要改走 search_images / 策划 / PPT。如果需要深读再调 web_fetch，搜完用 3-5 句总结关键发现即可。'
  },
  propose_concept: {
    type: 'strategy',
    label: '创意方向',
    hint: '【用户已手动选择"创意方向"工具】请直接调用 propose_concept 给出 3 个差异化创意方向。不要走完整策划流程，不要生成 PPT。每个方向一句话核心概念 + 一句执行要点即可。'
  }
};

function buildForcedIntent(forceTool) {
  const meta = FORCE_TOOL_INTENT_MAP[forceTool];
  if (!meta) return null;
  return {
    type: meta.type,
    label: meta.label,
    confidence: 1,
    hint: meta.hint,
    reason: `force_tool:${forceTool}`,
    needsClarification: false,
    suggestedType: '',
    forcedTool: forceTool
  };
}

const CLARIFY_HINT = '当前用户意图不够明确。先用一句话和用户确认想要的产物（找图 / 查资料 / 改文档 / 出方案 / 出 PPT），再决定后续动作。在确认前不要调用任何任务工具，也不要默认走 research / strategy / doc_edit / ppt 流程。';

function buildClarifyIntent({ confidence = 0, reason = '', suggestedType = '' } = {}) {
  return {
    type: 'chat',
    label: '普通对话',
    confidence,
    hint: CLARIFY_HINT,
    reason,
    needsClarification: true,
    suggestedType: suggestedType || ''
  };
}

// 明显的闲聊输入：无附件/文档，文本短且不含任务动词，跳过 LLM 分类节省 1-2s
const CHAT_ACTION_VERBS = /[问查搜找生成改写出做创建制作分析研究优化调整生产修改]/u;
const CHAT_SHORTCIRCUIT_MAX_LEN = 30;

function isObviousChatMessage(text, documents, workspaceDocs, attachments) {
  if (documents.length || workspaceDocs.length || attachments.length) return false;
  if (text.length > CHAT_SHORTCIRCUIT_MAX_LEN) return false;
  if (CHAT_ACTION_VERBS.test(text)) return false;
  return true;
}

async function detectTaskIntent(text = '', {
  documents = [],
  workspaceDocs = [],
  attachments = [],
  session = null,
  intentClassifier = null
} = {}) {
  const normalizedText = String(text || '').trim();

  // 完全没有输入：直接落到普通对话，不需要分类
  if (!normalizedText && !documents.length && !workspaceDocs.length && !attachments.length) {
    return {
      type: 'chat',
      label: '普通对话',
      confidence: 0.2,
      hint: '',
      reason: '',
      needsClarification: false,
      suggestedType: ''
    };
  }

  // 明显闲聊（短文本、无附件、无任务动词）：跳过 LLM 分类，直接返回 chat
  if (isObviousChatMessage(normalizedText, documents, workspaceDocs, attachments)) {
    return {
      type: 'chat',
      label: '普通对话',
      confidence: 0.85,
      hint: '',
      reason: 'heuristic_short_circuit',
      needsClarification: false,
      suggestedType: ''
    };
  }

  const classifier = intentClassifier || classifyTaskIntentWithLLM;
  if (typeof classifier !== 'function') {
    return buildClarifyIntent({ reason: 'classifier_unavailable' });
  }

  let classified;
  try {
    classified = await classifier(normalizedText, { documents, workspaceDocs, attachments, session });
  } catch (error) {
    return buildClarifyIntent({ reason: error?.message || 'classifier_error' });
  }

  const conf = Number(classified?.confidence) || 0;
  const meta = toIntentMeta(classified?.type);

  // 低置信或模型自己说要澄清 → 不要硬猜，转为澄清对话
  const threshold = Number.parseFloat(process.env.INTENT_CONFIDENCE_THRESHOLD);
  const confThreshold = Number.isFinite(threshold) && threshold >= 0 && threshold <= 1 ? threshold : 0.5;
  if (conf < confThreshold || classified?.needsClarification) {
    return buildClarifyIntent({
      confidence: conf,
      reason: classified?.reason || '',
      suggestedType: classified?.type || ''
    });
  }

  return {
    type: classified.type,
    label: meta.label,
    confidence: conf,
    hint: meta.hint || '',
    reason: classified.reason || '',
    needsClarification: false,
    suggestedType: ''
  };
}

async function prepareUserInputMessage(text, attachments = [], documents = [], session, onEvent, workspaceDocs = [], forceTool = '') {
  const normalizedText = String(text || '').trim();
  const parts = [];
  // 前端"+"按钮锁定的工具直达模式：跳过 LLM 意图分类，直接用强制意图
  const forcedIntent = forceTool ? buildForcedIntent(forceTool) : null;
  const detectedIntent = forcedIntent || await detectTaskIntent(normalizedText, { documents, workspaceDocs, attachments, session });
  const executionPlan = createExecutionPlan({
    text: normalizedText,
    intent: detectedIntent,
    session,
    documents,
    workspaceDocs,
    attachments
  });
  const taskSpec = createTaskSpec(executionPlan);
  const routeToolSequence = buildRouteToolSequence(taskSpec, {
    planItems: executionPlan?.planItems || [],
    workspaceDocs
  });

  session.taskIntent = detectedIntent;
  session.executionPlan = executionPlan;
  session.taskSpec = taskSpec;
  session.routeToolSequence = routeToolSequence;
  if (Array.isArray(executionPlan?.planItems)) {
    session.planItems = executionPlan.planItems;
  }
  onEvent('task_intent', {
    taskIntent: detectedIntent
  });
  onEvent('plan_update', {
    items: Array.isArray(executionPlan?.planItems) ? executionPlan.planItems : [],
    source: 'task_planner',
    mode: executionPlan?.mode || '',
    targetType: executionPlan?.targetType || ''
  });
  onEvent('execution_plan', { plan: executionPlan });
  onEvent('task_spec', { taskSpec });
  onEvent('route_update', {
    taskMode: taskSpec?.taskMode || '',
    primaryRoute: taskSpec?.primaryRoute || '',
    fallbackRoutes: taskSpec?.fallbackRoutes || [],
    toolSequence: routeToolSequence.map((step) => ({
      toolName: step.toolName,
      autoExecutable: step.autoExecutable,
      reason: step.reason || ''
    }))
  });

  if (detectedIntent?.hint) {
    parts.push(`【任务意图提示】${detectedIntent.hint}`);
  }
  const executionPlanBlock = buildExecutionPlanContextBlock(executionPlan);
  if (executionPlanBlock) {
    parts.push(executionPlanBlock);
  }
  const taskSpecBlock = buildTaskSpecContextBlock(taskSpec);
  if (taskSpecBlock) {
    parts.push(taskSpecBlock);
  }

  if (attachments.length) {
    onEvent('text', { text: '我先看一下你发来的图片内容。' });
    const analyzedAttachments = await analyzeAgentImages(attachments, {
      minimaxApiKey: session.apiKeys.minimaxApiKey,
      userText: normalizedText
    });
    const imageContext = buildImageContextBlock(analyzedAttachments);
    if (normalizedText) parts.push(normalizedText);
    if (imageContext) parts.push(imageContext);

    const docContext = buildDocumentContextBlock(documents);
    if (docContext) parts.push(docContext);

    const wsContext = buildWorkspaceDocContextBlock(workspaceDocs);
    if (wsContext) parts.push(wsContext);

    return {
      content: parts.join('\n\n') || '用户上传了图片，请结合图片内容理解需求并作答。',
      attachments: toPublicAttachments(analyzedAttachments)
    };
  }

  if (normalizedText) parts.push(normalizedText);

  if (documents.length) {
    parts.push('用户本轮上传了文档。若用户意图是基于这份文档继续完善方案或直接生成 PPT，请优先把文档内容视为当前任务依据。');
    const docContext = buildDocumentContextBlock(documents);
    if (docContext) parts.push(docContext);
  }

  if (workspaceDocs.length) {
    const wsContext = buildWorkspaceDocContextBlock(workspaceDocs);
    if (wsContext) parts.push(wsContext);
  }

  const hasContent = normalizedText || documents.length || workspaceDocs.length;
  return {
    content: parts.join('\n\n') || (hasContent ? '用户引用了文档，请结合文档内容理解需求并作答。' : ''),
    attachments: []
  };
}

/**
 * 收到用户新消息，启动/继续 Brain 循环
 */
async function run(session, userMessage, onEvent, options = {}) {
  // 首次启动时加载空间上下文，注入文档列表
  if (session.spaceId && !session.spaceContext) {
    try {
      session.spaceContext = wm.getSpaceContext(session.spaceId);
    } catch (e) {
      console.warn('[BrainAgent] 获取空间上下文失败:', e.message);
    }
  }

  // 记下本轮是否是 "+ 工具直达" 模式（pill 在前端可持续亮，每轮发送都会带 forceTool 过来）
  session.forceTool = options.forceTool || '';
  const prepared = await prepareUserInputMessage(userMessage, options.attachments || [], options.documents || [], session, onEvent, options.workspaceDocs || [], session.forceTool);
  appendSessionAttachments(session, prepared.attachments);
  session.messages.push({
    role: 'user',
    content: prepared.content,
    ...(prepared.attachments.length ? { attachments: prepared.attachments } : {})
  });
  session.status = 'running';
  session.stopRequested = false;
  session.doneEmitted = false;
  await runAutoRoutePrelude(session, onEvent, options);
  await runLoop(session, onEvent);
}

/**
 * 用户回答了 ask_user 的问题，恢复循环
 */
async function resume(session, userReply, onEvent, options = {}) {
  // resume 时复用 session 上已锁定的 forceTool（clarification 回答不应丢失工具模式）
  const forceTool = options.forceTool || session.forceTool || '';
  session.forceTool = forceTool;
  const prepared = await prepareUserInputMessage(userReply, options.attachments || [], options.documents || [], session, onEvent, options.workspaceDocs || [], forceTool);
  appendSessionAttachments(session, prepared.attachments);
  // 把用户回答作为 tool result 补回去
  if (session.pendingToolCallId) {
    session.messages.push({
      role: 'tool',
      tool_call_id: session.pendingToolCallId,
      content: JSON.stringify({
        answer: prepared.content,
        attachments: prepared.attachments
      })
    });
    session.pendingToolCallId = null;
  }

  // 把用户的回答补到 askedQuestions 最后一条 pending 记录上
  if (Array.isArray(session.askedQuestions) && session.askedQuestions.length) {
    const lastAsk = session.askedQuestions[session.askedQuestions.length - 1];
    if (lastAsk && lastAsk.answer == null) {
      lastAsk.answer = String(prepared.content || '').trim().slice(0, 200);
      lastAsk.answeredAt = new Date().toISOString();
    }
  }
  session.status = 'running';
  session.stopRequested = false;
  session.doneEmitted = false;
  await runAutoRoutePrelude(session, onEvent, options);
  await runLoop(session, onEvent);
}

/**
 * ReAct 主循环
 */
async function runLoop(session, onEvent) {
  const loopTracker = {}; // "toolName:argsHash" → 调用次数

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    if (isStopRequested(session)) {
      session.status = 'idle';
      return;
    }

    // 推送 thinking 事件
    onEvent('thinking', {});

    let choice;
    // 给本轮 LLM 流式调用一个独立 AbortController，挂到 session 上让 stop endpoint 能直接打断
    const llmAc = new AbortController();
    session._currentLlmAbort = llmAc;
    let lastChunkAt = Date.now();
    const llmWatchdog = setInterval(() => {
      if (isStopRequested(session)) { llmAc.abort('user_stop'); return; }
      if (Date.now() - lastChunkAt > LLM_STREAM_IDLE_MS) {
        llmAc.abort(new TimeoutError('llm_stream_idle', LLM_STREAM_IDLE_MS));
      }
    }, STOP_POLL_INTERVAL_MS);
    if (typeof llmWatchdog.unref === 'function') llmWatchdog.unref();

    try {
      const filter = new ThinkFilter();
      let hasStreamedText = false;

      choice = await callMinimaxWithToolsStream(
        buildMessages(session),
        TOOL_DEFINITIONS,
        {
          runtimeKey: session.apiKeys.minimaxApiKey,
          minimaxModel: session.apiKeys.minimaxModel,
          maxTokens: 4096,
          temperature: 0.7,
          signal: llmAc.signal
        },
        (chunk) => {
          lastChunkAt = Date.now();
          if (chunk.type !== 'text_delta') return;
          const clean = filter.push(chunk.delta);
          if (clean) {
            if (!hasStreamedText) {
              hasStreamedText = true;
            }
            onEvent('text_delta', { delta: clean });
          }
        }
      );

      // 刷出过滤器中剩余缓冲
      const tail = filter.flush();
      if (tail) onEvent('text_delta', { delta: tail });

      // 通知前端本轮文字流结束
      if (hasStreamedText || tail) onEvent('text_end', {});

    } catch (err) {
      console.error('[BrainAgent] LLM 调用失败:', err.message);
      if (isStopRequested(session) || llmAc.signal.aborted && llmAc.signal.reason === 'user_stop') {
        session.status = 'idle';
        return;
      }
      // 空闲超时：给模型一个更友好的错误 + 让外层 catch 走"普通错误"分支
      if (err instanceof TimeoutError || err?.code === 'TIMEOUT') {
        err.message = `LLM 流响应超时（${LLM_STREAM_IDLE_MS / 1000}s 无新内容）`;
      }

      // ── 400 invalid function arguments：清理历史中的坏 tool_call 后重试一次 ──
      const is400InvalidArgs = /400.*invalid.*function|invalid.*arguments.*json|2013/i.test(err.message);
      if (is400InvalidArgs && turn === 0) {
        console.warn('[BrainAgent] 检测到 tool_call arguments 非法，清理历史后重试...');
        // 移除最近一条含 tool_calls 的 assistant 消息及其对应的 tool 回复
        const msgs = session.messages;
        let lastAssistIdx = -1;
        for (let i = msgs.length - 1; i >= 0; i--) {
          if (msgs[i].role === 'assistant' && Array.isArray(msgs[i].tool_calls)) {
            lastAssistIdx = i;
            break;
          }
        }
        if (lastAssistIdx >= 0) {
          const badIds = new Set(msgs[lastAssistIdx].tool_calls.map(tc => tc.id));
          session.messages = msgs.filter((m, i) => {
            if (i === lastAssistIdx) return false;
            if (m.role === 'tool' && badIds.has(m.tool_call_id)) return false;
            return true;
          });
          console.warn(`[BrainAgent] 已移除 turn ${lastAssistIdx} 的 tool_calls，继续重试`);
          continue; // 重新进入本轮循环
        }
      }

      onEvent('error', { message: `AI 调用失败：${err.message}` });
      session.status = 'failed';
      return;
    } finally {
      clearInterval(llmWatchdog);
      if (session._currentLlmAbort === llmAc) session._currentLlmAbort = null;
    }

    if (isStopRequested(session)) {
      session.status = 'idle';
      return;
    }

    const { message } = choice;

    // 存储 assistant 消息（含 tool_calls 或纯文本）
    session.messages.push({
      role: 'assistant',
      content: message.content || null,
      ...(message.tool_calls ? { tool_calls: message.tool_calls } : {})
    });

    // 没有工具调用 → Brain 决定自然结束本轮
    if (!message.tool_calls || message.tool_calls.length === 0) {
      session.status = 'idle';
      break;
    }

    // 处理工具调用
    for (const toolCall of message.tool_calls) {
      if (isStopRequested(session)) {
        session.status = 'idle';
        return;
      }

      let args = {};
      try {
        args = JSON.parse(toolCall.function.arguments || '{}');
      } catch {
        args = {};
      }
      const toolName = toolCall.function.name;

      // ── 循环检测 ──────────────────────────────────────────────
      const sig = `${toolName}:${stableStringify(args)}`;
      loopTracker[sig] = (loopTracker[sig] || 0) + 1;

      if (loopTracker[sig] === 3) {
        // 注入警告，让 Brain 换策略
        session.messages.push({
          role: 'user',
          content: '注意：你刚才重复调用了同一个工具。请根据已有信息直接推进，不要继续重复搜索。'
        });
      }
      if (loopTracker[sig] >= 5) {
        onEvent('text', { text: '检测到重复操作，我先基于当前信息推进。' });
        session.status = 'idle';
        return;
      }

      // ── ask_user：特殊处理，暂停循环 ──────────────────────────
      if (toolName === 'ask_user') {
        // 质量体检：拦住浅问（缺 description、只有 1 个 option、suggestion 没带 options 等）
        const validation = validateAskUserArgs(args);
        if (!validation.valid) {
          console.warn(`[BrainAgent] ask_user 调用被拒：${validation.error}`);
          onEvent('tool_call', { tool: toolName, display: getToolDisplay(toolName, args), toolCallId: toolCall.id });
          const toolResult = { success: false, error: validation.error, guidance: validation.guidance };
          onEvent('tool_result', buildToolResultEvent(toolName, toolResult));
          session.messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify(toolResult)
          });
          session.messages.push({
            role: 'user',
            content: `系统提示：你上一次的 ask_user 调用不合格（${validation.error}）。${validation.guidance}\n请重新构造 ask_user 调用，不要换成普通文本发问。`
          });
          continue;
        }

        session.pendingToolCallId = toolCall.id;
        session.status = 'waiting_for_user';

        // 记录一笔"已问但未答"的追问到 session，防止跨轮鬼打墙
        if (!Array.isArray(session.askedQuestions)) session.askedQuestions = [];
        const _trim = (x) => String(x || '').trim();
        session.askedQuestions.push({
          header: _trim(args.header),
          question: _trim(args.question).slice(0, 160),
          type: _trim(args.type) || 'missing_info',
          optionLabels: (Array.isArray(args.options) ? args.options : [])
            .map(o => _trim(o && o.label))
            .filter(Boolean),
          askedAtTurn: turn,
          answer: null
        });
        if (session.askedQuestions.length > 6) {
          session.askedQuestions = session.askedQuestions.slice(-6);
        }

        onEvent('clarification', {
          header: args.header || '',
          question: args.question || '请提供更多信息',
          type: args.type || 'missing_info',
          options: Array.isArray(args.options) ? args.options : []
        });
        return; // 暂停，等待 resume() 被调用
      }

      // ── build_ppt：硬护栏，必须先有策划方案 ─────────────────────
      if (toolName === 'build_ppt' && !canCallBuildPpt(session)) {
        const toolResult = {
          success: false,
          error: '还没有策划方案，请先调用 run_strategy'
        };
        onEvent('tool_call', { tool: toolName, display: getToolDisplay(toolName, args), toolCallId: toolCall.id });
        onEvent('tool_result', buildToolResultEvent(toolName, toolResult));
        session.messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify(toolResult)
        });
        session.messages.push({
          role: 'user',
          content: '系统提示：build_ppt 前置条件未满足。你必须先调用 run_strategy，拿到完整策划方案和 doc_ready 之后，才能生成 PPT。不要再次提前调用 build_ppt。'
        });
        continue;
      }

      // ── 普通工具调用 ──────────────────────────────────────────
      const display = getToolDisplay(toolName, args);
      onEvent('tool_call', { tool: toolName, display, toolCallId: toolCall.id });

      // 给本次工具调用一个独立 AbortController，挂到 session 上让 stop endpoint 能直接打断。
      // 同时启 watchdog 周期性检查 stopRequested —— 不依赖底层工具自己看 signal。
      const toolAc = new AbortController();
      session._currentToolAbort = toolAc;
      const toolWatchdog = setInterval(() => {
        if (isStopRequested(session)) toolAc.abort('user_stop');
      }, STOP_POLL_INTERVAL_MS);
      if (typeof toolWatchdog.unref === 'function') toolWatchdog.unref();

      const budget = TOOL_BUDGET_MS[toolName] || TOOL_BUDGET_DEFAULT_MS;
      let toolResult;
      try {
        // race(real, timeout, abort) —— 任意一个赢都立刻把控制权交还给主循环。
        // 底层 executeTool 不一定真的停下（它没传 signal），但我们不再阻塞 LLM 的下一轮。
        toolResult = await Promise.race([
          executeTool(toolName, args, session, onEvent),
          new Promise((_, reject) => {
            const t = setTimeout(() => reject(new TimeoutError(`tool:${toolName}`, budget)), budget);
            if (typeof t.unref === 'function') t.unref();
          }),
          new Promise((_, reject) => {
            toolAc.signal.addEventListener('abort', () => reject(new AbortError(toolAc.signal.reason)), { once: true });
          })
        ]);
      } catch (err) {
        if (err instanceof AbortError && (err.reason === 'user_stop' || isStopRequested(session))) {
          session.status = 'idle';
          return;
        }
        if (err instanceof TimeoutError || err?.code === 'TIMEOUT') {
          // 关键：超时不当成失败抛回模型。返回一段"已转后台"的 tool_result，
          // 让模型自己决定下一步（继续别的事 / 直接回答用户 / 等等）。
          toolResult = {
            backgrounded: true,
            tool: toolName,
            budget_ms: budget,
            message: `工具 ${toolName} 在 ${Math.round(budget / 1000)} 秒内未返回，已转入后台继续执行。请勿重复调用同一工具；可基于已有信息继续推进，或直接告知用户当前阶段进展。`
          };
          console.warn(`[BrainAgent] 工具 ${toolName} 超时（${budget}ms），转后台`);
          onEvent('tool_progress', { message: `${toolName} 已转后台（${Math.round(budget / 1000)}s 未返回）` });
        } else {
          console.error(`[BrainAgent] 工具 ${toolName} 执行失败:`, err.message);
          toolResult = { error: err.message };
          onEvent('tool_progress', { message: `执行失败：${err.message}` });
        }
      } finally {
        clearInterval(toolWatchdog);
        if (session._currentToolAbort === toolAc) session._currentToolAbort = null;
      }

      if (isStopRequested(session)) {
        session.status = 'idle';
        return;
      }

      onEvent('tool_result', buildToolResultEvent(toolName, toolResult));

      // 把工具结果存入对话历史
      session.messages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: JSON.stringify(toolResult)
      });

      // build_ppt 内部已发出 done 事件，直接退出循环
      if (toolName === 'build_ppt' && toolResult?.success) {
        session.status = 'idle';
        return;
      }
    }
  }

  if (session.status === 'running') {
    session.status = 'idle';
  }

  if (session.status === 'idle' && !session.doneEmitted) {
    session.doneEmitted = true;
    onEvent('done', {
      mode: 'brain',
      taskIntent: session.taskIntent || null,
      brief: session.brief || null,
      executionPlan: session.executionPlan || null,
      taskSpec: session.taskSpec || null,
      planItems: Array.isArray(session.planItems) ? session.planItems : [],
      hasPlan: !!session.bestPlan,
      score: session.bestScore || 0
    });
  }
}

function buildToolResultEvent(toolName, toolResult) {
  const safeResult = toolResult && typeof toolResult === 'object' ? toolResult : { value: toolResult };
  const details = JSON.stringify(safeResult, null, 2);

  switch (toolName) {
    case 'generate_image':
      return {
        tool: toolName,
        ok: !!safeResult.success,
        summary: safeResult.success
          ? `图片已生成：${safeResult.intent || safeResult.prompt?.slice(0, 30) || ''}`
          : (safeResult.error || 'AI生图失败'),
        details
      };
    case 'search_images':
      return {
        tool: toolName,
        ok: !!safeResult.success,
        summary: safeResult.success
          ? `找到 ${safeResult.count || 0} 张图片`
          : (safeResult.error || '找图失败'),
        details
      };
    case 'write_todos':
      return {
        tool: toolName,
        ok: !safeResult.error,
        summary: safeResult.count ? `已更新 ${safeResult.count} 项计划` : '计划已更新',
        details
      };
    case 'update_brief':
      return {
        tool: toolName,
        ok: !safeResult.error,
        summary: `已整理任务简报${safeResult?.brief?.brand ? `：${safeResult.brief.brand}` : ''}`,
        details
      };
    case 'review_uploaded_images':
      return {
        tool: toolName,
        ok: !!safeResult.success,
        summary: safeResult.success
          ? `已重新查看 ${safeResult.count || 0} 张图片`
          : (safeResult.error || '图片查看失败'),
        details
      };
    case 'web_search':
      return {
        tool: toolName,
        ok: !!safeResult.found,
        summary: safeResult.found
          ? `找到 ${safeResult.count || 0} 条搜索结果（${safeResult.source || 'unknown'}）`
          : (safeResult.warning || '没有找到合适结果'),
        details
      };
    case 'web_fetch':
      return {
        tool: toolName,
        ok: !!safeResult.success,
        summary: safeResult.success ? '已读取页面全文' : '页面读取失败',
        details
      };
    case 'run_strategy':
      return {
        tool: toolName,
        ok: !!safeResult.success,
        summary: safeResult.success
          ? (safeResult.degraded
              ? `方案已生成（${safeResult.sectionCount || 0} 个章节，**降级兜底版**：模型结构化输出异常）并在右侧展示。回复时必须提示用户"这一版偏保守/兜底"，建议再跑一次或继续调整；不要复述方案内容。`
              : `方案已生成（${safeResult.sectionCount || 0} 个章节）并在右侧文档面板展示。回复时**不要**复述方案内容/亮点/章节（用户已看到），只用 1-2 句告诉用户方案好了，并询问下一步（出 PPT / 评审 / 继续改）。`)
          : (safeResult.error || '方案生成失败'),
        details
      };
    case 'review_strategy':
      return {
        tool: toolName,
        ok: !!safeResult.success,
        summary: safeResult.success
          ? `评审完成，得分 ${safeResult.score}${safeResult.passed ? '（通过）' : '（待优化）'}`
          : (safeResult.error || '评审失败'),
        details
      };
    case 'build_ppt':
      return {
        tool: toolName,
        ok: !!safeResult.success,
        summary: safeResult.success
          ? `PPT 已生成，共 ${safeResult.pageCount || 0} 页`
          : (safeResult.error || 'PPT 生成失败'),
        details
      };
    case 'read_workspace_doc':
      return {
        tool: toolName,
        ok: !!safeResult.success,
        summary: safeResult.success
          ? `已读取：${safeResult.name || safeResult.doc_id}`
          : (safeResult.error || '读取失败'),
        details
      };
    case 'save_to_workspace':
      return {
        tool: toolName,
        ok: !!safeResult.success,
        summary: safeResult.success
          ? `已保存到空间：${safeResult.name}`
          : (safeResult.error || '保存失败'),
        details
      };
    case 'update_workspace_doc':
      return {
        tool: toolName,
        ok: !!safeResult.success,
        summary: safeResult.success
          ? `已更新文档：${safeResult.name}`
          : (safeResult.error || '更新失败'),
        details
      };
    default:
      return {
        tool: toolName,
        ok: !safeResult.error,
        summary: safeResult.error || '工具执行完成',
        details
      };
  }
}

/**
 * 稳定序列化（忽略 key 顺序差异）
 */
function stableStringify(obj) {
  try {
    const keys = Object.keys(obj).sort();
    const sorted = {};
    keys.forEach(k => { sorted[k] = obj[k]; });
    return JSON.stringify(sorted);
  } catch {
    return String(obj);
  }
}

module.exports = { run, resume, detectTaskIntent };
