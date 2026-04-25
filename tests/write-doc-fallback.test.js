const assert = require('assert');
const path = require('path');

const llmUtilsPath = path.resolve(__dirname, '../src/utils/llmUtils.js');
const writeDocPath = path.resolve(__dirname, '../src/skills/writeDoc.js');

const originalLlmUtils = require(llmUtilsPath);
const originalCallLLM = originalLlmUtils.callLLM;

async function run() {
  const fallbackError = new Error('mock timeout');
  originalLlmUtils.callLLM = async () => {
    throw fallbackError;
  };

  delete require.cache[writeDocPath];
  const { writeDoc } = require(writeDocPath);

  let fallbackStatus = '';
  const plan = {
    planTitle: '岚图汽车新品发布会策划方案',
    coreStrategy: '围绕智能豪华与技术信任建立统一发布叙事。',
    highlights: ['用沉浸式场景串联发布流程'],
    sections: [
      {
        title: '发布会主线',
        keyPoints: ['主舞台首发', '媒体体验动线'],
        narrative: '先用一条清晰主线把品牌、产品和体验收拢。'
      }
    ],
    timeline: {
      phases: [{ phase: '预热期', duration: '2 周', milestone: '释放首轮预热内容' }]
    },
    kpis: [{ metric: '传播曝光', target: '破圈扩散', rationale: '形成内容外溢' }],
    riskMitigation: ['预案前置，确保核心节点稳定。'],
    visualExecutionHints: {
      sceneTone: '克制但有力量感的未来科技氛围',
      mustRenderScenes: ['主舞台', '签到区']
    }
  };

  const result = await writeDoc({
    plan,
    userInput: { brand: '岚图汽车', topic: '岚图MPV新车发布会' },
    reviewFeedback: { specificFeedback: '补充执行细节和传播动作。' },
    onStatus: ({ status }) => {
      fallbackStatus = status;
    }
  }, {});

  assert.strictEqual(fallbackStatus, 'fallback_start');
  assert(result.markdown.includes('# 岚图汽车新品发布会策划方案'));
  assert(result.markdown.includes('## 核心策略'));
  assert(result.markdown.includes('## 方案亮点'));
  assert(result.html && result.html.length > 0);

  console.log('writeDoc fallback test passed');
}

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    originalLlmUtils.callLLM = originalCallLLM;
    delete require.cache[writeDocPath];
  });
