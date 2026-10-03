import { describe, expect, it, vi } from 'vitest';
import { Response } from 'undici';
import { isPublicAddress, safeFetch, type SafeFetchRuntime } from '../../src/server/metadata/safe-fetch';

const htmlOptions = {
  maxBytes: 64,
  timeoutMs: 20,
  maxRedirects: 2,
  acceptedTypes: (type: string) => type === 'text/html',
};

function runtime(
  fetcher: SafeFetchRuntime['fetch'],
  resolver: SafeFetchRuntime['lookup'] = async () => [{ address: '1.1.1.1', family: 4 }],
): SafeFetchRuntime {
  return { fetch: fetcher, lookup: resolver };
}

describe('safe fetch address policy', () => {
  it.each([
    '0.0.0.0',
    '127.0.0.1',
    '10.0.0.1',
    '172.16.0.1',
    '192.168.1.1',
    '169.254.169.254',
    '224.0.0.1',
    '::1',
    'fe80::1',
    'fc00::1',
    '::ffff:127.0.0.1',
  ])('blocks non-public address %s', (address) => {
    expect(isPublicAddress(address)).toBe(false);
  });

  it.each(['1.1.1.1', '8.8.8.8', '2606:4700:4700::1111'])('accepts public address %s', (address) => {
    expect(isPublicAddress(address)).toBe(true);
  });

  it('rejects credentials and non-standard ports before requesting anything', async () => {
    const fetcher = vi.fn<SafeFetchRuntime['fetch']>();
    await expect(
      safeFetch('https://user:secret@example.com', htmlOptions, runtime(fetcher)),
    ).rejects.toMatchObject({
      code: 'invalid_url',
    });
    await expect(safeFetch('https://example.com:8443', htmlOptions, runtime(fetcher))).rejects.toMatchObject({
      code: 'unsafe_destination',
    });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('rejects a hostname when any DNS answer is non-public', async () => {
    const fetcher = vi.fn<SafeFetchRuntime['fetch']>();
    const resolver = vi.fn<SafeFetchRuntime['lookup']>().mockResolvedValue([
      { address: '1.1.1.1', family: 4 },
      { address: '127.0.0.1', family: 4 },
    ]);
    await expect(
      safeFetch('https://example.com', htmlOptions, runtime(fetcher, resolver)),
    ).rejects.toMatchObject({
      code: 'unsafe_destination',
    });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('revalidates every redirect destination and blocks a private redirect', async () => {
    const fetcher = vi
      .fn<SafeFetchRuntime['fetch']>()
      .mockResolvedValue(
        new Response(null, { status: 302, headers: { location: 'http://internal.test/admin' } }),
      );
    const resolver = vi.fn<SafeFetchRuntime['lookup']>(async (hostname) => [
      { address: hostname === 'internal.test' ? '10.0.0.8' : '1.1.1.1', family: 4 },
    ]);
    await expect(
      safeFetch('https://example.com', htmlOptions, runtime(fetcher, resolver)),
    ).rejects.toMatchObject({
      code: 'unsafe_destination',
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('bounds redirect hops', async () => {
    const fetcher = vi.fn<SafeFetchRuntime['fetch']>().mockImplementation(
      async (url) =>
        new Response(null, {
          status: 302,
          headers: { location: new URL('/again', String(url)).href },
        }),
    );
    await expect(
      safeFetch('https://example.com', { ...htmlOptions, maxRedirects: 1 }, runtime(fetcher)),
    ).rejects.toMatchObject({ code: 'remote_redirect_failed' });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('times out a slow destination', async () => {
    const fetcher = vi.fn<SafeFetchRuntime['fetch']>(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
        }),
    );
    await expect(safeFetch('https://example.com', htmlOptions, runtime(fetcher))).rejects.toMatchObject({
      code: 'remote_timeout',
    });
  });

  it('rejects declared, streamed, and decompressed bodies above the byte limit', async () => {
    const declared = vi
      .fn<SafeFetchRuntime['fetch']>()
      .mockResolvedValue(
        new Response('tiny', { headers: { 'content-type': 'text/html', 'content-length': '1000' } }),
      );
    await expect(safeFetch('https://example.com', htmlOptions, runtime(declared))).rejects.toMatchObject({
      code: 'remote_content_too_large',
    });

    const streamed = vi.fn<SafeFetchRuntime['fetch']>().mockResolvedValue(
      new Response('x'.repeat(100), {
        headers: { 'content-type': 'text/html', 'content-encoding': 'gzip' },
      }),
    );
    await expect(safeFetch('https://example.com', htmlOptions, runtime(streamed))).rejects.toMatchObject({
      code: 'remote_content_too_large',
    });
  });

  it('rejects an unexpected response MIME type', async () => {
    const fetcher = vi
      .fn<SafeFetchRuntime['fetch']>()
      .mockResolvedValue(new Response('{}', { headers: { 'content-type': 'application/json' } }));
    await expect(safeFetch('https://example.com', htmlOptions, runtime(fetcher))).rejects.toMatchObject({
      code: 'remote_content_type',
    });
  });
});
