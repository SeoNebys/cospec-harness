import { describe, it, expect } from 'vitest';
import { normalizeUrl, isValidWebUrl } from '../../src/services/normalizeUrl';

describe('normalizeUrl (light normalization, FR-006 / Q1)', () => {
  it('treats trailing slash, scheme, www, and host case as the same', () => {
    const a = normalizeUrl('https://www.Example.com/article/');
    const b = normalizeUrl('http://example.com/article');
    expect(a).toBe(b);
  });

  it('strips common tracking parameters', () => {
    const a = normalizeUrl('https://example.com/p?utm_source=x&utm_medium=y&id=42');
    const b = normalizeUrl('https://example.com/p?id=42');
    expect(a).toBe(b);
  });

  it('ignores fbclid/gclid', () => {
    expect(normalizeUrl('https://example.com/p?fbclid=abc')).toBe(normalizeUrl('https://example.com/p'));
  });

  it('keeps distinct paths separate', () => {
    expect(normalizeUrl('https://example.com/a')).not.toBe(normalizeUrl('https://example.com/b'));
  });

  it('keeps meaningful query parameters significant', () => {
    expect(normalizeUrl('https://example.com/search?q=cats')).not.toBe(
      normalizeUrl('https://example.com/search?q=dogs')
    );
  });

  it('accepts a scheme-less address', () => {
    expect(isValidWebUrl('example.com')).toBe(true);
    expect(normalizeUrl('example.com')).toBe('example.com');
  });

  it('rejects invalid addresses', () => {
    expect(isValidWebUrl('not a url')).toBe(false);
    expect(isValidWebUrl('ftp://example.com')).toBe(false);
  });
});
