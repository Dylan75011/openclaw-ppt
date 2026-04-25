#!/usr/bin/env node
/**
 * Intent classifier eval runner.
 *
 * 用法:
 *   MINIMAX_API_KEY=sk-xxx node scripts/eval-intent.js
 *   MINIMAX_API_KEY=sk-xxx node scripts/eval-intent.js --runs 3   # self-consistency
 *
 * 跑真实 minimax LLM，对 ADVERSARIAL_CASES 做回归。
 * 这是第 3 条"对抗用例只是文档没在跑"的修复。
 */

const path = require('path');
process.env.NODE_PATH = path.join(__dirname, '..', 'node_modules');
require('module').Module._initPaths();

const { detectTaskIntent } = require('../src/agents/brainAgent');

// 与 tests/intent-routing.test.js 保持同步。后续可以抽到共享文件。
const CASES = [
  {
    id: 'strategy-from-requirements',
    text: '基于空间里那份需求文档，帮我生成一版活动策划方案',
    workspaceDocs: [{ name: '需求.docx', docType: 'document', role: 'requirements', text: '品牌想在 618 办一场亲子活动...' }],
    expectedType: 'strategy'
  },
  {
    id: 'ppt-from-plan',
    text: '基于这份方案直接生成 PPT 吧',
    documents: [{ name: '活动方案.docx', text: '核心策略：打造沉浸式快闪...' }],
    expectedType: 'ppt'
  },
  {
    id: 'doc-edit-polish',
    text: '把这份再润色一下，语气高级点',
    documents: [{ name: '提案.docx', role: 'draft', text: '初稿内容...' }],
    expectedType: 'doc_edit'
  },
  {
    id: 'ambiguous-help',
    text: '帮我搞一下',
    expectedType: 'chat',
    expectedNeedsClarification: true
  },
  {
    id: 'continuation-strategy',
    text: '继续',
    priorIntentType: 'strategy',
    expectedType: 'strategy'
  },
  {
    id: 'image-search',
    text: '帮我找几张科技感发布会背景图',
    expectedType: 'image_search'
  },
  {
    id: 'image-generate',
    text: '帮我用 AI 重新画一张主视觉',
    expectedType: 'image_generate'
  }
];

function parseArgs() {
  const args = process.argv.slice(2);
  const out = { runs: 1 };
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === '--runs' && args[i + 1]) {
      out.runs = parseInt(args[i + 1], 10) || 1;
      i += 1;
    }
  }
  return out;
}

function makeSession(c) {
  return {
    apiKeys: { minimaxApiKey: process.env.MINIMAX_API_KEY || '' },
    messages: [],
    taskIntent: c.priorIntentType ? { type: c.priorIntentType, label: c.priorIntentType } : null
  };
}

async function runCase(c, runs) {
  const results = [];
  for (let i = 0; i < runs; i += 1) {
    const intent = await detectTaskIntent(c.text, {
      documents: c.documents || [],
      workspaceDocs: c.workspaceDocs || [],
      attachments: [],
      session: makeSession(c)
    });
    results.push(intent);
  }
  return results;
}

function majority(values) {
  const counts = new Map();
  values.forEach((v) => counts.set(v, (counts.get(v) || 0) + 1));
  let best = null;
  let bestN = -1;
  for (const [k, n] of counts.entries()) {
    if (n > bestN) { best = k; bestN = n; }
  }
  return { value: best, agreement: bestN / values.length };
}

(async () => {
  if (!process.env.MINIMAX_API_KEY) {
    console.error('ERROR: 需要 MINIMAX_API_KEY 环境变量');
    process.exit(2);
  }
  const { runs } = parseArgs();
  console.log(`Running ${CASES.length} cases × ${runs} run(s) against real LLM\n`);

  let passed = 0;
  const rows = [];

  for (const c of CASES) {
    try {
      const results = await runCase(c, runs);
      const types = results.map((r) => r.type);
      const m = majority(types);
      const confs = results.map((r) => Number(r.confidence) || 0);
      const avgConf = confs.reduce((a, b) => a + b, 0) / confs.length;

      let ok = m.value === c.expectedType;
      if (c.expectedNeedsClarification) {
        ok = results.every((r) => r.needsClarification === true);
      }
      if (ok) passed += 1;

      rows.push({
        id: c.id,
        expected: c.expectedType + (c.expectedNeedsClarification ? ' (clarify)' : ''),
        got: m.value + (m.agreement < 1 ? ` (${(m.agreement * 100).toFixed(0)}%)` : ''),
        conf: avgConf.toFixed(2),
        result: ok ? 'PASS' : 'FAIL',
        reason: results[0]?.reason || ''
      });
    } catch (err) {
      rows.push({ id: c.id, expected: c.expectedType, got: 'ERROR', conf: '-', result: 'FAIL', reason: err.message });
    }
  }

  const colW = { id: 28, expected: 22, got: 22, conf: 6, result: 6 };
  const header = `${'id'.padEnd(colW.id)}${'expected'.padEnd(colW.expected)}${'got'.padEnd(colW.got)}${'conf'.padEnd(colW.conf)}${'result'.padEnd(colW.result)}reason`;
  console.log(header);
  console.log('-'.repeat(header.length + 20));
  for (const r of rows) {
    console.log(
      r.id.padEnd(colW.id) +
      r.expected.padEnd(colW.expected) +
      r.got.padEnd(colW.got) +
      r.conf.padEnd(colW.conf) +
      r.result.padEnd(colW.result) +
      r.reason
    );
  }
  console.log(`\n${passed}/${CASES.length} passed`);
  process.exit(passed === CASES.length ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
