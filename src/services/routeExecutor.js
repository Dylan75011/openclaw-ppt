function buildToolStep(toolName, args = {}, options = {}) {
  return {
    toolName,
    args,
    autoExecutable: !!options.autoExecutable,
    reason: options.reason || '',
    key: options.key || `${toolName}:${JSON.stringify(args)}`
  };
}

function buildRouteToolSequence(taskSpec = null, context = {}) {
  if (!taskSpec) return [];

  const sequence = [];
  const planItems = Array.isArray(context.planItems) ? context.planItems : [];
  const workspaceDocs = Array.isArray(context.workspaceDocs) ? context.workspaceDocs : [];

  if (planItems.length) {
    sequence.push(buildToolStep(
      'write_todos',
      { todos: planItems },
      {
        autoExecutable: true,
        reason: '先把本轮任务计划写入会话，让后续执行和前端展示对齐。',
        key: `write_todos:${planItems.map(item => `${item.content}:${item.status}`).join('|')}`
      }
    ));
  }

  const singleWorkspaceDoc = workspaceDocs.length === 1 ? workspaceDocs[0] : null;
  if (
    singleWorkspaceDoc
    && ['doc_revision_pipeline', 'strategy_pipeline', 'ppt_from_material_pipeline', 'ppt_revision_pipeline'].includes(taskSpec.primaryRoute)
  ) {
    const focusMap = {
      doc_revision_pipeline: '提炼需要修改和保留的原文结构',
      strategy_pipeline: '提炼与本轮方案最相关的背景、结构和亮点',
      ppt_from_material_pipeline: '提炼可直接转成 PPT 的章节结构与关键信息',
      ppt_revision_pipeline: '识别现有 PPT 中需要保留和优化的页面结构'
    };
    sequence.push(buildToolStep(
      'read_workspace_doc',
      {
        doc_id: singleWorkspaceDoc.id,
        focus: focusMap[taskSpec.primaryRoute] || ''
      },
      {
        autoExecutable: true,
        reason: '当前只引用了一份明确的空间材料，可以先自动读取作为基线。',
        key: `read_workspace_doc:${singleWorkspaceDoc.id}:${taskSpec.primaryRoute}`
      }
    ));
  }

  const routeDefaults = {
    image_search_pipeline: [
      buildToolStep('search_images', {}, {
        autoExecutable: false,
        reason: '默认下一步应进入找图，但具体关键词仍应交给模型结合上下文决定。',
        key: 'search_images:deferred'
      })
    ],
    research_pipeline: [
      buildToolStep('web_search', {}, {
        autoExecutable: false,
        reason: '默认下一步应先搜索，但具体 query 仍需模型判断。',
        key: 'web_search:deferred'
      })
    ],
    strategy_pipeline: [
      buildToolStep('update_brief', {}, {
        autoExecutable: false,
        reason: '默认应先把简报结构化，再决定是否补充 research。',
        key: 'update_brief:deferred'
      }),
      buildToolStep('run_strategy', {}, {
        autoExecutable: false,
        reason: '在 brief 和必要 context 准备好后进入完整方案生成。',
        key: 'run_strategy:deferred'
      })
    ],
    doc_revision_pipeline: [
      buildToolStep('update_workspace_doc', {}, {
        autoExecutable: false,
        reason: '读取材料后应直接进入文档修改，而不是重走完整策划流程。',
        key: 'update_workspace_doc:deferred'
      })
    ],
    ppt_from_material_pipeline: [
      buildToolStep('run_strategy', {}, {
        autoExecutable: false,
        reason: '若现有材料还不够结构化，先整理成可出稿方案再转 PPT。',
        key: 'run_strategy:deferred'
      }),
      buildToolStep('build_ppt', {}, {
        autoExecutable: false,
        reason: '在材料或方案基线确认后进入 PPT 生成。',
        key: 'build_ppt:deferred'
      })
    ],
    ppt_build_pipeline: [
      buildToolStep('build_ppt', {}, {
        autoExecutable: false,
        reason: '当前已有方案基础，默认目标是直接生成或细化 PPT。',
        key: 'build_ppt:deferred'
      })
    ],
    ppt_revision_pipeline: [
      buildToolStep('read_workspace_doc', {}, {
        autoExecutable: false,
        reason: '先理解现有 PPT 结构，再决定修订力度。',
        key: 'read_workspace_doc:deferred'
      }),
      buildToolStep('build_ppt', {}, {
        autoExecutable: false,
        reason: '确认修订方向后重生成或细化 PPT。',
        key: 'build_ppt:deferred'
      })
    ]
  };

  return [
    ...sequence,
    ...((routeDefaults[taskSpec.primaryRoute] || []).filter(step => !sequence.find(item => item.toolName === step.toolName && item.key === step.key)))
  ];
}

module.exports = {
  buildRouteToolSequence
};
