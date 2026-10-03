// Best-effort page-title fetching (research.md Decision 4, FR-003).
// Never throws: on any failure it returns null so callers fall back to the URL.

const FETCH_TIMEOUT_MS = 5000;
const MAX_BYTES = 512 * 1024; // 512 KB cap — titles appear early in <head>.

/**
 * Extract the text of the first <title> element from an HTML string.
 * @param {string} html
 * @returns {string|null}
 */
export function extractTitle(html) {
  if (typeof html !== 'string') return null;
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!match) return null;
  const text = decodeBasicEntities(match[1]).replace(/\s+/g, ' ').trim();
  return text === '' ? null : text;
}

function decodeBasicEntities(s) {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

/**
 * Fetch a page and return its <title>, or null on any failure/timeout/non-HTML.
 * @param {string} url normalized http/https URL
 * @param {(url: string, opts: object) => Promise<Response>} [fetchImpl] injectable for tests
 * @returns {Promise<string|null>}
 */
export async function fetchTitle(url, fetchImpl = globalThis.fetch) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetchImpl(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'user-agent': 'BookmarkManager/1.0' },
    });
    if (!res.ok) return null;

    const contentType = res.headers?.get?.('content-type') || '';
    if (contentType && !contentType.includes('text/html')) return null;

    const html = await readCapped(res);
    return extractTitle(html);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function readCapped(res) {
  // Prefer streaming so we can stop after MAX_BYTES; fall back to text().
  if (res.body && typeof res.body.getReader === 'function') {
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let out = '';
    let received = 0;
    while (received < MAX_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      out += decoder.decode(value, { stream: true });
      if (/<\/title>/i.test(out)) break; // got what we need
    }
    try {
      await reader.cancel();
    } catch {
      /* ignore */
    }
    return out;
  }
  return await res.text();
}
