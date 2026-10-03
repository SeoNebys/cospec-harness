import sanitizeHtml from 'sanitize-html';

// Safe formatted notes (FR-009/010): allow a basic subset only — headings,
// bold/italic, lists, links. Scripts, event handlers, and unsafe URLs are
// stripped.
const OPTIONS = {
  allowedTags: [
    'h1', 'h2', 'h3', 'h4',
    'p', 'br', 'strong', 'b', 'em', 'i', 'u',
    'ul', 'ol', 'li',
    'blockquote', 'code', 'pre',
    'a',
  ],
  allowedAttributes: {
    a: ['href', 'title'],
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  allowedSchemesByTag: { a: ['http', 'https', 'mailto'] },
  disallowedTagsMode: 'discard',
  transformTags: {
    a: (tagName, attribs) => ({
      tagName: 'a',
      attribs: {
        ...attribs,
        rel: 'noopener noreferrer nofollow',
        target: '_blank',
      },
    }),
  },
};

export function sanitizeNote(html) {
  if (!html || typeof html !== 'string') return '';
  return sanitizeHtml(html, OPTIONS);
}

// Plain-text extraction of a note for search indexing (FR-017).
export function toPlainText(html) {
  if (!html || typeof html !== 'string') return '';
  const stripped = sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} });
  return stripped
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}
