/**
 * Word (.docx) → Tiptap JSON 转换服务
 * 
 * 使用 docx-preview 解析 .docx 文件为 HTML，
 * 然后转换为 Tiptap JSON 格式以支持完整编辑功能
 */

const docxPreview = require('docx-preview');

// ─── HTML 转 Tiptap JSON 转换 ─────────────────────────────────────────────

function createTextNode(text, marks = []) {
  const node = { type: 'text', text };
  if (marks.length > 0) {
    node.marks = marks;
  }
  return node;
}

function createParagraph(children = []) {
  return {
    type: 'paragraph',
    content: children.length > 0 ? children : undefined
  };
}

function createHeading(level, children = []) {
  return {
    type: 'heading',
    attrs: { level },
    content: children
  };
}

function createList(listType, items) {
  return {
    type: listType,
    content: items
  };
}

function createListItem(children = []) {
  return {
    type: 'listItem',
    content: children
  };
}

function createTaskItem(checked, children = []) {
  return {
    type: 'taskItem',
    attrs: { checked },
    content: children
  };
}

function createTaskList(items) {
  return {
    type: 'taskList',
    content: items
  };
}

function createBlockquote(children = []) {
  return {
    type: 'blockquote',
    content: children
  };
}

function createCodeBlock(children = []) {
  return {
    type: 'codeBlock',
    content: children
  };
}

function createHorizontalRule() {
  return { type: 'horizontalRule' };
}

function createImage(src, alt = '') {
  return {
    type: 'image',
    attrs: { src, alt, title: null }
  };
}

// ─── HTML 解析 ────────────────────────────────────────────────────────────

function parseInlineStyles(element) {
  const marks = [];
  const style = element.style;
  
  if (!style) return marks;
  
  if (style.fontWeight === 'bold' || style.fontWeight === '700' || style.fontWeight === '800') {
    marks.push({ type: 'bold' });
  }
  if (style.fontStyle === 'italic') {
    marks.push({ type: 'italic' });
  }
  if (style.textDecoration === 'underline') {
    marks.push({ type: 'underline' });
  }
  if (style.textDecoration === 'line-through') {
    marks.push({ type: 'strike' });
  }
  
  if (style.color) {
    marks.push({ type: 'textStyle', attrs: { color: style.color } });
  }
  
  if (style.backgroundColor) {
    marks.push({ type: 'highlight', attrs: { color: style.backgroundColor } });
  }
  
  return marks;
}

function parseLink(element) {
  const href = element.getAttribute('href');
  if (href) {
    return { type: 'link', attrs: { href, target: '_blank', rel: 'noopener noreferrer' } };
  }
  return null;
}

function parseInline(element) {
  const children = [];
  
  for (const child of element.childNodes) {
    if (child.nodeType === Node.TEXT_NODE) {
      const text = child.textContent;
      if (text) {
        children.push(createTextNode(text));
      }
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      const tagName = child.tagName.toLowerCase();
      let marks = parseInlineStyles(child);
      const linkMark = parseLink(child);
      if (linkMark) marks.push(linkMark);
      
      if (tagName === 'br') {
        children.push({ type: 'hardBreak' });
      } else if (tagName === 'img') {
        const src = child.getAttribute('src');
        const alt = child.getAttribute('alt') || '';
        if (src) {
          children.push(createImage(src, alt));
        }
      } else if (tagName === 'a') {
        const href = child.getAttribute('href') || '';
        const linkMarkInner = { type: 'link', attrs: { href, target: '_blank', rel: 'noopener noreferrer' } };
        const text = child.textContent || '';
        children.push(createTextNode(text, [...marks, linkMarkInner]));
      } else if (tagName === 'strong' || tagName === 'b') {
        marks.push({ type: 'bold' });
        const inner = parseInline(child);
        children.push(...inner.map(n => {
          if (n.type === 'text') {
            return { ...n, marks: [...(n.marks || []), { type: 'bold' }] };
          }
          return n;
        }));
      } else if (tagName === 'em' || tagName === 'i') {
        marks.push({ type: 'italic' });
        const inner = parseInline(child);
        children.push(...inner.map(n => {
          if (n.type === 'text') {
            return { ...n, marks: [...(n.marks || []), { type: 'italic' }] };
          }
          return n;
        }));
      } else if (tagName === 'u') {
        marks.push({ type: 'underline' });
        const inner = parseInline(child);
        children.push(...inner.map(n => {
          if (n.type === 'text') {
            return { ...n, marks: [...(n.marks || []), { type: 'underline' }] };
          }
          return n;
        }));
      } else if (tagName === 's' || tagName === 'del' || tagName === 'strike') {
        marks.push({ type: 'strike' });
        const inner = parseInline(child);
        children.push(...inner.map(n => {
          if (n.type === 'text') {
            return { ...n, marks: [...(n.marks || []), { type: 'strike' }] };
          }
          return n;
        }));
      } else if (tagName === 'code') {
        marks.push({ type: 'code' });
        const text = child.textContent || '';
        children.push(createTextNode(text, marks));
      } else if (tagName === 'mark') {
        marks.push({ type: 'highlight' });
        const inner = parseInline(child);
        children.push(...inner.map(n => {
          if (n.type === 'text') {
            return { ...n, marks: [...(n.marks || []), { type: 'highlight' }] };
          }
          return n;
        }));
      } else {
        const inner = parseInline(child);
        if (inner.length > 0) {
          children.push(...inner);
        }
      }
    }
  }
  
  return children;
}

function parseBlock(element) {
  const tagName = element.tagName.toLowerCase();
  const inlineContent = parseInline(element);
  
  switch (tagName) {
    case 'h1':
      return createHeading(1, inlineContent);
    case 'h2':
      return createHeading(2, inlineContent);
    case 'h3':
      return createHeading(3, inlineContent);
    case 'h4':
      return createHeading(4, inlineContent);
    case 'h5':
      return createHeading(5, inlineContent);
    case 'h6':
      return createHeading(6, inlineContent);
    case 'p':
      return createParagraph(inlineContent);
    case 'blockquote':
      return createBlockquote(inlineContent);
    case 'pre':
      return createCodeBlock(inlineContent);
    case 'hr':
      return createHorizontalRule();
    case 'ul': {
      const items = Array.from(element.children);
      const isTaskList = items.some(li => li.hasAttribute('data-checked'));
      
      if (isTaskList) {
        const taskItems = items.map(li => {
          const checked = li.getAttribute('data-checked') === 'true';
          const content = parseBlock(li);
          return createTaskItem(checked, content.content || []);
        });
        return createTaskList(taskItems);
      }
      
      const listItems = items.map(li => {
        return createListItem(parseBlock(li).content || []);
      });
      return createList('bulletList', listItems);
    }
    case 'ol': {
      const items = Array.from(element.children).map(li => {
        return createListItem(parseBlock(li).content || []);
      });
      return createList('orderedList', items);
    }
    case 'li': {
      const children = [];
      for (const child of element.children) {
        const childTag = child.tagName.toLowerCase();
        if (childTag === 'p') {
          children.push(...parseInline(child));
        } else if (childTag === 'ul' || childTag === 'ol') {
          children.push(parseBlock(child));
        }
      }
      return createParagraph(children);
    }
    case 'div':
    case 'section':
    case 'article': {
      if (element.getAttribute('data-type') === 'callout') {
        return {
          type: 'callout',
          attrs: { emoji: element.getAttribute('data-emoji') || '💡' },
          content: inlineContent
        };
      }
      const children = [];
      for (const child of element.children) {
        children.push(parseBlock(child));
      }
      return createParagraph(inlineContent);
    }
    case 'img': {
      const src = element.getAttribute('src');
      const alt = element.getAttribute('alt') || '';
      if (src) {
        return createImage(src, alt);
      }
      return createParagraph();
    }
    default:
      if (inlineContent.length > 0) {
        return createParagraph(inlineContent);
      }
      return createParagraph();
  }
}

function htmlToTiptap(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  
  const blocks = [];
  
  for (const child of doc.body.children) {
    blocks.push(parseBlock(child));
  }
  
  if (blocks.length === 0) {
    blocks.push(createParagraph());
  }
  
  return {
    type: 'doc',
    content: blocks
  };
}

// ─── 主转换函数 ────────────────────────────────────────────────────────────

/**
 * 将 .docx Buffer 转换为 Tiptap JSON 格式
 * @param {Buffer} buffer - .docx 文件的 Buffer
 * @returns {Promise<Object>} Tiptap JSON 文档
 */
async function docxToTiptapJson(buffer) {
  try {
    const result = await docxPreview.renderAsync(buffer, null, {
      className: 'docx-preview',
      inWrapper: true,
      ignoreWidth: false,
      ignoreHeight: false,
      ignoreFonts: false,
      breakPage: false,
      experimental: false,
      trimXmlDeclaration: true,
      useBase64URL: true,
      useMathMLPolyfill: false,
      renderChanges: false,
      renderHeaders: true,
      renderFooters: true,
      renderFootnotes: true,
      renderTrackChanges: false
    });
    
    let html = '';
    if (result && result.innerHTML) {
      html = result.innerHTML;
    } else if (typeof result === 'string') {
      html = result;
    } else if (result && result.document) {
      html = result.document.innerHTML || '';
    }
    
    html = html.replace(/class="docx-preview[^"]*"/g, '');
    html = html.replace(/data-docx[^"]*"/g, '');
    
    return htmlToTiptap(html);
    
  } catch (error) {
    console.error('[docxPreviewConverter] Error converting docx:', error);
    throw error;
  }
}

/**
 * 将 .docx Buffer 转换为 HTML（保留用于预览）
 * @param {Buffer} buffer - .docx 文件的 Buffer
 * @returns {Promise<string>} HTML 字符串
 */
async function docxToHtml(buffer) {
  try {
    const result = await docxPreview.renderAsync(buffer, null, {
      className: 'docx-preview',
      inWrapper: true,
      useBase64URL: true
    });
    
    if (result && result.innerHTML) {
      return result.innerHTML;
    }
    return '<p></p>';
  } catch (error) {
    console.error('[docxPreviewConverter] Error converting to HTML:', error);
    throw error;
  }
}

module.exports = { docxToTiptapJson, docxToHtml, htmlToTiptap };
