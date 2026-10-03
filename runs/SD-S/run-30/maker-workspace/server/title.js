// Best-effort page title fetching (FR-003). Never throws; on any failure the
// caller falls back to using the URL as the label. A short timeout keeps saves
// responsive even when a page is slow or unreachable.

const TIMEOUT_MS = 4000;
const MAX_BYTES = 200_000;

/**
 * Fetch a page and extract its <title>. Returns the trimmed title, or null if
 * it cannot be determined for any reason.
 * @param {string} url
 * @returns {Promise<string | null>}
 */
export async function fetchTitle(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'User-Agent': 'BookmarkManager/1.0 (+title-fetch)' },
    });
    if (!res.ok || !res.body) return null;
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('html')) return null;

    // Read at most MAX_BYTES so a huge page cannot stall the save.
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let html = '';
    let received = 0;
    while (received < MAX_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.length;
      html += decoder.decode(value, { stream: true });
      if (/<\/title>/i.test(html)) break; // stop early once the title is in hand
    }
    reader.cancel().catch(() => {});

    const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    if (!match) return null;
    const title = decodeEntities(match[1]).replace(/\s+/g, ' ').trim();
    return title || null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function decodeEntities(text) {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&nbsp;/g, ' ');
}
