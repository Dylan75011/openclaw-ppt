// Agent 基类：绑定 apiKeys、委托 llmUtils 进行 LLM 调用
const { callLLM, callLLMJson } = require('../utils/llmUtils');

class BaseAgent {
  /**
   * @param {string} name
   * @param {'minimax' | 'deepseek-reasoner'} model
   * @param {object} apiKeys  运行时 Key，在构造时注入
   */
  constructor(name, model = 'minimax', apiKeys = {}) {
    this.name = name;
    this.model = model;
    this.apiKeys = apiKeys;
  }

  /** 将实例上下文合并到 llmUtils options */
  _llmOptions(options = {}) {
    const runtimeKey = this.model === 'deepseek-reasoner'
      ? this.apiKeys.deepseekApiKey
      : this.apiKeys.minimaxApiKey;
    return {
      model: this.model,
      runtimeKey,
      minimaxModel: this.apiKeys.minimaxModel || undefined,
      name: this.name,
      ...options
    };
  }

  async callLLM(messages, options = {}) {
    return callLLM(messages, this._llmOptions(options));
  }

  async callLLMJson(messages, options = {}) {
    return callLLMJson(messages, this._llmOptions(options));
  }

  /** 子类实现此方法 */
  async run(input) {
    throw new Error(`[${this.name}] run() 未实现`);
  }
}

module.exports = BaseAgent;
