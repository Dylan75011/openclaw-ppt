// Brain Agent：ReAct 循环（Reason → Act → Observe → Reason...）
const { callMinimaxWithToolsStream } = require('../services/llmClients');
const { TOOL_DEFINITIONS, executeTool, getToolDisplay } = require('../services/toolRegistry');
const { analyzeAgentImages } = require('../services/visionMcp');
const { buildBrainSystemPrompt } = require('../prompts/brain');
const {
  createExecutionPlan,
  buildExecutionPlanContextBlock,
  createTaskSpec,
  buildTaskSpecContextBlock
} = require('../services/taskPlanner');
const { buildRouteToolSequence } = require('../services/routeExecutor');
const wm = require('../services/workspaceManager');

const MAX_TURNS = 15;

// 单条工具结果最大保留字符数（约 250 token）
const TOOL_RESULT_MAX_CHARS = 1000;
// 估算 token 数（中英混合约 0.4 token/字符）
function estimateTokens(text) {
  return Math.ceil((text || '').length * 0.4);
}
// 整体对话历史 token 警戒线（超过时截断早期工具结果）
const CONTEXT_TOKEN_WARN = 10000;

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
  const systemPrompt = buildBrainSystemPrompt(
    spaceContextWithLastDoc,
    session.executionPlan || null,
    session.taskSpec || null,
    session.routeToolSequence || []
  );

  // 第一步：对每条 tool 消息的 content 做截断，防止搜索/抓取结果撑爆 token
  const trimmed = session.messages.map((message) => {
    const next = {
      role: message.role,
      content: message.content
    };
    if (message.tool_calls)   next.tool_calls   = message.tool_calls;
    if (message.tool_call_id) next.tool_call_id = message.tool_call_id;

    if (message.role === 'tool' && typeof message.content === 'string'
        && message.content.length > TOOL_RESULT_MAX_CHARS) {
      next.content = message.content.slice(0, TOOL_RESULT_MAX_CHARS) + '\n...[结果已截断]';
    }
    return next;
  });

  // 第二步：估算总 token，超出警戒线时删除最早的工具往返（user→assistant+tool_calls→tool）
  const totalTokens = estimateTokens(systemPrompt)
    + trimmed.reduce((sum, m) => sum + estimateTokens(JSON.stringify(m)), 0);

  if (totalTokens > CONTEXT_TOKEN_WARN && trimmed.length > 6) {
    // 保留最近 6 条，但要确保消息完整性
    // 1. tool 消息必须紧跟在对应的 assistant(tool_calls) 之后
    // 2. 如果最近 6 条的第一条是 tool 或 assistant(tool_calls)，需要调整截断点
    
    let splitIndex = trimmed.length - 6;
    
    // 检查最近6条的第一条消息
    const firstRecentMsg = trimmed[splitIndex];
    
    // 如果第一条是 tool 消息，需要向前找对应的 assistant(tool_calls)
    if (firstRecentMsg.role === 'tool') {
      // 向前找对应的 assistant
      for (let i = splitIndex - 1; i >= 0; i--) {
        const msg = trimmed[i];
        if (msg.role === 'assistant' && msg.tool_calls) {
          if (msg.tool_calls.some(tc => tc.id === firstRecentMsg.tool_call_id)) {
            splitIndex = i; // 找到了对应的 assistant，从这里开始截断
            break;
          }
        }
      }
    }
    
    const recent = trimmed.slice(splitIndex);
    const older  = trimmed.slice(0, splitIndex).filter(m => m.role !== 'tool').map(m => {
      if (m.role === 'assistant' && m.tool_calls) {
        // assistant 只保留文字部分，去掉 tool_calls
        return { role: 'assistant', content: m.content || '[工具调用，已归档]' };
      }
      return m;
    });
    return [{ role: 'system', content: systemPrompt }, ...older, ...recent];
  }

  return [{ role: 'system', content: systemPrompt }, ...trimmed];
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

function detectTaskIntent(text = '', { documents = [], workspaceDocs = [], session = null } = {}) {
  const normalized = String(text || '').trim().toLowerCase();
  const sourceText = normalized.replace(/\s+/g, '');
  if (!sourceText && !documents.length && !workspaceDocs.length) {
    return {
      type: 'chat',
      label: '普通对话',
      confidence: 0.2,
      hint: ''
    };
  }

  const imageGenerateSignals = /(生成图|生成.*图片|生成一张|生成几张|画一张|画几张|ai生图|ai.*图|重新生成.*图|改.*这张|换.*这张|这张.*换|这张.*改|重新画|生图)/;
  const imageSearchSignals = /(找图|搜图|配图|参考图|效果图|海报图|kv|主视觉|意向图|素材图|展台图|现场图|氛围图|背景图|找一下.*图|来几张.*图|找几张.*图|配几张.*图|.*的图么|.*的图吗)/;
  const researchSignals = /(案例|竞品|趋势|数据|信息|新闻|资料|关键点|关键词|调研|研究|搜一下|查一下)/;
  const docEditSignals = /(改文档|改一下文档|修改文档|润色|重写|改写|扩写|缩写|压缩|补充|完善文档|整理文档|优化文案|改方案|补一段|补一版|改一下这段|续写|精简这份文档|调整这份文档|更新文档|更新一下文档|写进文档|加进文档|写到文档|加到文档|放进文档|插进文档|追加到|补到文档|补充到文档)/;
  const pptSignals = /(生成ppt|做ppt|出ppt|转成ppt|汇报页|排成ppt|修改ppt|优化ppt|改ppt|重做ppt|重排ppt|精简成.*页|这一页重做|这一页改一下|基于.*ppt)/;
  const strategySignals = /(策划|方案|活动方案|发布会方案|创意方向|整合方案)/;

  if (imageGenerateSignals.test(sourceText)) {
    return {
      type: 'image_generate',
      label: 'AI生图',
      confidence: 0.95,
      hint: '用户想用 AI 生成全新图片，或修改/替换已有图片。调用 generate_image，不要用 search_images 代替。'
    };
  }

  if (imageSearchSignals.test(sourceText) && !researchSignals.test(sourceText)) {
    return {
      type: 'image_search',
      label: '找图配图',
      confidence: 0.95,
      hint: '用户当前主要意图是”找图/配图/图片参考”。优先调用 search_images，除非用户明确要案例、数据或行业信息，否则不要改走 web_search。'
    };
  }

  const hasSessionDoc = !!(session?.lastSavedDocId || session?.docJson);
  if ((documents.length || workspaceDocs.length || hasSessionDoc) && docEditSignals.test(sourceText)) {
    return {
      type: 'doc_edit',
      label: '文档修改',
      confidence: 0.94,
      hint: '用户当前主要意图是”基于现有文档修改/续写/润色”。优先读取并更新文档，不要默认重走完整 research -> strategy 流程。'
    };
  }

  if ((documents.length || workspaceDocs.length || hasSessionDoc) && /(基于|按照|参考).*(文档|提案|方案|那份|这份)|开场文案|摘要|前言/.test(sourceText)) {
    return {
      type: 'doc_edit',
      label: '文档修改',
      confidence: 0.88,
      hint: '用户当前主要意图是”在已有文档基础上补充或修改内容”。优先读取上下文文档并直接编辑。'
    };
  }

  if (pptSignals.test(sourceText)) {
    return {
      type: 'ppt',
      label: 'PPT生成',
      confidence: 0.93,
      hint: '用户当前主要意图是“生成或修改 PPT”。如果还没有方案，先确认依据；如果已有方案，再判断是否进入 build_ppt。'
    };
  }

  if (researchSignals.test(sourceText) && !imageGenerateSignals.test(sourceText) && !imageSearchSignals.test(sourceText)) {
    return {
      type: 'research',
      label: '信息搜索',
      confidence: 0.92,
      hint: '用户当前主要意图是“搜索信息/案例/关键事实”。优先调用 web_search；只有值得深读的页面再调用 web_fetch。'
    };
  }

  if (strategySignals.test(sourceText)) {
    return {
      type: 'strategy',
      label: '方案策划',
      confidence: 0.9,
      hint: '用户当前主要意图是“做策划方案”。信息足够时直接推进 update_brief -> write_todos -> web_search -> run_strategy。'
    };
  }

  return {
    type: 'chat',
    label: '普通对话',
    confidence: 0.45,
    hint: ''
  };
}

async function prepareUserInputMessage(text, attachments = [], documents = [], session, onEvent, workspaceDocs = []) {
  const normalizedText = String(text || '').trim();
  const parts = [];
  const detectedIntent = detectTaskIntent(normalizedText, { documents, workspaceDocs, session });
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

  const prepared = await prepareUserInputMessage(userMessage, options.attachments || [], options.documents || [], session, onEvent, options.workspaceDocs || []);
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
  const prepared = await prepareUserInputMessage(userReply, options.attachments || [], options.documents || [], session, onEvent, options.workspaceDocs || []);
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
          temperature: 0.7
        },
        (chunk) => {
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
      if (isStopRequested(session)) {
        session.status = 'idle';
        return;
      }
      onEvent('error', { message: `AI 调用失败：${err.message}` });
      session.status = 'failed';
      return;
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
        session.pendingToolCallId = toolCall.id;
        session.status = 'waiting_for_user';
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

      let toolResult;
      try {
        toolResult = await executeTool(toolName, args, session, onEvent);
      } catch (err) {
        console.error(`[BrainAgent] 工具 ${toolName} 执行失败:`, err.message);
        if (isStopRequested(session)) {
          session.status = 'idle';
          return;
        }
        toolResult = { error: err.message };
        onEvent('tool_progress', { message: `执行失败：${err.message}` });
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
          ? `方案已形成，评分 ${safeResult.score || 0}`
          : (safeResult.error || '方案生成失败'),
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
