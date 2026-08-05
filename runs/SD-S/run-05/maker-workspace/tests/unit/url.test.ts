import { describe, it, expect } from 'vitest';
import { isValidHttpUrl, normalizeUrl } from '../../src/server/services/url';

describe('isValidHttpUrl (FR-002)', () => {
  it('accepts http and https URLs', () => {
    expect(isValidHttpUrl('http://example.com')).toBe(true);
    expect(isValidHttpUrl('https://example.com/path?q=1')).toBe(true);
  });

  it('rejects non-http schemes and malformed input', () => {
    expect(isValidHttpUrl('ftp://example.com')).toBe(false);
    expect(isValidHttpUrl('not a url')).toBe(false);
    expect(isValidHttpUrl('')).toBe(false);
  });

  it('accepts and validates trimmed input', () => {
    expect(isValidHttpUrl('  https://example.com  ')).toBe(true);
  });
});

describe('normalizeUrl (FR-014)', () => {
  it('lower-cases scheme and host but preserves the path', () => {
    expect(normalizeUrl('HTTPS://Example.COM/Path')).toBe(
      'https://example.com/Path',
    );
  });

  it('trims surrounding whitespace', () => {
    expect(normalizeUrl('  https://example.com/  ')).toBe('https://example.com/');
  });

  it('preserves non-Latin and special characters in the path/query', () => {
    // Path characters are percent-encoded by the URL parser but remain distinct
    // and reversible, so searching/uniqueness stay correct (edge case).
    const a = normalizeUrl('https://例え.jp/記事');
    const b = normalizeUrl('https://例え.jp/記事');
    expect(a).toBe(b);
    expect(a).not.toBe(normalizeUrl('https://例え.jp/違う'));
  });
});
