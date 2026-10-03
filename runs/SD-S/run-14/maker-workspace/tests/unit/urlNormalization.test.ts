import { describe, expect, it } from 'vitest'
import { normalizeUrl, validateBookmarkInput } from '../../src/domain/urlNormalization'

describe('URL and bookmark validation', () => {
  it('trims and adds HTTPS', () => expect(normalizeUrl(' example.com/path ')).toBe('https://example.com/path'))
  it('preserves HTTP and meaningful URL parts', () => expect(normalizeUrl('http://EXAMPLE.com:80/a?q=1#x')).toBe('http://example.com/a?q=1#x'))
  it.each(['', 'not a host', 'javascript:alert(1)', 'ftp://example.com'])('rejects %s', (value) => expect(() => normalizeUrl(value)).toThrow())
  it('requires a title and trims all fields', () => {
    const invalid = validateBookmarkInput({ title: ' ', url: 'example.com', description: '', tags: [] })
    expect(invalid.ok).toBe(false)
    const valid = validateBookmarkInput({ title: ' Example ', url: 'example.com', description: ' Note ', tags: [' Work '] })
    expect(valid).toEqual({ ok: true, value: { title: 'Example', url: 'https://example.com/', description: 'Note', tags: ['Work'] } })
  })
})
