import MarkdownIt from 'markdown-it';
import sanitizeHtml from 'sanitize-html';

const md = new MarkdownIt({ html: false, linkify: true, breaks: true });

// Render formatted notes (Markdown) to sanitized HTML for display (FR-025).
export function renderNotes(markdown) {
  if (!markdown) return '';
  const rawHtml = md.render(markdown);
  return sanitizeHtml(rawHtml, {
    allowedTags: [
      'p', 'br', 'hr', 'strong', 'em', 'del', 'code', 'pre', 'blockquote',
      'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'a',
      'table', 'thead', 'tbody', 'tr', 'th', 'td',
    ],
    allowedAttributes: {
      a: ['href', 'title', 'target', 'rel'],
    },
    transformTags: {
      a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer', target: '_blank' }),
    },
    allowedSchemes: ['http', 'https', 'mailto'],
  });
}
