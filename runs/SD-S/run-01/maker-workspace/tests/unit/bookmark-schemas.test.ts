import { describe, expect, it } from 'vitest';
import { createBookmarkSchema, listCriteriaSchema } from '../../src/shared/bookmark-schemas.js';
import { normalizeTags, normalizeUrl } from '../../src/server/services/normalization.js';

describe('bookmark validation and normalization', () => {
  it('accepts only absolute HTTP and HTTPS addresses', () => {
    expect(createBookmarkSchema.safeParse({ url: 'https://example.com', title: 'Example' }).success).toBe(true);
    expect(createBookmarkSchema.safeParse({ url: 'ftp://example.com', title: 'Example' }).success).toBe(false);
    expect(createBookmarkSchema.safeParse({ url: 'example.com', title: 'Example' }).success).toBe(false);
  });

  it('normalizes host casing and default ports while preserving query and fragment', () => {
    expect(normalizeUrl(' HTTPS://EXAMPLE.COM:443/path?q=One#part ')).toBe('https://example.com/path?q=One#part');
  });

  it('trims, collapses, case-deduplicates, and preserves first tag casing', () => {
    expect(normalizeTags(['  Web   Design ', 'web design', 'Research'])).toEqual([
      { name: 'Web Design', normalizedName: 'web design' },
      { name: 'Research', normalizedName: 'research' },
    ]);
  });

  it('enforces title, URL, notes, tags, and query limits', () => {
    expect(createBookmarkSchema.safeParse({ url: `https://example.com/${'a'.repeat(2050)}`, title: 'A' }).success).toBe(false);
    expect(createBookmarkSchema.safeParse({ url: 'https://example.com', title: 'a'.repeat(301) }).success).toBe(false);
    expect(createBookmarkSchema.safeParse({ url: 'https://example.com', title: 'A', notes: 'a'.repeat(10_001) }).success).toBe(false);
    expect(createBookmarkSchema.safeParse({ url: 'https://example.com', title: 'A', tags: Array.from({ length: 21 }, (_, index) => `tag${index}`) }).success).toBe(false);
    expect(listCriteriaSchema.safeParse({ q: 'a'.repeat(201) }).success).toBe(false);
  });
});
