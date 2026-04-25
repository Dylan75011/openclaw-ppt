const { extractTeamItems, estimateTextWeight, trimLine } = require('./textProcessing');

function buildStructuredFallback({ plan, userInput }, context) {
  const brand = userInput?.brand || plan?.visualTheme?.brand || '品牌'
  const visualTheme = plan?.visualTheme || {}
  const imageKeywords = Array.isArray(visualTheme.imageKeywords) && visualTheme.imageKeywords.length
    ? visualTheme.imageKeywords
    : ['premium automotive launch', 'cinematic stage lighting', 'luxury technology atmosphere', 'future mobility']
  const sections = Array.isArray(plan?.sections) ? plan.sections : []
  const highlights = Array.isArray(plan?.highlights) ? plan.highlights.filter(Boolean) : []
  const phases = Array.isArray(plan?.timeline?.phases) ? plan.timeline.phases.filter(Boolean) : []
  const kpis = Array.isArray(plan?.kpis) ? plan.kpis.filter(Boolean) : []
  const budgetBreakdown = Array.isArray(plan?.budget?.breakdown) ? plan.budget.breakdown.filter(Boolean) : []
  const risks = Array.isArray(plan?.riskMitigation) ? plan.riskMitigation.filter(Boolean) : []
  const teamItems = extractTeamItems(plan, context)

  const keywordSeed = imageKeywords.join(' ')
  const compositionCycle = ['editorial-left', 'split-editorial', 'annotation-runway', 'hero-asymmetric']
  const sectionPages = sections.slice(0, 20).map((section, index) => {
    const composition = compositionCycle[index % compositionCycle.length]
    const summary = String(section.narrative || '').trim()
    const compactSummary = summary.length > 160 ? `${summary.slice(0, 160).trim()}...` : summary
    const rawFacts = (section.keyPoints || []).slice(0, composition === 'hero-asymmetric' ? 5 : 6)
    const compactFacts = rawFacts.map((item) => {
      const text = String(item || '').trim()
      return text.length > 56 ? `${text.slice(0, 56).trim()}...` : text
    })
    const regionNames = composition === 'split-editorial'
      ? { lead: 'left', body: 'left', facts: 'right' }
      : composition === 'annotation-runway'
        ? { lead: 'header', body: 'quote', facts: 'facts' }
        : composition === 'hero-asymmetric'
          ? { lead: 'header', body: 'body', facts: 'rail' }
          : { lead: 'header', body: 'statement', facts: 'facts' }
    return {
      layout: 'asymmetrical_story',
      style: 'dark_tech',
      composition,
      title: section.title || `章节 ${index + 1}`,
      subtitle: compactSummary || '',
      facts: compactFacts,
      regions: composition === 'hero-asymmetric'
        ? [
            { name: 'header', x: 7, y: 12, w: 48, h: 24, stack: 'vertical', gap: 12, align: 'start', valign: 'start' },
            { name: 'body', x: 7, y: 46, w: 42, h: 24, stack: 'vertical', gap: 10, align: 'start', valign: 'start' },
            { name: 'rail', x: 68, y: 16, w: 18, h: 48, stack: 'vertical', gap: 10, align: 'stretch', valign: 'start' }
          ]
        : composition === 'annotation-runway'
          ? [
              { name: 'header', x: 8, y: 12, w: 36, h: 20, stack: 'vertical', gap: 12, align: 'start', valign: 'start' },
              { name: 'quote', x: 8, y: 42, w: 38, h: 22, stack: 'vertical', gap: 10, align: 'start', valign: 'start' },
              { name: 'facts', x: 58, y: 18, w: 28, h: 40, stack: 'vertical', gap: 10, align: 'stretch', valign: 'start' }
            ]
          : undefined,
      textBlocks: [
        { region: regionNames.lead, kind: 'eyebrow', text: `SECTION ${String(index + 1).padStart(2, '0')}` },
        { region: regionNames.lead, kind: 'title', text: section.title || `章节 ${index + 1}`, size: composition === 'hero-asymmetric' ? 38 : 42 },
        ...(compactSummary ? [{ region: regionNames.body, kind: composition === 'annotation-runway' ? 'quote' : 'body', text: compactSummary, size: composition === 'hero-asymmetric' ? 14 : 14, lineHeight: composition === 'annotation-runway' ? 1.5 : 1.7, strong: composition === 'hero-asymmetric', clamp: composition === 'hero-asymmetric' ? 5 : 6 }] : []),
        { region: regionNames.facts, kind: 'fact-list', items: compactFacts, variant: composition === 'annotation-runway' ? 'side-notes' : undefined, size: composition === 'hero-asymmetric' ? 12 : 13, lineHeight: composition === 'hero-asymmetric' ? 1.52 : 1.6, clamp: composition === 'hero-asymmetric' ? 2 : 3 }
      ],
      visualIntent: {
        role: 'section',
        mood: '坚定、专业、发布会式叙事',
        density: 'medium',
        composition,
        reason: '按章节建立连续但不重复的叙事页'
      },
      imageStrategy: {
        useBackground: true,
        query: `${brand} ${section.title || 'launch strategy'} ${keywordSeed}`.trim(),
        treatment: index % 2 === 0 ? 'editorial-fade' : 'split-atmosphere',
        overlay: index % 2 === 0 ? 0.56 : 0.48,
        focalPoint: index % 2 === 0 ? 'right-center' : 'center',
        textPlacement: composition === 'split-editorial' ? 'left' : 'left'
      }
    }
  })

  const pages = [
    {
      layout: 'immersive_cover',
      style: 'dark_tech',
      composition: 'hero-asymmetric',
      regions: [
        { name: 'header', x: 7, y: 14, w: 44, h: 34, stack: 'vertical', gap: 14, align: 'start', valign: 'start' },
        { name: 'body', x: 7, y: 68, w: 34, h: 12, stack: 'vertical', gap: 8, align: 'start', valign: 'end' },
        { name: 'rail', x: 73, y: 14, w: 14, h: 46, stack: 'vertical', gap: 10, align: 'stretch', valign: 'start' }
      ],
      title: plan?.planTitle || `${brand} 发布会活动策划方案`,
      subtitle: plan?.coreStrategy || `${brand} 新品发布会整体提案`,
      brand,
      date: plan?.timeline?.eventDate || '2026',
      location: 'Launch Proposal',
      textBlocks: [
        { region: 'header', kind: 'eyebrow', text: brand },
        { region: 'header', kind: 'title', text: plan?.planTitle || `${brand} 新品发布会活动策划方案`, size: 42 },
        { region: 'header', kind: 'subtitle', text: plan?.coreStrategy || '以发布会叙事承接技术实力、品牌高度与市场预热', size: 14, lineHeight: 1.75 },
        { region: 'body', kind: 'body', text: '让产品发布、品牌气质与传播引爆在同一条叙事线上完成闭环。', size: 13, lineHeight: 1.7 },
        { region: 'rail', kind: 'fact-list', items: highlights.slice(0, 3) }
      ],
      visualIntent: {
        role: 'cover',
        mood: '高端、克制、沉浸',
        density: 'airy',
        composition: 'left-weighted',
        reason: '用更像发布会 KV 的封面定调'
      },
      imageStrategy: {
        useBackground: true,
        query: `${brand} flagship launch cinematic key visual ${keywordSeed}`.trim(),
        treatment: 'full-bleed-dark',
        overlay: 0.42,
        focalPoint: 'right-center',
        textPlacement: 'left'
      }
    },
    {
      layout: 'toc',
      style: 'dark_tech',
      composition: 'split-editorial',
      title: '目录',
      textBlocks: [
        { region: 'left', kind: 'eyebrow', text: 'CONTENTS' },
        { region: 'left', kind: 'title', text: '目录' },
        { region: 'right', kind: 'fact-list', items: sections.slice(0, 6).map(item => item.title || '章节') }
      ],
      visualIntent: {
        role: 'toc',
        mood: '清晰、简洁、建立结构',
        density: 'medium',
        composition: 'sidebar',
        reason: '让后续内容节奏更有组织'
      },
      imageStrategy: {
        useBackground: false,
        query: '',
        treatment: 'none',
        overlay: 0,
        focalPoint: 'center',
        textPlacement: 'left'
      }
    },
    {
      layout: 'editorial_quote',
      style: 'dark_tech',
      composition: 'annotation-runway',
      regions: [
        { name: 'header', x: 8, y: 12, w: 28, h: 18, stack: 'vertical', gap: 10, align: 'start', valign: 'start' },
        { name: 'quote', x: 8, y: 40, w: 36, h: 26, stack: 'vertical', gap: 10, align: 'start', valign: 'start' },
        { name: 'facts', x: 58, y: 18, w: 28, h: 42, stack: 'vertical', gap: 12, align: 'stretch', valign: 'start' }
      ],
      title: '核心策略',
      subtitle: plan?.coreStrategy || '以高端智能叙事统领发布会表达',
      quote: plan?.coreStrategy || '用一场有仪式感的发布会，把产品实力翻译成时代性品牌语言。',
      facts: highlights.slice(0, 3),
      textBlocks: [
        { region: 'header', kind: 'eyebrow', text: 'STRATEGY' },
        { region: 'header', kind: 'title', text: '核心策略', size: 34 },
        { region: 'quote', kind: 'quote', text: plan?.coreStrategy || '用一场有仪式感的发布会，把产品实力翻译成时代性品牌语言。', size: 24, lineHeight: 1.42, clamp: 4 },
        { region: 'facts', kind: 'fact-list', items: highlights.slice(0, 3), variant: 'side-notes' }
      ],
      visualIntent: {
        role: 'manifesto',
        mood: '宣言感、克制、有压迫感',
        density: 'airy',
        composition: 'editorial',
        reason: '把方案中心命题立住'
      },
      imageStrategy: {
        useBackground: true,
        query: `${brand} premium keynote atmosphere ${keywordSeed}`.trim(),
        treatment: 'editorial-fade',
        overlay: 0.52,
        focalPoint: 'right-center',
        textPlacement: 'left'
      }
    },
    {
      layout: 'data_cards',
      style: 'dark_tech',
      composition: 'highlights-board',
      title: '活动亮点总览',
      metrics: highlights.slice(0, 6).map((item, index) => ({
        value: String(index + 1).padStart(2, '0'),
        label: item,
        sub: 'Key Highlight'
      })),
      textBlocks: [
        { region: 'header', kind: 'eyebrow', text: 'HIGHLIGHTS' },
        { region: 'header', kind: 'title', text: '活动亮点总览' },
        { region: 'facts', kind: 'fact-list', variant: 'floating-tags', items: highlights.slice(0, 5) }
      ],
      visualIntent: {
        role: 'highlights',
        mood: '有秩序但不平庸',
        density: 'medium',
        composition: 'mosaic',
        reason: '把亮点变成一面有层次的战报墙'
      },
      imageStrategy: {
        useBackground: true,
        query: `${brand} premium texture lighting ${keywordSeed}`.trim(),
        treatment: 'subtle-grid',
        overlay: 0.8,
        focalPoint: 'center',
        textPlacement: 'left'
      }
    },
    ...sectionPages,
    ...(phases.length ? [{
      layout: 'timeline_flow',
      style: 'dark_tech',
      composition: 'schedule-strip',
      regions: [
        { name: 'header', x: 7, y: 9, w: 36, h: 16, stack: 'vertical', gap: 8, align: 'start', valign: 'start' },
        { name: 'timeline', x: 7, y: 28, w: 86, h: 54, stack: 'vertical', gap: 0, align: 'stretch', valign: 'stretch' }
      ],
      title: '执行时间线',
      subtitle: '从预热、发布到转化的完整节奏推进',
      phases: phases.slice(0, 5).map((phase) => ({
        date: phase.duration || '',
        name: phase.phase || '',
        tasks: [phase.milestone || '关键里程碑']
      })),
      textBlocks: [
        { region: 'header', kind: 'eyebrow', text: 'TIMELINE' },
        { region: 'header', kind: 'title', text: '执行时间线', size: 30 },
        { region: 'header', kind: 'subtitle', text: '从预热、发布到转化的完整节奏推进', size: 13, lineHeight: 1.6 },
        { region: 'timeline', kind: 'timeline', items: phases.slice(0, 5).map((phase) => ({
          date: phase.duration || '',
          name: phase.phase || '',
          tasks: [phase.milestone || '关键里程碑']
        })) }
      ],
      visualIntent: {
        role: 'timeline',
        mood: '推进感明确、执行感强',
        density: 'medium',
        composition: 'schedule-strip',
        reason: '把筹备到传播的节奏打清楚'
      },
      imageStrategy: {
        useBackground: true,
        query: `${brand} motion path stage lighting future ${keywordSeed}`.trim(),
        treatment: 'dim-atmosphere',
        overlay: 0.74,
        focalPoint: 'center',
        textPlacement: 'center'
      }
    }] : []),
    ...(budgetBreakdown.length ? [{
      layout: 'data_cards',
      style: 'dark_tech',
      composition: 'budget-table',
      title: '预算分配',
      textBlocks: [
        { region: 'header', kind: 'eyebrow', text: 'BUDGET' },
        { region: 'header', kind: 'title', text: '预算分配' },
        { region: 'left', kind: 'fact-list', variant: 'compact-notes', items: budgetBreakdown.slice(0, 4).map(item => `${item.item || '预算项'} ${item.percentage ? `· ${item.percentage}` : ''}`), clamp: 2 },
        { region: 'right', kind: 'stats', variant: 'ledger', items: budgetBreakdown.slice(0, 4).map(item => ({ value: item.amount || '', label: item.item || '', sub: item.percentage || '' })) }
      ],
      metrics: budgetBreakdown.slice(0, 4).map(item => ({ value: item.amount || '', label: item.item || '', sub: item.percentage || '' })),
      visualIntent: {
        role: 'metrics',
        mood: '理性、可信、结果导向',
        density: 'compact',
        composition: 'budget-table',
        reason: '把预算结构做成易读的账本页'
      },
      imageStrategy: {
        useBackground: true,
        query: `${brand} data mesh subtle luxury background ${keywordSeed}`.trim(),
        treatment: 'subtle-grid',
        overlay: 0.86,
        focalPoint: 'center',
        textPlacement: 'left'
      }
    }] : []),
    ...(kpis.length ? [{
      layout: 'data_cards',
      style: 'dark_tech',
      composition: 'kpi-ledger',
      title: '效果目标',
      textBlocks: [
        { region: 'header', kind: 'eyebrow', text: 'KPI' },
        { region: 'header', kind: 'title', text: '效果目标' },
        { region: 'left', kind: 'stats', variant: 'staggered-notes', items: kpis.slice(0, 2).map(item => ({ value: item.target || '', label: item.metric || '', sub: 'Target' })) },
        { region: 'right', kind: 'stats', variant: 'ledger', items: kpis.slice(0, 4).map(item => ({ value: item.target || '', label: item.metric || '', sub: item.unit || 'Target' })) }
      ],
      metrics: kpis.slice(0, 4).map(item => ({ value: item.target || '', label: item.metric || '', sub: item.unit || 'Target' })),
      visualIntent: {
        role: 'metrics',
        mood: '明确、强结果导向、战报感',
        density: 'compact',
        composition: 'kpi-ledger',
        reason: '把关键成效目标做成主指标加说明账本'
      },
      imageStrategy: {
        useBackground: true,
        query: `${brand} premium analytics dashboard abstract lighting ${keywordSeed}`.trim(),
        treatment: 'subtle-grid',
        overlay: 0.88,
        focalPoint: 'center',
        textPlacement: 'left'
      }
    }] : []),
    ...(risks.length ? [{
      layout: 'split_content',
      style: 'dark_tech',
      composition: 'risk-matrix',
      title: '风险与应对',
      leftTitle: '关键风险',
      leftItems: risks.slice(0, 4),
      rightTitle: '应对原则',
      rightItems: [
        '提前彩排与多套技术备份',
        '舆情监控与现场应急机制',
        '媒体、嘉宾与用户动线分流',
        '线上线下联动保持信息一致'
      ],
      textBlocks: [
        { region: 'header', kind: 'eyebrow', text: 'RISK CONTROL' },
        { region: 'header', kind: 'title', text: '风险与应对' },
        { region: 'left', kind: 'fact-list', title: '关键风险', variant: 'compact-notes', size: 11, clamp: 2, items: risks.slice(0, 4) },
        { region: 'right', kind: 'fact-list', title: '应对原则', variant: 'editorial-list', items: [
          '提前彩排与多套技术备份',
          '舆情监控与现场应急机制',
          '媒体、嘉宾与用户动线分流',
          '线上线下联动保持信息一致'
        ], size: 11, clamp: 2 }
      ],
      visualIntent: {
        role: 'comparison',
        mood: '冷静、专业、可执行',
        density: 'medium',
        composition: 'risk-matrix',
        reason: '让方案看起来像真正可落地的项目管理'
      },
      imageStrategy: {
        useBackground: true,
        query: `${brand} control room stage operations ${keywordSeed}`.trim(),
        treatment: 'dark-paneled',
        overlay: 0.82,
        focalPoint: 'center',
        textPlacement: 'split'
      }
    }] : []),
    ...(teamItems.length ? [{
      layout: 'bento_grid',
      style: 'dark_tech',
      composition: 'team-grid',
      title: '团队分工',
      facts: teamItems,
      textBlocks: [
        { region: 'header', kind: 'eyebrow', text: 'TEAM' },
        { region: 'header', kind: 'title', text: '团队分工' },
        { region: 'facts', kind: 'fact-list', variant: 'floating-tags', items: teamItems, clamp: 3 }
      ],
      visualIntent: {
        role: 'team',
        mood: '专业、有组织、协同感明确',
        density: 'medium',
        composition: 'team-grid',
        reason: '把核心岗位与职责做成一页可扫描的团队面板'
      },
      imageStrategy: {
        useBackground: true,
        query: `${brand} backstage operations premium teamwork atmosphere ${keywordSeed}`.trim(),
        treatment: 'ambient-texture',
        overlay: 0.8,
        focalPoint: 'center',
        textPlacement: 'left'
      }
    }] : []),
    {
      layout: 'end_card',
      style: 'dark_tech',
      composition: 'annotation-runway',
      title: '谢谢观看',
      subtitle: `${brand} 新品发布会活动策划提案`,
      quote: '让一次发布，不止完成产品亮相，更完成品牌高度的再确认。',
      facts: [plan?.timeline?.eventDate || '2026', userInput?.goal || '新品发布与品牌提升'],
      textBlocks: [
        { region: 'header', kind: 'eyebrow', text: brand },
        { region: 'header', kind: 'title', text: '谢谢观看' },
        { region: 'quote', kind: 'quote', text: '让一次发布，不止完成产品亮相，更完成品牌高度的再确认。' },
        { region: 'facts', kind: 'fact-list', variant: 'quiet-lines', items: [plan?.timeline?.eventDate || '2026', userInput?.goal || '新品发布与品牌提升'] }
      ],
      visualIntent: {
        role: 'closing',
        mood: '收束、沉稳、余韵',
        density: 'airy',
        composition: 'centered-close',
        reason: '用简洁结束页收住整份提案'
      },
      imageStrategy: {
        useBackground: true,
        query: `${brand} night skyline premium finale ${keywordSeed}`.trim(),
        treatment: 'quiet-finale',
        overlay: 0.58,
        focalPoint: 'center',
        textPlacement: 'left'
      }
    }
  ]

  return {
    globalStyle: 'dark_tech',
    title: plan?.planTitle || `${brand} PPT`,
    theme: {
      primary: (userInput?.brandColor || '1A1A1A').replace('#', ''),
      secondary: 'C6A86A',
      brand
    },
    pages
  }
}

module.exports = {
  buildStructuredFallback,
};
