// Best-effort page metadata extraction (research §3, FR-005).
// Fetches a page with a short timeout and small size cap, then parses preview
// details in priority order: Open Graph → Twitter Card → standard <title>/<meta>.
// Never throws for a normal fetch failure — returns whatever it could gather.

export interface PageMetadata {
  title?: string;
  description?: string;
  iconUrl?: string | null;
  imageUrl?: string | null;
}

const FETCH_TIMEOUT_MS = 5000;
const MAX_BYTES = 1_000_000; // 1 MB cap — preview data lives in the <head>
const MAX_REDIRECTS = 5;

/** Fetch page HTML with guardrails; returns null if it can't be retrieved. */
async function fetchHtml(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'user-agent': 'BookmarkManager/0.1 (+local)', accept: 'text/html' },
    });
    if (!res.ok) return null;
    const type = res.headers.get('content-type') ?? '';
    if (!type.includes('html')) return null;

    // Read with a byte cap so a huge page can't hang or blow memory.
    const reader = res.body?.getReader();
    if (!reader) return await res.text();
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(value);
        total += value.length;
        if (total >= MAX_BYTES) {
          void reader.cancel();
          break;
        }
      }
    }
    return Buffer.concat(chunks).toString('utf8');
  } catch {
    return null; // timeout, DNS failure, unreachable — all best-effort
  } finally {
    clearTimeout(timer);
  }
}

function metaContent(html: string, patterns: RegExp[]): string | undefined {
  for (const re of patterns) {
    const m = html.match(re);
    if (m?.[1]) return decodeEntities(m[1].trim());
  }
  return undefined;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function attrMeta(prop: 'property' | 'name', key: string): RegExp {
  // Matches <meta property="og:title" content="..."> in either attribute order.
  const k = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(
    `<meta[^>]+(?:${prop}=["']${k}["'][^>]+content=["']([^"']*)["']|content=["']([^"']*)["'][^>]+${prop}=["']${k}["'])`,
    'i'
  );
}

function firstGroup(html: string, re: RegExp): string | undefined {
  const m = html.match(re);
  if (!m) return undefined;
  const val = m[1] ?? m[2];
  return val ? decodeEntities(val.trim()) : undefined;
}

/** Parse preview metadata out of raw HTML. Exported for unit testing. */
export function parseMetadata(html: string, baseUrl: string): PageMetadata {
  const title =
    firstGroup(html, attrMeta('property', 'og:title')) ??
    firstGroup(html, attrMeta('name', 'twitter:title')) ??
    metaContent(html, [/<title[^>]*>([^<]*)<\/title>/i]);

  const description =
    firstGroup(html, attrMeta('property', 'og:description')) ??
    firstGroup(html, attrMeta('name', 'twitter:description')) ??
    firstGroup(html, attrMeta('name', 'description'));

  const image =
    firstGroup(html, attrMeta('property', 'og:image')) ??
    firstGroup(html, attrMeta('name', 'twitter:image'));

  const iconMatch =
    html.match(/<link[^>]+rel=["'][^"']*icon[^"']*["'][^>]+href=["']([^"']+)["']/i) ??
    html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["'][^"']*icon[^"']*["']/i);
  const iconHref = iconMatch?.[1];

  const resolve = (href?: string): string | null => {
    if (!href) return null;
    try {
      return new URL(href, baseUrl).toString();
    } catch {
      return null;
    }
  };

  return {
    title: title || undefined,
    description: description || undefined,
    imageUrl: resolve(image),
    iconUrl: resolve(iconHref) ?? resolve('/favicon.ico'),
  };
}

/** Fetch + parse. Resolves to partial/empty metadata rather than throwing. */
export async function fetchMetadata(url: string): Promise<PageMetadata> {
  const html = await fetchHtml(url);
  if (!html) return {};
  return parseMetadata(html, url);
}

export const _test = { fetchHtml, MAX_REDIRECTS };
