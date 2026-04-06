const assert = require('assert');
const { createExecutionPlan, createTaskSpec, checkToolAgainstTaskSpec } = require('../src/services/taskPlanner');

const scenarios = [
  {
    id: 'image-only',
    input: {
      text: '帮我找几张科技感汽车发布会背景图',
      intent: { type: 'image_search' },
      session: {}
    },
    expected: {
      mode: 'image_search_only',
      targetType: 'image_refs'
    }
  },
  {
    id: 'doc-edit',
    input: {
      text: '基于空间里那份提案，帮我补一段开场文案',
      intent: { type: 'doc_edit' },
      session: {},
      workspaceDocs: [{ id: 'doc_1', name: '品牌提案', docType: 'document' }]
    },
    expected: {
      mode: 'update_existing_workspace_doc',
      targetType: 'document'
    }
  },
  {
    id: 'strategy-from-doc',
    input: {
      text: '参考这份方案文档，帮我整理一版更完整的活动策划',
      intent: { type: 'strategy' },
      session: {},
      documents: [{ id: 'up_1', name: '活动方案.docx' }]
    },
    expected: {
      mode: 'strategy_from_existing_material',
      targetType: 'strategy_doc'
    }
  },
  {
    id: 'ppt-from-existing',
    input: {
      text: '按这份文档直接生成 PPT',
      intent: { type: 'ppt' },
      session: {},
      documents: [{ id: 'up_1', name: '活动方案.docx' }]
    },
    expected: {
      mode: 'ppt_from_existing_material',
      targetType: 'ppt'
    }
  },
  {
    id: 'ppt-optimize-existing',
    input: {
      text: '把空间里现有的 PPT 优化一下，压缩到 12 页',
      intent: { type: 'ppt' },
      session: {},
      workspaceDocs: [{ id: 'ppt_1', name: '年度汇报', docType: 'ppt' }]
    },
    expected: {
      mode: 'optimize_existing_ppt',
      targetType: 'ppt_revision'
    }
  }
];

function run() {
  scenarios.forEach((scenario) => {
    const result = createExecutionPlan(scenario.input);
    assert.strictEqual(result.mode, scenario.expected.mode, `${scenario.id} mode mismatch`);
    assert.strictEqual(result.targetType, scenario.expected.targetType, `${scenario.id} targetType mismatch`);
    assert.ok(Array.isArray(result.planItems), `${scenario.id} missing planItems`);
    const taskSpec = createTaskSpec(result);
    assert.ok(taskSpec?.primaryRoute, `${scenario.id} missing primaryRoute`);
    if (scenario.id === 'doc-edit') {
      const guard = checkToolAgainstTaskSpec(taskSpec, 'run_strategy');
      assert.strictEqual(guard.allowed, false, 'doc-edit should block run_strategy');
    }
  });

  console.log(`✅ task-planner.test passed (${scenarios.length} scenarios)`);
}

run();
