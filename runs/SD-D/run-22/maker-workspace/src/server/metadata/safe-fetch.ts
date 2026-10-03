import { assertPublicHost } from './network-policy.js';
import { parsePublicHttpUrl, UrlPolicyError } from './url-policy.js';

export type SafeFetchOptions = {
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
  accept?: string;
  allowedTypes?: RegExp;
  fetchImpl?: typeof fetch;
};

export type SafeFetchResult = { finalUrl: URL; contentType: string; bytes: Uint8Array };

export async function safeFetch(input: string, options: SafeFetchOptions = {}): Promise<SafeFetchResult> {
  const timeoutMs = options.timeoutMs ?? 5_000;
  const maxBytes = options.maxBytes ?? 1_048_576;
  const maxRedirects = options.maxRedirects ?? 5;
  const fetchImpl = options.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let current = parsePublicHttpUrl(input);
  const seen = new Set<string>();
  try {
    for (let hops = 0; hops <= maxRedirects; hops += 1) {
      current.hash = '';
      if (seen.has(current.href)) throw new UrlPolicyError('REDIRECT_LOOP', 'The destination redirects in a loop.');
      seen.add(current.href);
      await assertPublicHost(current.hostname);
      const response = await fetchImpl(current, {
        redirect: 'manual',
        signal: controller.signal,
        headers: { accept: options.accept ?? 'text/html, application/xhtml+xml', 'user-agent': 'BookmarkManager/1.0 metadata preview' },
      });
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get('location');
        if (!location) throw new UrlPolicyError('INVALID_REDIRECT', 'The destination returned an incomplete redirect.');
        if (hops === maxRedirects) throw new UrlPolicyError('TOO_MANY_REDIRECTS', 'The destination redirected too many times.');
        current = parsePublicHttpUrl(new URL(location, current).href);
        continue;
      }
      if (!response.ok) throw new UrlPolicyError('UPSTREAM_STATUS', `The destination returned status ${response.status}.`);
      const contentType = response.headers.get('content-type')?.split(';')[0].trim().toLowerCase() ?? '';
      const allowed = options.allowedTypes ?? /^(text\/html|application\/xhtml\+xml)$/u;
      if (!allowed.test(contentType)) throw new UrlPolicyError('UNSUPPORTED_CONTENT', 'The destination did not return a supported page.');
      const reader = response.body?.getReader();
      if (!reader) throw new UrlPolicyError('EMPTY_RESPONSE', 'The destination returned no content.');
      const chunks: Uint8Array[] = [];
      let size = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > maxBytes) {
          await reader.cancel();
          throw new UrlPolicyError('RESPONSE_TOO_LARGE', 'The destination page is too large to preview.');
        }
        chunks.push(value);
      }
      const bytes = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
      return { finalUrl: current, contentType, bytes };
    }
    throw new UrlPolicyError('TOO_MANY_REDIRECTS', 'The destination redirected too many times.');
  } catch (error) {
    if (controller.signal.aborted) throw new UrlPolicyError('FETCH_TIMEOUT', 'Page details took too long to retrieve.');
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
