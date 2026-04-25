class StructuredOutputValidationError extends Error {
  constructor(message, issues = []) {
    super(message);
    this.name = 'StructuredOutputValidationError';
    this.issues = issues;
  }
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function asTrimmedString(value, fallback = '') {
  if (value === null || value === undefined) return fallback;
  return String(value).trim();
}

function asStringArray(value, { fallback = [], filterEmpty = true } = {}) {
  const list = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? [value]
      : fallback;

  return list
    .map(item => asTrimmedString(item))
    .filter(item => (filterEmpty ? Boolean(item) : true));
}

function ensureNonEmptyString(value, field, issues) {
  const next = asTrimmedString(value);
  if (!next) issues.push(`${field} 不能为空`);
  return next;
}

function ensureObject(value, field, issues) {
  if (!isPlainObject(value)) {
    issues.push(`${field} 必须是对象`);
    return {};
  }
  return value;
}

function normalizeOrchestratorResult(input) {
  const issues = [];
  const data = ensureObject(input, 'root', issues);
  const tasks = Array.isArray(data.searchTasks) ? data.searchTasks : [];

  const normalizedTasks = tasks
    .map((task, index) => {
      const item = ensureObject(task, `searchTasks[${index}]`, issues);
      const focus = ensureNonEmptyString(item.focus, `searchTasks[${index}].focus`, issues);
      const keywords = asStringArray(item.keywords);
      if (keywords.length === 0) issues.push(`searchTasks[${index}].keywords 至少需要 1 项`);
      return {
        id: asTrimmedString(item.id, `r${index + 1}`) || `r${index + 1}`,
        focus,
        keywords
      };
    })
    .filter(task => task.focus);

  if (normalizedTasks.length < 3) issues.push('searchTasks 至少需要 3 个有效任务');

  const result = {
    parsedGoal: ensureNonEmptyString(data.parsedGoal, 'parsedGoal', issues),
    keyThemes: asStringArray(data.keyThemes),
    targetAudience: asTrimmedString(data.targetAudience),
    searchTasks: normalizedTasks.slice(0, 3),
    pptStructureHint: asTrimmedString(data.pptStructureHint)
  };

  if (result.keyThemes.length === 0) issues.push('keyThemes 至少需要 1 项');

  if (issues.length > 0) {
    throw new StructuredOutputValidationError('orchestrate 输出结构不合法', issues);
  }
  return result;
}

function normalizeStrategizeResult(input) {
  const issues = [];
  const data = ensureObject(input, 'root', issues);
  const sections = Array.isArray(data.sections) ? data.sections : [];

  const normalizedSections = sections
    .map((section, index) => {
      const item = ensureObject(section, `sections[${index}]`, issues);
      const title = ensureNonEmptyString(item.title, `sections[${index}].title`, issues);
      const narrative = ensureNonEmptyString(item.narrative, `sections[${index}].narrative`, issues);
      return {
        title,
        keyPoints: asStringArray(item.keyPoints),
        narrative
      };
    })
    .filter(section => section.title && section.narrative);

  if (normalizedSections.length === 0) issues.push('sections 至少需要 1 个有效章节');

  const budget = ensureObject(data.budget || {}, 'budget', issues);
  const timeline = ensureObject(data.timeline || {}, 'timeline', issues);
  const visualTheme = ensureObject(data.visualTheme || {}, 'visualTheme', issues);
  const visualExecutionHints = ensureObject(data.visualExecutionHints || {}, 'visualExecutionHints', issues);

  const normalized = {
    planTitle: ensureNonEmptyString(data.planTitle, 'planTitle', issues),
    coreStrategy: ensureNonEmptyString(data.coreStrategy, 'coreStrategy', issues),
    highlights: asStringArray(data.highlights),
    sections: normalizedSections,
    budget: {
      total: asTrimmedString(budget.total),
      breakdown: Array.isArray(budget.breakdown)
        ? budget.breakdown.map((item, index) => {
            const row = ensureObject(item, `budget.breakdown[${index}]`, issues);
            return {
              item: asTrimmedString(row.item),
              amount: asTrimmedString(row.amount),
              percentage: asTrimmedString(row.percentage),
              rationale: asTrimmedString(row.rationale)
            };
          }).filter(row => row.item || row.amount || row.percentage || row.rationale)
        : []
    },
    timeline: {
      eventDate: asTrimmedString(timeline.eventDate),
      phases: Array.isArray(timeline.phases)
        ? timeline.phases.map((item, index) => {
            const row = ensureObject(item, `timeline.phases[${index}]`, issues);
            return {
              phase: asTrimmedString(row.phase),
              duration: asTrimmedString(row.duration),
              milestone: asTrimmedString(row.milestone)
            };
          }).filter(row => row.phase || row.duration || row.milestone)
        : []
    },
    kpis: Array.isArray(data.kpis)
      ? data.kpis.map((item, index) => {
          const row = ensureObject(item, `kpis[${index}]`, issues);
          return {
            metric: asTrimmedString(row.metric),
            target: asTrimmedString(row.target),
            rationale: asTrimmedString(row.rationale)
          };
        }).filter(row => row.metric || row.target || row.rationale)
      : [],
    riskMitigation: asStringArray(data.riskMitigation),
    visualTheme: {
      style: ensureNonEmptyString(visualTheme.style, 'visualTheme.style', issues),
      colorMood: asTrimmedString(visualTheme.colorMood),
      imageKeywords: asStringArray(visualTheme.imageKeywords)
    },
    visualExecutionHints: {
      sceneTone: asTrimmedString(visualExecutionHints.sceneTone),
      mustRenderScenes: asStringArray(visualExecutionHints.mustRenderScenes),
      spatialKeywords: asStringArray(visualExecutionHints.spatialKeywords),
      avoidElements: asStringArray(visualExecutionHints.avoidElements),
      onsiteDesignSuggestions: Array.isArray(visualExecutionHints.onsiteDesignSuggestions)
        ? visualExecutionHints.onsiteDesignSuggestions.map((item, index) => {
            const row = ensureObject(item, `visualExecutionHints.onsiteDesignSuggestions[${index}]`, issues);
            return {
              scene: asTrimmedString(row.scene),
              goal: asTrimmedString(row.goal),
              designSuggestion: asTrimmedString(row.designSuggestion),
              visualFocus: asStringArray(row.visualFocus)
            };
          }).filter(row => row.scene || row.goal || row.designSuggestion || row.visualFocus.length > 0)
        : []
    }
  };

  if (normalized.highlights.length === 0) issues.push('highlights 至少需要 1 项');

  if (issues.length > 0) {
    throw new StructuredOutputValidationError('strategize 输出结构不合法', issues);
  }
  return normalized;
}

function normalizeCritiqueResult(input) {
  const issues = [];
  const data = ensureObject(input, 'root', issues);
  const numericScore = Number.parseFloat(data.score);

  if (!Number.isFinite(numericScore)) issues.push('score 必须是数字');

  const result = {
    score: Number.isFinite(numericScore) ? Math.max(0, Math.min(10, numericScore)) : 0,
    strengths: asStringArray(data.strengths),
    weaknesses: asStringArray(data.weaknesses),
    specificFeedback: ensureNonEmptyString(data.specificFeedback, 'specificFeedback', issues)
  };

  if (issues.length > 0) {
    throw new StructuredOutputValidationError('critique 输出结构不合法', issues);
  }
  return result;
}

function normalizeIntentClassificationResult(input) {
  const issues = [];
  const data = ensureObject(input, 'root', issues);
  const allowedTypes = [
    'chat',
    'image_search',
    'image_generate',
    'research',
    'doc_edit',
    'strategy',
    'ppt'
  ];

  const type = ensureNonEmptyString(data.type, 'type', issues);
  if (type && !allowedTypes.includes(type)) {
    issues.push(`type 必须是以下之一：${allowedTypes.join(', ')}`);
  }

  const confidenceValue = Number.parseFloat(data.confidence);
  if (!Number.isFinite(confidenceValue)) issues.push('confidence 必须是数字');

  const normalized = {
    type: allowedTypes.includes(type) ? type : 'chat',
    confidence: Number.isFinite(confidenceValue)
      ? Math.max(0, Math.min(1, confidenceValue))
      : 0,
    reason: asTrimmedString(data.reason),
    needsClarification: Boolean(data.needsClarification)
  };

  if (issues.length > 0) {
    throw new StructuredOutputValidationError('intent 输出结构不合法', issues);
  }

  return normalized;
}

module.exports = {
  StructuredOutputValidationError,
  normalizeOrchestratorResult,
  normalizeStrategizeResult,
  normalizeCritiqueResult,
  normalizeIntentClassificationResult
};
