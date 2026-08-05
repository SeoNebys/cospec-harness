import { describe, it, expect } from 'vitest';
import { normalizeUrl, isValidUrl, deriveTitle } from '../../src/lib/url';
import { ValidationError } from '../../src/models/bookmark';

describe('normalizeUrl', () => {
  it('keeps a well-formed https address', () => {
    expect(normalizeUrl('https://example.com/a')).toBe('https://example.com/a');
  });

  it('assumes https when no scheme is given', () => {
    expect(normalizeUrl('example.com')).toBe('https://example.com/');
  });

  it('trims surrounding whitespace', () => {
    expect(normalizeUrl('  https://example.com  ')).toBe('https://example.com/');
  });

  it('rejects empty input', () => {
    expect(() => normalizeUrl('   ')).toThrow(ValidationError);
  });

  it('rejects non-http(s) schemes', () => {
    expect(() => normalizeUrl('ftp://example.com')).toThrow(ValidationError);
    expect(() => normalizeUrl('javascript:alert(1)')).toThrow(ValidationError);
  });

  it('rejects malformed addresses', () => {
    expect(() => normalizeUrl('http://')).toThrow(ValidationError);
  });
});

describe('isValidUrl', () => {
  it('is true for valid addresses and false otherwise', () => {
    expect(isValidUrl('example.com')).toBe(true);
    expect(isValidUrl('')).toBe(false);
    expect(isValidUrl('ftp://x')).toBe(false);
  });
});

describe('deriveTitle', () => {
  it('uses host and path', () => {
    expect(deriveTitle('https://example.com/blog/post')).toBe('example.com/blog/post');
  });

  it('drops a trailing root slash', () => {
    expect(deriveTitle('https://example.com/')).toBe('example.com');
  });
});
