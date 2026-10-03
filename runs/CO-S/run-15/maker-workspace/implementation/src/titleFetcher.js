'use strict';

// Fetches the real page title for a URL (SCN-001). On any failure it resolves
// with { ok: false } so the caller can fall back to showing the address
// (SCN-005: a failed title fetch never blocks saving).

function decodeEntities(s) {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)));
}

function extractTitle(html) {
  const m = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  if (!m) return null;
  const t = decodeEntities(m[1]).replace(/\s+/g, ' ').trim();
  return t || null;
}

async function fetchTitle(url, { timeoutMs = 8000, fetchImpl = globalThis.fetch } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'User-Agent': 'BookmarksApp/1.0 (+title-fetch)' },
    });
    if (!res.ok) return { ok: false };
    const ctype = res.headers.get('content-type') || '';
    if (ctype && !/text\/html|application\/xhtml/i.test(ctype)) return { ok: false };
    const html = await res.text();
    const title = extractTitle(html);
    if (!title) return { ok: false };
    return { ok: true, title };
  } catch (e) {
    return { ok: false };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { fetchTitle, extractTitle, decodeEntities };
