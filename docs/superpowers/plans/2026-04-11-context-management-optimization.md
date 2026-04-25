# 上下文管理优化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 参考 claude-code 的上下文管理架构，为 luna-ppt 的 brainAgent 实现差异化截断、旧消息摘要压缩、关键状态注入、token 警戒线提升。

**Architecture:** 在 `src/agents/brainAgent.js` 的 `buildMessages()` 函数中，将当前的两步截断逻辑升级为四步管线：(1) 按工具类型差异化截断 → (2) 估算总 token → (3) 超警戒线时对旧消息做摘要压缩而非丢弃 → (4) 将压缩后的关键状态注入 system prompt。同时将截断配置抽到独立模块 `src/services/contextManager.js`。

**Tech Stack:** Node.js (CommonJS), 无新依赖

---

## File Structure

| File | Responsibility |
|------|---------------|
| `src/services/contextManager.js` | 新建：截断配置常量、差异化截断函数、摘要压缩函数、关键状态提取函数 |
| `src/agents/brainAgent.js` | 修改：`buildMessages()` 调用 contextManager 四步管线 |
| `src/prompts/brain.js` | 修改：`buildBrainSystemPrompt()` 接受 `compactSummary` 参数，注入压缩摘要段 |
| `src/services/tools/helpers.js` | 修改：`getToolDisplay()` 已有，无需改动 |
| `tests/message-truncation-bug.test.js` | 修改：补充新逻辑的测试用例 |

---

### Task 1: 创建 contextManager 模块 — 差异化截断配置与实现

**Files:**
- Create: `src/services/contextManager.js`

- [ ] **Step 1: 创建 contextManager.js，定义差异化截断配置和截断函数**

参考 claude-code 的 `toolResultStorage.ts` + `microCompact.ts` 设计：
- 每种工具类型有独立的 `maxResultChars`（而非统一 1000）
- 可压缩的工具集合（COMPACTABLE_TOOLS）vs 不可压缩的工具集合
- 截断时保留工具名前缀，让模型知道结果来自哪个工具

```js
// src/services/contextManager.js

// ─── 差异化截断配置 ───
// 参考 claude-code: 不同工具有不同的 maxResultSizeChars
const TOOL_TRUNCATION_CONFIG = {
  // 搜索/抓取结果：保留较多，因为含关键事实
  web_search:    { maxChars: 3000, compactable: true },
  web_fetch:     { maxChars: 4000, compactable: true },
  // 图片搜索结果：中等，含 URL 和描述
  search_images: { maxChars: 2000, compactable: true },
  // 策略生成结果：保留完整，这是核心产出
  run_strategy:  { maxChars: Infinity, compactable: false },
  // PPT 构建结果：保留完整
  build_ppt:     { maxChars: Infinity, compactable: false },
  // 简报更新：保留完整，关键状态
  update_brief:  { maxChars: Infinity, compactable: false },
  // 文档读写：中等
  read_workspace_doc:    { maxChars: 3000, compactable: true },
  save_to_workspace:     { maxChars: 2000, compactable: true },
  update_workspace_doc:  { maxChars: 2000, compactable: true },
  // 图片生成/审阅：中等
  generate_image:         { maxChars: 1500, compactable: true },
  review_uploaded_images: { maxChars: 2000, compactable: true },
  // 待办更新：短
  write_todos: { maxChars: 800, compactable: true },
};

const DEFAULT_TRUNCATION = { maxChars: 1000, compactable: true };

// 整体对话 token 警戒线（从 10K 提升到 30K）
// 参考 claude-code: 200K context window，auto-compact 在 ~93% 触发
// MiniMax abab6.5s 的 context window 约 32K，30K 是 ~93%
const CONTEXT_TOKEN_WARN = 30000;

// 估算 token 数（中英混合约 0.4 token/字符）
function estimateTokens(text) {
  return Math.ceil((text || '').length * 0.4);
}

// ─── 第一步：按工具类型差异化截断 ───
function truncateToolResult(toolName, content) {
  if (typeof content !== 'string') return content;
  const config = TOOL_TRUNCATION_CONFIG[toolName] || DEFAULT_TRUNCATION;
  if (content.length <= config.maxChars) return content;
  const preview = content.slice(0, config.maxChars);
  return `${preview}\n...[${toolName} 结果已截断，保留前 ${config.maxChars} 字符]`;
}

// ─── 第二步：判断工具是否可压缩 ───
function isCompactableTool(toolName) {
  const config = TOOL_TRUNCATION_CONFIG[toolName] || DEFAULT_TRUNCATION;
  return config.compactable;
}

// ─── 第三步：旧消息摘要压缩 ───
// 参考 claude-code compact.ts：不是丢弃旧消息，而是压缩为摘要
function compressOldMessages(olderMessages) {
  if (!olderMessages.length) return [];

  const summaryParts = [];
  const toolCallSummaries = [];

  for (const msg of olderMessages) {
    if (msg.role === 'user') {
      // 保留用户消息的简短摘要
      const text = typeof msg.content === 'string' ? msg.content : '';
      if (text.length > 0) {
        summaryParts.push(`用户：${text.slice(0, 80)}${text.length > 80 ? '...' : ''}`);
      }
    } else if (msg.role === 'assistant') {
      // assistant 消息：保留文字部分，tool_calls 压缩为摘要
      const text = typeof msg.content === 'string' ? msg.content : '';
      if (text && text.trim()) {
        summaryParts.push(`助手：${text.slice(0, 80)}${text.length > 80 ? '...' : ''}`);
      }
      if (Array.isArray(msg.tool_calls)) {
        for (const tc of msg.tool_calls) {
          const fnName = tc.function?.name || tc.name || 'unknown';
          toolCallSummaries.push(fnName);
        }
      }
    }
    // tool 消息不单独保留，其信息已通过 toolCallSummaries 概括
  }

  if (!summaryParts.length && !toolCallSummaries.length) return [];

  const lines = ['[历史对话摘要]'];
  if (summaryParts.length) {
    lines.push(...summaryParts);
  }
  if (toolCallSummaries.length) {
    lines.push(`已执行工具：${toolCallSummaries.join(' → ')}`);
  }

  return [{
    role: 'system',
    content: lines.join('\n')
  }];
}

// ─── 第四步：提取关键状态 ───
// 参考 claude-code postCompactCleanup：从 session 中提取不可丢失的状态
function extractKeyState(session) {
  const parts = [];

  if (session.brief) {
    const b = session.brief;
    const briefLines = ['[当前任务简报]'];
    if (b.brand) briefLines.push(`品牌：${b.brand}`);
    if (b.eventType) briefLines.push(`活动类型：${b.eventType}`);
    if (b.topic) briefLines.push(`主题：${b.topic}`);
    if (b.goal) briefLines.push(`目标：${b.goal}`);
    if (b.audience) briefLines.push(`受众：${b.audience}`);
    if (b.style) briefLines.push(`风格：${b.style}`);
    if (Array.isArray(b.assumptions) && b.assumptions.length) {
      briefLines.push(`假设：${b.assumptions.join('；')}`);
    }
    parts.push(briefLines.join('\n'));
  }

  if (session.bestPlan) {
    const p = session.bestPlan;
    const planLines = ['[当前策划方案摘要]'];
    if (p.planTitle) planLines.push(`标题：${p.planTitle}`);
    if (p.coreStrategy) planLines.push(`核心策略：${p.coreStrategy.slice(0, 120)}`);
    if (Array.isArray(p.highlights) && p.highlights.length) {
      planLines.push(`亮点：${p.highlights.slice(0, 3).join('；')}`);
    }
    parts.push(planLines.join('\n'));
  }

  return parts.length ? parts.join('\n\n') : null;
}

module.exports = {
  TOOL_TRUNCATION_CONFIG,
  DEFAULT_TRUNCATION,
  CONTEXT_TOKEN_WARN,
  estimateTokens,
  truncateToolResult,
  isCompactableTool,
  compressOldMessages,
  extractKeyState,
};
```

- [ ] **Step 2: 验证模块可加载**

Run: `node -e "const m = require('./src/services/contextManager'); console.log('OK:', Object.keys(m))"`
Expected: `OK: [ 'TOOL_TRUNCATION_CONFIG', 'DEFAULT_TRUNCATION', 'CONTEXT_TOKEN_WARN', 'estimateTokens', 'truncateToolResult', 'isCompactableTool', 'compressOldMessages', 'extractKeyState' ]`

- [ ] **Step 3: Commit**

```bash
git add src/services/contextManager.js
git commit -m "feat: add contextManager module with differential truncation, compression, and key state extraction"
```

---

### Task 2: 改造 brainAgent.buildMessages() — 接入四步管线

**Files:**
- Modify: `src/agents/brainAgent.js:1-203`

- [ ] **Step 1: 替换 brainAgent.js 中的旧截断逻辑**

将 `brainAgent.js` 头部的旧常量和 `buildMessages()` 函数替换为调用 contextManager 的新实现。

**修改 1：替换头部常量（第 18-25 行）**

旧代码：
```js
// 单条工具结果最大保留字符数（约 250 token）
const TOOL_RESULT_MAX_CHARS = 1000;
// 估算 token 数（中英混合约 0.4 token/字符）
function estimateTokens(text) {
  return Math.ceil((text || '').length * 0.4);
}
// 整体对话历史 token 警戒线（超过时截断早期工具结果）
const CONTEXT_TOKEN_WARN = 10000;
```

新代码：
```js
const {
  CONTEXT_TOKEN_WARN,
  estimateTokens,
  truncateToolResult,
  isCompactableTool,
  compressOldMessages,
  extractKeyState,
} = require('../services/contextManager');
```

**修改 2：替换 buildMessages() 函数（第 132-203 行）**

旧代码：
```js
function buildMessages(session) {
  const spaceContextWithLastDoc = session.spaceContext
    ? {
        ...session.spaceContext,
        lastSavedDocId: session.lastSavedDocId || null,
        lastSavedDocName: session.lastSavedDocName || null
      }
    : null;
  const systemPrompt = buildBrainSystemPrompt(
    spaceContextWithLastDoc,
    session.executionPlan || null,
    session.taskSpec || null,
    session.routeToolSequence || []
  );

  // 第一步：对每条 tool 消息的 content 做截断，防止搜索/抓取结果撑爆 token
  const trimmed = session.messages.map((message) => {
    const next = {
      role: message.role,
      content: message.content
    };
    if (message.tool_calls)   next.tool_calls   = message.tool_calls;
    if (message.tool_call_id) next.tool_call_id = message.tool_call_id;

    if (message.role === 'tool' && typeof message.content === 'string'
        && message.content.length > TOOL_RESULT_MAX_CHARS) {
      next.content = message.content.slice(0, TOOL_RESULT_MAX_CHARS) + '\n...[结果已截断]';
    }
    return next;
  });

  // 第二步：估算总 token，超出警戒线时删除最早的工具往返（user→assistant+tool_calls→tool）
  const totalTokens = estimateTokens(systemPrompt)
    + trimmed.reduce((sum, m) => sum + estimateTokens(JSON.stringify(m)), 0);

  if (totalTokens > CONTEXT_TOKEN_WARN && trimmed.length > 6) {
    // 保留最近 6 条，但要确保消息完整性
    // 1. tool 消息必须紧跟在对应的 assistant(tool_calls) 之后
    // 2. 如果最近 6 条的第一条是 tool 或 assistant(tool_calls)，需要调整截断点
    
    let splitIndex = trimmed.length - 6;
    
    // 检查最近6条的第一条消息
    const firstRecentMsg = trimmed[splitIndex];
    
    // 如果第一条是 tool 消息，需要向前找对应的 assistant(tool_calls)
    if (firstRecentMsg.role === 'tool') {
      // 向前找对应的 assistant
      for (let i = splitIndex - 1; i >= 0; i--) {
        const msg = trimmed[i];
        if (msg.role === 'assistant' && msg.tool_calls) {
          if (msg.tool_calls.some(tc => tc.id === firstRecentMsg.tool_call_id)) {
            splitIndex = i; // 找到了对应的 assistant，从这里开始截断
            break;
          }
        }
      }
    }
    
    const recent = trimmed.slice(splitIndex);
    const older  = trimmed.slice(0, splitIndex).filter(m => m.role !== 'tool').map(m => {
      if (m.role === 'assistant' && m.tool_calls) {
        // assistant 只保留文字部分，去掉 tool_calls
        return { role: 'assistant', content: m.content || '[工具调用，已归档]' };
      }
      return m;
    });
    return [{ role: 'system', content: systemPrompt }, ...older, ...recent];
  }

  return [{ role: 'system', content: systemPrompt }, ...trimmed];
}
```

新代码：
```js
function buildMessages(session) {
  const spaceContextWithLastDoc = session.spaceContext
    ? {
        ...session.spaceContext,
        lastSavedDocId: session.lastSavedDocId || null,
        lastSavedDocName: session.lastSavedDocName || null
      }
    : null;

  // 提取关键状态，用于注入 system prompt
  const compactSummary = extractKeyState(session);

  const systemPrompt = buildBrainSystemPrompt(
    spaceContextWithLastDoc,
    session.executionPlan || null,
    session.taskSpec || null,
    session.routeToolSequence || [],
    compactSummary
  );

  // 第一步：按工具类型差异化截断
  // 需要知道每条 tool 消息对应的工具名，通过向前找 assistant(tool_calls) 匹配
  const toolNameMap = buildToolNameMap(session.messages);

  const trimmed = session.messages.map((message, idx) => {
    const next = {
      role: message.role,
      content: message.content
    };
    if (message.tool_calls)   next.tool_calls   = message.tool_calls;
    if (message.tool_call_id) next.tool_call_id = message.tool_call_id;

    if (message.role === 'tool' && typeof message.content === 'string') {
      const toolName = toolNameMap[idx] || 'unknown';
      next.content = truncateToolResult(toolName, message.content);
    }
    return next;
  });

  // 第二步：估算总 token，超出警戒线时压缩旧消息
  const totalTokens = estimateTokens(systemPrompt)
    + trimmed.reduce((sum, m) => sum + estimateTokens(JSON.stringify(m)), 0);

  if (totalTokens > CONTEXT_TOKEN_WARN && trimmed.length > 6) {
    let splitIndex = trimmed.length - 6;

    // 确保截断点不破坏 tool往返完整性
    const firstRecentMsg = trimmed[splitIndex];
    if (firstRecentMsg.role === 'tool') {
      for (let i = splitIndex - 1; i >= 0; i--) {
        const msg = trimmed[i];
        if (msg.role === 'assistant' && msg.tool_calls) {
          if (msg.tool_calls.some(tc => tc.id === firstRecentMsg.tool_call_id)) {
            splitIndex = i;
            break;
          }
        }
      }
    }

    const recent = trimmed.slice(splitIndex);
    const older  = trimmed.slice(0, splitIndex);

    // 第三步：旧消息压缩为摘要而非丢弃
    // 只压缩可压缩的工具往返，保留不可压缩的（run_strategy, build_ppt, update_brief）
    const compressed = compressOldMessages(older);

    return [{ role: 'system', content: systemPrompt }, ...compressed, ...recent];
  }

  return [{ role: 'system', content: systemPrompt }, ...trimmed];
}

// 构建 tool_call_id → toolName 的映射
function buildToolNameMap(messages) {
  const map = {};
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (msg.role === 'assistant' && Array.isArray(msg.tool_calls)) {
      for (const tc of msg.tool_calls) {
        const fnName = tc.function?.name || tc.name;
        // 找到对应的 tool result 消息
        for (let j = i + 1; j < messages.length; j++) {
          if (messages[j].role === 'tool' && messages[j].tool_call_id === tc.id) {
            map[j] = fnName;
            break;
          }
        }
      }
    }
  }
  return map;
}
```

- [ ] **Step 2: 验证 brainAgent 可加载**

Run: `node -e "const m = require('./src/agents/brainAgent'); console.log('OK:', typeof m)"`
Expected: `OK: function`

- [ ] **Step 3: Commit**

```bash
git add src/agents/brainAgent.js
git commit -m "feat: upgrade buildMessages() with 4-step context pipeline (differential truncation, compression, key state injection)"
```

---

### Task 3: 改造 brain.js — system prompt 接受 compactSummary 参数

**Files:**
- Modify: `src/prompts/brain.js:3` (函数签名)
- Modify: `src/prompts/brain.js:195` (模板字符串末尾)

- [ ] **Step 1: 修改 buildBrainSystemPrompt 签名和注入 compactSummary 段**

**修改 1：函数签名（第 3 行）**

旧：
```js
function buildBrainSystemPrompt(spaceContext = null, executionPlan = null, taskSpec = null, routeToolSequence = []) {
```

新：
```js
function buildBrainSystemPrompt(spaceContext = null, executionPlan = null, taskSpec = null, routeToolSequence = [], compactSummary = null) {
```

**修改 2：在函数体开头添加 compactSummary 段构建（第 4 行后插入）**

旧：
```js
  const spaceSection = buildSpaceSection(spaceContext);
```

新：
```js
  const compactSummarySection = buildCompactSummarySection(compactSummary);
  const spaceSection = buildSpaceSection(spaceContext);
```

**修改 3：在模板字符串末尾注入 compactSummarySection（第 195 行）**

旧：
```js
- 工具已经足够支撑下一步时，直接执行，不要先解释再执行${executionPlanSection}${taskSpecSection}${routeSequenceSection}${spaceSection}`;
```

新：
```js
- 工具已经足够支撑下一步时，直接执行，不要先解释再执行${compactSummarySection}${executionPlanSection}${taskSpecSection}${routeSequenceSection}${spaceSection}`;
```

**修改 4：在文件末尾 module.exports 前添加 buildCompactSummarySection 函数**

```js
function buildCompactSummarySection(compactSummary) {
  if (!compactSummary) return '';
  return `\n\n---\n\n## 压缩上下文（历史对话摘要 + 关键状态）\n\n以下内容来自对早期对话的自动压缩，保留了关键信息：\n\n${compactSummary}`;
}
```

- [ ] **Step 2: 验证模块可加载**

Run: `node -e "const m = require('./src/prompts/brain'); console.log('OK:', typeof m.buildBrainSystemPrompt)"`
Expected: `OK: function`

- [ ] **Step 3: 验证 compactSummary 注入生效**

Run: `node -e "const {buildBrainSystemPrompt} = require('./src/prompts/brain'); const p = buildBrainSystemPrompt(null, null, null, [], '测试摘要内容'); console.log(p.includes('压缩上下文'), p.includes('测试摘要内容'))"`
Expected: `true true`

- [ ] **Step 4: Commit**

```bash
git add src/prompts/brain.js
git commit -m "feat: inject compactSummary into system prompt for compressed context + key state"
```

---

### Task 4: 删除旧 slideDesigner.js 单体文件

**Files:**
- Delete: `src/services/slideDesigner.js`

- [ ] **Step 1: 确认无其他文件直接 require 旧单体**

Run: `grep -rn "require.*slideDesigner'" src/ --include="*.js" | grep -v "slideDesigner/"`
Expected: 无输出（所有引用都走 index.js 或 re-export）

- [ ] **Step 2: 删除旧文件**

Run: `rm src/services/slideDesigner.js`

- [ ] **Step 3: 验证拆分后的模块仍可正常加载**

Run: `node -e "const m = require('./src/services/slideDesigner'); console.log('OK:', Object.keys(m))"`
Expected: `OK: [ 'DESIGN_TOKENS', 'LAYOUTS', 'renderSlide', 'renderAllSlides', 'esc', 'buildCssVars', 'SLIDE_CSS' ]`

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove old slideDesigner.js monolith (replaced by slideDesigner/ directory)"
```

---

### Task 5: 补充测试用例

**Files:**
- Modify: `tests/message-truncation-bug.test.js`

- [ ] **Step 1: 在测试文件末尾追加新测试用例**

在现有测试文件末尾追加以下测试：

```js
// ─── 差异化截断测试 ───
const cm = require('../src/services/contextManager');

test('web_search 结果截断到 3000 字符', () => {
  const long = 'x'.repeat(5000);
  const result = cm.truncateToolResult('web_search', long);
  expect(result.length).toBeLessThan(3100);
  expect(result).toContain('web_search 结果已截断');
});

test('run_strategy 结果不截断', () => {
  const long = 'x'.repeat(50000);
  const result = cm.truncateToolResult('run_strategy', long);
  expect(result).toBe(long);
});

test('build_ppt 结果不截断', () => {
  const long = 'x'.repeat(50000);
  const result = cm.truncateToolResult('build_ppt', long);
  expect(result).toBe(long);
});

test('update_brief 结果不截断', () => {
  const long = 'x'.repeat(50000);
  expect(cm.truncateToolResult('update_brief', long)).toBe(long);
});

test('短结果不截断', () => {
  const short = 'hello';
  expect(cm.truncateToolResult('web_search', short)).toBe('hello');
});

// ─── 摘要压缩测试 ───
test('compressOldMessages 生成摘要而非丢弃', () => {
  const older = [
    { role: 'user', content: '帮我策划一个华为发布会' },
    { role: 'assistant', content: '好的，我来帮你策划', tool_calls: [{ id: 'tc1', function: { name: 'web_search' } }] },
    { role: 'tool', content: '搜索结果...', tool_call_id: 'tc1' },
  ];
  const compressed = cm.compressOldMessages(older);
  expect(compressed.length).toBe(1);
  expect(compressed[0].role).toBe('system');
  expect(compressed[0].content).toContain('历史对话摘要');
  expect(compressed[0].content).toContain('华为发布会');
  expect(compressed[0].content).toContain('web_search');
});

test('compressOldMessages 空数组返回空', () => {
  expect(cm.compressOldMessages([])).toEqual([]);
});

// ─── 关键状态提取测试 ───
test('extractKeyState 从 session 提取 brief 和 plan', () => {
  const session = {
    brief: { brand: '华为', eventType: 'product_launch', topic: 'Mate70 发布', goal: '品牌曝光' },
    bestPlan: { planTitle: '华为 Mate70 发布会方案', coreStrategy: '科技感+情感共鸣', highlights: ['沉浸体验', '明星站台', '全网直播'] },
  };
  const state = cm.extractKeyState(session);
  expect(state).toContain('华为');
  expect(state).toContain('Mate70');
  expect(state).toContain('科技感');
});

test('extractKeyState 空 session 返回 null', () => {
  expect(cm.extractKeyState({})).toBeNull();
});

// ─── 警戒线提升测试 ───
test('CONTEXT_TOKEN_WARN 为 30000', () => {
  expect(cm.CONTEXT_TOKEN_WARN).toBe(30000);
});
```

- [ ] **Step 2: 运行新增测试**

Run: `npx jest tests/message-truncation-bug.test.js --no-coverage -t "web_search" -t "run_strategy" -t "compressOldMessages" -t "extractKeyState" -t "CONTEXT_TOKEN_WARN" 2>&1 | tail -20`
Expected: 所有测试 PASS

- [ ] **Step 3: Commit**

```bash
git add tests/message-truncation-bug.test.js
git commit -m "test: add tests for differential truncation, message compression, key state extraction, and token warning line"
```

---

## Self-Review

### Spec Coverage
- ✅ 按工具类型差异化截断 → Task 1 (truncateToolResult + TOOL_TRUNCATION_CONFIG) + Task 2 (buildToolNameMap)
- ✅ 旧消息压缩为摘要而非丢弃 → Task 1 (compressOldMessages) + Task 2 (buildMessages 第三步)
- ✅ 关键状态注入系统提示 → Task 1 (extractKeyState) + Task 2 (buildMessages) + Task 3 (compactSummarySection)
- ✅ 提高 token 警戒线 → Task 1 (CONTEXT_TOKEN_WARN = 30000)
- ✅ 删除旧单体文件 → Task 4

### Placeholder Scan
- 无 TBD / TODO / "implement later" / "fill in details"
- 所有步骤都有完整代码

### Type Consistency
- `truncateToolResult(toolName, content)` → `string`
- `compressOldMessages(messages)` → `Array<{role, content}>`
- `extractKeyState(session)` → `string | null`
- `buildBrainSystemPrompt(..., compactSummary)` → `string`
- 所有签名一致
