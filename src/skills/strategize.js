// Skill: 基于研究结果和 Orchestrator 输出，制定完整策划方案
const { callLLMJson } = require('../utils/llmUtils');
const { buildStrategyPrompt } = require('../prompts/strategy');

/**
 * @param {{ orchestratorOutput, researchResults, round, previousFeedback, userInput }} input
 * @param {object} apiKeys  { minimaxApiKey, minimaxModel }
 * @returns {Promise<{ planTitle, coreStrategy, highlights, sections, visualTheme }>}
 */
async function strategize(input, apiKeys) {
  console.log(`[skill:strategize] 开始制定方案（第${input.round}轮）...`);
  const { systemPrompt, userPrompt } = buildStrategyPrompt(input);
  const result = await callLLMJson(
    [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
    {
      model: 'minimax',
      runtimeKey: apiKeys.minimaxApiKey,
      minimaxModel: apiKeys.minimaxModel,
      maxTokens: 6144,
      name: 'strategize'
    }
  );
  console.log(`[skill:strategize] 方案完成: ${result.planTitle}`);
  return result;
}

module.exports = { strategize };
