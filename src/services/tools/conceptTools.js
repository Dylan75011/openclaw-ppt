// 创意骨架提案工具：在 run_strategy 之前，向用户呈现 3 条差异化方向并确认
const { proposeConcept } = require('../../skills');

const MAX_ITERATIONS = 4;
const RESEARCH_CONTEXT_MAX_CHARS = 6000;

function buildResearchContext(session) {
  const store = Array.isArray(session.researchStore) ? session.researchStore : [];
  if (!store.length) return '';
  const parts = [];
  let totalChars = 0;
  for (let i = store.length - 1; i >= 0; i--) {
    const entry = store[i];
    const results = Array.isArray(entry.results) ? entry.results : [];
    const block = `【搜索${i + 1}】${entry.query || ''}\n` +
      results.map((r, j) => `  [${j + 1}] ${r.title || ''}\n  ${r.snippet || ''}`).join('\n');
    if (totalChars + block.length > RESEARCH_CONTEXT_MAX_CHARS) break;
    parts.unshift(block);
    totalChars += block.length;
  }
  return parts.join('\n\n');
}

function pickDirection(concept, label) {
  const directions = Array.isArray(concept?.directions) ? concept.directions : [];
  if (!directions.length) return null;
  if (!label) return directions[0];
  const normalized = String(label).trim().toUpperCase();
  return directions.find(d => String(d.label || '').toUpperCase() === normalized) || null;
}

async function execProposeConcept(args = {}, session, onEvent) {
  const userInput = {
    brand: args.brand || session.userInput?.brand || session.brief?.brand || '（未指定）',
    description: args.event_description || args.description || session.userInput?.description || '',
    goal: args.goal || session.userInput?.goal || session.brief?.goal || '',
    audience: args.audience || session.userInput?.audience || session.brief?.audience || '',
    tone: args.tone || session.userInput?.tone || session.brief?.tone || '',
    budget: args.budget || session.userInput?.budget || session.brief?.budget || '',
    requirements: args.requirements || session.userInput?.requirements || session.brief?.requirements || '',
    topic: args.topic || session.userInput?.topic || ''
  };

  // 保留 userInput 方便后续 run_strategy 复用
  session.userInput = { ...(session.userInput || {}), ...userInput };

  const researchContext = [buildResearchContext(session), args.research_context]
    .filter(s => s && s.trim())
    .join('\n\n---\n\n');

  // 品牌/核心需求切换时视为新任务，重置迭代计数
  const previousBrand = session.conceptContextBrand || '';
  const brandChanged = previousBrand && userInput.brand && previousBrand !== userInput.brand;
  if (brandChanged) {
    session.conceptIteration = 0;
    session.conceptProposal = null;
    session.conceptApproved = false;
    session.approvedDirection = null;
    session.approvedDirectionLabel = '';
  }

  const previousConcept = session.conceptProposal || null;
  const iteration = (session.conceptIteration || 0) + 1;
  const userFeedback = args.user_feedback || args.feedback || '';

  const atSoftCap = iteration > MAX_ITERATIONS;

  onEvent('tool_progress', { message: iteration === 1 ? '正在梳理 3 条差异化方向...' : `根据反馈调整第 ${iteration} 版的三条方向...` });

  let concept;
  try {
    concept = await proposeConcept({
      userInput,
      researchContext,
      previousConcept,
      userFeedback,
      iteration,
      onStatus: ({ status }) => {
        if (status === 'fallback_start') {
          onEvent('tool_progress', { message: '生成稍慢，切换为稳态兜底创意...' });
        }
      }
    }, session.apiKeys);
  } catch (err) {
    console.warn('[propose_concept] 失败:', err.message);
    return { success: false, error: err.message };
  }

  session.conceptProposal = concept;
  session.conceptIteration = iteration;
  session.conceptApproved = false;
  session.approvedDirection = null;
  session.approvedDirectionLabel = '';
  session.conceptContextBrand = userInput.brand || '';

  const directions = Array.isArray(concept.directions) ? concept.directions : [];

  onEvent('artifact', {
    artifactType: 'concept_proposal',
    payload: {
      iteration,
      sharedContext: concept.sharedContext || '',
      differentiationAxis: concept.differentiationAxis || '',
      directions: directions.map(d => ({
        label: d.label,
        codeName: d.codeName || '',
        themeName: d.themeName || '',
        positioning: d.positioning || '',
        coreIdea: d.coreIdea || '',
        eventFramework: d.eventFramework || [],
        creativeAngles: d.creativeAngles || [],
        toneAndStyle: d.toneAndStyle || '',
        upside: d.upside || '',
        risk: d.risk || '',
        bestFor: d.bestFor || ''
      })),
      recommendation: concept.recommendation || '',
      degraded: !!concept.degraded
    }
  });

  onEvent('tool_progress', { message: `第 ${iteration} 版的 3 条方向已呈现，等待客户挑选` });

  const convergenceHint = atSoftCap
    ? ` 注意：已经是第 ${iteration} 版，迭代次数偏多。建议在 ask_user 里提醒用户"三版下来，哪一条最接近你的想法？"。`
    : '';

  const labelList = directions.map(d => d.label).filter(Boolean).join(' / ') || 'A / B / C';

  return {
    success: true,
    iteration,
    directionCount: directions.length,
    directionLabels: directions.map(d => d.label),
    differentiationAxis: concept.differentiationAxis || '',
    recommendation: concept.recommendation || '',
    degraded: !!concept.degraded,
    atSoftCap,
    nextStepHint: `三条差异化方向（${labelList}）卡片已**直接渲染在对话里**，每条都含主题/定位/框架/亮点/收益/风险/适用场景，用户可切换查看完整内容。你只需用 1-2 句话铺垫（可以提一下你的 recommendation，但**不要复述卡片里的方向细节**，重复就是冗余），然后立刻调用 ask_user（type=suggestion，header="挑一条方向"，options 里每条方向一个选项——label 用"A 方向：<codeName>"的格式、value 用"按 A 方向继续"这样的可读文本、description 放 positioning 的一句话）。外加第四个选项"都不太对，换一批"用于触发重新 propose_concept。用户选定后调用 approve_concept 并传入 direction_label 参数；如需调整某条方向，调 propose_concept 并在 user_feedback 里写明"在 X 方向基础上怎么改"。${convergenceHint}`
  };
}

function execApproveConcept(args = {}, session, onEvent) {
  if (!session.conceptProposal) {
    return { success: false, error: '尚未生成创意方向，请先调用 propose_concept。' };
  }

  const directions = Array.isArray(session.conceptProposal.directions) ? session.conceptProposal.directions : [];
  if (!directions.length) {
    return { success: false, error: '当前创意提案里没有可选方向，请重新调用 propose_concept。' };
  }

  const label = args.direction_label || args.label || '';
  const picked = pickDirection(session.conceptProposal, label) || directions[0];

  session.conceptApproved = true;
  session.approvedDirection = picked;
  session.approvedDirectionLabel = picked.label || '';

  onEvent('tool_progress', { message: `客户已确认 ${picked.label || '其中一条'} 方向，可进入完整方案生成` });

  return {
    success: true,
    approvedIteration: session.conceptIteration || 1,
    approvedLabel: picked.label || '',
    approvedThemeName: picked.themeName || '',
    nextStepHint: `用户已确认 ${picked.label || ''} 方向（主题：${picked.themeName || '—'}）。现在可调用 run_strategy 生成完整策划方案。run_strategy 会把这条方向作为硬约束传给方案生成。`
  };
}

module.exports = { execProposeConcept, execApproveConcept };
