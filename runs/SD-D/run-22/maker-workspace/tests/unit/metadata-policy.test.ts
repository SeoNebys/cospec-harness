import { describe, expect, it } from 'vitest';
import { extractMetadata } from '../../src/server/metadata/extract-html.js';
import { isGloballyReachable } from '../../src/server/metadata/network-policy.js';
import { fallbackTitle, normalizeBookmarkUrl, parsePublicHttpUrl } from '../../src/server/metadata/url-policy.js';

describe('metadata safety and extraction', () => {
  it('normalizes duplicate keys without losing the query', () => {
    expect(normalizeBookmarkUrl('HTTPS://Example.COM:443/path?q=1#section')).toBe('https://example.com/path?q=1');
    expect(() => parsePublicHttpUrl('file:///etc/passwd')).toThrow(/HTTP and HTTPS/u);
    expect(() => parsePublicHttpUrl('https://name:secret@example.com')).toThrow(/credentials/u);
    expect(fallbackTitle('https://example.com/ancient-rome')).toContain('ancient rome');
  });

  it('blocks local, private, documentation, and mapped addresses', () => {
    for (const address of ['127.0.0.1', '10.1.2.3', '169.254.169.254', '192.168.1.2', '203.0.113.4', '::1', 'fd00::1', '::ffff:127.0.0.1']) {
      expect(isGloballyReachable(address), address).toBe(false);
    }
    expect(isGloballyReachable('93.184.216.34')).toBe(true);
    expect(isGloballyReachable('2606:2800:220:1:248:1893:25c8:1946')).toBe(true);
  });

  it('uses deterministic metadata precedence and safe fallback', () => {
    const result = extractMetadata(`<html><head><title>HTML title</title><meta property="og:title" content="Social title"><meta name="description" content=" A   useful page "><link rel="icon" href="/icon.png"></head></html>`, new URL('https://example.com/path'));
    expect(result).toMatchObject({ title: 'Social title', titleSource: 'og:title', description: 'A useful page', descriptionSource: 'description' });
    expect(result.iconCandidates[0]).toBe('https://example.com/icon.png');
    expect(extractMetadata('<html></html>', new URL('https://example.com/reading-list')).title).toContain('reading list');
  });
});
