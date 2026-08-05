import { describe, it, expect } from 'vitest'
import { openDatabase } from '../../src/main/db/connection'
import { BookmarksService } from '../../src/main/services/bookmarks'
import { isValidWebUrl, normalizeUrl } from '../../src/main/services/urls'

// FR-002 (validation) and FR-017 / SC-011 (one bookmark per address).
describe('URL validation', () => {
  it('accepts well-formed http/https addresses', () => {
    expect(isValidWebUrl('https://example.com')).toBe(true)
    expect(isValidWebUrl('http://example.com/path?q=1')).toBe(true)
  })
  it('rejects non-web or malformed input', () => {
    expect(isValidWebUrl('not a url')).toBe(false)
    expect(isValidWebUrl('ftp://example.com')).toBe(false)
    expect(isValidWebUrl('javascript:alert(1)')).toBe(false)
    expect(isValidWebUrl('')).toBe(false)
  })
})

describe('URL normalization for duplicate detection', () => {
  it('treats trivially different forms of the same page as equal', () => {
    expect(normalizeUrl('https://Example.com/')).toBe(normalizeUrl('https://example.com'))
    expect(normalizeUrl('https://example.com:443/page')).toBe(normalizeUrl('https://example.com/page'))
    expect(normalizeUrl('https://example.com/page#section')).toBe('https://example.com/page')
  })
})

describe('BookmarksService.save', () => {
  function service() {
    return new BookmarksService({ db: openDatabase(':memory:') })
  }

  it('rejects an invalid address with guidance', () => {
    const res = service().save({ url: 'nonsense' })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toBe('invalid-url')
  })

  it('saves a valid address and derives a fallback title when none is given', () => {
    const res = service().save({ url: 'https://example.com/article' })
    expect(res.ok && !res.duplicate).toBe(true)
    if (res.ok) expect(res.bookmark.title.length).toBeGreaterThan(0)
  })

  it('does not create a second copy for the same address; returns the existing one', () => {
    const svc = service()
    const first = svc.save({ url: 'https://example.com/a' })
    const again = svc.save({ url: 'https://example.com/a/' }) // trivially different form
    expect(first.ok && again.ok).toBe(true)
    if (first.ok && again.ok) {
      expect(again.duplicate).toBe(true)
      expect(again.bookmark.id).toBe(first.bookmark.id)
    }
    expect(svc.listActive().length).toBe(1)
  })
})
