const fs = require('fs');
const path = require('path');
const config = require('../config');

function getOutputRoot() {
  return path.resolve(config.outputDir);
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
  return dirPath;
}

function sanitizeSegment(value, fallback = 'run') {
  return String(value || fallback)
    .trim()
    .replace(/[^\w\u4e00-\u9fa5.-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || fallback;
}

function getRunId(seed = null) {
  return sanitizeSegment(seed || `run_${Date.now()}`, 'run');
}

function getRunDir(runId) {
  return ensureDir(path.join(getOutputRoot(), 'runs', getRunId(runId)));
}

function getRunAssetDir(runId, assetType) {
  return ensureDir(path.join(getRunDir(runId), sanitizeSegment(assetType, 'misc')));
}

function toOutputRelative(absolutePath) {
  if (!absolutePath) return '';
  const outputRoot = getOutputRoot();
  const resolved = path.resolve(absolutePath);
  if (!resolved.startsWith(outputRoot)) return '';
  return path.relative(outputRoot, resolved).split(path.sep).join('/');
}

function toOutputUrl(absolutePath) {
  const relative = toOutputRelative(absolutePath);
  return relative ? `/output/${relative}` : '';
}

// 生成公网可访问的绝对 URL（PUBLIC_BASE_URL 未设置时退化为相对路径，本地开发不受影响）
function toPublicUrl(absolutePath) {
  const relative = toOutputRelative(absolutePath);
  if (!relative) return '';
  const base = config.publicBaseUrl || '';
  return `${base}/output/${relative}`;
}

// 将任意相对 URL（/output/... 或 /api/...）转为绝对 URL
function toAbsoluteUrl(relativeUrl) {
  if (!relativeUrl) return '';
  if (relativeUrl.startsWith('http')) return relativeUrl;
  const base = config.publicBaseUrl || '';
  return `${base}${relativeUrl}`;
}

function resolveOutputRelative(relativePath = '') {
  const normalized = String(relativePath || '').replace(/^\/+/, '');
  return path.resolve(getOutputRoot(), normalized);
}

function createRunFilePath(runId, assetType, filename) {
  return path.join(getRunAssetDir(runId, assetType), filename);
}

module.exports = {
  getOutputRoot,
  ensureDir,
  getRunId,
  getRunDir,
  getRunAssetDir,
  toOutputRelative,
  toOutputUrl,
  toPublicUrl,
  toAbsoluteUrl,
  resolveOutputRelative,
  createRunFilePath,
};
