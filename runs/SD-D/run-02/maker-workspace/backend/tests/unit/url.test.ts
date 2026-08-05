import { describe, it, expect } from 'vitest';
import { normalizeUrl, fallbackTitle, looksLikePdf, InvalidUrlError } from '../../src/services/url.js';

describe('normalizeUrl', () => {
  it('adds https when the scheme is missing', () => {
    expect(normalizeUrl('example.com').href).toBe('https://example.com/');
  });

  it('rejects empty and malformed input', () => {
    expect(() => normalizeUrl('')).toThrow(InvalidUrlError);
    expect(() => normalizeUrl('not a url')).toThrow(InvalidUrlError);
    expect(() => normalizeUrl('ftp://example.com')).toThrow(InvalidUrlError);
  });

  it('treats trivially different forms of the same URL as duplicates', () => {
    const a = normalizeUrl('http://www.Example.com/page/').normalized;
    const b = normalizeUrl('https://example.com/page').normalized;
    const c = normalizeUrl('https://example.com/page?utm_source=twitter').normalized;
    expect(a).toBe(b);
    expect(b).toBe(c);
  });

  it('keeps meaningful query params and distinguishes different pages', () => {
    expect(normalizeUrl('https://x.com/a').normalized).not.toBe(normalizeUrl('https://x.com/b').normalized);
    expect(normalizeUrl('https://x.com/s?q=1').normalized).not.toBe(normalizeUrl('https://x.com/s?q=2').normalized);
  });
});

describe('helpers', () => {
  it('derives a fallback title from the address', () => {
    expect(fallbackTitle('https://example.com/docs/guide')).toBe('example.com/docs/guide');
    expect(fallbackTitle('https://example.com')).toBe('example.com');
  });
  it('detects PDF links', () => {
    expect(looksLikePdf('https://x.com/paper.pdf')).toBe(true);
    expect(looksLikePdf('https://x.com/page')).toBe(false);
  });
});
