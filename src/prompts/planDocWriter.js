// 合并 prompt：一次性产出策划文档 markdown + 结构化 plan JSON
// 输出顺序：markdown 先（用户实时看到），<plan_json>...</plan_json> 在文档末尾

function buildPlanDocPrompt(input) {
  const { orchestratorOutput = {}, researchResults = [], userInput = {}, approvedConcept = null } = input;
  const {
    brand = '', description = '', goal = '', audience = '', tone = '',
    budget = '', requirements = '', topic = ''
  } = userInput;

  const researchSummary = (Array.isArray(researchResults) ? researchResults : [])
    .map(r => `【${r.taskId || r.focus || '研究'}】${r.focus || ''}\n${r.summary || ''}`)
    .join('\n\n') || '（暂无补充研究）';

  const approvedConceptSection = approvedConcept ? `

## 已与客户确认的活动主体思路（必须沿用）

以下创意骨架已在上一步经客户明确确认，**完整方案必须沿用这个方向**，不要自行替换主题或创意方向。你可以在细节、执行、章节结构上深化扩展，但不得：
- 替换活动主题名称（当前为：${approvedConcept.themeName || '待定'}）
- 更换核心创意切入点
- 丢弃已确认的亮点方向（可以深化但不能省略）

### 主题
${approvedConcept.themeName || '（待定）'}

### 核心创意
${approvedConcept.coreIdea || ''}

### 已确认的亮点方向（必须在方案中体现）
${(approvedConcept.creativeAngles || []).map((a, i) => `${i + 1}. ${a}`).join('\n') || '（无）'}

### 整体调性
${approvedConcept.toneAndStyle || ''}

### 方向选择理由（供你理解上下文）
${approvedConcept.rationale || ''}
` : '';

  const systemPrompt = `你是顶级活动策划专家。你要一次性产出两样东西：
1）用户立刻能读的完整 Markdown 策划文档（第一部分，先写）
2）给系统用的结构化 JSON（第二部分，用 <plan_json>...</plan_json> 包住，必须放在文档最后）

写作风格（针对 Markdown 部分）：
- 第一人称视角（「我们建议」「我们判断」），不要「本方案」样的官样文体
- 每章先抛判断/结论，再展开；数字与案例要具体
- 标题层级：# 方案标题，## 章节，### 子点；重要数据加粗，用 - 列表或表格
- 直接开始写，不要前言、不要说明、不要 <think> 推理

硬性格式约束：
- Markdown 开头就是 \`# 方案标题\`，不要有任何空行或说明文字
- JSON 严格放在 <plan_json> 和 </plan_json> 之间，标签前后各空一行
- JSON 必须合法，不要带 markdown 代码块围栏`;

  const userPrompt = `请为下面这个活动一次性产出策划文档和结构化 JSON。

## 活动基本信息
品牌/客户：${brand || '（未指定）'}
活动/项目：${topic || description || '（未指定）'}
核心目标：${goal || orchestratorOutput.parsedGoal || '（未明确）'}
目标受众：${audience || '（未明确）'}
风格调性：${tone || '（未明确）'}
预算量级：${budget || '（未明确）'}
补充要求：${requirements || '无'}
关键主题：${(orchestratorOutput.keyThemes || []).join('、') || '无'}

## 研究素材
${researchSummary}
${approvedConceptSection}
---

## 第一部分：完整 Markdown 策划文档

直接以 \`# 方案标题\` 开始。方案必须覆盖：核心策略、方案亮点、章节设计（3-5 章）、预算框架、执行节奏、核心 KPI、风险应对、现场效果建议。标题层级与结构你根据活动特点自主设计。

## 第二部分：结构化 JSON

文档写完后，**另起一行输出 <plan_json>**，然后输出以下结构的合法 JSON，最后以 </plan_json> 结束：

<plan_json>
{
  "planTitle": "方案标题（与 Markdown 的 # 标题一致）",
  "coreStrategy": "核心命题 1-2 句",
  "highlights": ["亮点1", "亮点2", "亮点3"],
  "sections": [
    { "title": "章节标题", "keyPoints": ["要点1","要点2"], "narrative": "200字以内核心内容" }
  ],
  "budget": {
    "total": "${budget || '待定'}",
    "breakdown": [{ "item": "预算项", "amount": "金额", "percentage": "占比", "rationale": "分配理由" }]
  },
  "timeline": {
    "eventDate": "活动日期（如已知）",
    "phases": [{ "phase": "阶段名", "duration": "时长", "milestone": "产出" }]
  },
  "kpis": [{ "metric": "指标名", "target": "目标值", "rationale": "设定理由" }],
  "riskMitigation": ["风险+应对1", "风险+应对2"],
  "visualTheme": {
    "style": "整体视觉风格定位（1-2句）",
    "colorMood": "色彩基调",
    "imageKeywords": ["英文关键词1","英文关键词2","英文关键词3"]
  },
  "visualExecutionHints": {
    "sceneTone": "现场气质一句话",
    "mustRenderScenes": ["场景1","场景2","场景3"],
    "spatialKeywords": ["英文关键词1","英文关键词2"],
    "avoidElements": ["应避免元素1"],
    "onsiteDesignSuggestions": [
      { "scene": "主舞台/签到区等", "goal": "承担任务", "designSuggestion": "具体设计建议", "visualFocus": ["要素1","要素2"] }
    ]
  }
}
</plan_json>

要求：JSON 的 planTitle、sections[].title 应与 Markdown 里的标题文字保持一致。sections 数组至少 3 项，与 Markdown 里 ## 标题对应。`;

  return { systemPrompt, userPrompt };
}

module.exports = { buildPlanDocPrompt };
