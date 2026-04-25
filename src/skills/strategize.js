// Skill: 基于研究结果和 Orchestrator 输出，制定完整策划方案
const { callLLMJson } = require('../utils/llmUtils');
const { buildStrategyPrompt } = require('../prompts/strategy');
const { normalizeStrategizeResult } = require('../utils/structuredOutput');

function firstNonEmpty(...values) {
  for (const value of values) {
    const text = String(value || '').trim();
    if (text) return text;
  }
  return '';
}

function takeNonEmpty(values = [], limit = 5) {
  return values
    .map(item => String(item || '').trim())
    .filter(Boolean)
    .slice(0, limit);
}

function buildFallbackStrategy(input, failure) {
  const { orchestratorOutput = {}, researchResults = [], userInput = {}, round = 1 } = input || {};
  const brand = firstNonEmpty(userInput.brand, userInput.topic, '本次活动');
  const themeList = takeNonEmpty([
    ...(orchestratorOutput.keyThemes || []),
    userInput.tone,
    userInput.goal
  ], 4);
  const researchFocus = takeNonEmpty(researchResults.map(item => item.focus), 3);
  const researchInsights = takeNonEmpty(researchResults.flatMap((item) => item.keyFindings || []), 4);
  const fallbackHighlights = takeNonEmpty([
    orchestratorOutput.parsedGoal && `围绕“${orchestratorOutput.parsedGoal}”统一活动主叙事与现场体验。`,
    themeList[0] && `以“${themeList[0]}”作为活动感知锚点，保证传播口径和空间表达一致。`,
    researchFocus[0] && `把“${researchFocus[0]}”纳入核心内容模块，确保方案不是空转创意。`,
    userInput.requirements && `把补充要求中的关键限制前置处理：${String(userInput.requirements).slice(0, 48)}。`,
    '先用稳定的结构化框架收拢方案，再在后续轮次补强创意细节和执行颗粒度。'
  ], 5);

  const sections = [
    {
      title: '核心策略与主命题',
      keyPoints: takeNonEmpty([
        orchestratorOutput.parsedGoal,
        themeList[0],
        themeList[1]
      ], 3),
      narrative: firstNonEmpty(
        `${brand}这一轮先以“目标清晰、结构稳定、可继续打磨”为优先原则，先把活动主命题、品牌表达和用户感知路径收拢到一条线上。方案不追求一次性铺满所有细节，而是先确保方向正确、叙事顺畅，便于后续继续精修创意亮点和执行动作。`,
        `${brand}本轮优先明确活动主命题和内容主轴。`
      )
    },
    {
      title: '体验设计与内容编排',
      keyPoints: takeNonEmpty([
        themeList[0] && `体验关键词：${themeList[0]}`,
        researchFocus[0] && `研究参考：${researchFocus[0]}`,
        userInput.audience && `目标受众：${userInput.audience}`
      ], 3),
      narrative: `现场体验建议围绕“先吸引停留、再建立理解、最后推动转化”的节奏展开，把品牌故事、重点产品或核心信息拆成可感知的场景模块。研究里提到的${researchFocus[0] || '行业趋势'}可以直接转译成互动内容或展示语言，让现场不是堆信息，而是有起承转合的体验流程。`
    },
    {
      title: '执行节奏与落地保障',
      keyPoints: takeNonEmpty([
        userInput.budget && `预算量级：${userInput.budget}`,
        researchInsights[0],
        '按阶段推进，先保主线稳定再扩展细节'
      ], 3),
      narrative: `执行层面建议采用“主线先行、模块补强”的推进方式：先确认主视觉、核心内容模块和关键节点，再补充供应商、物料、传播和现场运营细节。这样即使模型结构化输出暂时不稳定，整体任务也不会卡在方案阶段，后续仍可继续写文档、补细节并生成 PPT。`
    }
  ];

  return normalizeStrategizeResult({
    planTitle: firstNonEmpty(userInput.topic, `${brand}活动策划方案`, `${brand}策略方案`),
    coreStrategy: firstNonEmpty(
      orchestratorOutput.parsedGoal && `围绕“${orchestratorOutput.parsedGoal}”建立统一叙事，把品牌表达、现场体验与后续传播收束成一条完整主线。`,
      `${brand}先以稳定可落地的主线策略收拢方案，再逐轮补强创意与执行细节。`
    ),
    highlights: fallbackHighlights.length ? fallbackHighlights : ['先保证方案主线清晰，再逐步补强亮点。'],
    sections,
    budget: {
      total: firstNonEmpty(userInput.budget, '待确认'),
      breakdown: [
        { item: '核心体验与舞美', amount: '待估算', percentage: '', rationale: '优先保障用户最直接感知到的活动体验。' },
        { item: '内容与传播', amount: '待估算', percentage: '', rationale: '确保线上线下口径统一，并为后续扩散留出空间。' },
        { item: '执行与人员', amount: '待估算', percentage: '', rationale: '保障现场交付、流程稳定和关键节点响应。' }
      ]
    },
    timeline: {
      eventDate: '待确认',
      phases: [
        { phase: '策略收敛', duration: '当前轮次', milestone: '确认主命题、章节结构和核心亮点。' },
        { phase: '内容深化', duration: '下一轮', milestone: '补充执行细节、预算拆分和传播动作。' },
        { phase: '输出成稿', duration: '确认后', milestone: '整理完整文档并进入 PPT 生成。' }
      ]
    },
    kpis: [
      { metric: '用户停留与互动', target: '显著高于常规展示型活动', rationale: '先用体验设计拉长停留，再承接转化。' },
      { metric: '内容传播效率', target: '形成可复用的传播素材与话题点', rationale: '方案要兼顾现场效果和后续扩散。' }
    ],
    riskMitigation: [
      `结构化输出不稳定：当前已切换为稳态兜底方案（第${round}轮），先保障流程继续，后续再补强细节。`,
      '执行风险前置：优先冻结主线内容、关键节点和核心场景，避免后期返工。'
    ],
    visualTheme: {
      style: firstNonEmpty(userInput.tone, themeList[0], '品牌气质导向的现代活动视觉'),
      colorMood: '根据品牌主色延展一套稳定、克制、可落地的现场配色。',
      imageKeywords: takeNonEmpty([
        `${brand} event design`,
        `${themeList[0] || 'brand'} immersive space`,
        'premium launch experience'
      ], 3)
    },
    visualExecutionHints: {
      sceneTone: '先统一整体空间气质，再把最关键的主舞台、入口区和互动区做出层次。',
      mustRenderScenes: takeNonEmpty([
        '主舞台 / 主视觉区',
        '入口签到与首屏记忆点',
        '核心互动体验区'
      ], 3),
      spatialKeywords: takeNonEmpty([
        'immersive event stage',
        'brand experience zone',
        'premium spatial design'
      ], 3),
      avoidElements: [
        '空泛口号式视觉堆砌',
        '与品牌调性不匹配的廉价装置感'
      ],
      onsiteDesignSuggestions: [
        {
          scene: '主舞台',
          goal: '负责传达活动主命题并建立第一记忆点。',
          designSuggestion: '用一套清晰的主视觉结构承载品牌叙事，优先保证构图稳定、灯光层次明确、信息焦点集中，再逐步补充动态装置或内容互动。',
          visualFocus: ['舞台主视觉', '灯光层次', '品牌记忆点']
        }
      ]
    }
  });
}

/**
 * @param {{ orchestratorOutput, researchResults, round, previousFeedback, userInput }} input
 * @param {object} apiKeys  { minimaxApiKey, minimaxModel }
 * @returns {Promise<{ planTitle, coreStrategy, highlights, sections, visualTheme }>}
 */
async function strategize(input, apiKeys) {
  console.log(`[skill:strategize] 开始制定方案（第${input.round}轮）...`);
  const { systemPrompt, userPrompt } = buildStrategyPrompt(input);
  const result = await callLLMJson(
    [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
    {
      model: 'minimax',
      runtimeKey: apiKeys.minimaxApiKey,
      minimaxModel: apiKeys.minimaxModel,
      maxTokens: 6144,
      streaming: true,   // 流式累积：tokens 持续到达，不触发整体超时
      name: 'strategize',
      validate: normalizeStrategizeResult,
      repairHint: '必须返回对象，至少包含 planTitle、coreStrategy、highlights、sections、budget、timeline、kpis、riskMitigation、visualTheme、visualExecutionHints。sections 内每项必须有 title、keyPoints、narrative。',
      debugLabel: 'strategize',
      onStatus: input.onStatus,
      fallback: ({ error }) => {
        console.warn('[skill:strategize] 启用稳态兜底方案:', error?.message || error);
        return {
          ...buildFallbackStrategy(input, error),
          degraded: true,
          fallbackReason: error?.message || String(error || '')
        };
      }
    }
  );
  console.log(`[skill:strategize] 方案完成: ${result.planTitle}`);
  return result;
}

module.exports = { strategize, buildFallbackStrategy };
