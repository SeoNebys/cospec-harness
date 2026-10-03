import { describe, expect, it } from 'vitest';
import { normalizeUrl, UrlValidationError } from '../../src/server/services/url';

describe('URL normalization', () => {
  it('normalizes scheme, host, default port, fragment and empty path while retaining query', () => {
    expect(normalizeUrl(' HTTPS://EXAMPLE.COM:443?b=2&a=1#part ').normalizedUrl).toBe(
      'https://example.com/?b=2&a=1',
    );
  });
  it('creates a hostname and path fallback title', () =>
    expect(normalizeUrl('https://www.example.com/good-article').fallbackTitle).toBe(
      'good article — example.com',
    ));
  it.each(['ftp://example.com', 'javascript:alert(1)', 'https://user:pass@example.com', 'nope'])(
    `rejects %s`,
    (value) => expect(() => normalizeUrl(value)).toThrow(UrlValidationError),
  );
});
