// Server-side page-title fetcher. The browser cannot fetch arbitrary pages
// (cross-origin restrictions), so the server does it and extracts <title>.
// Returns { ok: true, title } on success, or { ok: false } on any failure
// (network down, timeout, non-HTML, no title) — the caller then saves the link
// anyway with needsTitle=true (SCN-006 / SCN-007: never block a save).
const BM = require('./shared');

async function fetchTitle(url, { timeoutMs = 8000, fetchImpl = globalThis.fetch } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'User-Agent': 'BookmarksApp/1.0 (+title-fetch)' }
    });
    if (!res.ok) return { ok: false };
    const type = res.headers.get('content-type') || '';
    if (!/text\/html|application\/xhtml/i.test(type)) return { ok: false };
    const html = await res.text();
    const title = BM.extractTitle(html);
    return title ? { ok: true, title } : { ok: false };
  } catch (e) {
    return { ok: false }; // offline, DNS failure, timeout, etc.
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { fetchTitle };
