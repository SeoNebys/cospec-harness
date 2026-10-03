import { gzipSync } from 'node:zlib';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createMetadataDnsFake,
  createMetadataTransportFake,
  type MetadataDnsAddress,
  type MetadataTransportRequest,
} from '../fixtures/metadata.js';
import { createMetadataService } from '../../src/server/services/metadata-service.js';

const PUBLIC_V4 = '93.184.216.34';
const PUBLIC_V6 = '2606:2800:220:1:248:1893:25c8:1946';
const HTML_HEADERS = { 'content-type': 'text/html; charset=utf-8' };
const COMPLETE_HTML =
  '<!doctype html><html><head><title>Public page</title>' +
  '<meta name="description" content="Safe description"></head></html>';

function publicDns(...hostnames: string[]) {
  return createMetadataDnsFake(
    Object.fromEntries(
      hostnames.map((hostname) => [
        hostname,
        [{ address: PUBLIC_V4, family: 4 as const }],
      ]),
    ),
  );
}

function availableHtml(url = 'https://public.example/') {
  return createMetadataTransportFake({
    [url]: [{ headers: HTML_HEADERS, body: COMPLETE_HTML }],
  });
}

function expectUnavailable(
  result: Awaited<ReturnType<ReturnType<typeof createMetadataService>['preview']>>,
) {
  expect(result).toMatchObject({
    outcome: 'unavailable',
    title: null,
    description: null,
  });
}

afterEach(() => {
  vi.useRealTimers();
});

describe('metadata destination policy', () => {
  it.each([
    ['unspecified IPv4', '0.0.0.0'],
    ['private class A', '10.12.0.4'],
    ['carrier-grade NAT', '100.64.0.1'],
    ['loopback', '127.0.0.1'],
    ['link-local', '169.254.10.20'],
    ['private class B', '172.16.0.1'],
    ['IETF protocol assignments', '192.0.0.8'],
    ['documentation TEST-NET-1', '192.0.2.10'],
    ['private class C', '192.168.1.2'],
    ['deprecated 6to4 relay anycast', '192.88.99.1'],
    ['benchmarking', '198.18.0.1'],
    ['documentation TEST-NET-2', '198.51.100.4'],
    ['documentation TEST-NET-3', '203.0.113.9'],
    ['multicast', '224.0.0.1'],
    ['reserved', '240.0.0.1'],
    ['limited broadcast', '255.255.255.255'],
  ])('blocks %s DNS answers (%s)', async (_label, address) => {
    const dns = createMetadataDnsFake({
      'blocked.example': [{ address, family: 4 }],
    });
    const transport = createMetadataTransportFake({});
    const service = createMetadataService({
      dnsLookup: dns.lookup,
      transportRequest: transport.request,
    });

    expectUnavailable(await service.preview('https://blocked.example/'));
    expect(transport.calls).toHaveLength(0);
  });

  it.each([
    ['unspecified IPv6', '::'],
    ['IPv6 loopback', '::1'],
    ['IPv4-mapped unspecified', '::ffff:0.0.0.0'],
    ['IPv4-mapped loopback', '::ffff:127.0.0.1'],
    ['IPv4-mapped private', '::ffff:192.168.2.3'],
    ['discard-only', '100::1'],
    ['benchmarking', '2001:2::1'],
    ['documentation', '2001:db8::1'],
    ['unique-local', 'fd12:3456:789a::1'],
    ['link-local', 'fe80::1'],
    ['multicast', 'ff02::1'],
  ])('blocks %s DNS answers (%s)', async (_label, address) => {
    const dns = createMetadataDnsFake({
      'blocked.example': [{ address, family: 6 }],
    });
    const transport = createMetadataTransportFake({});
    const service = createMetadataService({
      dnsLookup: dns.lookup,
      transportRequest: transport.request,
    });

    expectUnavailable(await service.preview('https://blocked.example/'));
    expect(transport.calls).toHaveLength(0);
  });

  it.each([
    'http://2130706433/',
    'http://0177.0.0.1/',
    'http://0x7f000001/',
    'http://0x7f.0.0.1/',
    'http://127.1/',
    'http://[::ffff:127.0.0.1]/',
  ])('blocks alternate or mapped loopback literal %s', async (url) => {
    const dns = createMetadataDnsFake({});
    const transport = createMetadataTransportFake({});
    const service = createMetadataService({
      dnsLookup: dns.lookup,
      transportRequest: transport.request,
    });

    expectUnavailable(await service.preview(url));
    expect(dns.calls).toHaveLength(0);
    expect(transport.calls).toHaveLength(0);
  });

  it.each(['localhost', 'localhost.', 'api.localhost']) (
    'blocks localhost-style hostname %s without resolving it',
    async (hostname) => {
      const dns = createMetadataDnsFake({});
      const transport = createMetadataTransportFake({});
      const service = createMetadataService({
        dnsLookup: dns.lookup,
        transportRequest: transport.request,
      });

      expectUnavailable(await service.preview(`http://${hostname}/`));
      expect(dns.calls).toHaveLength(0);
      expect(transport.calls).toHaveLength(0);
    },
  );

  it('rejects the whole hostname when DNS mixes public and non-public answers', async () => {
    const dns = createMetadataDnsFake({
      'mixed.example': [
        { address: PUBLIC_V4, family: 4 },
        { address: '10.0.0.7', family: 4 },
      ],
    });
    const transport = createMetadataTransportFake({});
    const service = createMetadataService({
      dnsLookup: dns.lookup,
      transportRequest: transport.request,
    });

    expectUnavailable(await service.preview('https://mixed.example/'));
    expect(transport.calls).toHaveLength(0);
  });

  it('allows globally routable IPv4 and pins the connection to the validated answer', async () => {
    const dns = publicDns('public.example');
    const transport = availableHtml();
    const service = createMetadataService({
      dnsLookup: dns.lookup,
      transportRequest: transport.request,
    });

    await expect(service.preview('https://public.example/')).resolves.toMatchObject({
      outcome: 'complete',
      finalUrl: 'https://public.example/',
    });
    expect(transport.calls[0]).toMatchObject({ address: PUBLIC_V4 });
  });

  it('allows globally routable IPv6 and pins the connection to the validated answer', async () => {
    const dns = createMetadataDnsFake({
      'v6.example': [{ address: PUBLIC_V6, family: 6 }],
    });
    const transport = availableHtml('https://v6.example/');
    const service = createMetadataService({
      dnsLookup: dns.lookup,
      transportRequest: transport.request,
    });

    await expect(service.preview('https://v6.example/')).resolves.toMatchObject({
      outcome: 'complete',
    });
    expect(transport.calls[0]).toMatchObject({ address: PUBLIC_V6 });
  });

  it('does not perform a second DNS lookup between validation and connection', async () => {
    const answers: readonly MetadataDnsAddress[][] = [
      [{ address: PUBLIC_V4, family: 4 }],
      [{ address: '127.0.0.1', family: 4 }],
    ];
    let lookupCount = 0;
    const transport = availableHtml();
    const service = createMetadataService({
      dnsLookup: async () => answers[Math.min(lookupCount++, answers.length - 1)]!,
      transportRequest: transport.request,
    });

    await expect(service.preview('https://public.example/')).resolves.toMatchObject({
      outcome: 'complete',
    });
    expect(lookupCount).toBe(1);
    expect(transport.calls[0]?.address).toBe(PUBLIC_V4);
  });

  it.each([
    'https://user:password@public.example/',
    'https://public.example:444/',
    'http://public.example:8080/',
    'file:///etc/passwd',
  ])('makes disallowed destination %s unavailable before DNS or transport', async (url) => {
    const dns = createMetadataDnsFake({});
    const transport = createMetadataTransportFake({});
    const service = createMetadataService({
      dnsLookup: dns.lookup,
      transportRequest: transport.request,
    });

    expectUnavailable(await service.preview(url));
    expect(dns.calls).toHaveLength(0);
    expect(transport.calls).toHaveLength(0);
  });
});

describe('metadata redirects', () => {
  it('follows three relative redirects and revalidates every hop', async () => {
    const dns = publicDns('public.example');
    const transport = createMetadataTransportFake({
      'https://public.example/': [
        { status: 302, headers: { location: '/one' } },
      ],
      'https://public.example/one': [
        { status: 301, headers: { location: '/two' } },
      ],
      'https://public.example/two': [
        { status: 307, headers: { location: '/three' } },
      ],
      'https://public.example/three': [
        { headers: HTML_HEADERS, body: COMPLETE_HTML },
      ],
    });
    const service = createMetadataService({
      dnsLookup: dns.lookup,
      transportRequest: transport.request,
    });

    await expect(service.preview('https://public.example/')).resolves.toMatchObject({
      outcome: 'complete',
      finalUrl: 'https://public.example/three',
    });
    expect(dns.calls).toEqual([
      'public.example',
      'public.example',
      'public.example',
      'public.example',
    ]);
    expect(transport.calls).toHaveLength(4);
  });

  it('does not follow a fourth redirect', async () => {
    const dns = publicDns('public.example');
    const transport = createMetadataTransportFake({
      'https://public.example/': [{ status: 302, headers: { location: '/one' } }],
      'https://public.example/one': [{ status: 302, headers: { location: '/two' } }],
      'https://public.example/two': [{ status: 302, headers: { location: '/three' } }],
      'https://public.example/three': [{ status: 302, headers: { location: '/four' } }],
    });
    const service = createMetadataService({
      dnsLookup: dns.lookup,
      transportRequest: transport.request,
    });

    expectUnavailable(await service.preview('https://public.example/'));
    expect(transport.calls).toHaveLength(4);
  });

  it('blocks a redirect from a public page to a non-public destination', async () => {
    const dns = publicDns('public.example');
    const transport = createMetadataTransportFake({
      'https://public.example/': [
        { status: 302, headers: { location: 'http://127.0.0.1/admin' } },
      ],
    });
    const service = createMetadataService({
      dnsLookup: dns.lookup,
      transportRequest: transport.request,
    });

    expectUnavailable(await service.preview('https://public.example/'));
    expect(transport.calls).toHaveLength(1);
  });

  it.each([
    'http://user:password@public.example/private',
    'http://public.example:8080/private',
    'file:///etc/passwd',
  ])('reapplies URL policy to redirect target %s', async (location) => {
    const dns = publicDns('public.example');
    const transport = createMetadataTransportFake({
      'https://public.example/': [{ status: 302, headers: { location } }],
    });
    const service = createMetadataService({
      dnsLookup: dns.lookup,
      transportRequest: transport.request,
    });

    expectUnavailable(await service.preview('https://public.example/'));
    expect(transport.calls).toHaveLength(1);
  });
});

describe('metadata resource limits', () => {
  it('applies one four-second deadline to a never-ending response', async () => {
    vi.useFakeTimers();
    const dns = publicDns('public.example');
    const calls: MetadataTransportRequest[] = [];
    const service = createMetadataService({
      dnsLookup: dns.lookup,
      transportRequest: async (request) => {
        calls.push(request);
        return await new Promise<Response>((_resolve, reject) => {
          request.signal?.addEventListener(
            'abort',
            () => reject(request.signal?.reason ?? new DOMException('Aborted', 'AbortError')),
            { once: true },
          );
        });
      },
    });

    const preview = service.preview('https://public.example/');
    await vi.advanceTimersByTimeAsync(3_999);
    expect(calls[0]?.signal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);

    expectUnavailable(await preview);
    expect(calls[0]?.signal?.aborted).toBe(true);
  });

  it('admits at most four concurrent retrievals', async () => {
    const dns = publicDns('one.example', 'two.example', 'three.example', 'four.example', 'five.example');
    const pending: Array<(response: Response) => void> = [];
    const service = createMetadataService({
      dnsLookup: dns.lookup,
      transportRequest: async () =>
        await new Promise<Response>((resolve) => {
          pending.push(resolve);
        }),
    });

    const inFlight = ['one', 'two', 'three', 'four'].map((name) =>
      service.preview(`https://${name}.example/`),
    );
    await vi.waitFor(() => expect(pending).toHaveLength(4));

    await expect(service.preview('https://five.example/')).rejects.toMatchObject({
      code: 'METADATA_CONCURRENCY_LIMIT',
      status: 429,
    });
    expect(pending).toHaveLength(4);

    for (const resolve of pending) {
      resolve(new Response(COMPLETE_HTML, { headers: HTML_HEADERS }));
    }
    await expect(Promise.all(inFlight)).resolves.toHaveLength(4);
  });

  it.each(['text/html', 'application/xhtml+xml']) (
    'accepts successful %s responses',
    async (contentType) => {
      const dns = publicDns('public.example');
      const transport = createMetadataTransportFake({
        'https://public.example/': [
          { headers: { 'content-type': `${contentType}; charset=utf-8` }, body: COMPLETE_HTML },
        ],
      });
      const service = createMetadataService({
        dnsLookup: dns.lookup,
        transportRequest: transport.request,
      });

      await expect(service.preview('https://public.example/')).resolves.toMatchObject({
        outcome: 'complete',
      });
    },
  );

  it.each([
    ['missing content type', undefined],
    ['plain text', 'text/plain'],
    ['JSON', 'application/json'],
    ['an HTML-looking suffix', 'text/html-malicious'],
  ])('rejects %s responses', async (_label, contentType) => {
    const dns = publicDns('public.example');
    const headers = contentType === undefined ? undefined : { 'content-type': contentType };
    const transport = createMetadataTransportFake({
      'https://public.example/': [{ headers, body: COMPLETE_HTML }],
    });
    const service = createMetadataService({
      dnsLookup: dns.lookup,
      transportRequest: transport.request,
    });

    expectUnavailable(await service.preview('https://public.example/'));
  });

  it.each([199, 204, 304, 404, 500])('rejects non-success status %s', async (status) => {
    const dns = publicDns('public.example');
    const transport = createMetadataTransportFake({
      'https://public.example/': [{ status, headers: HTML_HEADERS, body: COMPLETE_HTML }],
    });
    const service = createMetadataService({
      dnsLookup: dns.lookup,
      transportRequest: transport.request,
    });

    expectUnavailable(await service.preview('https://public.example/'));
  });

  it('rejects an excessively large response-header section', async () => {
    const dns = publicDns('public.example');
    const transport = createMetadataTransportFake({
      'https://public.example/': [
        {
          headers: {
            ...HTML_HEADERS,
            'x-padding': 'x'.repeat(128 * 1024),
          },
          body: COMPLETE_HTML,
        },
      ],
    });
    const service = createMetadataService({
      dnsLookup: dns.lookup,
      transportRequest: transport.request,
    });

    expectUnavailable(await service.preview('https://public.example/'));
  });

  it('does not pass ambient cookie, authorization, proxy, or referrer headers to transport', async () => {
    const dns = publicDns('public.example');
    const transport = availableHtml();
    const service = createMetadataService({
      dnsLookup: dns.lookup,
      transportRequest: transport.request,
    });

    await service.preview('https://public.example/');
    const request = transport.calls[0] as unknown as Record<string, unknown>;
    expect(request.cookie).toBeUndefined();
    expect(request.authorization).toBeUndefined();
    expect(request.proxyAuthorization).toBeUndefined();
    expect(request.referrer).toBeUndefined();
    expect(request.headers).toBeUndefined();
  });

  it('stops when the decompressed body exceeds 512 KiB', async () => {
    const dns = publicDns('public.example');
    const expandedHtml = `<html><head>${' '.repeat(512 * 1024)}<title>Too late</title></head></html>`;
    const compressed = gzipSync(expandedHtml);
    expect(compressed.byteLength).toBeLessThan(512 * 1024);
    const transport = createMetadataTransportFake({
      'https://public.example/': [
        {
          headers: {
            'content-type': 'text/html; charset=utf-8',
            'content-encoding': 'gzip',
          },
          body: compressed,
        },
      ],
    });
    const service = createMetadataService({
      dnsLookup: dns.lookup,
      transportRequest: transport.request,
    });

    expectUnavailable(await service.preview('https://public.example/'));
  });

  it('stops when an uncompressed body exceeds 512 KiB', async () => {
    const dns = publicDns('public.example');
    const oversizedHtml = `<html><head>${' '.repeat(512 * 1024)}<title>Too late</title></head></html>`;
    const transport = createMetadataTransportFake({
      'https://public.example/': [
        { headers: HTML_HEADERS, body: oversizedHtml },
      ],
    });
    const service = createMetadataService({
      dnsLookup: dns.lookup,
      transportRequest: transport.request,
    });

    expectUnavailable(await service.preview('https://public.example/'));
  });
});
