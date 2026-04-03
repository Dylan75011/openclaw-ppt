// 文件API
const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const config = require('../config');
const { getOutputRoot, resolveOutputRelative, toOutputRelative } = require('../services/outputPaths');

// 下载文件
router.get('/download/*', (req, res) => {
  try {
    const relativePath = decodeURIComponent(req.params[0] || '');
    const filepath = resolveOutputRelative(relativePath);
    const filename = path.basename(filepath);

    // 安全检查：确保文件在输出目录内
    const resolvedPath = path.resolve(filepath);
    const resolvedOutputDir = getOutputRoot();

    if (!resolvedPath.startsWith(resolvedOutputDir)) {
      return res.status(403).json({
        success: false,
        error: '禁止访问'
      });
    }

    if (!fs.existsSync(filepath)) {
      return res.status(404).json({
        success: false,
        error: '文件不存在'
      });
    }

    res.download(filepath, filename);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 列出生成的文件
router.get('/list', (req, res) => {
  try {
    const outputDir = getOutputRoot();

    if (!fs.existsSync(outputDir)) {
      return res.json({
        success: true,
        data: []
      });
    }

    const files = [];
    const walk = (dir) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const filepath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(filepath);
          continue;
        }
        if (!entry.name.endsWith('.pptx')) continue;
        const stats = fs.statSync(filepath);
        files.push({
          filename: entry.name,
          relativePath: toOutputRelative(filepath),
          size: stats.size,
          created: stats.birthtime,
          downloadUrl: `/api/files/download/${toOutputRelative(filepath)}`
        });
      }
    };

    walk(outputDir);
    files.sort((a, b) => new Date(b.created) - new Date(a.created));

    res.json({
      success: true,
      data: files
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 删除文件
router.delete('/*', (req, res) => {
  try {
    const relativePath = decodeURIComponent(req.params[0] || '');
    const filepath = resolveOutputRelative(relativePath);

    // 安全检查
    const resolvedPath = path.resolve(filepath);
    const resolvedOutputDir = getOutputRoot();

    if (!resolvedPath.startsWith(resolvedOutputDir)) {
      return res.status(403).json({
        success: false,
        error: '禁止访问'
      });
    }

    if (!fs.existsSync(filepath)) {
      return res.status(404).json({
        success: false,
        error: '文件不存在'
      });
    }

    fs.unlinkSync(filepath);

    res.json({
      success: true,
      message: '文件已删除'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
