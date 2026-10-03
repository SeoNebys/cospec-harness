import { describe, expect, it, vi } from 'vitest';
import { MetadataFetcher, type MetadataTransport } from '../../../src/server/services/metadata-fetcher.js';
import { canonicalizeUrl, type AddressResolver } from '../../../src/server/services/url-policy.js';

const publicResolver: AddressResolver = async () => [{ address: '93.184.216.34', family: 4 }];

describe('metadata security regressions', () => {
  it.each(['http://2130706433', 'http://0177.0.0.1', 'http://0x7f000001', 'http://[::ffff:127.0.0.1]'])(
    'rejects alternative private address form %s',
    (url) => expect(() => canonicalizeUrl(url)).toThrow(/private network/i),
  );

  it('rejects mixed public/private DNS answers before connecting', async () => {
    const transport = vi.fn<MetadataTransport>();
    const resolver: AddressResolver = async () => [
      { address: '2606:2800:220:1:248:1893:25c8:1946', family: 6 },
      { address: '192.168.1.20', family: 4 },
    ];
    await expect(new MetadataFetcher({ resolver, transport }).preview('https://example.com')).rejects.toMatchObject({ code: 'UNSAFE_URL' });
    expect(transport).not.toHaveBeenCalled();
  });

  it('rejects a redirect that resolves privately', async () => {
    const resolver: AddressResolver = async (hostname) => hostname === 'example.com'
      ? [{ address: '93.184.216.34', family: 4 }]
      : [{ address: '169.254.169.254', family: 4 }];
    const transport: MetadataTransport = async () => ({ status: 302, headers: { location: 'http://metadata.internal/latest' }, body: '' });
    await expect(new MetadataFetcher({ resolver, transport }).preview('https://example.com')).rejects.toMatchObject({ code: 'UNSAFE_URL' });
  });

  it.each(['oversized body', 'timeout', 'malformed HTML'])(
    'returns a safe fallback for %s',
    async (scenario) => {
      const transport: MetadataTransport = scenario === 'malformed HTML'
        ? async () => ({ status: 200, headers: { 'content-type': 'text/html' }, body: '<html><title><script>never()</script>' })
        : async () => { throw new Error(scenario); };
      const result = await new MetadataFetcher({ resolver: publicResolver, transport }).preview('https://example.com/article');
      expect(result).toMatchObject({ source: 'fallback', title: 'Article · example.com' });
    },
  );
});
