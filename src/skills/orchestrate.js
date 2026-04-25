// Skill: 解析用户活动需求，输出 parsedGoal / searchTasks / pptStructureHint
const { callLLMJson } = require('../utils/llmUtils');
const { buildOrchestratorPrompt } = require('../prompts/orchestrator');
const { normalizeOrchestratorResult } = require('../utils/structuredOutput');

/**
 * @param {object} userInput
 * @param {object} apiKeys  { minimaxApiKey, minimaxModel }
 * @returns {Promise<{ parsedGoal, keyThemes, searchTasks, pptStructureHint }>}
 */
async function orchestrate(userInput, apiKeys) {
  const { systemPrompt, userPrompt } = buildOrchestratorPrompt(userInput);
  console.log('[skill:orchestrate] 开始解析需求...');
  const result = await callLLMJson(
    [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
    {
      model: 'minimax',
      runtimeKey: apiKeys.minimaxApiKey,
      minimaxModel: apiKeys.minimaxModel,
      maxTokens: 2048,
      name: 'orchestrate',
      validate: normalizeOrchestratorResult,
      repairHint: '必须返回对象，包含 parsedGoal(string)、keyThemes(string[])、targetAudience(string)、searchTasks(恰好3项，每项含 id/focus/keywords)、pptStructureHint(string)。',
      debugLabel: 'orchestrate'
    }
  );
  console.log('[skill:orchestrate] 完成，目标:', result.parsedGoal);
  return result;
}

module.exports = { orchestrate };
