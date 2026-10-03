// Fetch a link's page and extract basic details (title, description, site name).
// A failure to reach the page throws; callers translate that into the
// "couldn't get details" behaviour so saving is never blocked.

const ENTITIES = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&apos;': "'", '&nbsp;': ' ' };

function decode(s) {
  return s.replace(/&amp;|&lt;|&gt;|&quot;|&#39;|&apos;|&nbsp;/g, m => ENTITIES[m])
          .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
}

function titleCase(host) {
  const core = host.replace(/^www\./, '').split('.')[0];
  return core ? core.charAt(0).toUpperCase() + core.slice(1) : host;
}

function firstMatch(html, patterns) {
  for (const re of patterns) {
    const m = html.match(re);
    if (m && m[1] && m[1].trim()) return m[1];
  }
  return '';
}

// Exported for unit testing without network access.
export function parseMetadata(html, url) {
  const host = new URL(url).hostname.replace(/^www\./, '');
  const title = firstMatch(html, [
    /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i,
    /<title[^>]*>([\s\S]*?)<\/title>/i
  ]) || titleCase(host);
  const desc = firstMatch(html, [
    /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']*)["']/i,
    /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i
  ]);
  const site = firstMatch(html, [
    /<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i
  ]) || titleCase(host);
  return {
    site: decode(site.trim()),
    title: decode(title.trim().replace(/\s+/g, ' ')),
    desc: decode(desc.trim().replace(/\s+/g, ' '))
  };
}

export async function fetchMetadata(url, { timeoutMs = 8000, fetchImpl = fetch } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let resp;
  try {
    resp = await fetchImpl(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'user-agent': 'BookmarksApp/1.0 (+details fetch)' }
    });
  } finally {
    clearTimeout(timer);
  }
  if (!resp.ok) throw new Error('HTTP ' + resp.status);
  const html = await resp.text();
  return parseMetadata(html, url);
}
