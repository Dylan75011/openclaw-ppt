#!/usr/bin/env node
// Brain 决策压力测试：用 7 个针对性 scenario 直接喂 brain system prompt + 用户消息，
// 观察它第一轮的 tool 决策是否符合 prompt 里写的硬性约束 / 反模式 / 决策树。
// 用法：node scripts/brain-stress-eval.js
// 需要 .env 里有 MINIMAX_API_KEY。

require('dotenv').config();

const { buildBrainSystemPrompt } = require('../src/prompts/brain');
const { TOOL_DEFINITIONS } = require('../src/services/toolRegistry');
const { callMinimaxWithTools } = require('../src/services/llmClients');

// 一个 scenario = 一段 system prompt 上下文 + 一组 messages + 期望/反模式说明
const SCENARIOS = [
  {
    id: 'S1_full_brief_no_clarify',
    title: '完整 brief 不该复述确认',
    rule: 'prompt 禁止复述型 yes/no；信息够就直接 update_brief → challenge_brief',
    spaceContext: null,
    askedQuestions: [],
    messages: [
      { role: 'user', content: '帮小米 SU7 在上海做一场新品上市发布会，目标受众 25-40 岁高净值男性，预算 200 万，规模 600 人，时间 6 月中旬，调性希望偏科技感+轻奢' }
    ],
    expectTool: ['update_brief'],
    failIfTool: ['ask_user'],
    failIfText: ['对吗', '是不是', '我理解你是']
  },
  {
    id: 'S2_three_directions_inline',
    title: '"给我三个方向"应走 propose_concept 不要正文罗列',
    rule: '硬性约束：propose_concept 之前不要在正文罗列方向；先 brief → challenge → research → propose',
    spaceContext: null,
    askedQuestions: [],
    messages: [
      { role: 'user', content: '帮我想三个发布会创意方向看看' }
    ],
    expectTool: ['ask_user', 'update_brief'],
    failIfTool: ['propose_concept'],
    failIfText: ['方向A', '方向B', '方向一', '方向二', '## A', '## B']
  },
  {
    id: 'S3_budget_conflict',
    title: '明显预算冲突应触发 challenge_brief 链路',
    rule: 'update_brief → challenge_brief 闸口；冲突要让用户取舍而不是自己定',
    spaceContext: null,
    askedQuestions: [],
    messages: [
      { role: 'user', content: '给小米做一场 1000 人新品发布会，预算 5 万，4 月做完' }
    ],
    expectTool: ['update_brief'],
    failIfTool: ['run_strategy', 'propose_concept', 'build_ppt'],
    failIfText: ['没有问题', '可以做', '没问题']
  },
  {
    id: 'S4_image_ambiguous',
    title: '"找图，没合适就 AI 生" → 不能混用，应先找',
    rule: 'prompt 明确："两者不能混用"，先按"找图"理解',
    spaceContext: null,
    askedQuestions: [],
    messages: [
      { role: 'user', content: '给我找一张未来感的车展现场图，没合适的就 AI 帮我生成一张' }
    ],
    expectTool: ['search_images'],
    failIfTool: ['generate_image'],
    failIfText: []
  },
  {
    id: 'S5_xhs_url_only',
    title: '只贴 xhs URL 应立刻 browser_read_notes',
    rule: '不要 ask_user 问"重点看什么"，不要先编摘要',
    spaceContext: null,
    askedQuestions: [],
    messages: [
      { role: 'user', content: 'https://www.xiaohongshu.com/explore/65f3c2b1000000001a02b9e3' }
    ],
    expectTool: ['browser_read_notes'],
    failIfTool: ['ask_user', 'web_fetch', 'browser_read_page'],
    failIfText: ['你想让我重点', '重点关注', '想了解什么']
  },
  {
    id: 'S6_doc_local_edit',
    title: '局部改文档应走 patch_workspace_doc_section 不是整体重写',
    rule: '局部修改优先 patch；update_workspace_doc 仅用于全盘重写',
    spaceContext: {
      space: { id: 'sp_1', name: '小米 SU7' },
      documents: [
        { id: 'doc_42', name: '小米 SU7 发布会方案.docx', docType: 'document', updatedAt: '2026-04-20T10:00:00Z' }
      ],
      lastSavedDocId: 'doc_42',
      lastSavedDocName: '小米 SU7 发布会方案.docx'
    },
    askedQuestions: [],
    messages: [
      { role: 'user', content: '方案里"预算分配"那一节再写得保守点，把媒体投放预算降到原来的 70%' }
    ],
    expectTool: ['patch_workspace_doc_section', 'read_workspace_doc'],
    failIfTool: ['update_workspace_doc', 'run_strategy'],
    failIfText: []
  },
  {
    id: 'S7_already_approved_continue',
    title: '已 approve B 方向后说"继续"不该重开 propose_concept',
    rule: '不要让用户挑两次；已经 approve 就推进 run_strategy 或细化',
    spaceContext: null,
    askedQuestions: [
      {
        header: '挑一条押注',
        question: '三条里你押哪条？',
        answer: '按 B 方向继续',
        answeredAt: '2026-04-25T10:00:00Z'
      }
    ],
    // 模拟 session 已有 propose_concept 产出 + 用户挑了 B
    messages: [
      {
        role: 'assistant',
        content: '',
        tool_calls: [{ id: 'call_propose', type: 'function', function: { name: 'propose_concept', arguments: '{"brief_summary":"小米 SU7 上市发布会"}' } }]
      },
      {
        role: 'tool',
        tool_call_id: 'call_propose',
        content: JSON.stringify({ ok: true, directions: [{ label: 'A', codeName: '星河之境' }, { label: 'B', codeName: '黑盒审判' }, { label: 'C', codeName: '极客圣殿' }] })
      },
      {
        role: 'assistant',
        content: '',
        tool_calls: [{ id: 'call_ask', type: 'function', function: { name: 'ask_user', arguments: '{"question":"三条里你押哪条？","header":"挑一条押注","type":"suggestion"}' } }]
      },
      {
        role: 'tool',
        tool_call_id: 'call_ask',
        content: JSON.stringify({ answer: '按 B 方向继续' })
      },
      { role: 'user', content: '继续' }
    ],
    expectTool: ['approve_concept', 'run_strategy'],
    failIfTool: ['propose_concept'],
    failIfText: []
  }
];

function buildSystemMessage(scenario) {
  return buildBrainSystemPrompt(
    scenario.spaceContext || null,
    null, // executionPlan
    null, // taskSpec
    [],   // routeToolSequence
    null, // compactSummary
    scenario.askedQuestions || []
  );
}

function summarizeChoice(choice) {
  const msg = choice?.message || {};
  const out = {
    text: typeof msg.content === 'string' ? msg.content.slice(0, 240) : '',
    toolCalls: []
  };
  if (Array.isArray(msg.tool_calls)) {
    out.toolCalls = msg.tool_calls.map(tc => ({
      name: tc.function?.name,
      args: (tc.function?.arguments || '').slice(0, 240)
    }));
  }
  return out;
}

function evaluate(scenario, summary) {
  const calledTools = summary.toolCalls.map(t => t.name);
  const text = summary.text || '';

  const hits = (scenario.expectTool || []).filter(t => calledTools.includes(t));
  const violations = (scenario.failIfTool || []).filter(t => calledTools.includes(t));
  const textViolations = (scenario.failIfText || []).filter(s => text.includes(s));

  let verdict;
  if (violations.length || textViolations.length) {
    verdict = 'FAIL';
  } else if (hits.length) {
    verdict = 'PASS';
  } else if (calledTools.length === 0 && text) {
    verdict = 'AMBIGUOUS_TEXT_ONLY';
  } else {
    verdict = 'AMBIGUOUS_OTHER_TOOL';
  }

  return { verdict, calledTools, violations, textViolations };
}

async function runScenario(scenario) {
  const sys = buildSystemMessage(scenario);
  const messages = [
    { role: 'system', content: sys },
    ...scenario.messages
  ];

  try {
    const choice = await callMinimaxWithTools(
      messages,
      TOOL_DEFINITIONS,
      { maxTokens: 1024, temperature: 0.7 }
    );
    const summary = summarizeChoice(choice);
    const result = evaluate(scenario, summary);
    return { scenario, summary, result };
  } catch (err) {
    return { scenario, error: err.message };
  }
}

function fmtVerdict(v) {
  return ({ PASS: '✅ PASS', FAIL: '❌ FAIL', AMBIGUOUS_TEXT_ONLY: '⚠️  TEXT-ONLY', AMBIGUOUS_OTHER_TOOL: '⚠️  OTHER-TOOL' })[v] || v;
}

(async () => {
  console.log(`\n=== Brain 压力测试  (${SCENARIOS.length} scenarios, parallel) ===\n`);

  const t0 = Date.now();
  const results = await Promise.all(SCENARIOS.map(runScenario));
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

  let passN = 0, failN = 0, ambN = 0;

  for (const r of results) {
    const s = r.scenario;
    console.log(`\n----- [${s.id}] ${s.title} -----`);
    console.log(`规则: ${s.rule}`);
    if (r.error) {
      console.log(`💥 ERROR: ${r.error}`);
      failN++;
      continue;
    }
    const { verdict, calledTools, violations, textViolations } = r.result;
    console.log(`决策: tools=[${calledTools.join(', ') || '(none)'}]`);
    if (r.summary.text) console.log(`文本: "${r.summary.text.replace(/\s+/g, ' ').slice(0, 200)}"`);
    if (r.summary.toolCalls.length) {
      r.summary.toolCalls.forEach(tc => console.log(`  ↳ ${tc.name}(${tc.args})`));
    }
    if (violations.length) console.log(`❗ 违反 failIfTool: ${violations.join(', ')}`);
    if (textViolations.length) console.log(`❗ 文本踩雷: ${textViolations.join(', ')}`);
    console.log(`判定: ${fmtVerdict(verdict)}`);
    if (verdict === 'PASS') passN++;
    else if (verdict === 'FAIL') failN++;
    else ambN++;
  }

  console.log(`\n=== 汇总 (${elapsed}s) ===`);
  console.log(`  ✅ PASS:      ${passN}`);
  console.log(`  ❌ FAIL:      ${failN}`);
  console.log(`  ⚠️  AMBIGUOUS: ${ambN}`);
  console.log('');
})();
