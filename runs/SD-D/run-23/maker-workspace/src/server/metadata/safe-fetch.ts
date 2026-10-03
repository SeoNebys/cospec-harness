import dns from 'node:dns/promises';
import { Agent, request } from 'undici';
import ipaddr from 'ipaddr.js';
import { config } from '../config.js';

export class FetchBlockedError extends Error {}
export class FetchTimeoutError extends Error {}

export interface SafeFetchResult {
  finalUrl: string;
  contentType: string;
  body: Buffer;
  redirects: number;
}

function isPublicAddress(value: string): boolean {
  try {
    let address = ipaddr.parse(value);
    if (address.kind() === 'ipv6') {
      const ipv6 = address as ipaddr.IPv6;
      if (ipv6.isIPv4MappedAddress()) address = ipv6.toIPv4Address();
    }
    return address.range() === 'unicast';
  } catch {
    return false;
  }
}

export async function resolvePublic(url: URL): Promise<Array<{ address: string; family: number }>> {
  if (!['http:', 'https:'].includes(url.protocol)) throw new FetchBlockedError('Only HTTP and HTTPS destinations are allowed.');
  if (url.username || url.password) throw new FetchBlockedError('Destinations containing credentials are blocked.');
  if (url.port && !['80', '443'].includes(url.port)) throw new FetchBlockedError('Only standard web ports are allowed.');
  const records = await dns.lookup(url.hostname, { all: true, order: 'verbatim' });
  if (!records.length || records.some((record) => !isPublicAddress(record.address))) {
    throw new FetchBlockedError('The destination does not resolve exclusively to public addresses.');
  }
  return records;
}

export async function safeFetch(
  input: string,
  options: { maxBytes?: number; accept?: string; allowedTypes?: RegExp } = {},
): Promise<SafeFetchResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.metadata.deadlineMs);
  let current = new URL(input);
  const visited = new Set<string>();
  try {
    for (let redirects = 0; redirects <= config.metadata.maxRedirects; redirects++) {
      if (visited.has(current.href)) throw new FetchBlockedError('The destination redirects in a loop.');
      visited.add(current.href);
      const records = await resolvePublic(current);
      const selected = records[0];
      const dispatcher = new Agent({
        maxResponseSize: options.maxBytes ?? config.metadata.maxHtmlBytes,
        connect: {
          timeout: 1500,
          lookup: (_hostname, _options, callback) => callback(null, selected.address, selected.family),
        },
      });
      try {
        const response = await request(current, {
          method: 'GET',
          dispatcher,
          signal: controller.signal,
          headersTimeout: 2500,
          bodyTimeout: 2500,
          headers: {
            accept: options.accept || 'text/html,application/xhtml+xml',
            'accept-encoding': 'identity',
            'user-agent': 'LatchBookmarkPreview/1.0',
          },
        });
        if ([301, 302, 303, 307, 308].includes(response.statusCode)) {
          const location = response.headers.location;
          await response.body.dump();
          if (!location) throw new FetchBlockedError('Redirect response has no destination.');
          if (redirects === config.metadata.maxRedirects) throw new FetchBlockedError('Too many redirects.');
          current = new URL(Array.isArray(location) ? location[0] : location, current);
          continue;
        }
        if (response.statusCode < 200 || response.statusCode >= 300) {
          await response.body.dump();
          throw new Error(`Publisher returned HTTP ${response.statusCode}.`);
        }
        const contentType = String(response.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
        if (options.allowedTypes && !options.allowedTypes.test(contentType)) {
          await response.body.dump();
          throw new Error('Publisher returned an unsupported content type.');
        }
        const bytes = Buffer.from(await response.body.arrayBuffer());
        return { finalUrl: current.href, contentType, body: bytes, redirects };
      } finally {
        await dispatcher.close();
      }
    }
    throw new FetchBlockedError('Too many redirects.');
  } catch (error) {
    if (controller.signal.aborted) throw new FetchTimeoutError('The publisher did not respond in time.');
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
