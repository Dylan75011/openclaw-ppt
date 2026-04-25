// 任务简报相关工具：write_todos, update_brief
const { pickValue } = require('./helpers');

async function execWriteTodos(args, session, onEvent) {
  const todos = Array.isArray(args.todos)
    ? args.todos
      .map((item) => ({
        content: String(item?.content || '').trim(),
        status: ['pending', 'in_progress', 'completed'].includes(item?.status) ? item.status : 'pending'
      }))
      .filter((item) => item.content)
      .slice(0, 8)
    : [];

  session.planItems = todos;
  onEvent('plan_update', { items: todos });

  return {
    success: true,
    count: todos.length
  };
}

async function execUpdateBrief(args, session, onEvent) {
  const previous = session.brief || {};
  const nextBrief = {
    brand: pickValue(args.brand, previous.brand),
    productCategory: pickValue(args.productCategory, previous.productCategory),
    eventType: pickValue(args.eventType, previous.eventType),
    topic: pickValue(args.topic, previous.topic),
    goal: pickValue(args.goal, previous.goal),
    audience: pickValue(args.audience, previous.audience),
    scale: pickValue(args.scale, previous.scale),
    budget: pickValue(args.budget, previous.budget),
    style: pickValue(args.style, previous.style),
    tone: pickValue(args.tone, previous.tone),
    requirements: pickValue(args.requirements, previous.requirements),
    assumptions: Array.isArray(args.assumptions)
      ? args.assumptions.map((item) => String(item || '').trim()).filter(Boolean).slice(0, 5)
      : (previous.assumptions || [])
  };

  session.brief = nextBrief;
  onEvent('brief_update', { brief: nextBrief });
  onEvent('artifact', {
    artifactType: 'task_brief',
    payload: {
      brand: nextBrief.brand,
      topic: nextBrief.topic,
      parsedGoal: nextBrief.goal || nextBrief.requirements || '',
      keyThemes: [nextBrief.eventType, nextBrief.scale, nextBrief.budget].filter(Boolean),
      assumptions: nextBrief.assumptions || []
    }
  });

  return {
    success: true,
    brief: nextBrief
  };
}

module.exports = { execWriteTodos, execUpdateBrief };
