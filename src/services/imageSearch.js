// 图片搜索与下载服务
const https  = require('https');
const http   = require('http');
const fs     = require('fs');
const path   = require('path');
const sharp  = require('sharp');
const config = require('../config');

// 支持系统 HTTPS 代理（HTTPS_PROXY / https_proxy 环境变量）
function getProxyAgent() {
  const proxyUrl = process.env.HTTPS_PROXY || process.env.https_proxy;
  if (!proxyUrl) return undefined;
  try {
    const { HttpsProxyAgent } = require('https-proxy-agent');
    return new HttpsProxyAgent(proxyUrl);
  } catch { return undefined; }
}

// PPT 背景图目标尺寸（16:9，1920×1080 清晰度足够，文件体积可控）
const PPT_WIDTH  = 1920;
const PPT_HEIGHT = 1080;
const JPEG_QUALITY = 82;  // 82% JPEG：清晰且体积适中（约 200-500 KB）

/**
 * 搜索 Pexels 图片
 * 返回的 url 已附加 CDN 尺寸参数（1920×1080 裁切+压缩），下载即可直接用于 PPT
 */
async function searchPexels(query, options = {}) {
  const { perPage = 4, apiKey: keyOverride } = options;
  const apiKey = keyOverride || config.pexelsApiKey;
  if (!apiKey) return [];

  const qs = new URLSearchParams({
    query,
    orientation: 'landscape',
    size: 'large',
    per_page: String(perPage)
  });
  const url = `https://api.pexels.com/v1/search?${qs}`;

  return new Promise(resolve => {
    const req = https.get(url, { headers: { Authorization: apiKey } }, res => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        try {
          const json = JSON.parse(raw);
          resolve((json.photos || []).map(p => {
            // 使用 original（或 large2x 作保底）去掉原有 CDN 参数，
            // 换成精确 1920×1080 裁切 + 压缩参数，让 Pexels Imgix CDN 处理
            const base = (p.src.original || p.src.large2x || p.src.large).split('?')[0];
            // 不用 auto=compress，指定 q=92 保留高质量，避免 CDN 自动降级
            const cdnUrl = `${base}?cs=tinysrgb&fit=crop&w=${PPT_WIDTH}&h=${PPT_HEIGHT}&q=92`;
            return {
              id:              p.id,
              url:             cdnUrl,
              thumb:           p.src.medium,
              photographer:    p.photographer,
              photographerUrl: p.photographer_url
            };
          }));
        } catch { resolve([]); }
      });
    });
    req.on('error', () => resolve([]));
    req.setTimeout(8000, () => { req.destroy(); resolve([]); });
  });
}

/**
 * 下载远程图片到本地（支持重定向）
 */
async function downloadImage(remoteUrl, localPath) {
  const dir = path.dirname(localPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  return new Promise((resolve, reject) => {
    const isHttps = remoteUrl.startsWith('https');
    const proto   = isHttps ? https : http;
    const reqOpts = isHttps ? { agent: getProxyAgent() } : {};
    const file    = fs.createWriteStream(localPath);
    proto.get(remoteUrl, reqOpts, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        file.close();
        fs.unlink(localPath, () => {});
        return downloadImage(res.headers.location, localPath).then(resolve).catch(reject);
      }
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(localPath); });
      file.on('error', err => { fs.unlink(localPath, () => {}); reject(err); });
    }).on('error', err => { fs.unlink(localPath, () => {}); reject(err); });
  });
}

/**
 * 将本地图片处理为 PPT 背景图规格
 * - 尺寸：1920×1080（cover 模式裁切，不留黑边）
 * - 格式：JPEG，quality=82（清晰度与体积的最佳平衡点）
 * - 对于 Pexels 图：已由 CDN 处理为 1920×1080，此处再过一遍 sharp 确保格式统一
 * - 对于 AI 生成图：尺寸不可控，必须经此处理
 */
async function processImageForPpt(localPath) {
  const tmpPath = localPath + '.tmp.jpg';
  try {
    const meta = await sharp(localPath).metadata();
    const sizeMB = (fs.statSync(localPath).size / 1024 / 1024).toFixed(1);
    console.log(`[imageSearch] 处理前：${meta.width}×${meta.height} ${sizeMB}MB  ${path.basename(localPath)}`);

    await sharp(localPath)
      .resize(PPT_WIDTH, PPT_HEIGHT, { fit: 'cover', position: 'centre' })
      .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
      .toFile(tmpPath);

    // 替换原文件
    fs.renameSync(tmpPath, localPath);

    const newSize = (fs.statSync(localPath).size / 1024 / 1024).toFixed(1);
    console.log(`[imageSearch] 处理后：${PPT_WIDTH}×${PPT_HEIGHT} ${newSize}MB  ${path.basename(localPath)}`);
  } catch (err) {
    console.warn('[imageSearch] sharp 处理失败，保留原图:', err.message);
    if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
  }
}

/**
 * 调用 MiniMax image-01 生成图片
 * @returns {Promise<string|null>} 图片 URL（24h 有效，需立即下载）
 */
async function generateMiniMaxImage(prompt, apiKey) {
  if (!apiKey) return null;
  const body = JSON.stringify({
    model: 'image-01',
    prompt,
    aspect_ratio: '16:9',
    n: 1,
    response_format: 'url'
  });

  // 从 minimaxBaseUrl 解析 host，支持用户自定义代理地址
  const baseUrl = (config.minimaxBaseUrl || 'https://api.minimaxi.com/v1').replace(/\/+$/, '');
  const endpoint = new URL(`${baseUrl}/image_generation`);

  return new Promise(resolve => {
    const req = https.request({
      hostname: endpoint.hostname,
      port:     endpoint.port || 443,
      path:     endpoint.pathname,
      method:   'POST',
      agent:    getProxyAgent(),
      headers: {
        Authorization:    `Bearer ${apiKey}`,
        'Content-Type':   'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    }, res => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        try {
          const json = JSON.parse(raw);
          resolve(json.data?.image_urls?.[0] || null);
        } catch { resolve(null); }
      });
    });
    req.on('error', (err) => { console.warn('[generateMiniMaxImage] 网络错误:', err.message); resolve(null); });
    req.setTimeout(60000, () => { req.destroy(); resolve(null); });
    req.write(body);
    req.end();
  });
}

/**
 * 搜索 Bing 图片（Azure Cognitive Services Bing Image Search v7）
 * 返回格式与 searchPexels 一致
 */
async function searchBing(query, options = {}) {
  const { perPage = 4, apiKey: keyOverride } = options;
  const apiKey = keyOverride || config.bingApiKey;
  if (!apiKey) return [];

  const qs = new URLSearchParams({
    q: query,
    count: String(perPage),
    aspect: 'Wide',
    size: 'Large',
    imageType: 'Photo',
    safeSearch: 'Moderate'
  });

  return new Promise(resolve => {
    const req = https.get(
      `https://api.bing.microsoft.com/v7.0/images/search?${qs}`,
      { headers: { 'Ocp-Apim-Subscription-Key': apiKey } },
      res => {
        let raw = '';
        res.on('data', c => raw += c);
        res.on('end', () => {
          try {
            const json = JSON.parse(raw);
            resolve((json.value || []).map(item => ({
              id:              item.imageId || item.contentUrl,
              url:             item.contentUrl,
              thumb:           item.thumbnailUrl,
              photographer:    '',
              photographerUrl: item.hostPageUrl || ''
            })));
          } catch { resolve([]); }
        });
      }
    );
    req.on('error', () => resolve([]));
    req.setTimeout(8000, () => { req.destroy(); resolve([]); });
  });
}

/**
 * 通过 SerpAPI 搜索图片，支持 bing_images / google_images / baidu_images
 */
async function searchSerpApi(query, options = {}) {
  const { perPage = 4, engine = 'bing_images', apiKey: keyOverride } = options;
  const apiKey = keyOverride || config.serpApiKey;
  if (!apiKey) return [];

  const qs = new URLSearchParams({
    engine,
    q:       query,
    count:   String(perPage),
    api_key: apiKey
  });

  return new Promise(resolve => {
    const req = https.get(`https://serpapi.com/search?${qs}`, res => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        try {
          const json = JSON.parse(raw);
          resolve((json.images_results || []).slice(0, perPage).map(item => ({
            id:              item.position ? `serp_${engine}_${item.position}` : item.original,
            url:             item.original  || item.thumbnail,
            thumb:           item.thumbnail || item.original,
            photographer:    item.source    || item.domain || '',
            photographerUrl: item.link      || ''
          })));
        } catch { resolve([]); }
      });
    });
    req.on('error', () => resolve([]));
    req.setTimeout(10000, () => { req.destroy(); resolve([]); });
  });
}

/**
 * 判断查询词更适合哪个图源
 * - 含中文 → Bing（具体内容：品牌/产品/案例）
 * - 含具体品牌/产品/活动词 → Bing
 * - 抽象氛围词（英文）→ Pexels（专业摄影，版权清晰，更适合做 PPT 背景）
 */
/**
 * 判断查询词适合哪类图源
 * 返回 'bing'（具体内容）或 'pexels'（氛围背景）
 */
function detectImageSource(query = '') {
  if (/[\u4e00-\u9fa5]/.test(query)) return 'bing';

  const specificSignals = /\b(brand|product|launch|event|show|exhibition|conference|summit|expo|keynote|press|release|campaign|sponsor|demo|prototype|concept car|concept)\b/i;
  if (specificSignals.test(query)) return 'bing';

  const atmosphereSignals = /\b(cinematic|atmospheric|abstract|texture|minimal|editorial|ambient|volumetric|moody|silhouette|bokeh|gradient|backdrop|blur|dark|light beams?|shadow|pattern|surface|macro|galactic|nebula)\b/i;
  if (atmosphereSignals.test(query)) return 'pexels';

  return (config.bingApiKey || config.serpApiKey) ? 'bing' : 'pexels';
}

/**
 * 统一图片搜索入口
 * - source: 'auto'（默认）→ 根据 query 内容智能选源
 * - source: 'pexels'    → 强制 Pexels（PPT 背景/氛围图）
 * - source: 'bing'      → 真实内容：直接 Bing → SerpAPI → Pexels
 *
 * SerpAPI 引擎选择：中文查询用百度，英文用 Bing
 */
async function searchImages(query, options = {}) {
  const { source = 'auto', serpApiKey, bingApiKey, pexelsApiKey, ...rest } = options;
  const resolved = source === 'auto' ? detectImageSource(query) : source;

  const effectiveSerpKey   = serpApiKey   || config.serpApiKey;
  const effectiveBingKey   = bingApiKey   || config.bingApiKey;
  const effectivePexelsKey = pexelsApiKey || config.pexelsApiKey;

  if (resolved === 'bing') {
    // 1. SerpAPI（中文 → 谷歌，英文 → Bing）
    if (effectiveSerpKey) {
      const isChinese = /[\u4e00-\u9fa5]/.test(query);
      const engine = isChinese ? 'google_images' : 'bing_images';
      const results = await searchSerpApi(query, { ...rest, engine, apiKey: effectiveSerpKey });
      if (results.length) return results;
    }
    // 2. 直接 Bing API
    if (effectiveBingKey) {
      const results = await searchBing(query, { ...rest, apiKey: effectiveBingKey });
      if (results.length) return results;
    }
  }

  // 3. Pexels（兜底，或 source === 'pexels' 时直接走）
  return searchPexels(query, { ...rest, apiKey: effectivePexelsKey });
}

module.exports = { searchImages, searchPexels, searchBing, searchSerpApi, downloadImage, processImageForPpt, generateMiniMaxImage };
