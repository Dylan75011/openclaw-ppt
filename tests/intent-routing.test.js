const assert = require('assert');
const { detectTaskIntent } = require('../src/agents/brainAgent');

const scenarios = [
  {
    id: 1,
    userMessage: '你可以帮我找一下车展的图么',
    options: {},
    expectedType: 'image_search',
    expectedLabel: '找图配图',
    expectedTaskRoute: '优先 search_images，返回图片候选，不走案例研究'
  },
  {
    id: 2,
    userMessage: '给这页来几张科技感发布会背景图，偏暗一点',
    options: {},
    expectedType: 'image_search',
    expectedLabel: '找图配图',
    expectedTaskRoute: '优先 search_images，按页面背景图方向找图'
  },
  {
    id: 3,
    userMessage: '帮我搜一下最近汽车品牌快闪活动有什么趋势',
    options: {},
    expectedType: 'research',
    expectedLabel: '信息搜索',
    expectedTaskRoute: '优先 web_search，必要时 web_fetch 深读'
  },
  {
    id: 4,
    userMessage: '找几个新能源车发布会竞品案例，重点看互动装置',
    options: {},
    expectedType: 'research',
    expectedLabel: '信息搜索',
    expectedTaskRoute: '优先 web_search，输出案例/信息而不是图片'
  },
  {
    id: 5,
    userMessage: '把我刚上传的方案文档润色一下，结构别动，语气更高级一点',
    options: {
      documents: [{ id: 'doc_1', name: '方案.docx' }]
    },
    expectedType: 'doc_edit',
    expectedLabel: '文档修改',
    expectedTaskRoute: '优先读取/更新文档，不重走完整 research -> strategy'
  },
  {
    id: 6,
    userMessage: '基于空间里那份提案，帮我补一段开场文案',
    options: {
      workspaceDocs: [{ id: 'doc_space_1', name: '品牌提案', docType: 'document' }]
    },
    expectedType: 'doc_edit',
    expectedLabel: '文档修改',
    expectedTaskRoute: '优先读取空间文档并直接改写'
  },
  {
    id: 7,
    userMessage: '帮我给小米做一个新品发布会方案，想要年轻一点、科技一点',
    options: {},
    expectedType: 'strategy',
    expectedLabel: '方案策划',
    expectedTaskRoute: 'update_brief -> write_todos -> web_search -> run_strategy'
  },
  {
    id: 8,
    userMessage: '这版方向没问题，直接帮我生成 PPT 吧',
    options: {},
    expectedType: 'ppt',
    expectedLabel: 'PPT生成',
    expectedTaskRoute: '确认已有方案后进入 build_ppt'
  }
];

function run() {
  console.log('Intent Routing Verification');
  console.log('===========================');

  const results = scenarios.map((scenario) => {
    const intent = detectTaskIntent(scenario.userMessage, scenario.options);
    const passed = intent.type === scenario.expectedType && intent.label === scenario.expectedLabel;

    assert.strictEqual(intent.type, scenario.expectedType, `Scenario ${scenario.id} type mismatch`);
    assert.strictEqual(intent.label, scenario.expectedLabel, `Scenario ${scenario.id} label mismatch`);

    return {
      ...scenario,
      actualType: intent.type,
      actualLabel: intent.label,
      confidence: intent.confidence,
      passed
    };
  });

  results.forEach((item) => {
    console.log(`\n[Scenario ${item.id}] ${item.userMessage}`);
    console.log(`- Intent: ${item.actualType} / ${item.actualLabel} (confidence ${item.confidence})`);
    console.log(`- Expected route: ${item.expectedTaskRoute}`);
    console.log(`- Verification: ${item.passed ? 'PASS' : 'FAIL'}`);
  });

  console.log(`\nSummary: ${results.filter(item => item.passed).length}/${results.length} passed`);
}

run();
