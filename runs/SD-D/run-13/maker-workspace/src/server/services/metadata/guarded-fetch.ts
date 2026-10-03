import http from 'node:http';
import https from 'node:https';
import { brotliDecompressSync, gunzipSync, inflateSync } from 'node:zlib';
import { LIMITS } from '../../../shared/config/limits.js';
import { outboundUrl } from '../../../shared/urls/normalize-url.js';
import { resolvePublic } from '../../security/ip-policy.js';
import { MetadataFetchError } from './metadata-errors.js';

export interface GuardedResponse { finalUrl: string; body: Buffer; contentType: string }

function decode(body: Buffer, encoding: string | undefined): Buffer {
  if (!encoding) return body;
  if (encoding.includes('gzip')) return gunzipSync(body);
  if (encoding.includes('deflate')) return inflateSync(body);
  if (encoding.includes('br')) return brotliDecompressSync(body);
  return body;
}

async function oneRequest(url: URL, maxBytes: number, signal?: AbortSignal): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: Buffer }> {
  if(signal?.aborted) throw new MetadataFetchError('unreachable','Metadata retrieval was canceled.');
  if ((url.protocol === 'http:' && url.port && url.port !== '80') || (url.protocol === 'https:' && url.port && url.port !== '443')) throw new MetadataFetchError('unreachable', 'Metadata retrieval is limited to standard web ports.');
  const answers = await Promise.race([resolvePublic(url.hostname),new Promise<never>((_,reject)=>setTimeout(()=>reject(new MetadataFetchError('timeout','Name lookup timed out.')),LIMITS.dnsTimeoutMs))]);
  const selected = answers[0]!;
  return new Promise((resolve, reject) => {
    let settled = false;
    const timeout=setTimeout(()=>request.destroy(new MetadataFetchError('timeout','Metadata retrieval timed out.')),LIMITS.metadataTimeoutMs);
    const finishError = (error: Error) => { if (!settled) { settled = true; clearTimeout(timeout); reject(error); } };
    const requester = url.protocol === 'https:' ? https : http;
    const request = requester.request(url, {
      method: 'GET', headers: { accept: 'text/html,application/xhtml+xml,image/avif,image/webp,image/png,image/jpeg;q=0.9,*/*;q=0.1', 'accept-encoding': 'gzip, deflate, br', 'user-agent': 'KeepsakeMetadata/1.0' },
      lookup: ((_hostname: string, options: any, callback: any) => options?.all ? callback(null, [selected]) : callback(null, selected.address, selected.family)) as any,
      agent: false,
    }, (response) => {
      const chunks: Buffer[] = []; let received = 0;
      response.on('data', (chunk: Buffer) => { received += chunk.length; if (received > maxBytes) request.destroy(new MetadataFetchError('too_large', 'The remote response was too large.')); else chunks.push(chunk); });
      response.on('end', () => {
        if (settled) return;
        try {
          const body = decode(Buffer.concat(chunks), response.headers['content-encoding']);
          if (body.length > maxBytes) throw new MetadataFetchError('too_large', 'The decoded response was too large.');
          settled = true; clearTimeout(timeout); resolve({ status: response.statusCode || 0, headers: response.headers, body });
        } catch (error) { finishError(error as Error); }
      });
    });
    signal?.addEventListener('abort', () => request.destroy(new MetadataFetchError('unreachable', 'Metadata retrieval was canceled.')), { once: true });
    request.on('error', (error) => finishError(error instanceof MetadataFetchError ? error : new MetadataFetchError('unreachable', 'The page could not be reached.')));
    request.end();
  });
}

export async function guardedFetch(rawUrl: string, options: { maxBytes?: number; signal?: AbortSignal } = {}): Promise<GuardedResponse> {
  let url = outboundUrl(rawUrl); const maxBytes = options.maxBytes ?? LIMITS.htmlBytes;
  for (let hop = 0; hop <= LIMITS.redirects; hop++) {
    const response = await oneRequest(url, maxBytes, options.signal);
    if ([301,302,303,307,308].includes(response.status) && response.headers.location) {
      if (hop === LIMITS.redirects) throw new MetadataFetchError('unreachable', 'The page redirected too many times.');
      const next = outboundUrl(new URL(response.headers.location, url).toString());
      if (url.protocol === 'https:' && next.protocol !== 'https:') throw new MetadataFetchError('unreachable', 'An insecure redirect was blocked.');
      url = next; continue;
    }
    if (response.status < 200 || response.status >= 300) throw new MetadataFetchError('unreachable', 'The page did not return a successful response.');
    return { finalUrl: url.toString(), body: response.body, contentType: String(response.headers['content-type'] || '').toLowerCase() };
  }
  throw new MetadataFetchError('unreachable', 'The page could not be reached.');
}
