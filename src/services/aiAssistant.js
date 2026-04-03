// AI辅助生成服务 - 复用统一搜索能力
const { search: webSearch } = require('./webSearch');

async function searchWeb(query) {
  try {
    return await webSearch(query, { maxResults: 5 });
  } catch {
    return { results: [], source: null, warning: null };
  }
}

// 根据主题生成PPT大纲
async function generateOutline(topic, templateType = 'simple') {
  // 使用统一搜索服务补充上下文
  const searchResult = await searchWeb(`${topic} 2025`);

  const baseOutline = {
    simple: {
      title: topic,
      pages: [
        { type: 'cover', title: '封面', mainTitle: topic },
        { type: 'toc', title: '目录', items: [] },
        { type: 'content', title: '概述' },
        { type: 'content', title: '详细内容' },
        { type: 'end', title: '结束页' }
      ]
    },
    business_plan: {
      title: topic,
      pages: [
        { type: 'cover', title: '封面', mainTitle: topic, subtitle: '商业计划书' },
        { type: 'toc', title: '目录', items: [] },
        { type: 'content', title: '项目概述' },
        { type: 'content', title: '市场分析' },
        { type: 'content', title: '产品介绍' },
        { type: 'content', title: '商业模式' },
        { type: 'content', title: '竞争分析' },
        { type: 'content', title: '团队介绍' },
        { type: 'content', title: '融资计划' },
        { type: 'end', title: '结束页' }
      ]
    }
  };

  const outline = baseOutline[templateType] || baseOutline.simple;

  // 如果搜索成功，添加强化信息
  if (searchResult.results.length > 0) {
    outline.searchResults = searchResult.results.slice(0, 3).map(r => ({
      title: r.title,
      url: r.url,
      snippet: r.snippet
    }));
  }

  return outline;
}

// 智能填充页面内容
async function fillPageContent(pageType, context) {
  const { topic, existingContent } = context;

  // 根据页面类型生成内容
  const contentTemplates = {
    cover: {
      mainTitle: topic,
      subtitle: existingContent?.subtitle || '演示文稿',
      date: new Date().getFullYear().toString() + '年'
    },
    toc: {
      items: existingContent?.items || [
        { title: '概述' },
        { title: '详细内容' },
        { title: '总结' }
      ]
    },
    content: {
      title: existingContent?.title || '内容标题',
      sections: existingContent?.sections || [
        {
          title: '要点一',
          content: [`关于${topic}的重要内容点`]
        }
      ]
    },
    end: {
      mainText: '谢谢观看',
      subText: 'THANK YOU'
    }
  };

  return contentTemplates[pageType] || contentTemplates.content;
}

// 生成完整的PPT数据
async function generateFullPPT(topic, templateType = 'simple') {
  const outline = await generateOutline(topic, templateType);

  // 为每个页面生成详细内容
  for (const page of outline.pages) {
    if (page.type !== 'cover' && page.type !== 'end' && page.type !== 'toc') {
      const pageContent = await fillPageContent(page.type, { topic });
      Object.assign(page, pageContent);
    }
  }

  return outline;
}

module.exports = {
  searchWeb,
  generateOutline,
  fillPageContent,
  generateFullPPT
};
