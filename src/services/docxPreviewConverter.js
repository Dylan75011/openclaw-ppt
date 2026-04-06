const mammoth = require('mammoth');
const { htmlToTiptap } = require('./richText');

function normalizeHtml(html = '') {
  return String(html || '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/class="docx-preview[^"]*"/g, '')
    .replace(/data-docx[^=]*="[^"]*"/g, '')
    .trim();
}

async function docxToHtml(buffer) {
  try {
    const result = await mammoth.convertToHtml({ buffer });
    const html = normalizeHtml(result?.value || '');
    return html || '<p></p>';
  } catch (error) {
    console.error('[docxPreviewConverter] Error converting to HTML:', error);
    throw error;
  }
}

async function docxToTiptapJson(buffer) {
  try {
    const html = await docxToHtml(buffer);
    return htmlToTiptap(html);
  } catch (error) {
    console.error('[docxPreviewConverter] Error converting docx:', error);
    throw error;
  }
}

module.exports = { docxToTiptapJson, docxToHtml, htmlToTiptap };
