import { describe, it, expect } from 'vitest';
import {
  normalizeUrl,
  urlKey,
  normalizeAndKey,
  InvalidUrlError,
} from '../../src/server/services/url';

describe('normalizeUrl (FR-002)', () => {
  it('adds https:// when the scheme is omitted', () => {
    expect(normalizeUrl('example.com')).toBe('https://example.com/');
  });

  it('lowercases the host', () => {
    expect(normalizeUrl('HTTPS://Example.COM/Path')).toBe('https://example.com/Path');
  });

  it('preserves an existing https scheme and path', () => {
    expect(normalizeUrl('https://example.com/a/b?q=1')).toBe('https://example.com/a/b?q=1');
  });

  it('rejects empty input', () => {
    expect(() => normalizeUrl('   ')).toThrow(InvalidUrlError);
  });

  it('rejects non-http(s) schemes', () => {
    expect(() => normalizeUrl('ftp://example.com')).toThrow(InvalidUrlError);
    expect(() => normalizeUrl('javascript:alert(1)')).toThrow(InvalidUrlError);
  });

  it('rejects gibberish without a dotted host', () => {
    expect(() => normalizeUrl('not a url')).toThrow(InvalidUrlError);
    expect(() => normalizeUrl('localhostonly')).toThrow(InvalidUrlError);
  });
});

describe('urlKey / duplicate detection (FR-023, SC-007)', () => {
  it('treats example.com and https://example.com/ as the same', () => {
    expect(normalizeAndKey('example.com').key).toBe(normalizeAndKey('https://example.com/').key);
  });

  it('ignores a trailing slash on the path', () => {
    expect(urlKey('https://example.com/page/')).toBe(urlKey('https://example.com/page'));
  });

  it('ignores default ports and #fragments', () => {
    expect(urlKey('https://example.com:443/p#section')).toBe(urlKey('https://example.com/p'));
  });

  it('keeps distinct query strings distinct', () => {
    expect(urlKey('https://example.com/?id=1')).not.toBe(urlKey('https://example.com/?id=2'));
  });

  it('distinguishes different hosts', () => {
    expect(urlKey('https://a.com/')).not.toBe(urlKey('https://b.com/'));
  });
});
