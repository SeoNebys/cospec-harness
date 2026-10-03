import { marked } from 'marked';
import DOMPurify from 'dompurify';

// Render Markdown notes to sanitized HTML for viewing (FR-010).
export function renderMarkdown(md) {
  const html = marked.parse(String(md || ''), { breaks: true, gfm: true });
  return DOMPurify.sanitize(html, { USE_PROFILES: { html: true } });
}
