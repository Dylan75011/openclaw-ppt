/**
 * 方案生成流程接口集成测试
 *
 * 验证范围：
 * 1. POST /api/agent/start  → 返回 sessionId + streamUrl
 * 2. GET  /api/agent/stream/:sessionId → SSE 事件流
 *    - task_intent 事件（意图识别）
 *    - execution_plan 事件（执行计划）
 *    - route_update / plan_update 事件（进度更新）
 *    - doc_ready 事件（方案文档生成完成）
 * 3. 各事件数据结构校验
 *
 * 使用方式：
 *   node tests/strategy-flow.test.js
 *
 * 前置条件：服务已启动（npm start 或 npm run dev:api）
 */

const http  = require('http');
const https = require('https');

const BASE_URL  = process.env.BASE_URL || 'http://localhost:3000';
const TIMEOUT   = parseInt(process.env.TEST_TIMEOUT || '120000', 10); // 2 分钟
const TEST_MSG  = process.env.TEST_MSG  || '帮我策划一场科技品牌新品发布会，品牌是"华为"，目标受众是科技爱好者，预算200万';

// ─── 颜色输出 ──────────────────────────────────────────────────────────────
const c = {
  reset:  '\x1b[0m',
  green:  '\x1b[32m',
  red:    '\x1b[31m',
  yellow: '\x1b[33m',
  cyan:   '\x1b[36m',
  gray:   '\x1b[90m',
  bold:   '\x1b[1m',
};
const ok   = (msg) => console.log(`${c.green}  ✓${c.reset} ${msg}`);
const fail = (msg) => console.log(`${c.red}  ✗${c.reset} ${msg}`);
const info = (msg) => console.log(`${c.cyan}  ℹ${c.reset} ${msg}`);
const warn = (msg) => console.log(`${c.yellow}  ⚠${c.reset} ${msg}`);
const sep  = ()    => console.log(`${c.gray}${'─'.repeat(60)}${c.reset}`);

let passed = 0;
let failed = 0;

function assert(condition, label, detail = '') {
  if (condition) {
    ok(label);
    passed++;
  } else {
    fail(`${label}${detail ? ' — ' + detail : ''}`);
    failed++;
  }
}

// ─── HTTP 工具 ─────────────────────────────────────────────────────────────
function request(url, options = {}, body = null) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const lib    = parsed.protocol === 'https:' ? https : http;
    const req    = lib.request(url, options, (res) => {
      const chunks = [];
      res.on('data', (d) => chunks.push(d));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString();
        try {
          resolve({ status: res.statusCode, headers: res.headers, body: JSON.parse(raw), raw });
        } catch {
          resolve({ status: res.statusCode, headers: res.headers, body: null, raw });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

// ─── SSE 监听 ─────────────────────────────────────────────────────────────
function listenSSE(url, handlers = {}, timeoutMs = TIMEOUT) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const lib    = parsed.protocol === 'https:' ? https : http;

    const timer = setTimeout(() => {
      req.destroy();
      resolve({ timedOut: true, events: collected });
    }, timeoutMs);

    const collected = [];

    const req = lib.request(url, { method: 'GET', headers: { Accept: 'text/event-stream' } }, (res) => {
      let buf = '';

      res.on('data', (chunk) => {
        buf += chunk.toString();
        const lines = buf.split('\n');
        buf = lines.pop(); // 保留未完成行

        let eventName = null;
        let dataLine  = null;

        for (const line of lines) {
          if (line.startsWith('event:')) {
            eventName = line.slice(6).trim();
          } else if (line.startsWith('data:')) {
            dataLine = line.slice(5).trim();
          } else if (line === '') {
            if (eventName && dataLine !== null) {
              let parsed;
              try { parsed = JSON.parse(dataLine); } catch { parsed = dataLine; }
              const ev = { name: eventName, data: parsed };
              collected.push(ev);

              // 打印事件摘要
              const summary = typeof parsed === 'object'
                ? JSON.stringify(parsed).slice(0, 120)
                : String(dataLine).slice(0, 120);
              console.log(`${c.gray}    [SSE] ${eventName}: ${summary}${c.reset}`);

              // 调用处理器
              if (handlers[eventName]) handlers[eventName](parsed, ev);
              if (handlers['*']) handlers['*'](eventName, parsed);

              // 检查终止条件
              if (eventName === 'done' || (handlers._stopOn && handlers._stopOn(eventName, parsed))) {
                clearTimeout(timer);
                req.destroy();
                resolve({ timedOut: false, events: collected });
              }
            }
            eventName = null;
            dataLine  = null;
          }
        }
      });

      res.on('end', () => {
        clearTimeout(timer);
        resolve({ timedOut: false, events: collected });
      });

      res.on('error', (e) => {
        clearTimeout(timer);
        reject(e);
      });
    });

    req.on('error', (e) => {
      clearTimeout(timer);
      // 连接被主动断开是正常的
      if (e.code === 'ECONNRESET' || e.code === 'ECONNABORTED') {
        resolve({ timedOut: false, events: collected });
      } else {
        reject(e);
      }
    });

    req.end();
  });
}

// ─── 测试主体 ─────────────────────────────────────────────────────────────
async function run() {
  console.log(`\n${c.bold}━━━ 方案生成流程接口测试 ━━━${c.reset}`);
  console.log(`${c.cyan}目标服务${c.reset}: ${BASE_URL}`);
  console.log(`${c.cyan}测试消息${c.reset}: ${TEST_MSG.slice(0, 40)}...`);
  console.log(`${c.cyan}超时时间${c.reset}: ${TIMEOUT / 1000}s\n`);

  // ── Step 0: 健康检查 ─────────────────────────────────────────────────────
  sep();
  console.log(`${c.bold}Step 0 — 服务健康检查${c.reset}`);
  let health;
  try {
    health = await request(`${BASE_URL}/api/health`);
    assert(health.status === 200, 'GET /api/health 返回 200');
    assert(health.body && health.body.status === 'ok', 'body.status === "ok"', JSON.stringify(health.body));
    info(`服务版本: ${health.body?.version || '未知'}`);
  } catch (e) {
    fail(`无法连接服务 — ${e.message}`);
    fail('请先启动服务: npm start');
    process.exit(1);
  }

  // ── Step 1: 启动 Agent 会话 ───────────────────────────────────────────────
  sep();
  console.log(`${c.bold}Step 1 — POST /api/agent/start${c.reset}`);

  const startPayload = JSON.stringify({
    message: TEST_MSG,
    spaceId: '',
    apiKeys: {}  // 使用服务端环境变量里的 Key
  });

  let sessionId, streamUrl;
  try {
    const res = await request(
      `${BASE_URL}/api/agent/start`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(startPayload)
        }
      },
      startPayload
    );

    assert(res.status === 200, `响应状态 200`, `实际: ${res.status}`);
    assert(res.body?.success === true, 'body.success === true');
    assert(typeof res.body?.sessionId === 'string' && res.body.sessionId.length > 0, 'body.sessionId 非空字符串');
    assert(typeof res.body?.streamUrl === 'string' && res.body.streamUrl.length > 0, 'body.streamUrl 非空字符串');

    sessionId = res.body?.sessionId;
    streamUrl = res.body?.streamUrl;

    info(`sessionId: ${sessionId}`);
    info(`streamUrl: ${streamUrl}`);
  } catch (e) {
    fail(`请求失败 — ${e.message}`);
    process.exit(1);
  }

  // ── Step 2: 监听 SSE 流，验证事件 ─────────────────────────────────────────
  sep();
  console.log(`${c.bold}Step 2 — GET /api/agent/stream/:sessionId (SSE)${c.reset}`);
  info(`开始监听，最长等待 ${TIMEOUT / 1000}s...`);

  const seen = {
    task_intent:    false,
    execution_plan: false,
    plan_update:    false,
    route_update:   false,
    doc_ready:      false,
    doc_section_added: false,
    error:          false,
  };

  let taskIntentData    = null;
  let executionPlanData = null;
  let docReadyData      = null;
  let firstPlanUpdate   = null;

  const fullStreamUrl = streamUrl.startsWith('http') ? streamUrl : `${BASE_URL}${streamUrl}`;

  const { timedOut, events } = await listenSSE(
    fullStreamUrl,
    {
      task_intent(data) {
        seen.task_intent = true;
        taskIntentData = data;
      },
      execution_plan(data) {
        seen.execution_plan = true;
        executionPlanData = data;
      },
      plan_update(data) {
        if (!firstPlanUpdate) firstPlanUpdate = data;
        seen.plan_update = true;
      },
      route_update(data) {
        seen.route_update = true;
      },
      doc_ready(data) {
        seen.doc_ready = true;
        docReadyData = data;
      },
      doc_section_added(data) {
        seen.doc_section_added = true;
      },
      error(data) {
        seen.error = true;
        warn(`收到 error 事件: ${JSON.stringify(data).slice(0, 200)}`);
      },
      _stopOn(name) {
        // doc_ready 出现即可停止，不必等 done
        return name === 'doc_ready' || name === 'done';
      }
    },
    TIMEOUT
  );

  if (timedOut) {
    warn(`SSE 监听超时 (${TIMEOUT / 1000}s)，已收到 ${events.length} 个事件`);
  } else {
    info(`SSE 监听结束，共收到 ${events.length} 个事件`);
  }

  // ── Step 3: 事件完整性验证 ────────────────────────────────────────────────
  sep();
  console.log(`${c.bold}Step 3 — 事件完整性校验${c.reset}`);

  assert(!seen.error, '流程无 error 事件');
  assert(seen.task_intent, '收到 task_intent 事件');
  assert(seen.execution_plan || seen.route_update, '收到 execution_plan 或 route_update 事件');
  assert(seen.plan_update || seen.route_update, '收到进度更新事件 (plan_update/route_update)');
  assert(seen.doc_ready || seen.doc_section_added, '收到文档生成事件 (doc_ready/doc_section_added)');

  // ── Step 4: task_intent 数据结构验证 ──────────────────────────────────────
  sep();
  console.log(`${c.bold}Step 4 — task_intent 数据结构${c.reset}`);

  if (taskIntentData) {
    assert(typeof taskIntentData.type === 'string',  'intent.type 是字符串');
    assert(typeof taskIntentData.label === 'string', 'intent.label 是字符串');
    assert(['strategy', 'doc_edit', 'ppt', 'image_search', 'research', 'chat'].includes(taskIntentData.type),
      `intent.type 值合法: "${taskIntentData.type}"`);
    info(`识别意图: ${taskIntentData.type} (${taskIntentData.label})`);
    if (taskIntentData.type !== 'strategy') {
      warn(`期望 strategy 意图，实际是 "${taskIntentData.type}"（可能 LLM 分类不同）`);
    }
  } else {
    warn('未收到 task_intent 事件，跳过数据结构验证');
  }

  // ── Step 5: execution_plan 数据结构验证 ────────────────────────────────────
  sep();
  console.log(`${c.bold}Step 5 — execution_plan 数据结构${c.reset}`);

  if (executionPlanData) {
    const steps = executionPlanData.steps || executionPlanData;
    assert(Array.isArray(steps) || typeof executionPlanData === 'object', 'execution_plan 是对象/数组');
    info(`执行计划: ${JSON.stringify(executionPlanData).slice(0, 200)}`);
  } else {
    warn('未收到 execution_plan 事件，跳过数据结构验证');
  }

  // ── Step 6: doc_ready 数据结构验证 ────────────────────────────────────────
  sep();
  console.log(`${c.bold}Step 6 — doc_ready 数据结构${c.reset}`);

  if (docReadyData) {
    assert(typeof docReadyData === 'object', 'doc_ready.data 是对象');

    // docId 或 id
    const docId = docReadyData.docId || docReadyData.id;
    assert(typeof docId === 'string' && docId.length > 0, 'doc_ready 包含 docId');
    info(`生成文档 ID: ${docId}`);

    // 有内容
    const hasContent = docReadyData.html || docReadyData.content || docReadyData.tiptapJson;
    assert(!!hasContent, 'doc_ready 包含文档内容 (html/content/tiptapJson)');

    // plan 结构
    if (docReadyData.plan) {
      const plan = docReadyData.plan;
      assert(typeof plan.planTitle === 'string' && plan.planTitle.length > 0, 'plan.planTitle 非空');
      assert(typeof plan.coreStrategy === 'string' && plan.coreStrategy.length > 0, 'plan.coreStrategy 非空');
      assert(Array.isArray(plan.sections) && plan.sections.length > 0, 'plan.sections 非空数组');

      if (plan.sections?.length) {
        const s = plan.sections[0];
        assert(typeof s.title === 'string', 'section[0].title 是字符串');
        assert(Array.isArray(s.keyPoints) || typeof s.narrative === 'string', 'section[0] 有 keyPoints 或 narrative');
      }

      if (plan.budget) {
        assert(typeof plan.budget.total === 'string' || typeof plan.budget.total === 'number', 'plan.budget.total 存在');
        assert(Array.isArray(plan.budget.breakdown), 'plan.budget.breakdown 是数组');
      } else {
        warn('plan.budget 不存在');
      }

      if (plan.kpis) {
        assert(Array.isArray(plan.kpis) && plan.kpis.length > 0, 'plan.kpis 非空数组');
      } else {
        warn('plan.kpis 不存在');
      }

      info(`方案标题: ${plan.planTitle}`);
      info(`核心策略: ${String(plan.coreStrategy).slice(0, 60)}...`);
      info(`章节数量: ${plan.sections?.length}`);
    } else {
      warn('doc_ready 不含 plan 结构，跳过方案字段验证');
    }
  } else {
    warn('未收到 doc_ready 事件（可能还在生成中或事件名不同）');
  }

  // ── Step 7: 检查 session 状态接口（可选）─────────────────────────────────
  sep();
  console.log(`${c.bold}Step 7 — 会话状态查询${c.reset}`);
  try {
    const statusRes = await request(`${BASE_URL}/api/agent/${sessionId}/status`);
    if (statusRes.status === 200) {
      assert(statusRes.body?.success !== false, '会话状态接口返回成功');
      info(`会话状态: ${JSON.stringify(statusRes.body).slice(0, 150)}`);
    } else {
      warn(`状态接口返回 ${statusRes.status}（接口可能不存在，忽略）`);
    }
  } catch {
    warn('状态接口不可用，忽略');
  }

  // ── 汇总 ─────────────────────────────────────────────────────────────────
  sep();
  const total = passed + failed;
  const color = failed > 0 ? c.red : c.green;
  console.log(`\n${c.bold}测试结果: ${color}${passed}/${total} 通过${c.reset}  (失败: ${failed})\n`);

  // 打印事件覆盖摘要
  console.log(`${c.bold}事件覆盖情况:${c.reset}`);
  for (const [ev, hit] of Object.entries(seen)) {
    if (ev === 'error') continue;
    console.log(`  ${hit ? c.green + '●' : c.gray + '○'}${c.reset} ${ev}`);
  }
  console.log();

  if (failed > 0) process.exit(1);
}

run().catch((e) => {
  console.error(`\n${c.red}测试运行异常:${c.reset}`, e);
  process.exit(1);
});
