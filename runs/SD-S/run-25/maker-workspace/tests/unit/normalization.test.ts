import {
  canonicalizeBookmarkUrl,
  createUrlKey,
  normalizeBookmarkUrl,
  normalizeTag,
  normalizeTagName,
  normalizeTags,
} from '../../src/shared/normalization.js';

describe('bookmark URL normalization', () => {
  it('trims and applies WHATWG scheme, host, and default-port canonicalization', () => {
    expect(canonicalizeBookmarkUrl('  HTTPS://Example.COM:443/docs  ')).toBe(
      'https://example.com/docs',
    );
  });

  it('retains the fragment for navigation and removes it from duplicate keys', () => {
    expect(normalizeBookmarkUrl('https://example.com/docs?q=one#intro')).toEqual({
      url: 'https://example.com/docs?q=one#intro',
      urlKey: 'https://example.com/docs?q=one',
    });
    expect(createUrlKey('https://example.com/docs?q=two#intro')).toBe(
      'https://example.com/docs?q=two',
    );
  });

  it.each(['ftp://example.com/file', 'mailto:user@example.com']) (
    'rejects unsupported protocol %s',
    (url) => expect(() => canonicalizeBookmarkUrl(url)).toThrow(/HTTP or HTTPS/),
  );

  it('rejects embedded credentials', () => {
    expect(() => createUrlKey('https://user:secret@example.com/')).toThrow(
      /credentials/,
    );
  });
});

describe('tag normalization', () => {
  it('trims, compatibility-normalizes, and lowercases identity values', () => {
    expect(normalizeTagName('  Ｄｅｓｉｇｎ  ')).toBe('design');
    expect(normalizeTag('  Research  ')).toEqual({
      displayName: 'Research',
      normalizedName: 'research',
    });
  });

  it('deduplicates normalized identities while retaining first spelling and order', () => {
    expect(normalizeTags([' Design ', 'RESEARCH', 'ｄｅｓｉｇｎ', 'research'])).toEqual([
      { displayName: 'Design', normalizedName: 'design' },
      { displayName: 'RESEARCH', normalizedName: 'research' },
    ]);
  });
});
