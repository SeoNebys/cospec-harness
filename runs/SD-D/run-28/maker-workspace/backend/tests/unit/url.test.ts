import { describe, it, expect } from 'vitest';
import { normalizeUrl, deriveTitleFromUrl } from '../../src/lib/url.ts';

describe('normalizeUrl', () => {
  it('adds http:// when scheme missing', () => {
    expect(normalizeUrl('example.com').url).toBe('http://example.com/');
  });

  it('treats trailing slash, scheme case and host case as the same key', () => {
    const a = normalizeUrl('http://Example.com/path/').key;
    const b = normalizeUrl('http://example.com/path').key;
    expect(a).toBe(b);
  });

  it('keeps distinct paths distinct', () => {
    expect(normalizeUrl('http://a.com/x').key).not.toBe(normalizeUrl('http://a.com/y').key);
  });

  it('rejects whitespace-only input', () => {
    expect(() => normalizeUrl('   ')).toThrow();
  });

  it('rejects non-http(s) schemes', () => {
    expect(() => normalizeUrl('ftp://a.com')).toThrow();
    expect(() => normalizeUrl('javascript:alert(1)')).toThrow();
  });

  it('derives a title from a url', () => {
    expect(deriveTitleFromUrl('https://news.site/a/b')).toBe('news.site/a/b');
    expect(deriveTitleFromUrl('https://news.site/')).toBe('news.site');
  });
});
