import { Agent, request } from 'undici';
import type { MetadataResult, MetadataWarning } from '../../shared/types.js';
import { fallbackTitle, normalizeUrl, UnsafeUrlError, validatePublicUrl, type Resolver } from './urlPolicy.js';
import { parseMetadata } from './metadataParser.js';

export interface FetchOptions { timeoutMs?: number; maxBytes?: number; maxRedirects?: number; resolver?: Resolver; }
const fallback = (requested: URL, final: URL, warningCode: MetadataWarning): MetadataResult => ({ requestedUrl: requested.href, finalUrl: final.href, title: fallbackTitle(final), description: null, status: 'fallback', warningCode });

export async function fetchMetadata(input: string, options: FetchOptions = {}): Promise<MetadataResult> {
  const requested = normalizeUrl(input); let current = requested;
  const timeoutMs = options.timeoutMs ?? 8000, maxBytes = options.maxBytes ?? 1024 * 1024, maxRedirects = options.maxRedirects ?? 5;
  const deadline = Date.now() + timeoutMs;
  for (let redirects = 0; ; redirects++) {
    if (redirects > maxRedirects) return fallback(requested, current, 'TOO_MANY_REDIRECTS');
    let addresses: string[];
    try { addresses = await validatePublicUrl(current, options.resolver); }
    catch (error) { if (error instanceof UnsafeUrlError) throw error; return fallback(requested, current, 'UNREACHABLE'); }
    const remaining = deadline - Date.now();
    if (remaining <= 0) return fallback(requested, current, 'TIMEOUT');
    const address = addresses[0];
    const family = address.includes(':') ? 6 : 4;
    const dispatcher = new Agent({ connect: { lookup: (_hostname, lookupOptions, callback) => {
      if (lookupOptions.all) (callback as any)(null, [{ address, family }]);
      else callback(null, address, family);
    } } });
    try {
      const response = await request(current, { dispatcher, headersTimeout: remaining, bodyTimeout: remaining, headers: { accept: 'text/html,application/xhtml+xml', 'user-agent': 'Keepmark/1.0' } });
      if ([301, 302, 303, 307, 308].includes(response.statusCode)) {
        const rawLocation = response.headers.location; const location = Array.isArray(rawLocation) ? rawLocation[0] : rawLocation; await response.body.dump();
        if (!location) return fallback(requested, current, 'UNREACHABLE');
        current = normalizeUrl(new URL(location, current).href); continue;
      }
      if (response.statusCode < 200 || response.statusCode >= 300) { await response.body.dump(); return fallback(requested, current, 'UNREACHABLE'); }
      const contentType = String(response.headers['content-type'] ?? '').toLowerCase();
      if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) { await response.body.dump(); return fallback(requested, current, 'NON_HTML'); }
      const chunks: Buffer[] = []; let size = 0;
      for await (const chunk of response.body) { const buffer = Buffer.from(chunk); size += buffer.length; if (size > maxBytes) { response.body.destroy(); return fallback(requested, current, 'RESPONSE_TOO_LARGE'); } chunks.push(buffer); }
      return parseMetadata(Buffer.concat(chunks).toString('utf8'), requested, current);
    } catch (error) {
      if (error instanceof UnsafeUrlError) throw error;
      return fallback(requested, current, Date.now() >= deadline ? 'TIMEOUT' : 'UNREACHABLE');
    } finally { await dispatcher.close(); }
  }
}
