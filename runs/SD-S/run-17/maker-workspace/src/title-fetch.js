// Best-effort page-title fetch (FR-004).
// Fetches the target page with a short timeout and extracts the <title>.
// On ANY failure (network error, timeout, non-HTML, missing title) it returns
// null so the caller can fall back to the user-provided title or the address.
// This function never throws to the caller.

const FETCH_TIMEOUT_MS = 5000;
const MAX_BYTES = 512 * 1024; // only need the <head>; cap the read

/**
 * @param {string} url a normalised http/https URL
 * @returns {Promise<string|null>} the page title, or null if unavailable
 */
export async function fetchTitle(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'User-Agent': 'BookmarkManager/1.0 (+title-fetch)' },
    });
    if (!res.ok) return null;

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('html')) return null;

    const html = await readCapped(res, MAX_BYTES);
    return extractTitle(html);
  } catch {
    // Timeout, DNS failure, connection refused, etc. — fall back gracefully.
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function readCapped(res, maxBytes) {
  // Prefer streaming so we can stop once we have the <head>; fall back to text().
  if (!res.body || typeof res.body.getReader !== 'function') {
    const full = await res.text();
    return full.slice(0, maxBytes);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let out = '';
  let received = 0;
  while (received < maxBytes) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.length;
    out += decoder.decode(value, { stream: true });
    if (/<\/title>/i.test(out)) break; // got the title; stop early
  }
  try {
    await reader.cancel();
  } catch {
    // ignore
  }
  return out;
}

/**
 * Extract and clean the <title> text from an HTML string.
 * @param {string} html
 * @returns {string|null}
 */
export function extractTitle(html) {
  if (typeof html !== 'string') return null;
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!match) return null;
  const raw = decodeEntities(match[1]).replace(/\s+/g, ' ').trim();
  return raw.length > 0 ? raw : null;
}

function decodeEntities(text) {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCodePoint(parseInt(n, 16)));
}
