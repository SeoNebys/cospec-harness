import { lookup } from 'node:dns/promises';
import ipaddr from 'ipaddr.js';
import { Agent, fetch } from 'undici';
import { AppError } from '../api/errors.js';
import { parseBookmarkUrl } from '../domain/url-normalization.js';

export type SafeFetchResult = {
  finalUrl: string;
  contentType: string;
  bytes: Uint8Array;
  status: number;
};

type FetchOptions = {
  maxBytes: number;
  timeoutMs?: number;
  maxRedirects?: number;
  acceptedTypes: (contentType: string) => boolean;
};

export type SafeFetchRuntime = {
  lookup(hostname: string): Promise<Array<{ address: string; family: number }>>;
  fetch: typeof fetch;
};

const defaultRuntime: SafeFetchRuntime = {
  lookup: (hostname) => lookup(hostname, { all: true, verbatim: true }),
  fetch,
};

export function isPublicAddress(address: string): boolean {
  try {
    let parsed = ipaddr.parse(address);
    if (parsed.kind() === 'ipv6') {
      const ipv6 = parsed as ipaddr.IPv6;
      if (ipv6.isIPv4MappedAddress()) parsed = ipv6.toIPv4Address();
    }
    return parsed.range() === 'unicast';
  } catch {
    return false;
  }
}

async function resolvePublic(url: URL, runtime: SafeFetchRuntime): Promise<string> {
  if (url.port && !['80', '443'].includes(url.port)) {
    throw new AppError(422, 'unsafe_destination', 'Only standard web ports are allowed.');
  }
  const records = await runtime.lookup(url.hostname);
  if (records.length === 0 || records.some((record) => !isPublicAddress(record.address))) {
    throw new AppError(422, 'unsafe_destination', 'That address does not resolve to a public destination.');
  }
  return records[0]!.address;
}

async function readLimited(response: Response, maxBytes: number): Promise<Uint8Array> {
  const declared = Number(response.headers.get('content-length') ?? 0);
  if (declared > maxBytes)
    throw new AppError(422, 'remote_content_too_large', 'Remote content is too large.');
  if (!response.body) return new Uint8Array();
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const result = await reader.read();
    if (result.done) break;
    total += result.value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new AppError(422, 'remote_content_too_large', 'Remote content is too large.');
    }
    chunks.push(result.value);
  }
  const output = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return output;
}

export async function safeFetch(
  input: string,
  options: FetchOptions,
  runtime: SafeFetchRuntime = defaultRuntime,
): Promise<SafeFetchResult> {
  let url = parseBookmarkUrl(input);
  const maxRedirects = options.maxRedirects ?? 5;
  for (let redirects = 0; redirects <= maxRedirects; redirects += 1) {
    const address = await resolvePublic(url, runtime);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 3_000);
    const agent = new Agent({
      connect: {
        lookup: (_hostname, lookupOptions, callback) => {
          const family = ipaddr.parse(address).kind() === 'ipv4' ? 4 : 6;
          if (typeof lookupOptions === 'object' && lookupOptions.all) {
            (
              callback as unknown as (
                error: null,
                records: Array<{ address: string; family: number }>,
              ) => void
            )(null, [{ address, family }]);
          } else {
            callback(null, address, family);
          }
        },
      },
    });
    try {
      const response = await runtime.fetch(url, {
        dispatcher: agent,
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          accept: 'text/html,application/xhtml+xml,image/*;q=0.8',
          'user-agent': 'KeepwellMetadata/0.1 (+https://keepwell.local)',
        },
      });
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get('location');
        if (!location || redirects === maxRedirects) {
          throw new AppError(422, 'remote_redirect_failed', 'The destination redirected too many times.');
        }
        url = parseBookmarkUrl(new URL(location, url).href);
        continue;
      }
      if (!response.ok) {
        throw new AppError(422, 'remote_unavailable', `The destination returned status ${response.status}.`);
      }
      const contentType = (response.headers.get('content-type') ?? '').split(';')[0]!.trim().toLowerCase();
      if (!options.acceptedTypes(contentType)) {
        throw new AppError(
          422,
          'remote_content_type',
          'The destination returned an unsupported content type.',
        );
      }
      return {
        finalUrl: url.href,
        contentType,
        bytes: await readLimited(response as unknown as Response, options.maxBytes),
        status: response.status,
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      if (controller.signal.aborted)
        throw new AppError(422, 'remote_timeout', 'The destination took too long to respond.');
      throw new AppError(422, 'remote_unavailable', 'The destination could not be reached.');
    } finally {
      clearTimeout(timer);
      await agent.close();
    }
  }
  throw new AppError(422, 'remote_redirect_failed', 'The destination redirected too many times.');
}

export function fetchHtml(url: string): Promise<SafeFetchResult> {
  return safeFetch(url, {
    maxBytes: 2 * 1024 * 1024,
    acceptedTypes: (type) => type === 'text/html' || type === 'application/xhtml+xml',
  });
}

export function fetchImage(url: string, purpose: 'favicon' | 'preview'): Promise<SafeFetchResult> {
  return safeFetch(url, {
    maxBytes: purpose === 'favicon' ? 1024 * 1024 : 5 * 1024 * 1024,
    acceptedTypes: (type) => type.startsWith('image/') && type !== 'image/svg+xml',
  });
}
