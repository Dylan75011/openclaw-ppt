// 验证 ask_user 机制升级：(1) runtime validator (2) session.askedQuestions 记忆
// 全部为单元级验证，不依赖外部服务。

const { validateAskUserArgs } = require('../src/services/tools/askUserValidator');
const { buildBrainSystemPrompt } = require('../src/prompts/brain');
const { createSession } = require('../src/services/agentSession');

const results = { pass: 0, fail: 0, details: [] };

function check(name, cond, extra = '') {
  if (cond) {
    results.pass++;
    console.log(`  ✅ ${name}`);
  } else {
    results.fail++;
    console.log(`  ❌ ${name}  ${extra}`);
    results.details.push(name);
  }
}

// =========================
// Part 1: Validator 边界
// =========================
console.log('\n=== Part 1: ask_user validator ===');

// 1.1 空/残缺
check('空 args 被拒',
  validateAskUserArgs({}).valid === false);

check('question 过短被拒',
  validateAskUserArgs({ question: '嗯?' }).valid === false);

check('合法 question 无 options 通过',
  validateAskUserArgs({ question: '这次是华为系新品吗？想早点定方向', type: 'missing_info' }).valid === true);

// 1.2 type 枚举
check('非法 type 被拒',
  validateAskUserArgs({ question: '确认方向？', type: 'weirdtype' }).valid === false);

check('缺 type 不报错（仅 question 合法即可）',
  validateAskUserArgs({ question: '这次是华为系新品吗？想早点定方向' }).valid === true);

// 1.3 suggestion 类型必须带 options
check('suggestion 无 options 被拒',
  validateAskUserArgs({
    question: '三条方向里你押哪条？想听直觉选',
    type: 'suggestion'
  }).valid === false);

check('suggestion 带合法 options 通过',
  validateAskUserArgs({
    question: '三条方向里你押哪条？',
    type: 'suggestion',
    options: [
      { label: '押 A 星河之境', value: '按 A 继续', description: '稳、媒体友好；代价：话题度平' },
      { label: '押 B 黑盒审判', value: '按 B 继续', description: '社媒大概率破圈；代价：控场风险高' }
    ]
  }).valid === true);

// 1.4 options 数量边界
check('options 只 1 条被拒',
  validateAskUserArgs({
    question: '确认？',
    type: 'confirmation',
    options: [{ label: 'OK', value: 'OK', description: '够长够细致的描述' }]
  }).valid === false);

check('options 5 条被拒',
  validateAskUserArgs({
    question: '选一条',
    type: 'suggestion',
    options: Array(5).fill({ label: 'X', value: 'X', description: '随便描述一下都行' })
  }).valid === false);

// 1.5 option 字段完整性
check('option 缺 label 被拒',
  validateAskUserArgs({
    question: '选一条',
    type: 'suggestion',
    options: [
      { value: 'A', description: '收益稳；代价话题度平' },
      { label: 'B', value: 'B', description: '社媒爆；代价控场难' }
    ]
  }).valid === false);

check('option 缺 value 被拒',
  validateAskUserArgs({
    question: '选一条',
    type: 'suggestion',
    options: [
      { label: 'A', description: '收益稳；代价话题度平' },
      { label: 'B', value: 'B', description: '社媒爆；代价控场难' }
    ]
  }).valid === false);

// 1.6 浅问 description 被拦
check('option.description < 8 字被拒',
  validateAskUserArgs({
    question: '选一条',
    type: 'suggestion',
    options: [
      { label: 'A', value: 'A', description: '短' },
      { label: 'B', value: 'B', description: '按这个' }
    ]
  }).valid === false);

check('option.description 为"按这个继续"也被拒（4 字）',
  validateAskUserArgs({
    question: '选一条',
    type: 'suggestion',
    options: [
      { label: '按这个方向继续', value: '按这个方向继续', description: '按这个' },
      { label: '我想调整', value: '我想调整', description: '调整下' }
    ]
  }).valid === false);

// 1.7 深问 description 通过
check('合格深问通过（每个 description 都带代价）',
  validateAskUserArgs({
    question: '三条里你押哪条？想听直觉选',
    type: 'suggestion',
    options: [
      { label: '押 A 星河之境', value: '按 A 继续', description: '稳、媒体友好；代价：话题度平，社媒不爆' },
      { label: '押 B 黑盒审判', value: '按 B 继续', description: '社媒大概率破圈；代价：大咖控场风险高' },
      { label: '押 C 极客圣殿', value: '按 C 继续', description: '极客心智+长尾内容强；代价：大众覆盖窄' },
      { label: '都不够好，换一批', value: '换一批', description: '我会带着你的反馈重出一版' }
    ]
  }).valid === true);

// 1.8 guidance 文本包含可行动提示
const shallowResult = validateAskUserArgs({
  question: '选一条',
  type: 'suggestion',
  options: [
    { label: '按这个继续', value: '按这个继续', description: '继续' },
    { label: '换', value: '换', description: '换' }
  ]
});
check('拒绝时返回可行动 guidance',
  shallowResult.guidance && shallowResult.guidance.includes('代价'));

// =========================
// Part 2: session.askedQuestions 流转
// =========================
console.log('\n=== Part 2: session.askedQuestions 记忆 ===');

const session = createSession({ sessionId: 'test-1', spaceId: 'sp-1', apiKeys: {} });

check('session 初始化时 askedQuestions 为空数组',
  Array.isArray(session.askedQuestions) && session.askedQuestions.length === 0);

// 模拟 brainAgent 对 ask_user 的 push 逻辑
const _trim = (x) => String(x || '').trim();
const ask1 = {
  header: '锁定品牌',
  question: '品牌方向是"华为手机新品"、还是其实是"荣耀/其他品牌"？后者做法完全不一样',
  options: []
};
session.askedQuestions.push({
  header: _trim(ask1.header),
  question: _trim(ask1.question).slice(0, 160),
  optionLabels: [],
  askedAtTurn: 1,
  answer: null
});

check('第一次 push 后长度=1 且 answer 为 null',
  session.askedQuestions.length === 1 && session.askedQuestions[0].answer === null);

// 模拟 resume 回填
const lastAsk = session.askedQuestions[session.askedQuestions.length - 1];
lastAsk.answer = String('华为的，Mate 80 系列').trim().slice(0, 200);
lastAsk.answeredAt = new Date().toISOString();

check('resume 回填后 answer 非空',
  session.askedQuestions[0].answer === '华为的，Mate 80 系列'
  && !!session.askedQuestions[0].answeredAt);

// 第二次追问
session.askedQuestions.push({
  header: '挑一条押注',
  question: '三条里你押哪条？',
  optionLabels: ['押 A 星河之境', '押 B 黑盒审判', '押 C 极客圣殿', '都不够好，换一批'],
  askedAtTurn: 5,
  answer: null
});
check('第二次 push 后长度=2',
  session.askedQuestions.length === 2);

// 超过 6 条应自动截断
for (let i = 0; i < 8; i++) {
  session.askedQuestions.push({
    header: `H${i}`, question: `Q${i}?`, optionLabels: [], askedAtTurn: 10 + i, answer: `A${i}`
  });
  if (session.askedQuestions.length > 6) {
    session.askedQuestions = session.askedQuestions.slice(-6);
  }
}
check('超 6 条自动截断为 6',
  session.askedQuestions.length === 6);

check('截断后最早的一条是 H2（前两条已被挤出）',
  session.askedQuestions[0].header === 'H2');

// =========================
// Part 3: buildBrainSystemPrompt 渲染
// =========================
console.log('\n=== Part 3: prompt 渲染 ===');

// 3.1 向后兼容
const p1 = buildBrainSystemPrompt();
check('无参调用不报错',
  typeof p1 === 'string' && p1.length > 1000);

// 3.2 空数组不渲染 section
const p2 = buildBrainSystemPrompt(null, null, null, [], null, []);
check('空数组不渲染"已问过"章节',
  !p2.includes('已经问过用户的问题'));

// 3.3 有数据时渲染
const p3 = buildBrainSystemPrompt(null, null, null, [], null, [
  { header: '锁定品牌', question: '品牌方向是华为还是荣耀？', answer: '华为的', askedAtTurn: 1 },
  { header: '挑一条押注', question: '三条里你押哪条？', answer: '押 B 黑盒审判', askedAtTurn: 5 },
  { header: '下一步', question: '直接上 PPT 还是先评审？', answer: null, askedAtTurn: 8 }
]);
check('有数据时渲染"已问过"章节', p3.includes('已经问过用户的问题'));
check('包含第 1 条 Q+A', p3.includes('品牌方向是华为还是荣耀？') && p3.includes('华为的'));
check('包含第 2 条 Q+A', p3.includes('三条里你押哪条？') && p3.includes('押 B 黑盒审判'));
check('pending 条显示"用户尚未回复"',
  p3.includes('下一步') && p3.includes('（用户尚未回复）'));
check('含"禁止再用 ask_user 问同一个话题"硬约束',
  p3.includes('禁止再用 ask_user 问同一个话题'));

// 3.4 超 6 条只渲染最近 6
const manyAsks = Array.from({ length: 9 }, (_, i) => ({
  header: `H${i}`, question: `Q${i}?`, answer: `A${i}`, askedAtTurn: i
}));
const p4 = buildBrainSystemPrompt(null, null, null, [], null, manyAsks);
check('超 6 条只显示最近 6 条',
  p4.includes('H8') && p4.includes('H3') && !p4.includes('[H2]') && !p4.includes('[H1]'));

// 3.5 section 位置：在 compactSummary 之前、与其它 section 同一块
check('askedQuestions section 出现在硬性约束之后',
  p3.indexOf('硬性约束') < p3.indexOf('已经问过用户的问题'));

// =========================
// Part 4: brainAgent ask_user 拦截链路（静态验证）
// =========================
console.log('\n=== Part 4: brainAgent 拦截代码存在性 ===');

const fs = require('fs');
const brainAgentSrc = fs.readFileSync(
  require.resolve('../src/agents/brainAgent'),
  'utf8'
);

check('brainAgent 导入 validateAskUserArgs',
  brainAgentSrc.includes("require('../services/tools/askUserValidator')"));

check('brainAgent 在 ask_user 分支调用了 validator',
  brainAgentSrc.includes('validateAskUserArgs(args)'));

check('校验失败时 push tool_result + user reminder + continue',
  brainAgentSrc.includes('validation.error')
  && brainAgentSrc.includes('validation.guidance')
  && /if\s*\(!validation\.valid\)[\s\S]*?continue;/.test(brainAgentSrc));

check('ask_user 派发时 push 到 session.askedQuestions',
  brainAgentSrc.includes('session.askedQuestions.push'));

check('resume 里回填 answer + answeredAt',
  brainAgentSrc.includes('lastAsk.answer')
  && brainAgentSrc.includes('lastAsk.answeredAt'));

check('buildMessages 把 askedQuestions 传进系统提示',
  brainAgentSrc.includes('session.askedQuestions')
  && /buildBrainSystemPrompt\([\s\S]*?askedQuestions[\s\S]*?\)/.test(brainAgentSrc));

// =========================
// Summary
// =========================
console.log(`\n=== 总计 ${results.pass}/${results.pass + results.fail} 通过 ===`);
if (results.fail > 0) {
  console.log('失败项:');
  results.details.forEach(d => console.log(`  - ${d}`));
  process.exit(1);
}
process.exit(0);
