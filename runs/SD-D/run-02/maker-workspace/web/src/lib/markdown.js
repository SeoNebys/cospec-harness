import { marked } from 'marked';
import DOMPurify from 'dompurify';

marked.setOptions({ breaks: true, gfm: true });

// Render Markdown to sanitized HTML for note display (FR-007).
export function renderMarkdown(md) {
  if (!md) return '';
  const raw = marked.parse(String(md));
  return DOMPurify.sanitize(raw);
}
