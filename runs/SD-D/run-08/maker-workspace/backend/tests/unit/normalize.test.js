import { describe, it, expect } from 'vitest';
import { isValidWebUrl, normalizeUrl, fallbackTitle } from '../../src/url/normalize.js';

describe('URL validation', () => {
  it('accepts http/https URLs', () => {
    expect(isValidWebUrl('https://example.com')).toBe(true);
    expect(isValidWebUrl('http://example.com/path')).toBe(true);
  });
  it('rejects invalid or non-web URLs', () => {
    expect(isValidWebUrl('not a url')).toBe(false);
    expect(isValidWebUrl('ftp://example.com')).toBe(false);
    expect(isValidWebUrl('javascript:alert(1)')).toBe(false);
    expect(isValidWebUrl('')).toBe(false);
  });
});

describe('URL normalization (duplicate key)', () => {
  it('treats trailing slash as equal', () => {
    expect(normalizeUrl('https://example.com/a/')).toBe(normalizeUrl('https://example.com/a'));
  });
  it('lowercases scheme and host', () => {
    expect(normalizeUrl('HTTPS://Example.COM/A')).toBe('https://example.com/A');
  });
  it('drops the default port', () => {
    expect(normalizeUrl('https://example.com:443/x')).toBe(normalizeUrl('https://example.com/x'));
    expect(normalizeUrl('http://example.com:80/x')).toBe(normalizeUrl('http://example.com/x'));
  });
  it('keeps a non-default port', () => {
    expect(normalizeUrl('https://example.com:8443/x')).toContain(':8443');
  });
  it('preserves query strings (distinct pages)', () => {
    expect(normalizeUrl('https://e.com/s?q=1')).not.toBe(normalizeUrl('https://e.com/s?q=2'));
  });
});

describe('fallback title', () => {
  it('derives a readable title from the last path segment', () => {
    expect(fallbackTitle('https://example.com/my-cool_article.html')).toBe('my cool article');
  });
  it('falls back to the host when no path', () => {
    expect(fallbackTitle('https://example.com')).toBe('example.com');
  });
});
