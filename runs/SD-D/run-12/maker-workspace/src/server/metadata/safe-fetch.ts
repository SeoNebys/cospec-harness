import http from 'node:http';
import https from 'node:https';
import { createBrotliDecompress, createGunzip, createInflate } from 'node:zlib';
import type { Readable } from 'node:stream';
import { validatePublicUrl, type Resolver, systemResolver, UrlPolicyError } from './url-policy.js';

export class FetchFailure extends Error { constructor(public code: string, message: string) { super(message); } }
export type SafeFetchOptions = { resolver?: Resolver; kind?: 'html'|'icon'; timeoutMs?: number; maxRedirects?: number };
export type SafeFetchResult = { body: Buffer; finalUrl: string; contentType: string };

async function requestOnce(url: URL, address: string, family: 4|6, timeoutMs: number, maxBytes: number): Promise<{status:number; headers:http.IncomingHttpHeaders; body:Buffer}> {
  return new Promise((resolve, reject) => {
    const transport = url.protocol === 'https:' ? https : http;
    const request = transport.request(url, {
      method: 'GET',
      headers: { 'user-agent': 'BookmarkGarden/1.0', accept: 'text/html,image/*;q=0.8', 'accept-encoding': 'gzip, deflate, br' },
      lookup: ((_hostname: string, options: {all?:boolean}, callback: (...args:unknown[])=>void) => options?.all ? callback(null, [{address, family}]) : callback(null, address, family)) as never,
      servername: url.hostname,
      agent: false,
    }, (response) => {
      const peer=response.socket.remoteAddress?.replace(/^::ffff:/,'');
      if(peer&&peer!==address.replace(/^::ffff:/,'')){request.destroy();reject(new FetchFailure('unsafe_destination','The connected address changed unexpectedly.'));return}
      let stream: Readable = response;
      const encoding = String(response.headers['content-encoding'] ?? '').toLowerCase();
      if (encoding === 'gzip') stream = response.pipe(createGunzip());
      else if (encoding === 'deflate') stream = response.pipe(createInflate());
      else if (encoding === 'br') stream = response.pipe(createBrotliDecompress());
      else if (encoding && encoding !== 'identity') { request.destroy(); reject(new FetchFailure('unsupported_content_type', 'Unsupported response encoding.')); return; }
      const chunks: Buffer[] = []; let size = 0;
      stream.on('data', (chunk: Buffer) => { size += chunk.length; if (size > maxBytes) stream.destroy(new FetchFailure('response_too_large', 'The response was too large.')); else chunks.push(Buffer.from(chunk)); });
      stream.on('end', () => resolve({ status: response.statusCode ?? 0, headers: response.headers, body: Buffer.concat(chunks) }));
      stream.on('error', reject);
    });
    request.setTimeout(Math.min(2_000, timeoutMs), () => request.destroy(new FetchFailure('timeout', 'The destination took too long to respond.')));
    request.on('error', (error) => reject(error instanceof FetchFailure ? error : new FetchFailure((error as NodeJS.ErrnoException).code?.startsWith('ERR_TLS') ? 'tls_error' : 'http_status', 'The destination could not be retrieved.')));
    request.end();
  });
}

export async function safeFetch(input: string, options: SafeFetchOptions = {}): Promise<SafeFetchResult> {
  const resolver = options.resolver ?? systemResolver;
  const kind = options.kind ?? 'html';
  const deadline = Date.now() + (options.timeoutMs ?? 8_000);
  const seen = new Set<string>();
  let current = input;
  for (let hop = 0; hop <= (options.maxRedirects ?? 5); hop++) {
    if (Date.now() >= deadline) throw new FetchFailure('timeout', 'The destination took too long to respond.');
    const validated = await validatePublicUrl(current, resolver);
    if (seen.has(validated.normalizedUrl)) throw new FetchFailure('too_many_redirects', 'The destination redirected in a loop.');
    seen.add(validated.normalizedUrl);
    const pinned = validated.addresses[0]!;
    const response = await requestOnce(validated.url, pinned.address, pinned.family, deadline - Date.now(), kind === 'html' ? 1_048_576 : 262_144);
    if ([301,302,303,307,308].includes(response.status)) {
      const location = response.headers.location;
      if (!location || hop === (options.maxRedirects ?? 5)) throw new FetchFailure('too_many_redirects', 'The destination redirected too many times.');
      current = new URL(location, validated.url).toString();
      continue;
    }
    if (response.status < 200 || response.status >= 300) throw new FetchFailure('http_status', `The destination returned status ${response.status}.`);
    const contentType = String(response.headers['content-type'] ?? '').split(';')[0]!.trim().toLowerCase();
    if (kind === 'html' && contentType !== 'text/html') throw new FetchFailure('unsupported_content_type', 'The destination did not return a webpage.');
    return { body: response.body, finalUrl: validated.normalizedUrl, contentType };
  }
  throw new FetchFailure('too_many_redirects', 'The destination redirected too many times.');
}

export function isRejectedFetch(error: unknown): boolean {
  return error instanceof UrlPolicyError && ['invalid_url','unsupported_scheme','credentials_not_allowed','port_not_allowed','unsafe_destination'].includes(error.code);
}
