import { describe, it, expect } from 'vitest'
import { sanitizeNoteHtml, htmlToText } from '../../src/main/services/notes'

// FR-014: notes keep basic formatting but nothing unsafe; a plain-text copy is
// derived for search (FR-018).
describe('sanitizeNoteHtml', () => {
  it('keeps basic formatting (bold, list, link)', () => {
    const clean = sanitizeNoteHtml(
      '<p>Try <strong>this</strong></p><ul><li>one</li></ul><a href="https://example.com">link</a>'
    )
    expect(clean).toContain('<strong>this</strong>')
    expect(clean).toContain('<li>one</li>')
    expect(clean).toContain('href="https://example.com"')
  })

  it('strips scripts and disallowed markup', () => {
    const clean = sanitizeNoteHtml('<p>ok</p><script>alert(1)</script><img src=x onerror=alert(1)>')
    expect(clean.toLowerCase()).not.toContain('<script')
    expect(clean.toLowerCase()).not.toContain('onerror')
    expect(clean.toLowerCase()).not.toContain('<img')
    expect(clean).toContain('ok')
  })
})

describe('htmlToText', () => {
  it('produces a plain-text projection for search', () => {
    expect(htmlToText('<p>Hello <strong>world</strong></p><ul><li>item</li></ul>')).toBe(
      'Hello world item'
    )
  })
})
