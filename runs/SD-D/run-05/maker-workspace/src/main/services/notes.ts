import { JSDOM } from 'jsdom'
import createDOMPurify from 'dompurify'

// Basic formatting a personal note may keep (FR-014): emphasis, lists, links,
// simple structure. Anything else is stripped so a note can never carry unsafe
// markup into storage or the display.
const ALLOWED_TAGS = [
  'b', 'strong', 'i', 'em', 'u', 'a', 'p', 'br',
  'ul', 'ol', 'li', 'blockquote', 'h3', 'h4', 'code', 'pre'
]
const ALLOWED_ATTR = ['href', 'target', 'rel']

// Cleans note HTML down to the allowed formatting before it is stored/shown.
export function sanitizeNoteHtml(html: string): string {
  const { window } = new JSDOM('')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const DOMPurify = createDOMPurify(window as any)
  return DOMPurify.sanitize(html, { ALLOWED_TAGS, ALLOWED_ATTR }).trim()
}

// A plain-text version of the note, used only for search indexing so that
// searching "inside" notes matches the words, not the HTML tags (FR-018).
// Block boundaries become spaces so words from adjacent blocks (e.g. list
// items) don't run together and break search matching.
export function htmlToText(html: string): string {
  const spaced = html
    .replace(/<\/(p|li|ul|ol|h[1-6]|blockquote|pre|div)>/gi, ' ')
    .replace(/<br\s*\/?>/gi, ' ')
  const { window } = new JSDOM(`<body>${spaced}</body>`)
  return (window.document.body.textContent ?? '').replace(/\s+/g, ' ').trim()
}
