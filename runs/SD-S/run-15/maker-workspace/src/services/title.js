/**
 * Derive a bookmark title.
 *
 * fallbackFromAddress: always available — a readable label built from the URL
 * (host + first path segment) so no bookmark is ever untitled (FR-011).
 *
 * fetchPageTitle: best-effort retrieval of the page's <title>. Never throws;
 * resolves to null on any failure or timeout, keeping the app usable offline.
 */
export function fallbackFromAddress(address) {
  try {
    const u = new URL(address);
    const host = u.hostname.replace(/^www\./, '');
    const seg = u.pathname.split('/').filter(Boolean)[0];
    return seg ? `${host} — ${decodeURIComponent(seg)}` : host;
  } catch {
    return address;
  }
}

export async function fetchPageTitle(address, { timeoutMs = 3000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(address, {
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'User-Agent': 'BookmarkManager/1.0' },
    });
    if (!res.ok) return null;
    const html = await res.text();
    const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    if (!match) return null;
    const title = match[1].replace(/\s+/g, ' ').trim();
    return title || null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
