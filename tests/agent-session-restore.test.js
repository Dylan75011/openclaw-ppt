const { spawn } = require('child_process');

const PORT = Number(process.env.TEST_PORT || 3300 + Math.floor(Math.random() * 200));
const BASE_URL = `http://localhost:${PORT}`;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function checkServer() {
  try {
    const res = await fetch(`${BASE_URL}/api/health`);
    if (!res.ok) return false;
    const data = await res.json();
    return !!data?.success;
  } catch {
    return false;
  }
}

async function startServer() {
  const server = spawn('node', ['src/server.js'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(PORT),
      LUNA_MOCK_AGENT_HOLD: '1'
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  server.stdout.on('data', (data) => process.stdout.write(data.toString()));
  server.stderr.on('data', (data) => process.stderr.write(data.toString()));

  for (let i = 0; i < 20; i += 1) {
    if (await checkServer()) return server;
    await wait(300);
  }

  server.kill('SIGTERM');
  throw new Error('测试服务启动失败');
}

function stopServer(server) {
  return new Promise((resolve) => {
    if (!server || server.killed) {
      resolve();
      return;
    }
    server.once('exit', () => resolve());
    server.kill('SIGTERM');
    setTimeout(resolve, 2000);
  });
}

async function postStart({ message, sessionId, restoreSession }) {
  const form = new FormData();
  form.append('message', message);
  form.append('spaceId', 'space_restore_test');
  form.append('apiKeys', JSON.stringify({}));
  if (sessionId) form.append('sessionId', sessionId);
  if (restoreSession) form.append('restoreSession', JSON.stringify(restoreSession));

  const res = await fetch(`${BASE_URL}/api/agent/start`, {
    method: 'POST',
    body: form
  });
  return res.json();
}

async function stopAgent(sessionId) {
  const res = await fetch(`${BASE_URL}/api/agent/${sessionId}/stop`, { method: 'POST' });
  return res.json();
}

async function runTest() {
  let server = await startServer();

  try {
    const first = await postStart({
      message: '第一轮需求，建立上下文'
    });

    if (!first?.success || !first?.sessionId) {
      throw new Error('第一次启动未返回 sessionId');
    }

    await stopAgent(first.sessionId);
    await stopServer(server);
    server = await startServer();

    const restoreSession = {
      messages: [
        { role: 'user', content: '第一轮需求，建立上下文' },
        { role: 'assistant', content: '已记录你的需求背景。' }
      ],
      userInput: {
        topic: '第一轮需求，建立上下文'
      },
      brief: {
        topic: '第一轮需求，建立上下文'
      },
      executionPlan: {
        mode: 'research_only',
        targetType: 'research_summary',
        summary: '先搜集信息，再决定是否扩展任务',
        planItems: [
          { content: '整理问题', status: 'completed' },
          { content: '补充 research', status: 'in_progress' }
        ]
      },
      taskSpec: {
        taskMode: 'research',
        targetArtifact: 'research_summary',
        primaryRoute: 'research_pipeline',
        fallbackRoutes: ['doc_revision_pipeline'],
        allowedTools: ['write_todos', 'web_search']
      },
      planItems: [
        { content: '整理需求与约束', status: 'completed' },
        { content: '补充案例与趋势参考', status: 'in_progress' }
      ]
    };

    const second = await postStart({
      message: '继续补充第二轮需求',
      sessionId: first.sessionId,
      restoreSession
    });

    if (!second?.success) {
      throw new Error(second?.message || '恢复启动失败');
    }
    if (second.sessionId !== first.sessionId) {
      throw new Error(`恢复后的 sessionId 不一致：${second.sessionId} !== ${first.sessionId}`);
    }

    console.log('✅ 服务重启后，/api/agent/start 仍可基于 restoreSession 恢复同一会话');
  } finally {
    await stopServer(server);
  }
}

runTest()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(`❌ agent-session-restore.test 失败: ${error.message}`);
    process.exit(1);
  });
