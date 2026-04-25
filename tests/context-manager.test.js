const assert = require('assert');
const cm = require('../src/services/contextManager');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (e) {
    console.log(`  ❌ ${name}: ${e.message}`);
    failed++;
  }
}

console.log('\n🧪 差异化截断测试');
test('web_search 结果截断到 3000 字符', () => {
  const long = 'x'.repeat(5000);
  const result = cm.truncateToolResult('web_search', long);
  assert(result.length < 3100, `length ${result.length} >= 3100`);
  assert(result.includes('web_search 结果已截断'));
});

test('run_strategy 结果不截断', () => {
  const long = 'x'.repeat(50000);
  assert.strictEqual(cm.truncateToolResult('run_strategy', long), long);
});

test('build_ppt 结果不截断', () => {
  const long = 'x'.repeat(50000);
  assert.strictEqual(cm.truncateToolResult('build_ppt', long), long);
});

test('update_brief 结果不截断', () => {
  const long = 'x'.repeat(50000);
  assert.strictEqual(cm.truncateToolResult('update_brief', long), long);
});

test('短结果不截断', () => {
  assert.strictEqual(cm.truncateToolResult('web_search', 'hello'), 'hello');
});

test('未知工具用默认 1000 截断', () => {
  const long = 'x'.repeat(2000);
  const result = cm.truncateToolResult('unknown_tool', long);
  assert(result.length < 1100);
  assert(result.includes('unknown_tool 结果已截断'));
});

console.log('\n🧪 摘要压缩测试');
test('compressOldMessages 生成摘要而非丢弃', () => {
  const older = [
    { role: 'user', content: '帮我策划一个华为发布会' },
    { role: 'assistant', content: '好的，我来帮你策划', tool_calls: [{ id: 'tc1', function: { name: 'web_search' } }] },
    { role: 'tool', content: '搜索结果...', tool_call_id: 'tc1' },
  ];
  const compressed = cm.compressOldMessages(older);
  assert.strictEqual(compressed.length, 1);
  assert.strictEqual(compressed[0].role, 'system');
  assert(compressed[0].content.includes('历史对话摘要'));
  assert(compressed[0].content.includes('华为发布会'));
  assert(compressed[0].content.includes('web_search'));
});

test('compressOldMessages 空数组返回空', () => {
  assert.deepStrictEqual(cm.compressOldMessages([]), []);
});

test('compressOldMessages 保留用户和助手消息摘要', () => {
  const older = [
    { role: 'user', content: '用户说了一些话' },
    { role: 'assistant', content: '助手回复了一些内容' },
  ];
  const compressed = cm.compressOldMessages(older);
  assert.strictEqual(compressed.length, 1);
  assert(compressed[0].content.includes('用户'));
  assert(compressed[0].content.includes('助手'));
});

console.log('\n🧪 关键状态提取测试');
test('extractKeyState 从 session 提取 brief 和 plan', () => {
  const session = {
    brief: { brand: '华为', eventType: 'product_launch', topic: 'Mate70 发布', goal: '品牌曝光' },
    bestPlan: { planTitle: '华为 Mate70 发布会方案', coreStrategy: '科技感+情感共鸣', highlights: ['沉浸体验', '明星站台', '全网直播'] },
  };
  const state = cm.extractKeyState(session);
  assert(state.includes('华为'));
  assert(state.includes('Mate70'));
  assert(state.includes('科技感'));
});

test('extractKeyState 空 session 返回 null', () => {
  assert.strictEqual(cm.extractKeyState({}), null);
});

test('extractKeyState 只有 brief', () => {
  const session = { brief: { brand: '小米', eventType: 'launch' } };
  const state = cm.extractKeyState(session);
  assert(state.includes('小米'));
  assert(!state.includes('策划方案摘要'));
});

console.log('\n🧪 警戒线提升测试');
test('CONTEXT_TOKEN_WARN 为 30000', () => {
  assert.strictEqual(cm.CONTEXT_TOKEN_WARN, 30000);
});

console.log('\n🧪 isCompactableTool 测试');
test('run_strategy 不可压缩', () => {
  assert.strictEqual(cm.isCompactableTool('run_strategy'), false);
});

test('web_search 可压缩', () => {
  assert.strictEqual(cm.isCompactableTool('web_search'), true);
});

console.log(`\n📊 结果: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
