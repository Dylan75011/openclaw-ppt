// 文档解析服务：从 PDF / Word 提取纯文本
const pdfParse = require('pdf-parse');
const mammoth  = require('mammoth');

const DOC_MIMES = {
  pdf:  'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
};

/**
 * 判断 file 是否为支持的文档类型
 */
function isDocumentFile(file) {
  const mime = file.mimetype || file.type || '';
  const name = file.originalname || file.name || '';
  return (
    mime === DOC_MIMES.pdf  || name.toLowerCase().endsWith('.pdf')  ||
    mime === DOC_MIMES.docx || name.toLowerCase().endsWith('.docx')
  );
}

/**
 * 解析单个文档 buffer，返回提取结果
 * @param {Buffer} buffer
 * @param {string} mimeType
 * @param {string} filename
 * @returns {{ type: 'pdf'|'docx', text: string, pages: number|null, info: string }}
 */
async function parseDocument(buffer, mimeType, filename) {
  const lowerName = (filename || '').toLowerCase();

  if (mimeType === DOC_MIMES.pdf || lowerName.endsWith('.pdf')) {
    let data;
    try {
      data = await pdfParse(buffer);
    } catch (err) {
      throw new Error(`PDF 解析失败（${filename}）：${err.message}`);
    }
    const text = (data.text || '').trim();
    if (!text) {
      throw new Error(`该 PDF 为图片扫描版，无法提取文字（${filename}）`);
    }
    return {
      type: 'pdf',
      text,
      pages: data.numpages || null,
      info: data.info?.Title || filename
    };
  }

  if (mimeType === DOC_MIMES.docx || lowerName.endsWith('.docx')) {
    let result;
    try {
      result = await mammoth.extractRawText({ buffer });
    } catch (err) {
      throw new Error(`Word 文档解析失败（${filename}）：${err.message}`);
    }
    const text = (result.value || '').trim();
    if (!text) {
      throw new Error(`Word 文档内容为空（${filename}）`);
    }
    return {
      type: 'docx',
      text,
      pages: null,
      info: filename
    };
  }

  throw new Error(`不支持的文档格式：${filename}（仅支持 PDF 和 .docx）`);
}

/**
 * 批量解析上传的文档文件
 * @param {Array} files — multer 文件数组
 * @returns {Promise<Array>} 解析结果数组
 */
async function parseUploadedDocuments(files = []) {
  if (!Array.isArray(files) || !files.length) return [];
  const docFiles = files.filter(isDocumentFile);
  if (!docFiles.length) return [];

  const results = [];
  for (const file of docFiles) {
    const id = `doc_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
    try {
      const parsed = await parseDocument(file.buffer, file.mimetype, file.originalname || '');
      results.push({
        id,
        name: file.originalname || '未命名文档',
        type: parsed.type,
        pages: parsed.pages,
        size: file.size || 0,
        text: parsed.text,
        error: null
      });
    } catch (err) {
      results.push({
        id,
        name: file.originalname || '未命名文档',
        type: 'unknown',
        pages: null,
        size: file.size || 0,
        text: '',
        error: err.message
      });
    }
  }
  return results;
}

module.exports = { isDocumentFile, parseDocument, parseUploadedDocuments };
