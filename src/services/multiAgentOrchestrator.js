// 多 Agent 编排主逻辑
const ResearchAgent    = require('../agents/researchAgent');
const PptBuilderAgent  = require('../agents/pptBuilderAgent');
const ImageAgent       = require('../agents/imageAgent');
const EventVisualDesignerAgent = require('../agents/eventVisualDesignerAgent');
const { orchestrate, strategize, writeDoc } = require('../skills');
const { generatePPT }  = require('./pptGenerator');
const { renderToHtml } = require('./previewRenderer');
const taskManager      = require('./taskManager');
const config           = require('../config');
const workspaceManager = require('./workspaceManager');
const platformMemory   = require('./platformMemory');
const { buildImageCanvasPayload } = require('./imageCanvas');
const { createStallWatcher } = require('./tools/helpers');

function push(taskId, stage, status, extra = {}) {
  taskManager.pushEvent(taskId, 'progress', { stage, status, ...extra });
  taskManager.updateTask(taskId, { currentStage: stage });
}

function pushArtifact(taskId, artifactType, payload = {}) {
  taskManager.pushEvent(taskId, 'artifact', { artifactType, payload });
}

function syncSpaceIndexFromTask(taskId, payload = {}) {
  Promise.resolve().then(async () => {
    const task = taskManager.getTask(taskId);
    const spaceId = task?.userInput?.spaceId;
    if (!spaceId) return;

    await workspaceManager.upsertSpaceIndexFromTask({
      spaceId,
      taskId,
      userInput: task.userInput || {},
      apiKeys: task.savedApiKeys || {},
      ...payload
    });
  }).catch((err) => {
    console.warn('[space-index] sync failed:', err.message);
  });
}

async function runMultiAgent(taskId, userInput, apiKeys = {}) {
  taskManager.updateTask(taskId, { status: 'running' });

  try {
    const memory = platformMemory.getMemoryForPrompt();
    Object.assign(userInput, {
      platformMemorySummary:        memory.summary || '',
      platformMemoryPrinciples:     Array.isArray(memory.principles)      ? memory.principles      : [],
      platformMemoryPatterns:       Array.isArray(memory.patterns)        ? memory.patterns        : [],
      platformMemoryPitfalls:       Array.isArray(memory.pitfalls)        ? memory.pitfalls        : [],
      platformMemoryRecentLearnings:Array.isArray(memory.recentLearnings) ? memory.recentLearnings : []
    });

    // ─── 1. Orchestrate ──────────────────────────────────────────
    push(taskId, 'orchestrator', 'running', { message: '正在解析活动需求...' });
    const orchestratorOutput = await orchestrate(userInput, apiKeys);
    push(taskId, 'orchestrator', 'completed', {
      message: `需求解析完成：${orchestratorOutput.parsedGoal}`,
      data: { parsedGoal: orchestratorOutput.parsedGoal, keyThemes: orchestratorOutput.keyThemes }
    });
    pushArtifact(taskId, 'task_brief', {
      parsedGoal:       orchestratorOutput.parsedGoal,
      keyThemes:        orchestratorOutput.keyThemes || [],
      searchTasks:      orchestratorOutput.searchTasks || [],
      pptStructureHint: orchestratorOutput.pptStructureHint || ''
    });
    taskManager.updateTask(taskId, { progress: 15 });

    // ─── 2. Research × N 并行 ─────────────────────────────────────
    const searchTasks = orchestratorOutput.searchTasks || [];
    const researchAgents = searchTasks.map((_, i) => new ResearchAgent(i + 1, apiKeys));

    searchTasks.forEach((t, i) => {
      push(taskId, 'research', 'running', {
        agentId: `research-${i + 1}`,
        message: `Research-${i + 1} 正在搜索：${t.focus}`
      });
    });

    const researchResults = await Promise.all(
      searchTasks.map((task, i) =>
        researchAgents[i].run({ task, orchestratorOutput }).then(result => {
          push(taskId, 'research', 'completed', {
            agentId: `research-${i + 1}`,
            message: `Research-${i + 1} 完成`
          });
          pushArtifact(taskId, 'research_result', {
            agentId:      `research-${i + 1}`,
            focus:        result.focus || task.focus,
            summary:      result.summary || '',
            keyFindings:  result.keyFindings || [],
            inspirations: result.inspirations || []
          });
          return result;
        }).catch(err => {
          push(taskId, 'research', 'failed', {
            agentId: `research-${i + 1}`,
            message: `Research-${i + 1} 失败：${err.message}`
          });
          return { taskId: task.id, focus: task.focus, summary: '搜索失败', keyFindings: [], inspirations: [] };
        })
      )
    );
    taskManager.updateTask(taskId, { progress: 40 });

    // ─── 3. Strategize（单轮，跳过 Critique 评审）────────────────
    push(taskId, 'strategy', 'running', { round: 1, message: '正在制定策划方案...' });
    const bestPlan = await strategize({ orchestratorOutput, researchResults, round: 1, previousFeedback: null, userInput }, apiKeys);
    push(taskId, 'strategy', 'completed', { round: 1, message: '策划方案完成' });
    (bestPlan.sections || []).forEach((section, index) => {
      pushArtifact(taskId, 'plan_section', {
        round: 1,
        index,
        title:     section.title || `章节 ${index + 1}`,
        keyPoints: section.keyPoints || [],
        content:   section.content || {}
      });
    });
    const bestScore = 0;
    taskManager.updateTask(taskId, { progress: 70 });

    // ─── 4. 生成策划文档 ──────────────────────────────────────────
    push(taskId, 'building', 'running', { message: '正在整理策划文档...' });
    const docWatchdog = createStallWatcher(() => {
      push(taskId, 'building', 'running', { message: '策划文档仍在整理，正在等待模型返回...' });
    });
    let markdown;
    let docHtml;
    try {
      ({ markdown, html: docHtml } = await writeDoc({
        plan: bestPlan,
        userInput,
        reviewFeedback: null,
        onStatus: ({ status }) => {
          docWatchdog.bump();
          if (status === 'fallback_start') {
            push(taskId, 'building', 'running', { message: '文档整理稍慢，先切换为稳态成稿继续往下走...' });
          }
        }
      }, apiKeys));
    } finally {
      docWatchdog.stop();
    }
    push(taskId, 'building', 'completed', { message: '策划文档已生成' });

    taskManager.updateTask(taskId, {
      status: 'awaiting_confirmation',
      progress: 90,
      bestPlan,
      bestScore,
      savedApiKeys: apiKeys,
      docMarkdown: markdown,
      docHtml
    });

    taskManager.pushEvent(taskId, 'doc_ready', {
      docHtml,
      title: bestPlan?.planTitle || userInput.topic || '策划方案',
      score: bestScore
    });
    syncSpaceIndexFromTask(taskId, {
      status:    'doc_ready',
      planTitle: bestPlan?.planTitle || userInput.topic || '策划方案',
      summary:   bestPlan?.coreStrategy || orchestratorOutput?.parsedGoal || '',
      highlights:bestPlan?.highlights || [],
      score:     bestScore
    });
    platformMemory.updateMemoryFromTask({
      taskId,
      userInput,
      planTitle: bestPlan?.planTitle || userInput.topic || '策划方案',
      summary:   bestPlan?.coreStrategy || orchestratorOutput?.parsedGoal || '',
      highlights:bestPlan?.highlights || [],
      score:     bestScore || '',
      status:    'doc_ready',
      apiKeys:   apiKeys || {}
    }).catch((err) => {
      console.warn('[platform-memory] doc_ready update failed:', err.message);
    });

  } catch (err) {
    console.error(`[MultiAgent] 任务 ${taskId} 失败:`, err);
    taskManager.updateTask(taskId, { status: 'failed', error: err.message });
    taskManager.pushEvent(taskId, 'error', {
      stage:   taskManager.getTask(taskId)?.currentStage || 'unknown',
      message: err.message,
      code:    'PIPELINE_ERROR'
    });
  }
}

/**
 * 从候选图中自动选取每个类别的最佳图（第一张，已由 ImageAgent 按相关性排序）
 */
function autoSelectImages(imageCandidates) {
  const map = {};
  for (const category of ['cover', 'content', 'end']) {
    const list = imageCandidates?.[category];
    if (list && list.length > 0 && list[0].localPath) {
      map[category] = list[0].localPath;
    }
  }
  map.pages = Object.fromEntries(
    (imageCandidates?.pages || [])
      .filter(item => item?.localPath && Number.isInteger(item.pageIndex))
      .map(item => [item.pageIndex, item])
  );
  return map;
}

/**
 * 用户确认文档后，触发 PPT 生成阶段
 */
async function runPptBuilder(taskId, docContent) {
  const task = taskManager.getTask(taskId);
  if (!task) throw new Error('任务不存在');

  const { bestPlan, savedApiKeys: apiKeys, userInput } = task;
  const imageMap = {};
  const pptBuilderAgent = new PptBuilderAgent(apiKeys);

  taskManager.updateTask(taskId, { status: 'running', currentStage: 'building' });

  try {
    push(taskId, 'building', 'running', { message: '正在生成 PPT 大纲...' });

    const pptData = await pptBuilderAgent.run({
      plan: bestPlan,
      userInput,
      docContent,
      imageMap,
      onOutlineReady: async (outline, total) => {
        push(taskId, 'building', 'running', { message: '正在由活动图设计师规划现场效果图...' });
        const visualDesignerAgent = new EventVisualDesignerAgent(apiKeys || {});
        const visualPlan = await visualDesignerAgent.run({
          plan: bestPlan,
          pptOutline: outline,
          userInput,
          attachments: Array.isArray(task?.attachments) ? task.attachments : []
        }).catch(err => {
          console.warn('[runPptBuilder] 活动图设计失败:', err.message);
          return null;
        });

        if (visualPlan?.pages?.length) {
          outline.pages = (outline.pages || []).map((page, index) => ({
            ...page,
            visualAssetPlan: visualPlan.pages.find(item => item.pageIndex === index) || page.visualAssetPlan || null
          }));
        }

        push(taskId, 'building', 'running', { message: '正在为每页执行搜图与效果图生成...' });
        const imageCandidates = await runImageSearch(taskId, outline, visualPlan).catch(err => {
          console.warn('[runPptBuilder] 配图搜索失败，将不带背景图生成:', err.message);
          return {};
        });
        const selected = autoSelectImages(imageCandidates || {});
        Object.assign(imageMap, selected);
        console.log('[runPptBuilder] 配图已注入:', Object.keys(imageMap));

        pushArtifact(taskId, 'image_canvas', buildImageCanvasPayload(imageCandidates, visualPlan, outline));
        taskManager.pushEvent(taskId, 'artifact', {
          artifactType: 'ppt_outline',
          payload: { title: outline.title, total, pages: outline.pages || [] }
        });
      },
      onPageReady: (page, index, total, theme) => {
        const html = renderToHtml({ pages: [page], theme })[0];
        taskManager.pushEvent(taskId, 'slide_added', { html, index, total });
        taskManager.updateTask(taskId, {
          progress: 90 + Math.round((index + 1) / total * 8)
        });
      }
    });

    taskManager.updateTask(taskId, { progress: 98 });

    const filename = `ppt_${Date.now()}.pptx`;
    const exportResult = await generatePPT(pptData, filename, { runId: taskId });
    const downloadUrl = exportResult.path;
    const previewSlides = renderToHtml(pptData);

    push(taskId, 'building', 'completed', { message: 'PPT 生成完成' });
    taskManager.updateTask(taskId, {
      status: 'completed',
      progress: 100,
      result: { filename: exportResult.filename, downloadUrl, previewSlides, previewData: pptData }
    });

    taskManager.pushEvent(taskId, 'done', { filename: exportResult.filename, downloadUrl, previewSlides, previewData: pptData });
    syncSpaceIndexFromTask(taskId, {
      status:       'completed',
      planTitle:    bestPlan?.planTitle || userInput.topic || '策划方案',
      summary:      bestPlan?.coreStrategy || task.docMarkdown || '',
      highlights:   bestPlan?.highlights || [],
      score:        task.bestScore || '',
      pptPageTotal: Array.isArray(pptData?.pages) ? pptData.pages.length : 0
    });
    platformMemory.updateMemoryFromTask({
      taskId,
      userInput,
      planTitle: bestPlan?.planTitle || userInput.topic || '策划方案',
      summary:   bestPlan?.coreStrategy || task.docMarkdown || '',
      highlights:bestPlan?.highlights || [],
      score:     task.bestScore || '',
      status:    'completed',
      apiKeys:   apiKeys || {}
    }).catch((err) => {
      console.warn('[platform-memory] update failed:', err.message);
    });

  } catch (err) {
    console.error(`[runPptBuilder] 任务 ${taskId} PPT 生成失败:`, err);
    taskManager.updateTask(taskId, { status: 'failed', error: err.message });
    taskManager.pushEvent(taskId, 'error', {
      stage:   'building',
      message: err.message,
      code:    'PPT_BUILD_ERROR'
    });
  }
}

/**
 * 配图搜索（在 outline 生成后由 runPptBuilder 内部调用）
 */
async function runImageSearch(taskId, pptOutline = null, visualPlan = null) {
  const task = taskManager.getTask(taskId);
  if (!task) throw new Error('任务不存在');

  const { bestPlan, userInput, savedApiKeys: apiKeys } = task;
  const imageAgent = new ImageAgent(apiKeys || {});
  const visualDesignerAgent = new EventVisualDesignerAgent(apiKeys || {});

  try {
    const resolvedVisualPlan = visualPlan || await visualDesignerAgent.run({
      plan: bestPlan,
      pptOutline,
      userInput,
      attachments: Array.isArray(task?.attachments) ? task.attachments : []
    }).catch(err => {
      console.warn('[runImageSearch] 活动图设计失败，继续用旧逻辑兜底:', err.message);
      return null;
    });

    const imageCandidates = await imageAgent.run({
      plan: bestPlan,
      userInput,
      taskId,
      pptOutline,
      visualPlan: resolvedVisualPlan
    });
    taskManager.updateTask(taskId, { imageCandidates });
    console.log('[runImageSearch] 配图搜索完成');
    return imageCandidates;
  } catch (err) {
    console.warn('[runImageSearch] 搜索失败:', err.message);
    throw err;
  }
}

module.exports = { runMultiAgent, runPptBuilder, runImageSearch };
