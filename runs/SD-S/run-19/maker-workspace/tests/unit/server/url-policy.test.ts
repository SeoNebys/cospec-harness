import { describe, expect, it } from 'vitest';
import { canonicalizeUrl, fallbackTitleForUrl, isPublicAddress, resolvePublicAddresses, UrlPolicyError } from '../../../src/server/services/url-policy.js';

describe('URL policy', () => {
  it('canonicalizes HTTP URLs for duplicate comparison', () => {
    const result = canonicalizeUrl('  HTTPS://Example.COM:443/path#fragment  ');
    expect(result.canonical).toBe('https://example.com/path');
    expect(result.normalized).toBe(result.canonical);
  });

  it('rejects unsupported schemes, credentials, and direct private addresses', () => {
    expect(() => canonicalizeUrl('file:///tmp/a')).toThrow(UrlPolicyError);
    expect(() => canonicalizeUrl('https://user:pass@example.com')).toThrow(UrlPolicyError);
    expect(() => canonicalizeUrl('http://127.0.0.1')).toThrow(UrlPolicyError);
    expect(() => canonicalizeUrl('http://[::1]')).toThrow(UrlPolicyError);
  });

  it('classifies public and private IPv4 and IPv6 addresses', () => {
    expect(isPublicAddress('93.184.216.34')).toBe(true);
    expect(isPublicAddress('10.0.0.1')).toBe(false);
    expect(isPublicAddress('2606:2800:220:1:248:1893:25c8:1946')).toBe(true);
    expect(isPublicAddress('fe80::1')).toBe(false);
  });

  it('rejects a hostname if any resolved address is private', async () => {
    await expect(resolvePublicAddresses('example.test', async () => [
      { address: '93.184.216.34', family: 4 },
      { address: '127.0.0.1', family: 4 },
    ])).rejects.toMatchObject({ code: 'UNSAFE_URL' });
  });

  it('creates a readable fallback title', () => {
    expect(fallbackTitleForUrl('https://www.example.com/good-article.html')).toBe('Good article · example.com');
  });
});
