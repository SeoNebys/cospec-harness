// Rich-notes sanitization. Notes are stored as HTML but must never be able to
// break or alter the surrounding UI, so we sanitize on write to a small allowlist
// and also derive a plain-text form for search indexing.
import { JSDOM } from 'jsdom';
import createDOMPurify from 'dompurify';

const window = new JSDOM('').window;
const DOMPurify = createDOMPurify(window);

const ALLOWED_TAGS = ['b', 'strong', 'i', 'em', 'ul', 'ol', 'li', 'a', 'p', 'br'];
const ALLOWED_ATTR = ['href'];

export function sanitizeNotes(html) {
  if (!html) return '';
  const clean = DOMPurify.sanitize(String(html), {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    // Only allow safe link protocols.
    ALLOWED_URI_REGEXP: /^(?:https?:|mailto:|#)/i,
  });
  return clean;
}

export function toPlainText(html) {
  if (!html) return '';
  const dom = new JSDOM(`<div id="root">${html}</div>`);
  return dom.window.document.getElementById('root').textContent.replace(/\s+/g, ' ').trim();
}
