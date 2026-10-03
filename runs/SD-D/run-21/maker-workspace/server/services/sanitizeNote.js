import sanitizeHtml from 'sanitize-html';

// Sanitizes note HTML to a small formatting allow-list and derives a
// plain-text projection for search (FR-026, FR-008).
const ALLOWED_TAGS = ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 'ul', 'ol', 'li', 'a', 'blockquote', 'code', 'pre', 'h3', 'h4'];

export function sanitizeNote(html) {
  if (!html) return { noteHtml: null, noteText: null };
  const noteHtml = sanitizeHtml(String(html), {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: { a: ['href', 'target', 'rel'] },
    allowedSchemes: ['http', 'https', 'mailto'],
    transformTags: {
      a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer', target: '_blank' }),
    },
  });
  const noteText = sanitizeHtml(String(html), { allowedTags: [], allowedAttributes: {} })
    .replace(/\s+/g, ' ')
    .trim();
  return { noteHtml: noteHtml.trim() || null, noteText: noteText || null };
}
