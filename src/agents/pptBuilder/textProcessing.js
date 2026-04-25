const STABLE_LAYOUTS = new Set([
  'immersive_cover',
  'cover',
  'toc',
  'editorial_quote',
  'data_cards',
  'asymmetrical_story',
  'split_content',
  'timeline_flow',
  'end_card',
  'bento_grid'
]);

function estimateTextWeight(text = '') {
  const value = String(text || '').trim();
  const cjkCount = (value.match(/[\u4e00-\u9fff]/g) || []).length;
  const latinCount = value.length - cjkCount;
  return cjkCount + latinCount * 0.45;
}

function summarizeText(text = '', maxWeight = 42) {
  const value = String(text || '').trim();
  if (!value) return '';
  const clauses = value
    .split(/[。！？；]/)
    .map(part => part.trim())
    .filter(Boolean);
  if (clauses.length > 1) {
    let combined = '';
    for (const clause of clauses) {
      const candidate = combined ? `${combined}，${clause}` : clause;
      if (estimateTextWeight(candidate) > maxWeight) break;
      combined = candidate;
    }
    if (combined) return combined.length < value.length ? `${combined}...` : combined;
  }
  let weight = 0;
  let result = '';
  for (const char of value) {
    weight += /[\u4e00-\u9fff]/.test(char) ? 1 : 0.45;
    if (weight > maxWeight) break;
    result += char;
  }
  return result.length < value.length ? `${result.trim()}...` : value;
}

function trimLine(text = '', maxWeight = 24) {
  const value = String(text || '').trim();
  if (!value) return '';
  return estimateTextWeight(value) > maxWeight ? summarizeText(value, maxWeight) : value;
}

function inferPageRole(page = {}, index = 0, total = 0) {
  if (index === 0) return 'cover';
  if (total > 1 && index === total - 1) return 'closing';
  return page?.visualIntent?.role || page?.layout || page?.type || 'section';
}

function stableLayoutForRole(role = 'section', index = 0, total = 0) {
  if (index === 0 || role === 'cover') return 'immersive_cover';
  if (total > 1 && index === total - 1) return 'end_card';
  if (role === 'toc') return 'toc';
  if (role === 'manifesto') return 'editorial_quote';
  if (role === 'highlights' || role === 'metrics') return 'data_cards';
  if (role === 'team') return 'bento_grid';
  if (role === 'timeline') return 'timeline_flow';
  if (role === 'comparison') return 'split_content';
  return 'asymmetrical_story';
}

function extractTeamItems(plan = {}, context) {
  const pools = [
    plan?.team,
    plan?.teamRoles,
    plan?.teamAssignments,
    plan?.executionTeam,
    plan?.staffing,
    plan?.organization,
  ];

  const normalizeEntry = (entry) => {
    if (!entry) return '';
    if (typeof entry === 'string') return trimLine(entry, 48);
    const role = trimLine(entry.role || entry.title || entry.position || entry.name, 24);
    const owner = trimLine(entry.owner || entry.person || entry.lead || entry.member, 20);
    const note = trimLine(entry.responsibility || entry.scope || entry.desc || entry.description, 28);
    return [role, owner ? ` / ${owner}` : '', note ? `: ${note}` : ''].join('').trim();
  };

  for (const pool of pools) {
    if (!Array.isArray(pool) || !pool.length) continue;
    const items = pool.map(normalizeEntry).filter(Boolean).slice(0, 6);
    if (items.length) return items;
  }

  const sections = Array.isArray(plan?.sections) ? plan.sections : [];
  const teamSection = sections.find(section => /团队|分工|组织|保障|执行团队|team|staff/i.test(section?.title || ''));
  if (!teamSection) return [];
  const sanitizeList = context && context.sanitizeList ? context.sanitizeList.bind(context) : (items, opts) => {
    return (Array.isArray(items) ? items : [])
      .map(item => trimLine(item, opts?.maxWeight || 56))
      .filter(Boolean)
      .slice(0, opts?.maxItems || 8);
  };
  return sanitizeList(teamSection.keyPoints || [], { maxItems: 6, maxWeight: 44 });
}

module.exports = {
  STABLE_LAYOUTS,
  estimateTextWeight,
  summarizeText,
  trimLine,
  inferPageRole,
  stableLayoutForRole,
  extractTeamItems,
};
