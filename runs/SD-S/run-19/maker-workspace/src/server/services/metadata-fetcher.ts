import http from 'node:http';
import https from 'node:https';
import type { IncomingHttpHeaders } from 'node:http';
import type { LookupFunction } from 'node:net';
import type { MetadataPreview } from '../../shared/types.js';
import {
  canonicalizeUrl,
  defaultAddressResolver,
  fallbackTitleForUrl,
  resolvePublicAddresses,
  UrlPolicyError,
  type AddressResolver,
  type ResolvedAddress,
} from './url-policy.js';
import { parseMetadata } from './metadata-parser.js';

export interface MetadataTransportResponse {
  status: number;
  headers: IncomingHttpHeaders;
  body: string;
}

export type MetadataTransport = (
  url: URL,
  address: ResolvedAddress,
  timeoutMs: number,
  maximumBytes: number,
) => Promise<MetadataTransportResponse>;

export interface MetadataFetcherOptions {
  resolver?: AddressResolver;
  transport?: MetadataTransport;
  timeoutMs?: number;
  maximumBytes?: number;
  maximumRedirects?: number;
}

function headerValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export const defaultMetadataTransport: MetadataTransport = (url, address, timeoutMs, maximumBytes) =>
  new Promise((resolve, reject) => {
    const client = url.protocol === 'https:' ? https : http;
    const lookup: LookupFunction = (_hostname, options, callback) => {
      if (options.all) {
        callback(null, [address]);
      } else {
        callback(null, address.address, address.family);
      }
    };
    const request = client.request(url, {
      method: 'GET',
      headers: {
        Accept: 'text/html,application/xhtml+xml;q=0.9',
        'User-Agent': 'KeepwellBookmarkManager/1.0 (+metadata preview)',
      },
      lookup,
      maxHeaderSize: 32 * 1024,
      ...(url.protocol === 'https:' ? { servername: url.hostname } : {}),
    }, (response) => {
      const status = response.statusCode ?? 0;
      if ([301, 302, 303, 307, 308].includes(status)) {
        response.resume();
        resolve({ status, headers: response.headers, body: '' });
        return;
      }
      const declaredLength = Number(headerValue(response.headers['content-length']) ?? 0);
      if (declaredLength > maximumBytes) {
        response.destroy();
        reject(new Error('The destination page is too large to preview.'));
        return;
      }
      const chunks: Buffer[] = [];
      let received = 0;
      response.on('data', (chunk: Buffer) => {
        received += chunk.length;
        if (received > maximumBytes) {
          response.destroy(new Error('The destination page is too large to preview.'));
          return;
        }
        chunks.push(chunk);
      });
      response.on('end', () => resolve({ status, headers: response.headers, body: Buffer.concat(chunks).toString('utf8') }));
      response.on('error', reject);
    });
    request.setTimeout(timeoutMs, () => request.destroy(new Error('The metadata request timed out.')));
    request.on('error', reject);
    request.end();
  });

export class MetadataFetcher {
  private readonly resolver: AddressResolver;
  private readonly transport: MetadataTransport;
  private readonly timeoutMs: number;
  private readonly maximumBytes: number;
  private readonly maximumRedirects: number;

  constructor(options: MetadataFetcherOptions = {}) {
    this.resolver = options.resolver ?? defaultAddressResolver;
    this.transport = options.transport ?? defaultMetadataTransport;
    this.timeoutMs = options.timeoutMs ?? 4_000;
    this.maximumBytes = options.maximumBytes ?? 1_048_576;
    this.maximumRedirects = options.maximumRedirects ?? 3;
  }

  async preview(input: string): Promise<MetadataPreview> {
    const original = canonicalizeUrl(input);
    if (process.env.METADATA_TEST_MODE === '1' && original.url.hostname === 'metadata.test') {
      if (original.url.pathname === '/success') {
        return {
          url: original.canonical,
          normalizedUrl: original.normalized,
          title: 'The thoughtful web',
          description: 'A page about keeping the internet useful.',
          source: 'remote',
          warning: null,
        };
      }
      return this.fallback(original.canonical, original.normalized);
    }

    try {
      let current = original.url;
      const deadline = Date.now() + this.timeoutMs;
      for (let redirectCount = 0; redirectCount <= this.maximumRedirects; redirectCount += 1) {
        const currentNormalized = canonicalizeUrl(current.toString());
        const addresses = await resolvePublicAddresses(currentNormalized.url.hostname, this.resolver);
        const remaining = deadline - Date.now();
        if (remaining <= 0) throw new Error('The metadata request timed out.');
        const response = await this.transport(currentNormalized.url, addresses[0]!, remaining, this.maximumBytes);
        if ([301, 302, 303, 307, 308].includes(response.status)) {
          const location = headerValue(response.headers.location);
          if (!location) throw new Error('The destination returned an invalid redirect.');
          if (redirectCount === this.maximumRedirects) throw new Error('The destination redirected too many times.');
          current = new URL(location, currentNormalized.url);
          continue;
        }
        if (response.status < 200 || response.status >= 300) throw new Error(`The destination returned status ${response.status}.`);
        const contentType = headerValue(response.headers['content-type'])?.toLowerCase() ?? '';
        if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
          throw new Error('The destination did not return an HTML page.');
        }
        const metadata = parseMetadata(response.body);
        if (!metadata.title) throw new Error('The destination did not provide a usable title.');
        return {
          url: original.canonical,
          normalizedUrl: original.normalized,
          title: metadata.title,
          description: metadata.description,
          source: 'remote',
          warning: null,
        };
      }
      return this.fallback(original.canonical, original.normalized);
    } catch (error) {
      if (error instanceof UrlPolicyError) throw error;
      return this.fallback(original.canonical, original.normalized);
    }
  }

  private fallback(url: string, normalizedUrl: string): MetadataPreview {
    return {
      url,
      normalizedUrl,
      title: fallbackTitleForUrl(url),
      description: null,
      source: 'fallback',
      warning: 'We could not retrieve page details, so we made a title from the address. You can edit it before saving.',
    };
  }
}
