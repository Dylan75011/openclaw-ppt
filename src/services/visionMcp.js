const fs = require('fs/promises');
const path = require('path');
const config = require('../config');

function getMinimaxApiHost() {
  return String(config.minimaxBaseUrl || 'https://api.minimaxi.com/v1').replace(/\/v1\/?$/, '');
}

async function fileToDataUrl(localPath, mimeType = '') {
  const ext = path.extname(localPath).toLowerCase();
  const resolvedMimeType = mimeType
    || (ext === '.png' ? 'image/png'
      : ext === '.webp' ? 'image/webp'
      : 'image/jpeg');
  const buffer = await fs.readFile(localPath);
  return `data:${resolvedMimeType};base64,${buffer.toString('base64')}`;
}

async function normalizeImageSource(imageSource, mimeType = '') {
  if (!imageSource) throw new Error('图片来源不能为空');

  if (imageSource.startsWith('data:')) {
    return imageSource;
  }

  if (imageSource.startsWith('http://') || imageSource.startsWith('https://')) {
    const response = await fetch(imageSource);
    if (!response.ok) throw new Error(`下载图片失败：HTTP ${response.status}`);
    const contentType = response.headers.get('content-type') || mimeType || 'image/jpeg';
    const arrayBuffer = await response.arrayBuffer();
    return `data:${contentType};base64,${Buffer.from(arrayBuffer).toString('base64')}`;
  }

  return fileToDataUrl(imageSource, mimeType);
}

async function understandImage(prompt, imageSource, options = {}) {
  const apiKey = options.minimaxApiKey || config.minimaxApiKey;
  if (!apiKey) throw new Error('MINIMAX_API_KEY 未配置，请在设置面板中填写');

  const imageUrl = await normalizeImageSource(imageSource, options.mimeType);
  const response = await fetch(`${getMinimaxApiHost()}/v1/coding_plan/vlm`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      prompt,
      image_url: imageUrl
    })
  });

  if (!response.ok) {
    throw new Error(`MiniMax VLM HTTP ${response.status}`);
  }

  const data = await response.json();
  const content = String(data?.content || '').trim();
  if (!content) throw new Error('MiniMax VLM 未返回有效内容');
  return content;
}

async function analyzeAgentImages(attachments = [], options = {}) {
  const text = String(options.userText || '').trim();
  const prompt = [
    '你是活动策划对话的视觉理解助手。',
    '请分析这张图片，输出简洁中文，尽量控制在 120-180 字。',
    '重点包括：1. 主体/场景 2. 可识别的文字、品牌、产品线索 3. 风格、配色、氛围 4. 对活动策划、PPT 或用户当前问题最有帮助的信息。',
    text ? `用户本轮问题或说明：${text}` : '用户本轮未提供额外文字，请重点概括图片本身。'
  ].join('\n');

  const results = [];
  for (const attachment of attachments) {
    try {
      const analysis = await understandImage(prompt, attachment.localPath || attachment.url, {
        minimaxApiKey: options.minimaxApiKey,
        mimeType: attachment.mimeType
      });
      results.push({
        ...attachment,
        analysis
      });
    } catch (error) {
      results.push({
        ...attachment,
        analysis: '',
        error: error.message
      });
    }
  }
  return results;
}

module.exports = {
  understandImage,
  analyzeAgentImages
};
