function normalizeText(value = '') {
  return String(value || '').trim();
}

function hasUserMaterials({ documents = [], workspaceDocs = [], attachments = [] } = {}) {
  return Boolean(
    (Array.isArray(documents) && documents.length)
    || (Array.isArray(workspaceDocs) && workspaceDocs.length)
    || (Array.isArray(attachments) && attachments.length)
  );
}

function firstStepStatus(index) {
  return index === 0 ? 'in_progress' : 'pending';
}

function buildPlanItems(items = []) {
  return items
    .map((content, index) => ({
      content: normalizeText(content),
      status: firstStepStatus(index)
    }))
    .filter((item) => item.content)
    .slice(0, 8);
}

function buildReadSourceStep({ documents = [], workspaceDocs = [] } = {}) {
  if (workspaceDocs.length) return '读取已有空间文档/PPT，确认本轮修改基线';
  if (documents.length) return '读取用户提供的文档内容，提炼需要继承的结构与信息';
  return '确认本轮任务依据与产出目标';
}

function inferPptMode({ text, session, documents = [], workspaceDocs = [] }) {
  const sourceText = normalizeText(text).toLowerCase().replace(/\s+/g, '');
  const hasBestPlan = !!session?.bestPlan;
  const hasDraftDoc = !!session?.docHtml;
  const hasWorkspacePpt = workspaceDocs.some((item) => item?.docType === 'ppt');
  const hasWorkspaceDoc = workspaceDocs.some((item) => item?.docType !== 'ppt');
  const hasUploadedDocs = documents.length > 0;
  const optimizationSignals = /(优化|修改|改|重做|重排|精简|压缩|补强|提升|美化|润色).*(ppt|汇报|这一页|那一页|页面)|基于.*ppt|在.*ppt基础上|现有的ppt|已有的ppt|空间里的ppt/;

  if (optimizationSignals.test(sourceText) && hasWorkspacePpt) {
    return {
      mode: 'optimize_existing_ppt',
      targetType: 'ppt_revision',
      summary: '本轮更像是在已有 PPT 基础上做局部优化或重排，而不是从头生成。',
      suggestedTools: ['read_workspace_doc', 'write_todos', 'build_ppt'],
      planItems: buildPlanItems([
        '读取已有 PPT 内容与结构，识别要改的页面和问题',
        '整理本轮修改目标，确认是局部优化还是整稿重建',
        '基于现有方案或内容重新生成修订版 PPT'
      ])
    };
  }

  if ((hasUploadedDocs || hasWorkspaceDoc || hasWorkspacePpt) && !hasBestPlan) {
    return {
      mode: 'ppt_from_existing_material',
      targetType: 'ppt',
      summary: '本轮更适合先吸收现有文档/PPT 内容，再决定是直接出稿还是先整理方案结构。',
      suggestedTools: ['read_workspace_doc', 'write_todos', 'run_strategy', 'build_ppt'],
      planItems: buildPlanItems([
        buildReadSourceStep({ documents, workspaceDocs }),
        '提炼可用于演示的故事线、页面结构与重点信息',
        '必要时先整理成方案文档，再确认是否生成 PPT',
        '用户确认后生成或重生成 PPT'
      ])
    };
  }

  if (hasBestPlan || hasDraftDoc) {
    return {
      mode: 'generate_ppt_from_confirmed_plan',
      targetType: 'ppt',
      summary: '当前会话已经有方案基础，本轮可以直接围绕生成或细化 PPT 推进。',
      suggestedTools: ['write_todos', 'build_ppt'],
      planItems: buildPlanItems([
        '确认本轮 PPT 的修改重点与页数/风格要求',
        '沿用当前方案生成或细化 PPT',
        '检查是否需要继续局部调整'
      ])
    };
  }

  return {
    mode: 'ppt_request_needs_basis',
    targetType: 'ppt',
    summary: '用户想要 PPT，但当前缺少足够依据，优先补齐基线材料或方案，而不是直接出稿。',
    suggestedTools: ['ask_user', 'update_brief', 'run_strategy'],
    planItems: buildPlanItems([
      '确认本轮 PPT 依据：已有文档 / 已有方案 / 需要从头策划',
      '若缺少基线，先补齐简报或整理成可出稿方案',
      '确认后再进入 PPT 生成'
    ])
  };
}

function inferStrategyMode({ session, documents = [], workspaceDocs = [] }) {
  const hasContextDocs = documents.length > 0 || workspaceDocs.length > 0;
  const hasBestPlan = !!session?.bestPlan;

  if (hasBestPlan) {
    return {
      mode: 'refine_existing_strategy',
      targetType: 'strategy_doc',
      summary: '当前会话已有方案，本轮更像是在现有方案基础上补充、改方向或继续深化。',
      suggestedTools: ['update_brief', 'write_todos', 'run_strategy'],
      planItems: buildPlanItems([
        '对比现有方案与新要求，定位需要调整的部分',
        '补充必要 research 或假设，重跑方案优化',
        '输出更新后的方案文档或关键差异'
      ])
    };
  }

  return {
    mode: hasContextDocs ? 'strategy_from_existing_material' : 'new_strategy',
    targetType: 'strategy_doc',
    summary: hasContextDocs
      ? '本轮适合先读取已有材料，再决定 research 深度和方案结构。'
      : '本轮是从零开始的新策划任务，可按需求复杂度决定 research 和方案深度。',
    suggestedTools: ['update_brief', 'write_todos', 'web_search', 'run_strategy'],
    planItems: buildPlanItems([
      buildReadSourceStep({ documents, workspaceDocs }),
      '整理任务简报与关键假设',
      '按需要补充案例/趋势 research',
      '生成并评审方案文档',
      '根据用户反馈决定是否继续转 PPT'
    ])
  };
}

function inferDocEditMode({ documents = [], workspaceDocs = [], session = null }) {
  const hasWorkspaceDocs = workspaceDocs.length > 0 || !!(session?.lastSavedDocId);
  return {
    mode: hasWorkspaceDocs ? 'update_existing_workspace_doc' : 'revise_uploaded_doc',
    targetType: 'document',
    summary: '本轮目标是修改现有文档内容，不要默认升级成完整策划或 PPT 生成任务。',
    suggestedTools: hasWorkspaceDocs
      ? ['read_workspace_doc', 'write_todos', 'update_workspace_doc']
      : ['write_todos', 'save_to_workspace'],
    planItems: buildPlanItems([
      buildReadSourceStep({ documents, workspaceDocs }),
      '按用户要求改写、补充或压缩指定内容',
      hasWorkspaceDocs ? '直接更新原文档，保留原任务上下文' : '输出修订稿并保存为新文档'
    ])
  };
}

function inferResearchMode() {
  return {
    mode: 'research_only',
    targetType: 'research_summary',
    summary: '本轮目标是搜集案例、趋势或事实信息，不默认生成方案或 PPT。',
    suggestedTools: ['write_todos', 'web_search', 'web_fetch', 'save_to_workspace'],
    planItems: buildPlanItems([
      '明确研究问题与关键词',
      '搜索案例/趋势/数据并筛选高价值结果',
      '必要时深读重点页面',
      '整理成摘要或建议输出'
    ])
  };
}

function inferImageMode() {
  return {
    mode: 'image_search_only',
    targetType: 'image_refs',
    summary: '本轮目标是找图和视觉参考，不默认改成案例研究或整套策划。',
    suggestedTools: ['write_todos', 'search_images'],
    planItems: buildPlanItems([
      '提炼主体、场景、风格和用途',
      '先返回一批图片候选供用户筛选',
      '根据反馈继续细化关键词或风格方向'
    ])
  };
}

function inferChatMode({ text, documents = [], workspaceDocs = [], attachments = [] }) {
  const hasMaterials = hasUserMaterials({ documents, workspaceDocs, attachments });
  return {
    mode: hasMaterials ? 'material_understanding' : 'reply_only',
    targetType: hasMaterials ? 'analysis' : 'reply',
    summary: hasMaterials
      ? '本轮更像是在理解材料、回答问题或做轻量分析，不默认进入长链路生成。'
      : '本轮是普通问答或轻量沟通，直接回复即可。',
    suggestedTools: [],
    planItems: hasMaterials
      ? buildPlanItems([
          buildReadSourceStep({ documents, workspaceDocs }),
          '围绕用户问题做针对性分析或回答'
        ])
      : []
  };
}

function createExecutionPlan({ text = '', intent = null, session = null, documents = [], workspaceDocs = [], attachments = [] } = {}) {
  const normalizedIntent = intent?.type || 'chat';
  let basePlan;

  switch (normalizedIntent) {
    case 'image_search':
      basePlan = inferImageMode();
      break;
    case 'research':
      basePlan = inferResearchMode();
      break;
    case 'doc_edit':
      basePlan = inferDocEditMode({ documents, workspaceDocs, session });
      break;
    case 'strategy':
      basePlan = inferStrategyMode({ session, documents, workspaceDocs });
      break;
    case 'ppt':
      basePlan = inferPptMode({ text, session, documents, workspaceDocs });
      break;
    default:
      basePlan = inferChatMode({ text, documents, workspaceDocs, attachments });
      break;
  }

  return {
    version: 1,
    createdAt: Date.now(),
    intentType: normalizedIntent,
    userGoal: normalizeText(text),
    ...basePlan
  };
}

function buildExecutionPlanContextBlock(executionPlan = null) {
  if (!executionPlan) return '';
  const lines = [
    '【系统生成的本轮执行规划】',
    `- 目标产物：${executionPlan.targetType || 'unknown'}`,
    `- 执行模式：${executionPlan.mode || 'unknown'}`,
    `- 规划摘要：${executionPlan.summary || ''}`
  ];

  if (Array.isArray(executionPlan.planItems) && executionPlan.planItems.length) {
    lines.push('- 推荐步骤：');
    executionPlan.planItems.forEach((item, index) => {
      lines.push(`  ${index + 1}. ${item.content}（${item.status}）`);
    });
  }

  if (Array.isArray(executionPlan.suggestedTools) && executionPlan.suggestedTools.length) {
    lines.push(`- 建议优先工具：${executionPlan.suggestedTools.join(' / ')}`);
  }

  return lines.join('\n');
}

function createTaskSpec(executionPlan = null) {
  if (!executionPlan) return null;

  const universalTools = ['write_todos', 'ask_user', 'read_workspace_doc', 'review_uploaded_images'];
  const map = {
    image_search_only: {
      taskMode: 'image_search',
      primaryRoute: 'image_search_pipeline',
      fallbackRoutes: ['research_pipeline'],
      allowedTools: [...universalTools, 'search_images', 'save_to_workspace']
    },
    research_only: {
      taskMode: 'research',
      primaryRoute: 'research_pipeline',
      fallbackRoutes: ['doc_revision_pipeline'],
      allowedTools: [...universalTools, 'web_search', 'web_fetch', 'save_to_workspace']
    },
    revise_uploaded_doc: {
      taskMode: 'doc_edit',
      primaryRoute: 'doc_revision_pipeline',
      fallbackRoutes: ['strategy_pipeline'],
      allowedTools: [...universalTools, 'save_to_workspace']
    },
    update_existing_workspace_doc: {
      taskMode: 'doc_edit',
      primaryRoute: 'doc_revision_pipeline',
      fallbackRoutes: ['strategy_pipeline'],
      allowedTools: [...universalTools, 'update_workspace_doc']
    },
    new_strategy: {
      taskMode: 'strategy',
      primaryRoute: 'strategy_pipeline',
      fallbackRoutes: ['research_pipeline', 'ppt_build_pipeline'],
      allowedTools: [...universalTools, 'update_brief', 'web_search', 'web_fetch', 'run_strategy', 'save_to_workspace']
    },
    strategy_from_existing_material: {
      taskMode: 'strategy',
      primaryRoute: 'strategy_pipeline',
      fallbackRoutes: ['doc_revision_pipeline', 'ppt_build_pipeline'],
      allowedTools: [...universalTools, 'update_brief', 'web_search', 'web_fetch', 'run_strategy', 'save_to_workspace', 'update_workspace_doc']
    },
    refine_existing_strategy: {
      taskMode: 'strategy',
      primaryRoute: 'strategy_pipeline',
      fallbackRoutes: ['doc_revision_pipeline', 'ppt_build_pipeline'],
      allowedTools: [...universalTools, 'update_brief', 'web_search', 'web_fetch', 'run_strategy', 'save_to_workspace', 'update_workspace_doc']
    },
    ppt_from_existing_material: {
      taskMode: 'ppt',
      primaryRoute: 'ppt_from_material_pipeline',
      fallbackRoutes: ['strategy_pipeline', 'doc_revision_pipeline'],
      allowedTools: [...universalTools, 'update_brief', 'run_strategy', 'build_ppt', 'update_workspace_doc', 'save_to_workspace', 'search_images']
    },
    generate_ppt_from_confirmed_plan: {
      taskMode: 'ppt',
      primaryRoute: 'ppt_build_pipeline',
      fallbackRoutes: ['strategy_pipeline'],
      allowedTools: [...universalTools, 'build_ppt', 'search_images']
    },
    optimize_existing_ppt: {
      taskMode: 'ppt_optimize',
      primaryRoute: 'ppt_revision_pipeline',
      fallbackRoutes: ['ppt_from_material_pipeline', 'strategy_pipeline'],
      allowedTools: [...universalTools, 'run_strategy', 'build_ppt', 'search_images']
    },
    ppt_request_needs_basis: {
      taskMode: 'ppt',
      primaryRoute: 'clarify_then_route',
      fallbackRoutes: ['strategy_pipeline', 'ppt_from_material_pipeline'],
      allowedTools: [...universalTools, 'update_brief']
    },
    material_understanding: {
      taskMode: 'analysis',
      primaryRoute: 'analysis_pipeline',
      fallbackRoutes: ['doc_revision_pipeline', 'research_pipeline'],
      allowedTools: [...universalTools]
    },
    reply_only: {
      taskMode: 'chat',
      primaryRoute: 'direct_reply',
      fallbackRoutes: [],
      allowedTools: []
    }
  };

  const resolved = map[executionPlan.mode] || map.reply_only;
  return {
    version: 1,
    taskMode: resolved.taskMode,
    targetArtifact: executionPlan.targetType || 'reply',
    primaryRoute: resolved.primaryRoute,
    fallbackRoutes: resolved.fallbackRoutes,
    allowedTools: resolved.allowedTools,
    completionHint: executionPlan.summary || ''
  };
}

function buildTaskSpecContextBlock(taskSpec = null) {
  if (!taskSpec) return '';
  const lines = [
    '【系统生成的任务规格】',
    `- 任务模式：${taskSpec.taskMode || 'unknown'}`,
    `- 目标产物：${taskSpec.targetArtifact || 'unknown'}`,
    `- 主执行路径：${taskSpec.primaryRoute || 'unknown'}`
  ];
  if (Array.isArray(taskSpec.fallbackRoutes) && taskSpec.fallbackRoutes.length) {
    lines.push(`- 兜底路径：${taskSpec.fallbackRoutes.join(' / ')}`);
  }
  if (Array.isArray(taskSpec.allowedTools) && taskSpec.allowedTools.length) {
    lines.push(`- 允许工具：${taskSpec.allowedTools.join(' / ')}`);
  }
  if (taskSpec.completionHint) {
    lines.push(`- 完成标准：${taskSpec.completionHint}`);
  }
  return lines.join('\n');
}

function checkToolAgainstTaskSpec(taskSpec = null, toolName = '') {
  if (!taskSpec || !toolName) return { allowed: true, reason: '' };
  if (toolName === 'ask_user') return { allowed: true, reason: '' };
  const allowedTools = Array.isArray(taskSpec.allowedTools) ? taskSpec.allowedTools : [];
  if (!allowedTools.length) {
    return { allowed: false, reason: `当前任务模式「${taskSpec.taskMode}」应直接回答，不需要调用工具。` };
  }
  if (allowedTools.includes(toolName)) {
    return { allowed: true, reason: '' };
  }
  return {
    allowed: false,
    reason: `工具「${toolName}」不在当前任务规格允许范围内。当前主路径是「${taskSpec.primaryRoute}」，应优先围绕「${taskSpec.targetArtifact}」推进。`
  };
}

module.exports = {
  createExecutionPlan,
  buildExecutionPlanContextBlock,
  createTaskSpec,
  buildTaskSpecContextBlock,
  checkToolAgainstTaskSpec
};
