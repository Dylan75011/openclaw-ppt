# PPT 预览系统设计

## 设计原则

`previewRenderer.js` 与 `pptGenerator.js` 共用**同一份 PPT JSON**，只是输出格式不同：

- `pptGenerator.js` → `.pptx` 文件（下载）
- `previewRenderer.js` → HTML 幻灯片数组（浏览器预览）

两者输入完全相同，保证预览所见即所得。

---

## previewRenderer.js 接口

```js
/**
 * 将 PPT JSON 转为 HTML 幻灯片数组
 * @param {Object} pptData - 与 pptGenerator 相同的输入 JSON
 * @returns {string[]} - 每个元素是一张幻灯片的 HTML 片段
 */
function renderToHtml(pptData) { ... }

/**
 * 将 HTML 片段包装为完整 HTML 文档（供 Puppeteer 截图）
 * @param {string} htmlFragment - 单张幻灯片 HTML
 * @param {string} bgImagePath - 背景图路径（用于内联转换）
 */
function wrapForScreenshot(htmlFragment, bgImagePath) { ... }

module.exports = { renderToHtml, wrapForScreenshot, SLIDE_CSS };
```

---

## PPT JSON 格式（两种兼容）

系统同时兼容旧格式（`type` 字段）和新格式（`layout` 字段），`renderToHtml` 自动检测。

### 旧格式（type 驱动）

由 `pptBuilderAgent` 直接生成，`previewRenderer` 根据 `page.type` 选择渲染模板。

```json
{
  "title": "策划方案标题",
  "theme": {
    "primary": "FF6B00",
    "secondary": "1A1A1A"
  },
  "pages": [
    {
      "type": "cover",
      "mainTitle": "品牌名",
      "subtitle": "活动名称",
      "date": "2024年4月",
      "location": "上海",
      "bgImagePath": "/output/images/xxx.jpg"
    },
    {
      "type": "toc",
      "items": [{ "num": "01", "title": "项目背景" }, { "num": "02", "title": "核心策略" }]
    },
    {
      "type": "content",
      "title": "项目背景与目标",
      "sectionNum": "01",
      "sections": [
        { "title": "核心目标", "content": ["目标1", "目标2"] },
        { "title": "市场背景", "content": ["背景1"] }
      ],
      "kpis": [{ "value": "500+", "label": "预计到场人数" }]
    },
    {
      "type": "two_column",
      "title": "竞品对比",
      "left": { "title": "我方优势", "points": ["优势1", "优势2"] },
      "right": { "title": "市场机会", "points": ["机会1", "机会2"] }
    },
    {
      "type": "cards",
      "title": "三大亮点",
      "cards": [{ "icon": "🎯", "title": "亮点", "desc": "描述", "features": ["特点1", "特点2"] }]
    },
    {
      "type": "timeline",
      "title": "执行时间线",
      "phases": [
        { "date": "T-4周", "title": "筹备", "tasks": ["场地确认", "嘉宾邀请"] },
        { "date": "T-1周", "title": "预热", "tasks": ["传播启动"] }
      ]
    },
    {
      "type": "end",
      "mainText": "感谢观看",
      "subText": "活动口号",
      "brand": "品牌名",
      "contact": "contact@brand.com"
    }
  ]
}
```

### 新格式（layout 驱动，来自 slideDesigner）

由 `slideDesigner.js` 设计器生成，使用 `page.layout` + `page.content` 结构。渲染时 `previewRenderer` 会使用 `designerRenderer.js`（或内联逻辑）来处理新格式。

```json
{
  "title": "策划方案标题",
  "theme": {
    "primary": "FF6B00",
    "secondary": "1A1A1A",
    "globalStyle": "dark_tech",
    "bgImage": "/output/images/theme_bg.jpg"
  },
  "pages": [
    {
      "layout": "immersive_cover",
      "content": {
        "title": "主标题",
        "subtitle": "副标题",
        "brand": "品牌",
        "date": "2024年4月"
      },
      "bgImagePath": "/output/images/cover.jpg"
    },
    {
      "layout": "bento_grid",
      "content": {
        "title": "亮点呈现",
        "cards": [{ "title": "亮点1", "description": "...", "icon": "🎯" }]
      }
    },
    {
      "layout": "timeline_flow",
      "content": {
        "title": "执行时间线",
        "phases": [{ "date": "T-4周", "title": "筹备" }, { "date": "T-1周", "title": "预热" }]
      }
    },
    {
      "layout": "end_card",
      "content": {
        "brand": "品牌",
        "tagline": "口号",
        "contact": "contact@brand.com"
      }
    }
  ]
}
```

---

## 页面类型 → HTML 映射

### type（旧格式）

| type | 布局描述 | CSS 类 |
|------|----------|--------|
| `cover` | 全屏深色背景 + 居中大标题 | `.slide-cover` |
| `toc` | 左侧品牌色边栏 + 右侧 2×N 目录网格 | `.slide-toc` |
| `content` | 顶部标题栏 + 左侧卡片列表 + 底部 KPI 行 | `.slide-content` |
| `two_column` | 顶部标题栏 + 左右等宽双栏 | `.slide-two-column` |
| `cards` | 顶部标题栏 + 横排多张卡片 | `.slide-cards` |
| `timeline` | 顶部标题栏 + 横向时间轴节点 | `.slide-timeline` |
| `end` | 全屏深色背景 + 居中结束语 | `.slide-end` |

### layout（新格式）

| layout | 说明 |
|--------|------|
| `immersive_cover` | 全出血深色封面（与 type=cover 视觉一致） |
| `grid_toc` | 网格目录 |
| `split_content` | 分栏内容 |
| `bento_grid` | Bento 网格布局（卡片式） |
| `timeline_flow` | 时间线流 |
| `editorial_quote` | 引用/宣言式 |
| `data_cards` | 数据卡片 |
| `end_card` | 结束页 |

---

## 幻灯片尺寸与缩放

- 固定尺寸：**960 × 540px**（16:9）
- 前端通过 `transform: scale(ratio)` 等比适配容器宽度
- CSS 变量注入品牌色：`--primary` / `--secondary`

```css
.slide {
  width: 960px;
  height: 540px;
  position: relative;
  overflow: hidden;
  font-family: 'PingFang SC', 'Microsoft YaHei', sans-serif;
  background: #fff;
  color: var(--secondary, #1A1A1A);
}

.slide-cover { background: var(--secondary, #0F172A); color: #fff; }
.slide-end   { background: var(--secondary, #0F172A); color: #fff; }
.slide-content { background: #fff; }
```

---

## 品牌色注入

```js
// previewRenderer.js 中
const primary   = '#' + (theme.primary   || '2563EB').replace('#', '');
const secondary = '#' + (theme.secondary || '1E293B').replace('#', '');
const vars = `--primary:${primary};--secondary:${secondary}`;

// 每张幻灯片注入 style 属性
<div class="slide slide-cover" style="${vars}">
```

---

## 背景图处理

1. `bgImagePath` 支持字符串或对象（`{ localPath, path, url }`）
2. 路径标准化：`normalizeImageUrl()` 处理 output 相对路径和绝对路径
3. 旧格式渲染时自动叠加半透明遮罩（`rgba(0,0,0,0.42)`），使文字可读
4. 新格式（slideDesigner）由设计器本身处理背景叠加方式

**背景图加载优先级**：
```
page.bgImagePath（单页覆盖）
    ↓ 不存在
theme.bgImage（全局主题图）
    ↓ 不存在
theme.secondary（纯色背景）
```

---

## wrapForScreenshot

供 Puppeteer 截图使用，将 HTML 片段包装为完整 HTML 文档：

```js
function wrapForScreenshot(htmlFragment, bgImagePath) {
  // 背景图 URL 替换为内联 data: URI，避免 about:blank 文件加载限制
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>body{margin:0;}${SLIDE_CSS}${designerCSS || ''}</style>
</head><body>${htmlFragment}</body></html>`;
}
```

**使用场景**：ImageAgent 可能需要用 Puppeteer 对生成的幻灯片截图，用于 AI 生成的封面图评分参考。

---

## 前端预览组件（SlideViewer.vue）

### 布局结构

```
┌──────────────────────────────────────────────────┐
│  [←]                                            [→] │
│                                                  │
│          ┌────────────────────────────┐         │
│          │                            │         │
│          │   960×540 幻灯片主区域      │         │
│          │   (transform:scale 自适应)  │         │
│          │                            │         │
│          └────────────────────────────┘         │
│                                                  │
├──────────────────────────────────────────────────┤
│  [全屏]  [下载PPTX]        3 / 12    缩略图条  │
└──────────────────────────────────────────────────┘
```

### 交互

| 操作 | 行为 |
|------|------|
| `←` / `→` 按钮 | 上一页 / 下一页 |
| `F` 键 | 进入/退出全屏 |
| `ESC` 键 | 退出全屏 |
| `Home` / `End` | 跳转到第一页 / 最后一页 |
| 点击缩略图 | 跳转到对应页 |
| 拖拽缩略图条 | 横向滚动缩略图 |

### 生成流程中的预览时机

```
done 事件到达（包含 previewSlides[] 和 downloadUrl）
    │
    ├─ 取 previewSlides → 渲染全部缩略图到缩略图条
    ├─ 展示第 1 页为主展示区当前页
    └─ 显示"下载 PPTX"按钮
```

SSE 推送 `slide_added` 事件时（第 3 步中），前端逐页追加到缩略图条，无需等待全部完成。

---

## SlideViewer 与 SlideViewer 的关系

```
AgentView.vue
    │
    ├─ 对话区域（消息列表）
    │
    └─ SlideViewer.vue（底部预览面板）
            │
            ├─ 主展示区（当前页）
            ├─ 缩略图导航条
            └─ 工具栏（全屏/下载/翻页）
```

---

## 与 pptGenerator 共用数据

```
PPT Builder Agent 输出 pptData（JSON）
    │
    ├──▶ pptGenerator.generatePPT(pptData, outputName)
    │           ↓
    │    output/2024/04/ppt_xxx.pptx
    │
    └──▶ previewRenderer.renderToHtml(pptData)
                ↓
         ["<div class=\"slide slide-cover\">...</div>", ...]
                ↓
         slide_added 事件 → SlideViewer 渲染
```

同一份 JSON 同时驱动两个消费路径，保证预览和最终 PPTX 完全一致。
