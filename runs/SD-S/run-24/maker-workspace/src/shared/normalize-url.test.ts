import { describe, expect, it } from 'vitest';

import { normalizeUrl } from './normalize-url.js';

describe('normalizeUrl', () => {
  it('trims and normalizes scheme, host, default port, root, and trailing slashes', () => {
    expect(normalizeUrl(' HTTPS://Example.COM:443/docs/ ')).toBe('https://example.com/docs');
    expect(normalizeUrl('https://example.com')).toBe('https://example.com/');
  });

  it('preserves path case, query order, and fragments', () => {
    expect(normalizeUrl('https://example.com/Docs?b=2&a=1#Part')).toBe(
      'https://example.com/Docs?b=2&a=1#Part',
    );
  });

  it('removes HTTP default ports while preserving non-default ports', () => {
    expect(normalizeUrl('http://EXAMPLE.com:80/path')).toBe('http://example.com/path');
    expect(normalizeUrl('https://example.com:8443/path')).toBe('https://example.com:8443/path');
  });

  it.each(['ftp://example.com', 'javascript:alert(1)', 'not a url'])('rejects %s', (value) => {
    expect(() => normalizeUrl(value)).toThrow('HTTP or HTTPS');
  });
});
