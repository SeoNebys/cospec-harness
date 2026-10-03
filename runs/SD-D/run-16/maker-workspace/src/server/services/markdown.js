// Render Markdown notes to sanitized HTML for safe display (FR-038).
import { marked } from 'marked';
import { JSDOM } from 'jsdom';
import createDOMPurify from 'dompurify';

const window = new JSDOM('').window;
const DOMPurify = createDOMPurify(window);

marked.setOptions({ gfm: true, breaks: true });

export function renderNote(markdownText) {
  if (!markdownText) return '';
  const rawHtml = marked.parse(String(markdownText));
  return DOMPurify.sanitize(rawHtml, {
    ALLOWED_TAGS: [
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'br', 'hr',
      'strong', 'em', 'del', 'blockquote', 'code', 'pre',
      'ul', 'ol', 'li', 'a', 'img', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
    ],
    ALLOWED_ATTR: ['href', 'title', 'alt', 'src'],
    ALLOWED_URI_REGEXP: /^(?:https?:|mailto:|#)/i,
  });
}
