const assert = require('assert');
const { buildRouteToolSequence } = require('../src/services/routeExecutor');

function run() {
  const docSequence = buildRouteToolSequence(
    {
      primaryRoute: 'doc_revision_pipeline'
    },
    {
      planItems: [{ content: '读取原文', status: 'in_progress' }],
      workspaceDocs: [{ id: 'doc_1', name: '提案', docType: 'document' }]
    }
  );

  assert.strictEqual(docSequence[0].toolName, 'write_todos');
  assert.strictEqual(docSequence[0].autoExecutable, true);
  assert.strictEqual(docSequence[1].toolName, 'read_workspace_doc');
  assert.strictEqual(docSequence[1].autoExecutable, true);

  const imageSequence = buildRouteToolSequence(
    {
      primaryRoute: 'image_search_pipeline'
    },
    {
      planItems: [{ content: '提炼关键词', status: 'in_progress' }],
      workspaceDocs: []
    }
  );

  assert.strictEqual(imageSequence[0].toolName, 'write_todos');
  assert.strictEqual(imageSequence[1].toolName, 'search_images');
  assert.strictEqual(imageSequence[1].autoExecutable, false);

  console.log('✅ route-executor.test passed');
}

run();
