import { describe, expect, it } from 'vitest';
import { normalizeUrl } from '../../src/server/bookmarks/url-normalization';

describe('normalizeUrl', () => {
  it('normalizes host, default port, fragment, and empty path', () =>
    expect(normalizeUrl('HTTPS://Example.COM:443#part')).toBe('https://example.com/'));
  it('preserves meaningful query values', () =>
    expect(normalizeUrl('https://example.com/a?x=1')).toBe('https://example.com/a?x=1'));
});
