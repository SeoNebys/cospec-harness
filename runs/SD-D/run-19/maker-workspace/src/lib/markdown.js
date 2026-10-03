import MarkdownIt from 'markdown-it';
import sanitizeHtml from 'sanitize-html';

const md = new MarkdownIt({ html: false, linkify: true, breaks: true });

const ALLOWED_TAGS = [
  'p', 'br', 'strong', 'em', 'del', 'blockquote', 'code', 'pre',
  'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'a', 'hr',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
];

/** Render Markdown source to sanitised HTML safe to display. */
export function renderMarkdown(source) {
  if (!source) return '';
  const rawHtml = md.render(String(source));
  return sanitizeHtml(rawHtml, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: { a: ['href', 'title'] },
    allowedSchemes: ['http', 'https', 'mailto'],
    transformTags: {
      a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer', target: '_blank' }),
    },
  });
}
