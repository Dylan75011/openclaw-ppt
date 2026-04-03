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
  resolveOutputRelative,
  createRunFilePath,
};
