# API 接口设计

## 目录

- [Agent 接口](#agent-接口) — Brain Agent 对话与任务执行
- [空间接口](#空间接口) — 文档空间管理
- [文件接口](#文件接口) — PPTX 下载
- [模板接口](#模板接口) — 模板列表

---

## Agent 接口

所有接口均通过 `/api/agent` 路由，提供 Brain Agent 的对话和任务管理能力。

---

### GET `/api/agent/stream/:sessionId`

SSE 长连接，订阅 Brain Agent 的实时响应。前端用 `EventSource` 订阅。

**Response Headers**
```
Content-Type: text/event-stream
Cache-Type: no-cache
Connection: keep-alive
X-Accel-Buffering: no
```

**SSE 格式**
```
event: <event_name>
data: <json_payload>

```

**重连与回放**

- 前端断开重连时，重新调用 `POST /api/agent/start` 或 `POST /api/agent/message` 会自动恢复
- Session 的 `eventBacklog`（最多 80 条）会在连接建立后立即推送 `event: replay`，保证不丢事件
- Session TTL 2 小时，超时后事件清除

**事件类型**

| 事件名 | 触发时机 | payload 示例 |
|--------|----------|-------------|
| `replay` | 连接建立时，恢复历史事件 | `{ "count": 5 }` |
| `thinking` | Agent 推理中 | `{ "text": "在搜索竞品案例..." }` |
| `text_delta` | 流式文字输出（累加） | `{ "delta": "正在为您..." }` |
| `text_end` | 本轮文字流结束 | `{}` |
| `text` | 完整文字消息（非流式） | `{ "content": "完整文字" }` |
| `tool_call` | 工具开始执行 | `{ "tool": "web_search", "display": "...", "toolCallId": "call_xxx" }` |
| `tool_progress` | 工具执行进度更新 | `{ "tool": "run_strategy", "progress": "第2轮优化中...", "step": 2 }` |
| `tool_result` | 工具执行完成 | `{ "tool": "web_search", "ok": true, "summary": "..." }` |
| `clarification` | ask_user 暂停，等待用户回答 | `{ "question": "...", "type": "missing_info" }` |
| `brief_update` | brief 有更新时推送 | `{ "brief": { "brand": "某品牌" } }` |
| `plan_update` | 任务计划更新 | `{ "todos": [...] }` |
| `artifact` | 研究结果/大纲/方案内容更新 | `{ "type": "plan_draft", "content": "..." }` |
| `doc_ready` | 策划文档已生成并保存 | `{ "docId": "doc_xxx", "title": "策划文档" }` |
| `slide_added` | PPT 某页已添加到预览 | `{ "pageIndex": 3, "html": "<div>...</div>" }` |
| `done` | 任务完成（所有流程结束） | `{ "mode": "brain", "hasPlan": true, "score": 7.5, ... }` |
| `error` | 发生错误 | `{ "message": "AI 调用失败", "code": "LLM_TIMEOUT" }` |

**典型 SSE 事件序列（一次策划请求）**

```
# 1. 连接建立
event: replay
data: {"count": 0}

# 2. Agent 开始思考
event: thinking
data: {"text": "好的，我来为某品牌策划一场新车发布会。先搜集一些竞品案例。"}

# 3. 调用搜索工具
event: tool_call
data: {"tool": "web_search", "display": "搜索：2024 车企发布会创意趋势", "toolCallId": "call_abc123"}

# 4. 工具执行中
event: tool_progress
data: {"tool": "web_search", "progress": "搜索中...", "step": 1}

# 5. 搜索完成
event: tool_result
data: {"tool": "web_search", "ok": true, "summary": "找到 8 条结果（minimax）", "source": "minimax"}

# 6. Agent 思考
event: thinking
data: {"text": "找到了不少案例，现在开始制定策划方案。"}

# 7. 调用策略工具（多轮评审）
event: tool_call
data: {"tool": "run_strategy", "display": "制定策划方案...", "toolCallId": "call_def456"}
event: tool_progress
data: {"tool": "run_strategy", "progress": "第1轮生成中...", "step": 1}
event: tool_progress
data: {"tool": "run_strategy", "progress": "评审中（DeepSeek）...", "step": 2}
event: tool_result
data: {"tool": "run_strategy", "ok": true, "score": 7.5, "passed": true}

# 8. 文档生成
event: doc_ready
data: {"docId": "doc_abc", "title": "某品牌 新车发布会 策划方案"}

# 9. PPT 生成
event: tool_call
data: {"tool": "build_ppt", "display": "生成 PPT...", "toolCallId": "call_ghi789"}
event: slide_added
data: {"pageIndex": 0, "html": "<div class=\"slide slide-cover\">..."}
event: slide_added
data: {"pageIndex": 1, "html": "<div class=\"slide slide-toc\">..."}
event: tool_result
data: {"tool": "build_ppt", "ok": true, "downloadUrl": "/api/files/download/2024/04/ppt_xxx.pptx", "pageCount": 12}

# 10. 任务完成
event: done
data: {"mode": "brain", "hasPlan": true, "score": 7.5, "downloadUrl": "/api/files/download/2024/04/ppt_xxx.pptx"}
```

**clarification 事件（ask_user 暂停）**

```json
{
  "question": "这次发布会主要面向哪类人群？",
  "type": "missing_info"
}
```

此时 SSE 断开，前端需等待用户回答后调用 `POST /api/agent/answer` 恢复。

**done 事件**

```json
{
  "mode": "brain",
  "brief": { "brand": "某品牌", "eventType": "product_launch", "budget": "500万" },
  "planItems": [{ "content": "核心亮点1", "status": "completed" }],
  "hasPlan": true,
  "score": 7.5,
  "downloadUrl": "/api/files/download/ppt_xxx.pptx",
  "docId": "doc_xxx",
  "pageCount": 12
}
```

**error 事件**

```json
{ "message": "AI 调用失败：超时", "code": "LLM_TIMEOUT" }
```

错误码：
| code | 说明 |
|------|------|
| `LLM_TIMEOUT` | LLM 调用超时（重试 2 次后失败） |
| `LLM_ERROR` | LLM 返回错误 |
| `SESSION_NOT_FOUND` | session 不存在或已过期 |
| `SESSION_BUSY` | session 正在处理中 |
| `INVALID_REQUEST` | 请求参数错误 |
| `TOOL_EXECUTION_FAILED` | 工具执行失败 |

---

### POST `/api/agent/start`

创建新会话并开始任务。

**请求体**
```json
{
  "spaceId": "space_xxx",
  "message": "我想为某品牌策划一场新车发布会",
  "attachments": [],
  "documents": [],
  "apiKeys": {
    "minimaxApiKey": "sk-xxx",
    "deepseekApiKey": "sk-xxx"
  }
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `spaceId` | string | 是 | 关联的空间 ID |
| `message` | string | 是 | 用户输入的自然语言 |
| `attachments` | array | 否 | 上传的图片（格式见下） |
| `documents` | array | 否 | 上传的文档（格式见下） |
| `apiKeys` | object | 否 | 运行时 API Key，优先级高于环境变量 |

**附件格式（attachments）**

```json
{
  "id": "img_xxx",
  "name": "图片.jpg",
  "mimeType": "image/jpeg",
  "size": 123456,
  "url": "/api/files/download/xxx.jpg",
  "localPath": "/output/uploads/xxx.jpg"
}
```

本地文件需同时提供 `url` 和 `localPath`，供 visionMcp.js 读取分析。

**文档格式（documents）**

```json
{
  "id": "doc_xxx",
  "name": "文档.pdf",
  "type": "pdf",
  "pages": 10,
  "size": 1234567,
  "text": "文档全文（已提取）..."
}
```

`text` 字段由后端 `documentParser.js` 解析后填充，前端上传时留空。

**响应**
```json
{
  "success": true,
  "sessionId": "sess_xxx"
}
```

返回 `sessionId` 后，前端立即建立 SSE 连接 `GET /api/agent/stream/:sessionId`。

---

### POST `/api/agent/message`

继续已有会话，发送新消息。

**请求体**
```json
{
  "sessionId": "sess_xxx",
  "message": "预算再加一些",
  "attachments": [],
  "documents": []
}
```

**响应**
```json
{ "success": true }
```

若 session 不存在或已超时，返回 `{ "success": false, "message": "会话不存在" }`。

---

### POST `/api/agent/answer`

用户回答 Agent 的提问（ask_user）。调用后 Brain Agent 恢复执行。

**请求体**
```json
{
  "sessionId": "sess_xxx",
  "answer": "主要面向 25-35 岁都市白领",
  "attachments": [],
  "documents": []
}
```

**响应**
```json
{ "success": true }
```

---

### POST `/api/agent/stop`

强制停止当前会话的 Brain Agent 循环。

**请求体**
```json
{ "sessionId": "sess_xxx" }
```

**响应**
```json
{ "success": true }
```

Session status 变为 `stopped`，SSE 推送 `error` 事件 `{ "message": "用户主动停止", "code": "USER_STOPPED" }`。

---

### DELETE `/api/agent/session/:sessionId`

删除会话（同时清理内存 session 和 SQLite 中的会话记录）。

**响应**
```json
{ "success": true }
```

---

### GET `/api/agent/sessions`

获取当前空间的所有会话列表。

**Query**: `?spaceId=space_xxx`

**响应**
```json
{
  "success": true,
  "data": [
    {
      "sessionId": "sess_xxx",
      "status": "idle",
      "title": "某品牌发布会策划",
      "createdAt": "2024-04-01T10:00:00Z",
      "updatedAt": "2024-04-01T10:30:00Z"
    }
  ]
}
```

`status` 取值：`idle`（空闲）/`running`（执行中）/`waiting_for_answer`（等待用户回答）/`stopped`（已停止）。

---

## 空间接口

通过 `/api/workspace` 管理多租户文档空间。

所有接口统一响应格式：
```json
{ "success": true, "data": {...} }
```
错误时：`{ "success": false, "message": "错误描述" }`

---

### GET `/api/workspace`

获取完整空间树（含所有 Space 及其下的文档/文件夹）。

**响应**
```json
{
  "success": true,
  "data": {
    "version": 1,
    "updatedAt": "2024-04-01T00:00:00Z",
    "spaces": [
      {
        "id": "space_xxx",
        "type": "space",
        "name": "某品牌项目",
        "systemType": null,
        "children": [
          { "id": "doc_yyy", "type": "document", "name": "策划文档", "docType": "document", "children": null },
          { "id": "folder_zzz", "type": "folder", "name": "素材", "children": [] }
        ]
      }
    ]
  }
}
```

Space 节点可能包含 `systemType: "space_index"`，表示这是隐藏的空间索引节点，前端应跳过渲染。

---

### POST `/api/workspace/space`

创建新空间。

**请求体**
```json
{ "name": "新品牌发布会项目" }
```

**响应**
```json
{
  "success": true,
  "node": { "id": "space_xxx", "type": "space", "name": "新品牌发布会项目", "children": [] }
}
```

---

### POST `/api/workspace/folder`

在指定空间下创建文件夹。

**请求体**
```json
{ "parentId": "space_xxx", "name": "素材库" }
```

---

### POST `/api/workspace/document`

在指定空间下创建文档。

**请求体**
```json
{ "parentId": "space_xxx", "name": "策划文档", "docType": "document" }
```

`docType` 可选值：`document`（默认，富文本文档）、`ppt`（PPT 文档）、`system`（系统节点，如 space_index）。

---

### GET `/api/workspace/:id/content`

获取文档内容（含 contentFormat 和 content）。

**响应**
```json
{
  "success": true,
  "content": {
    "id": "doc_xxx",
    "name": "策划文档",
    "docType": "document",
    "contentFormat": "tiptap-json",
    "content": { "type": "doc", "content": [...] },
    "createdAt": "2024-04-01T10:00:00Z",
    "updatedAt": "2024-04-01T11:00:00Z"
  }
}
```

`contentFormat` 可选值：
- `tiptap-json`：Tiptap 编辑器 JSON 格式（默认）
- `legacy-html`：旧版 HTML 格式

---

### PUT `/api/workspace/:id/content`

保存文档内容。

**请求体**
```json
{
  "content": { "type": "doc", "content": [...] },
  "contentFormat": "tiptap-json"
}
```

**响应**
```json
{ "success": true, "updatedAt": "2024-04-01T12:00:00Z" }
```

---

### PUT `/api/workspace/:id/rename`

重命名节点。

**请求体**
```json
{ "name": "新名称" }
```

---

### DELETE `/api/workspace/:id`

删除节点。递归删除所有子节点。

**响应**
```json
{
  "success": true,
  "deletedIds": ["doc_xxx", "folder_yyy", "doc_zzz"]
}
```

若删除 Space，同时清理该 Space 下所有会话（`conversationStore.deleteWorkspaceConversations`）。

---

### POST `/api/workspace/save-ppt`

将 Agent 生成的 PPT 保存到文档空间。

**请求体**
```json
{
  "spaceId": "space_xxx",
  "name": "某品牌发布会策划",
  "pptData": { "title": "...", "theme": {...}, "pages": [...] },
  "downloadUrl": "/api/files/download/ppt_xxx.pptx",
  "previewSlides": ["<div>...</div>", "<div>...</div>"]
}
```

会在 Space 下创建一个 `docType: "ppt"` 的节点。

---

### POST `/api/workspace/:id/import-word`

上传 `.docx` 文件，解析为 HTML 并保存到指定文档节点。

**Content-Type**: `multipart/form-data`

| 字段 | 类型 | 说明 |
|------|------|------|
| `file` | file | .docx 文件，最大 20MB |

- `id` 为真实节点 ID 时，直接保存内容
- `id` 为 `_new` 时，仅返回解析后的 HTML，前端决定存储位置

**响应**
```json
{ "success": true, "html": "<p>解析后的 HTML...</p>" }
```

---

### GET `/api/workspace/:id/export-word`

导出文档为 `.docx` 下载。

**响应**：二进制流，Content-Type 为 `application/vnd.openxmlformats-officedocument.wordprocessingml.document`。

---

### GET `/api/workspace/:spaceId/conversations`

获取某空间下的所有会话列表。

**响应**
```json
{
  "success": true,
  "data": [
    {
      "id": "conv_xxx",
      "workspaceId": "space_xxx",
      "title": "某品牌发布会策划",
      "status": "active",
      "createdAt": "2024-04-01T10:00:00Z",
      "updatedAt": "2024-04-01T10:30:00Z",
      "lastMessageAt": "2024-04-01T10:30:00Z",
      "messageCount": 12
    }
  ]
}
```

---

### GET `/api/workspace/conversations/:id`

获取会话详情与消息历史。

**响应**
```json
{
  "success": true,
  "data": {
    "id": "conv_xxx",
    "workspaceId": "space_xxx",
    "title": "某品牌发布会策划",
    "status": "active",
    "state": { "brief": {...}, "todos": [...] },
    "messages": [
      { "id": "msg_xxx", "role": "user", "content": "...", "createdAt": "..." },
      { "id": "msg_yyy", "role": "assistant", "content": "...", "createdAt": "..." }
    ],
    "createdAt": "...",
    "updatedAt": "..."
  }
}
```

---

### PUT `/api/workspace/conversations/:id`

保存会话快照（标题、状态、消息）。

**请求体**
```json
{
  "title": "新标题",
  "status": "active",
  "state": { "brief": {...}, "todos": [...] },
  "messages": [...],
  "lastMessageAt": "2024-04-01T10:30:00Z"
}
```

---

### DELETE `/api/workspace/conversations/:id`

删除会话。

---

## 文件接口

通过 `/api/files` 管理生成的文件。

**安全约束**：所有路径必须位于 `OUTPUT_DIR`（默认 `./output`）内，禁止目录遍历。

---

### GET `/api/files/list`

列出所有生成的 PPTX 文件。

**响应**
```json
{
  "success": true,
  "data": [
    {
      "filename": "ppt_1714000000.pptx",
      "relativePath": "2024/04/ppt_1714000000.pptx",
      "size": 1234567,
      "created": "2024-04-01T10:00:00Z",
      "downloadUrl": "/api/files/download/2024/04/ppt_1714000000.pptx"
    }
  ]
}
```

---

### GET `/api/files/download/*`

下载指定文件。路径在 `output/` 目录内按相对路径解析。

**响应**：文件二进制流。

**错误**：
- 403：路径在 OUTPUT_DIR 之外（目录遍历攻击）
- 404：文件不存在

---

### DELETE `/api/files/*`

删除指定文件。

**响应**
```json
{ "success": true, "message": "文件已删除" }
```

---

## 模板接口

### GET `/api/templates`

获取所有可用模板列表。

**响应**
```json
{
  "success": true,
  "data": [
    {
      "id": "auto_show",
      "name": "车展策划模板",
      "description": "适合大型车展活动",
      "thumbnail": "/assets/templates/auto_show.png",
      "pageCount": 12,
      "tags": ["汽车", "大型活动"]
    }
  ]
}
```

---

### GET `/api/templates/:id`

获取指定模板详情（含完整的 PPT JSON 结构）。

**响应**
```json
{
  "success": true,
  "data": {
    "id": "auto_show",
    "name": "车展策划模板",
    "description": "适合大型车展活动",
    "theme": { "primary": "2563EB", "secondary": "1E293B" },
    "pages": [{ "type": "cover", "mainTitle": "{{brand}}", ... }]
  }
}
```

---

### POST `/api/ppt/generate`

基于模板生成 PPT（旧版，保留兼容）。

**请求体**
```json
{
  "templateId": "auto_show",
  "data": { "brand": "某品牌", "topic": "新品发布" },
  "outputName": "output.pptx"
}
```

---

## 健康检查

### GET `/api/health`

```json
{
  "success": true,
  "message": "OpenClaw PPT服务运行中",
  "version": "1.0.0"
}
```
