const brainAgent = require('../src/agents/brainAgent');

function estimateTokens(text) {
  if (!text) return 0;
  const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
  const otherChars = text.length - chineseChars;
  return Math.ceil(chineseChars * 1.5 + otherChars * 0.5);
}

function createMockSession() {
  return {
    messages: [],
    status: 'idle',
    apiKeys: {
      minimaxApiKey: process.env.MINIMAX_API_KEY || 'test-key',
      minimaxModel: 'abab6.5s-chat'
    },
    spaceContext: null,
    executionPlan: null,
    taskSpec: null,
    routeToolSequence: [],
    taskIntent: 'test',
    brief: null,
    bestPlan: null,
    bestScore: 0,
    planItems: [],
    doneEmitted: false,
    stopRequested: false,
    attachments: [],
    pendingToolCallId: null
  };
}

function generateLongToolResult(length = 5000) {
  return JSON.stringify({
    success: true,
    data: 'x'.repeat(length),
    message: '这是一个很长的工具调用结果，用于模拟搜索或抓取返回的大量数据'
  });
}

async function testMessageTruncationBug() {
  console.log('🧪 测试消息截断导致的 tool call result 错误\n');
  
  const session = createMockSession();
  
  console.log('📝 构造消息历史，模拟真实场景...\n');
  console.log('🎯 目标：让 recent 部分第一个消息是 tool 消息');
  console.log('   这需要倒数第 7 条是 assistant(tool_calls)，倒数第 6 条是 tool\n');
  
  const toolCallIds = [];
  
  // 构造足够多的消息，确保会触发截断
  for (let i = 1; i <= 5; i++) {
    const toolCallId = `call_${i}_${Date.now() + i}`;
    toolCallIds.push(toolCallId);
    
    session.messages.push({ role: 'user', content: `用户消息 ${i}` });
    session.messages.push({
      role: 'assistant',
      content: null,
      tool_calls: [{
        id: toolCallId,
        type: 'function',
        function: { name: 'web_search', arguments: JSON.stringify({ query: `查询 ${i}` }) }
      }]
    });
    session.messages.push({ role: 'tool', tool_call_id: toolCallId, content: generateLongToolResult(3000) });
  }
  
  // 第6轮：多工具调用
  const toolCallId6a = `call_6a_${Date.now()}`;
  const toolCallId6b = `call_6b_${Date.now()}`;
  toolCallIds.push(toolCallId6a, toolCallId6b);
  
  session.messages.push({ role: 'user', content: '用户消息 6' });
  session.messages.push({
    role: 'assistant',
    content: null,
    tool_calls: [
      { id: toolCallId6a, type: 'function', function: { name: 'web_search', arguments: JSON.stringify({ query: '查询6a' }) } },
      { id: toolCallId6b, type: 'function', function: { name: 'web_fetch', arguments: JSON.stringify({ url: 'https://example.com' }) } }
    ]
  });
  session.messages.push({ role: 'tool', tool_call_id: toolCallId6a, content: generateLongToolResult(3000) });
  session.messages.push({ role: 'tool', tool_call_id: toolCallId6b, content: generateLongToolResult(3000) });
  
  // 第7轮：纯文本回复
  session.messages.push({ role: 'user', content: '用户消息 7' });
  session.messages.push({ role: 'assistant', content: '好的，我已经完成了搜索。' });
  
  // 第8轮：关键！这将是倒数第7条消息（assistant with tool_calls）
  // 对应的tool消息将是倒数第6条（recent的第一条）
  const toolCallId8 = `call_8_CRITICAL_${Date.now()}`;
  toolCallIds.push(toolCallId8);
  
  session.messages.push({ role: 'user', content: '用户消息 8（关键轮次）' });
  session.messages.push({
    role: 'assistant',
    content: null,
    tool_calls: [{
      id: toolCallId8,
      type: 'function',
      function: { name: 'run_strategy', arguments: JSON.stringify({ topic: '策划方案' }) }
    }]
  });
  session.messages.push({ role: 'tool', tool_call_id: toolCallId8, content: generateLongToolResult(3000) });
  
  // 第9轮：最后添加一些消息
  const toolCallId9 = `call_9_${Date.now()}`;
  toolCallIds.push(toolCallId9);
  
  session.messages.push({ role: 'user', content: '用户消息 9' });
  session.messages.push({
    role: 'assistant',
    content: null,
    tool_calls: [{
      id: toolCallId9,
      type: 'function',
      function: { name: 'build_ppt', arguments: JSON.stringify({ planId: 'plan-1' }) }
    }]
  });
  session.messages.push({ role: 'tool', tool_call_id: toolCallId9, content: generateLongToolResult(3000) });
  
  // 关键调整：添加消息让tool消息正好在recent的第一位
  // 当前总消息数：28条（索引0-27）
  // slice(-6)会返回索引22-27
  // 我需要索引22是tool消息，索引21是对应的assistant(tool_calls)
  
  // 第10轮：关键！assistant(tool_calls)在索引21，tool在索引22
  const toolCallId10 = `call_10_CRITICAL_${Date.now()}`;
  toolCallIds.push(toolCallId10);
  
  session.messages.push({ role: 'user', content: '用户消息 10（关键）' });
  session.messages.push({
    role: 'assistant',
    content: null,
    tool_calls: [{
      id: toolCallId10,
      type: 'function',
      function: { name: 'run_strategy', arguments: JSON.stringify({ topic: '最终策划' }) }
    }]
  });
  session.messages.push({ role: 'tool', tool_call_id: toolCallId10, content: generateLongToolResult(3000) });
  
  // 额外消息：填充到索引27
  session.messages.push({ role: 'user', content: '用户消息 11' });
  session.messages.push({ role: 'assistant', content: '明白了，我继续。' });
  
  console.log(`✅ 已构造 ${session.messages.length} 条消息\n`);
  
  console.log('📋 消息序列（最后10条）:');
  session.messages.slice(-10).forEach((m, i) => {
    const idx = session.messages.length - 10 + i;
    if (m.role === 'tool') {
      console.log(`   ${idx}: [tool] tool_call_id=${m.tool_call_id}`);
    } else if (m.role === 'assistant') {
      if (m.tool_calls) {
        console.log(`   ${idx}: [assistant] tool_calls=[${m.tool_calls.map(tc => tc.id.slice(0, 20)).join(', ')}]`);
      } else {
        console.log(`   ${idx}: [assistant] content="${m.content?.slice(0, 30)}..."`);
      }
    } else {
      console.log(`   ${idx}: [${m.role}] content="${m.content?.slice(0, 30)}..."`);
    }
  });
  console.log(`\n   倒数第 7 条索引: ${session.messages.length - 7}`);
  console.log(`   倒数第 6 条索引: ${session.messages.length - 6}\n`);
  
  console.log(`✅ 已构造 ${session.messages.length} 条消息`);
  console.log(`   - 用户消息: 10 条`);
  console.log(`   - assistant(tool_calls): 10 条`);
  console.log(`   - tool 结果: 10 条\n`);
  
  const totalChars = session.messages.reduce((sum, m) => sum + (m.content?.length || 0), 0);
  const estimatedTokens = estimateTokens(JSON.stringify(session.messages));
  console.log(`📊 消息统计:`);
  console.log(`   - 总字符数: ${totalChars}`);
  console.log(`   - 估算 tokens: ${estimatedTokens}`);
  console.log(`   - 警戒线: 10000 tokens\n`);
  
  console.log('🔍 检查消息完整性...');
  
  const toolMessages = session.messages.filter(m => m.role === 'tool');
  const assistantWithToolCalls = session.messages.filter(m => m.role === 'assistant' && m.tool_calls);
  
  console.log(`   - tool 消息数: ${toolMessages.length}`);
  console.log(`   - assistant(tool_calls) 消息数: ${assistantWithToolCalls.length}`);
  
  const toolCallIdSet = new Set(
    assistantWithToolCalls.flatMap(m => m.tool_calls.map(tc => tc.id))
  );
  
  let hasOrphanTool = false;
  for (const tm of toolMessages) {
    if (!toolCallIdSet.has(tm.tool_call_id)) {
      console.log(`\n❌ 发现孤立 tool 消息: tool_call_id=${tm.tool_call_id}`);
      hasOrphanTool = true;
    }
  }
  
  if (!hasOrphanTool) {
    console.log(`   ✅ 所有 tool 消息都有对应的 tool_calls`);
  }
  
  console.log('\n🔬 模拟 buildMessages 的截断逻辑...');
  
  const trimmed = session.messages.map((message) => {
    const next = {
      role: message.role,
      content: message.content
    };
    if (message.tool_calls)   next.tool_calls   = message.tool_calls;
    if (message.tool_call_id) next.tool_call_id = message.tool_call_id;
    return next;
  });
  
  const recent = trimmed.slice(-6);
  const older  = trimmed.slice(0, -6).filter(m => m.role !== 'tool').map(m => {
    if (m.role === 'assistant' && m.tool_calls) {
      return { role: 'assistant', content: m.content || '[工具调用，已归档]' };
    }
    return m;
  });
  
  const finalMessages = [...older, ...recent];
  
  console.log(`\n📊 截断后消息统计:`);
  console.log(`   - older 部分: ${older.length} 条`);
  console.log(`   - recent 部分: ${recent.length} 条`);
  console.log(`   - 总计: ${finalMessages.length} 条`);
  
  console.log('\n📋 recent 部分的消息序列:');
  recent.forEach((m, i) => {
    if (m.role === 'tool') {
      console.log(`   ${i}: [tool] tool_call_id=${m.tool_call_id}`);
    } else if (m.role === 'assistant') {
      if (m.tool_calls) {
        console.log(`   ${i}: [assistant] tool_calls=[${m.tool_calls.map(tc => tc.id).join(', ')}]`);
      } else {
        console.log(`   ${i}: [assistant] content="${m.content?.slice(0, 30) || 'null'}..."`);
      }
    } else {
      console.log(`   ${i}: [${m.role}] content="${m.content?.slice(0, 30) || 'null'}..."`);
    }
  });
  
  console.log('🔍 检查截断后的消息完整性...');
  
  const finalToolMessages = finalMessages.filter(m => m.role === 'tool');
  const finalAssistantWithToolCalls = finalMessages.filter(m => m.role === 'assistant' && m.tool_calls);
  
  console.log(`   - tool 消息数: ${finalToolMessages.length}`);
  console.log(`   - assistant(tool_calls) 消息数: ${finalAssistantWithToolCalls.length}`);
  
  const finalToolCallIdSet = new Set(
    finalAssistantWithToolCalls.flatMap(m => (m.tool_calls || []).map(tc => tc.id))
  );
  
  let hasOrphanToolAfterTruncation = false;
  const orphanTools = [];
  
  for (const tm of finalToolMessages) {
    if (!finalToolCallIdSet.has(tm.tool_call_id)) {
      orphanTools.push(tm);
      hasOrphanToolAfterTruncation = true;
    }
  }
  
  if (hasOrphanToolAfterTruncation) {
    console.log(`\n❌❌❌ 发现孤立 tool 消息（这正是 bug 的根源）❌❌❌`);
    orphanTools.forEach(tm => {
      console.log(`   - tool_call_id: ${tm.tool_call_id}`);
      console.log(`   - 内容长度: ${tm.content?.length || 0}`);
    });
    
    console.log('\n💡 问题分析:');
    console.log('   截断逻辑保留了最近 6 条消息，但可能导致:');
    console.log('   1. tool 消息存在，但对应的 assistant(tool_calls) 消息被截断或归档');
    console.log('   2. MiniMax API 要求每个 tool 消息必须紧跟在调用它的 assistant 消息之后');
    console.log('   3. 当 API 收到孤立的 tool 消息时，会返回错误:');
    console.log('      "400 invalid params, tool call result does not follow tool call (2013)"');
    
    console.log('\n📝 消息序列示例:');
    finalMessages.slice(0, 10).forEach((m, i) => {
      if (m.role === 'tool') {
        console.log(`   ${i}: [tool] tool_call_id=${m.tool_call_id}`);
      } else if (m.role === 'assistant') {
        if (m.tool_calls) {
          console.log(`   ${i}: [assistant] tool_calls=[${m.tool_calls.map(tc => tc.id).join(', ')}]`);
        } else {
          console.log(`   ${i}: [assistant] content="${m.content?.slice(0, 30)}..."`);
        }
      } else {
        console.log(`   ${i}: [${m.role}]`);
      }
    });
    
    return false;
  } else {
    console.log(`   ✅ 截断后所有 tool 消息都有对应的 tool_calls`);
    return true;
  }
}

testMessageTruncationBug()
  .then(success => {
    if (!success) {
      console.log('\n✅ 成功复现 bug！');
      process.exit(0);
    } else {
      console.log('\n⚠️ 未能复现 bug，可能需要调整测试参数');
      process.exit(1);
    }
  })
  .catch(err => {
    console.error('测试失败:', err);
    process.exit(1);
  });
