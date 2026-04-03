// Skill: 解析用户活动需求，输出 parsedGoal / searchTasks / pptStructureHint
const { callLLMJson } = require('../utils/llmUtils');
const { buildOrchestratorPrompt } = require('../prompts/orchestrator');

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
      name: 'orchestrate'
    }
  );
  console.log('[skill:orchestrate] 完成，目标:', result.parsedGoal);
  return result;
}

module.exports = { orchestrate };
