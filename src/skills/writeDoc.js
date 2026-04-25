// Skill: 将策划方案转化为 Markdown 文档并渲染为 Tiptap 兼容的 HTML
const { callMinimaxStreamText } = require('../services/llmClients');
const { buildDocWriterPrompt } = require('../prompts/docWriter');
const { markdownToHtml } = require('../services/richText');

function firstNonEmpty(...values) {
  for (const value of values) {
    const text = String(value || '').trim();
    if (text) return text;
  }
  return '';
}

function asStringArray(values, limit = 6) {
  return (Array.isArray(values) ? values : [])
    .map(item => String(item || '').trim())
    .filter(Boolean)
    .slice(0, limit);
}

function buildFallbackMarkdown(plan = {}, userInput = {}, reviewFeedback = null) {
  const title = firstNonEmpty(
    plan.planTitle,
    userInput.topic,
    userInput.brand && `${userInput.brand}策划方案`,
    '策划方案'
  );
  const lines = [`# ${title}`];

  if (plan.coreStrategy) {
    lines.push('', '## 核心策略', '', plan.coreStrategy);
  }

  const highlights = asStringArray(plan.highlights, 8);
  if (highlights.length) {
    lines.push('', '## 方案亮点', '', ...highlights.map(item => `- ${item}`));
  }

  const sections = Array.isArray(plan.sections) ? plan.sections : [];
  if (sections.length) {
    sections.forEach((section, index) => {
      lines.push('', `## ${section.title || `章节 ${index + 1}`}`);
      if (section.narrative) lines.push('', section.narrative);
      const keyPoints = asStringArray(section.keyPoints, 6);
      if (keyPoints.length) {
        lines.push('', ...keyPoints.map(item => `- ${item}`));
      }
    });
  }

  const phases = Array.isArray(plan.timeline?.phases) ? plan.timeline.phases : [];
  if (phases.length) {
    lines.push('', '## 执行节奏', '');
    phases.forEach((phase) => {
      const phaseName = firstNonEmpty(phase.phase, '阶段');
      const detail = firstNonEmpty(phase.milestone, phase.duration);
      lines.push(`- ${phaseName}${detail ? `：${detail}` : ''}`);
    });
  }

  const kpis = Array.isArray(plan.kpis) ? plan.kpis : [];
  if (kpis.length) {
    lines.push('', '## KPI 目标', '');
    kpis.forEach((item) => {
      const metric = firstNonEmpty(item.metric, '关键指标');
      const target = firstNonEmpty(item.target, item.rationale);
      lines.push(`- ${metric}${target ? `：${target}` : ''}`);
    });
  }

  const risks = asStringArray(plan.riskMitigation, 8);
  if (risks.length) {
    lines.push('', '## 风险与应对', '', ...risks.map(item => `- ${item}`));
  }

  const sceneTone = firstNonEmpty(plan.visualExecutionHints?.sceneTone);
  if (sceneTone) {
    lines.push('', '## 现场效果建议', '', `整体气质：${sceneTone}`);
  }

  const scenes = asStringArray(plan.visualExecutionHints?.mustRenderScenes, 6);
  if (scenes.length) {
    lines.push('', '### 建议优先出效果图的场景', '', ...scenes.map(item => `- ${item}`));
  }

  if (reviewFeedback?.specificFeedback) {
    lines.push('', '## 后续优化提示', '', reviewFeedback.specificFeedback);
  }

  return lines.join('\n').trim();
}

// ─── <think> 实时过滤器（与 strategyTools 保持一致）────────────────────────────
function createThinkStripper(onClean) {
  let buf = '';
  let inThink = false;
  return (delta) => {
    buf += delta;
    let out = '';
    let i = 0;
    while (i < buf.length) {
      if (!inThink) {
        const s = buf.indexOf('<think>', i);
        if (s === -1) { out += buf.slice(i); buf = ''; break; }
        out += buf.slice(i, s);
        inThink = true;
        i = s + 7;
      } else {
        const e = buf.indexOf('</think>', i);
        if (e === -1) { buf = buf.slice(i); break; }
        inThink = false;
        i = e + 8;
      }
    }
    if (out) onClean(out);
  };
}

/**
 * 流式生成策划文档
 * @param {{ plan, userInput, reviewFeedback, onStatus, onSection }} input
 *   onSection(accumulatedMarkdown) — 每遇到 ## 边界或结束时回调，供调用方实时推送预览
 * @param {object} apiKeys  { minimaxApiKey, minimaxModel }
 * @returns {Promise<{ markdown: string, html: string }>}
 */
async function writeDoc({ plan, userInput, reviewFeedback, onStatus, onSection }, apiKeys) {
  console.log('[skill:writeDoc] 开始流式生成策划文档...');
  const { systemPrompt, userPrompt } = buildDocWriterPrompt(plan, userInput, reviewFeedback);

  let accumulated = '';
  let lastSectionAt = 0;

  const emitSection = () => {
    if (typeof onSection === 'function' && accumulated.length > lastSectionAt) {
      try {
        onSection(accumulated);
      } catch {}
      lastSectionAt = accumulated.length;
    }
  };

  const stripper = createThinkStripper((clean) => {
    accumulated += clean;
    // 在新增内容里找 \n## 章节边界
    const newContent = accumulated.slice(lastSectionAt);
    if (/\n## /.test(newContent) && accumulated.length > lastSectionAt + 40) {
      emitSection();
    }
  });

  try {
    if (typeof onStatus === 'function') onStatus({ status: 'requesting' });

    await callMinimaxStreamText(
      [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
      {
        runtimeKey: apiKeys.minimaxApiKey,
        minimaxModel: apiKeys.minimaxModel,
        maxTokens: 6000,
        temperature: 0.4
        // 无需 timeoutMs：流式输出按 chunk 持续到达，不会整体超时
      },
      stripper
    );

    // 流结束后推送最终快照
    emitSection();
    console.log('[skill:writeDoc] 流式生成完成，字符数:', accumulated.length);

  } catch (error) {
    console.warn('[skill:writeDoc] 流式生成失败，切换到稳态兜底稿:', error.message);
    if (typeof onStatus === 'function') onStatus({ status: 'fallback_start', error });
    // 若流式调用失败，立即用结构化 fallback
    if (!accumulated.trim()) {
      accumulated = buildFallbackMarkdown(plan, userInput, reviewFeedback);
    }
    emitSection();
  }

  const markdown = accumulated || buildFallbackMarkdown(plan, userInput, reviewFeedback);
  const html = markdownToHtml(markdown);
  console.log('[skill:writeDoc] 文档生成完成');
  return { markdown, html };
}

module.exports = { writeDoc, buildFallbackMarkdown };
