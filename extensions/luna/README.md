# Luna Browser Bridge (Chrome Extension)

让 Luna PPT 的 agent 用**当前 Chrome 的登录态**在小红书等站点内搜索/抓取内容，避开 API 配额和反爬。对齐 Claude for Chrome / Manus Browser 的做法。

## 架构

```
Chrome Extension (MV3, service worker)
  ├─ WebSocket client  ←→  Node 后端 ws://127.0.0.1:3399  (browserBridge)
  │                         （hello 阶段 shared-token 认证，不对则直接踢）
  ├─ chrome.alarms 15s 保活（抄 opencode-browser 成熟值）
  ├─ chrome.storage.session  —— session 级授权 + 用户偏好
  ├─ lib/
  │    └─ tabManager.js   —— 串行锁 + tab 存在性校验 + 模式复用
  └─ extractors/
       ├─ xiaohongshu.js  —— 搜索 + SPA 弹窗抓正文（走 per-host 锁）
       └─ readPage.js     —— 通用正文抽取，含 shadow DOM + iframe 穿透
```

协议：
- 后端 → 扩展：`{ id, op, payload }`
- 扩展 → 后端：`{ id, ok, result?, error? }`
- 握手：扩展发送 `{ type: 'hello', version, token }`，后端返回 `{ type: 'auth_ok' }` 或 `{ type: 'auth_error' }`

## Phase 1 支持的能力

- `browser_search(platform='xiaohongshu', query, max_results, fetch_body_top_n?)` — 用登录态搜小红书笔记卡片
- `browser_read_notes(platform='xiaohongshu', urls[])` — 批量抓笔记正文（必须在同一搜索 tab 上）
- `browser_read_page(url)` — 通用正文抽取，穿透 shadow DOM + 同源 iframe

**只读、不点击、不发帖**。写操作留到后续（会走 chrome.notifications 审批）。

## 安装（未打包加载）

1. 启动 Node 后端：`npm run dev:api`（会监听 HTTP 3000 和 WS 3399）
   - 首次启动自动生成 token 到 `~/.luna/bridge.token`（权限 0600）
   - 或通过 `LUNA_BRIDGE_TOKEN=xxx npm run dev:api` 显式指定
2. 拿 token：`cat ~/.luna/bridge.token`
3. Chrome 地址栏打开 `chrome://extensions/`
4. 右上角开启「开发者模式」
5. 点「加载已解压的扩展程序」，选 `extensions/luna/` 目录
6. 点扩展图标打开 popup：
   - 把上一步的 token 粘贴到 **Bridge Token** 输入框
   - 点「保存并连接」
   - 状态应显示「已连接 Luna 后端」+ 绿点；右上角 badge 显示 `ON`
7. 打开 `https://www.xiaohongshu.com/` 并**登录自己的账号**（扩展不会帮你登录）

连接状态也可通过后端探测：

```bash
curl http://localhost:3000/api/browser-bridge/status
# => { "listening": true, "connected": true, "meta": {...}, "allowlist": [...], "tokenFile": "..." }
```

## 安全模型

| 层 | 机制 |
|---|---|
| **传输** | 只接受 `127.0.0.1` / `::1` 本机连接 |
| **认证** | hello 阶段 shared-token，错了直接 close(4401) |
| **域名** | Extension `host_permissions` 硬限制 + Bridge `allowlist` 兜底（默认只放 xiaohongshu.com / xhscdn.com） |
| **会话授权** | popup 内 `chrome.storage.session` 记录 session 级 grants，浏览器关闭即清空 |
| **默认策略** | allowlist 内站点**只读**自动放行（可在 popup 关闭）；写操作（未开放）需显式审批 |
| **审计** | 后端控制台 `[browserBridge]` 前缀；扩展 `[luna-bridge]` 前缀 |

覆盖 allowlist：`LUNA_BRIDGE_ALLOWLIST=xiaohongshu.com,xhscdn.com,zhihu.com`（**注意**：也要同步改 Extension manifest 的 `host_permissions`，这两层都要通过才能实际访问）。

## 冒烟测试

启动后端 + 加载扩展 + 登录小红书后，在任意 agent 会话里让它：

> 帮我去小红书搜一下"车展展台 科技感"，列前 10 条

Brain 应调用 `browser_search(platform='xiaohongshu', query='车展展台 科技感')`，几秒后返回笔记列表（标题 / 作者 / 封面 / URL）。

## 已知限制 / 排错

- 小红书结果页结构偶发变动，extractor 用多 selector 兜底，必要时改 `extensions/luna/src/extractors/xiaohongshu.js`
- 工具返回里的 `reason` 字段可以判断失败类型：
  - `login_required` — 未登录，去 Chrome 手动登录
  - `need_user_approval` — session 未授权，去 popup 勾选 auto-read 或手动授权
  - `extension_disconnected` — 扩展未连/认证失败
  - `host_not_allowed` — 目标域名不在 allowlist
  - `empty` / `timeout` — 抓取失败，建议降级到 `web_search` / `web_fetch`
- MV3 service worker 会休眠，已用 `chrome.alarms` 每 **15s** 保活 + 自动重连

## 调试

- 扩展日志：`chrome://extensions/` → Luna → 「服务工作进程」→ 点 inspect
- 后端日志：看 node 控制台 `[browserBridge]` 和 `[ext:info]` 前缀
- 手动重连：popup 上「重连」按钮
- 清空授权：popup 上「清空本次授权」
- Token 错了：popup 显示「Token 错误」红点，重新粘贴后点「保存并连接」
