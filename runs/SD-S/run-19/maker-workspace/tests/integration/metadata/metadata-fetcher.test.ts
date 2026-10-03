import { describe, expect, it, vi } from 'vitest';
import { createServer } from 'node:http';
import { metadataPages } from '../../fixtures/metadata-pages.js';
import { defaultMetadataTransport, MetadataFetcher, type MetadataTransport } from '../../../src/server/services/metadata-fetcher.js';
import type { AddressResolver } from '../../../src/server/services/url-policy.js';

const publicResolver: AddressResolver = async () => [{ address: '93.184.216.34', family: 4 }];

describe('metadata fetcher', () => {
  it('pins a vetted address and extracts HTML metadata', async () => {
    const transport = vi.fn<MetadataTransport>(async () => ({ status: 200, headers: { 'content-type': 'text/html; charset=utf-8' }, body: metadataPages.rich }));
    const fetcher = new MetadataFetcher({ resolver: publicResolver, transport });
    const result = await fetcher.preview('https://example.com/article');
    expect(transport).toHaveBeenCalledWith(expect.objectContaining({ hostname: 'example.com' }), { address: '93.184.216.34', family: 4 }, expect.any(Number), 1_048_576);
    expect(result).toMatchObject({ title: 'Social title', description: 'Social description', source: 'remote', warning: null });
  });

  it('uses the pinned address with Node lookup-all requests', async () => {
    const server = createServer((_request, response) => response.end(metadataPages.standard));
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Fixture server did not expose a port.');
    try {
      const response = await defaultMetadataTransport(
        new URL(`http://example.test:${address.port}/`),
        { address: '127.0.0.1', family: 4 },
        1_000,
        1_048_576,
      );
      expect(response.status).toBe(200);
      expect(response.body).toContain('Standard title');
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  });

  it('checks every redirect and rejects redirect-to-private attempts', async () => {
    const resolver: AddressResolver = async (hostname) => hostname === 'example.com'
      ? [{ address: '93.184.216.34', family: 4 }]
      : [{ address: '127.0.0.1', family: 4 }];
    const transport: MetadataTransport = async () => ({ status: 302, headers: { location: 'http://internal.test/secret' }, body: '' });
    await expect(new MetadataFetcher({ resolver, transport }).preview('https://example.com')).rejects.toMatchObject({ code: 'UNSAFE_URL' });
  });

  it('stops after three redirects', async () => {
    const transport: MetadataTransport = async (url) => ({ status: 302, headers: { location: `${url.origin}/next${url.pathname}` }, body: '' });
    const result = await new MetadataFetcher({ resolver: publicResolver, transport }).preview('https://example.com/start');
    expect(result.source).toBe('fallback');
    expect(result.warning).toMatch(/could not retrieve/i);
  });

  it('falls back for timeouts, oversized pages, non-HTML content, and missing titles', async () => {
    const cases: MetadataTransport[] = [
      async () => { throw new Error('timeout'); },
      async () => { throw new Error('response too large'); },
      async () => ({ status: 200, headers: { 'content-type': 'application/pdf' }, body: '' }),
      async () => ({ status: 200, headers: { 'content-type': 'text/html' }, body: metadataPages.blank }),
    ];
    for (const transport of cases) {
      const result = await new MetadataFetcher({ resolver: publicResolver, transport }).preview('https://example.com/good-article');
      expect(result).toMatchObject({ title: 'Good article · example.com', description: null, source: 'fallback' });
    }
  });

  it('rejects mixed public and private DNS answers before transport', async () => {
    const transport = vi.fn<MetadataTransport>();
    const resolver: AddressResolver = async () => [
      { address: '93.184.216.34', family: 4 },
      { address: '10.0.0.2', family: 4 },
    ];
    await expect(new MetadataFetcher({ resolver, transport }).preview('https://example.com')).rejects.toMatchObject({ code: 'UNSAFE_URL' });
    expect(transport).not.toHaveBeenCalled();
  });
});
