import { describe, it, expect } from 'vitest';
import { normalize, isValidWebUrl, titleFromUrl } from '../../src/server/services/urlNormalize.js';

describe('urlNormalize', () => {
  it('adds a missing scheme', () => {
    expect(normalize('example.com')).toBe('https://example.com');
  });

  it('treats trailing slash, scheme, and host case as the same', () => {
    const base = normalize('https://example.com');
    expect(normalize('https://example.com/')).toBe(base);
    expect(normalize('http://example.com')).toBe(base);
    expect(normalize('HTTPS://Example.COM/')).toBe(base);
    expect(normalize('example.com')).toBe(base);
  });

  it('strips default ports but keeps non-default ports', () => {
    expect(normalize('https://example.com:443/path')).toBe('https://example.com/path');
    expect(normalize('https://example.com:8443/path')).toBe('https://example.com:8443/path');
  });

  it('keeps path and query case-sensitive', () => {
    expect(normalize('https://example.com/Path?A=B')).toBe('https://example.com/Path?A=B');
  });

  it('rejects invalid addresses', () => {
    expect(isValidWebUrl('not a url')).toBe(false);
    expect(isValidWebUrl('mailto:a@b.com')).toBe(false);
    expect(isValidWebUrl('javascript:alert(1)')).toBe(false);
    expect(isValidWebUrl('')).toBe(false);
    expect(isValidWebUrl('example.com')).toBe(true);
    expect(() => normalize('not a url')).toThrow();
  });

  it('derives a fallback title from the URL', () => {
    expect(titleFromUrl('https://www.example.com/page')).toBe('example.com/page');
  });
});
