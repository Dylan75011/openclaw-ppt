const assert = require('assert');

const { extractJson } = require('../src/utils/llmUtils');
const {
  normalizeOrchestratorResult,
  normalizeStrategizeResult,
  normalizeCritiqueResult,
  StructuredOutputValidationError
} = require('../src/utils/structuredOutput');

function testExtractJsonFromFencedBlock() {
  const parsed = extractJson('```json\n{"ok":true,"items":[1,2,3],}\n```');
  assert.deepStrictEqual(parsed, { ok: true, items: [1, 2, 3] });
}

function testNormalizeOrchestratorResult() {
  const value = normalizeOrchestratorResult({
    parsedGoal: '提升车展声量',
    keyThemes: ['新能源', '家庭出行'],
    targetAudience: '城市家庭用户',
    searchTasks: [
      { id: 'r1', focus: '行业趋势', keywords: ['新能源', '车展'] },
      { id: 'r2', focus: '品牌案例', keywords: ['岚图', '发布会'] },
      { id: 'r3', focus: '互动玩法', keywords: ['互动装置'] }
    ],
    pptStructureHint: '8-10页'
  });
  assert.strictEqual(value.searchTasks.length, 3);
  assert.strictEqual(value.parsedGoal, '提升车展声量');
}

function testNormalizeStrategizeResult() {
  const value = normalizeStrategizeResult({
    planTitle: '岚图车展传播方案',
    coreStrategy: '用技术可感知化建立信任。',
    highlights: ['高势能首秀'],
    sections: [
      { title: '核心判断', keyPoints: ['技术要被看见'], narrative: '围绕可感知科技建立叙事。' }
    ],
    budget: { total: '300万', breakdown: [{ item: '舞美', amount: '120万', percentage: '40%', rationale: '主视觉承载传播' }] },
    timeline: { eventDate: '待定', phases: [{ phase: '预热', duration: '2周', milestone: '释出预告' }] },
    kpis: [{ metric: '曝光', target: '1亿', rationale: '匹配车展节点' }],
    riskMitigation: ['现场拥堵-分流导视'],
    visualTheme: { style: '未来科技', colorMood: '深蓝银色', imageKeywords: ['futuristic auto show'] },
    visualExecutionHints: {
      sceneTone: '高级、锋利、可传播',
      mustRenderScenes: ['主舞台'],
      spatialKeywords: ['immersive stage'],
      avoidElements: ['廉价灯带'],
      onsiteDesignSuggestions: [
        {
          scene: '主舞台',
          goal: '建立品牌势能',
          designSuggestion: '用大跨度弧幕与透光材质制造科技感。',
          visualFocus: ['弧幕', '灯光']
        }
      ]
    }
  });
  assert.strictEqual(value.sections[0].title, '核心判断');
  assert.strictEqual(value.visualTheme.style, '未来科技');
}

function testNormalizeCritiqueResult() {
  const value = normalizeCritiqueResult({
    score: '8.6',
    strengths: ['定位清晰'],
    weaknesses: ['预算略粗'],
    specificFeedback: '补充分项预算。'
  });
  assert.strictEqual(value.score, 8.6);
}

function testStructuredValidationError() {
  assert.throws(
    () => normalizeOrchestratorResult({ parsedGoal: '', keyThemes: [], searchTasks: [] }),
    StructuredOutputValidationError
  );
}

function run() {
  testExtractJsonFromFencedBlock();
  testNormalizeOrchestratorResult();
  testNormalizeStrategizeResult();
  testNormalizeCritiqueResult();
  testStructuredValidationError();
  console.log('structured-output tests passed');
}

run();
