import { describe, expect, it } from 'vitest';
import { normalizeBookmarkUrl, parseBookmarkUrl } from '../../src/server/domain/url-normalization';

describe('bookmark URL normalization', () => {
  it('trims, removes fragments/default ports/trailing host dots, and normalizes an empty path', () => {
    expect(normalizeBookmarkUrl('  HTTPS://Example.COM.:443/a/../#section  ').normalized).toBe(
      'https://example.com/',
    );
  });

  it('preserves query order, protocol, www, path case, and trailing slash semantics', () => {
    expect(normalizeBookmarkUrl('http://www.Example.com/A/?b=2&a=1').normalized).toBe(
      'http://www.example.com/A/?b=2&a=1',
    );
  });

  it('rejects unsupported protocols and embedded credentials', () => {
    expect(() => parseBookmarkUrl('file:///etc/passwd')).toThrow(/Only http/);
    expect(() => parseBookmarkUrl('https://user:pass@example.com')).toThrow(/credentials/);
  });
});
