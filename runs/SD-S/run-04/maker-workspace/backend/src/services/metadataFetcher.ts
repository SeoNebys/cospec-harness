import * as cheerio from "cheerio";

export interface PageMetadata {
  title: string | null;
  description: string | null;
  imageUrl: string | null;
}

export type MetadataFetcher = (url: string) => Promise<PageMetadata>;

const EMPTY: PageMetadata = { title: null, description: null, imageUrl: null };

const FETCH_TIMEOUT_MS = 5_000;
const MAX_BYTES = 2_000_000; // cap response size (~2MB of HTML)
const USER_AGENT = "BookmarkManager/1.0 (+metadata-fetch)";

function firstNonEmpty(...values: (string | undefined | null)[]): string | null {
  for (const v of values) {
    if (v && v.trim()) return v.trim();
  }
  return null;
}

/**
 * Extract title/description/image from HTML, preferring Open Graph, then
 * Twitter Card, then the plain <title>/<meta description> (research §2).
 * Exported for unit testing without a network call.
 */
export function parseMetadata(html: string, baseUrl: string): PageMetadata {
  const $ = cheerio.load(html);
  const meta = (selector: string, attr = "content") =>
    $(selector).attr(attr)?.trim() || undefined;

  const title = firstNonEmpty(
    meta('meta[property="og:title"]'),
    meta('meta[name="twitter:title"]'),
    $("title").first().text(),
  );

  const description = firstNonEmpty(
    meta('meta[property="og:description"]'),
    meta('meta[name="twitter:description"]'),
    meta('meta[name="description"]'),
  );

  let imageUrl = firstNonEmpty(
    meta('meta[property="og:image"]'),
    meta('meta[name="twitter:image"]'),
  );
  // Resolve relative image URLs against the page URL.
  if (imageUrl) {
    try {
      imageUrl = new URL(imageUrl, baseUrl).toString();
    } catch {
      /* leave as-is if it won't resolve */
    }
  }

  return { title, description, imageUrl };
}

/**
 * Fetch a page and extract its metadata. Bounded by a timeout and a response
 * size cap; any failure resolves to empty metadata so the caller can fall back
 * gracefully (FR-016) — it never throws.
 */
export const fetchMetadata: MetadataFetcher = async (url: string): Promise<PageMetadata> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: { "User-Agent": USER_AGENT, Accept: "text/html,application/xhtml+xml" },
    });
    if (!res.ok || !res.body) return EMPTY;

    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("html")) return EMPTY;

    // Read up to MAX_BYTES then stop.
    const reader = res.body.getReader();
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
    const html = Buffer.concat(chunks).toString("utf-8");
    return parseMetadata(html, url);
  } catch {
    return EMPTY;
  } finally {
    clearTimeout(timer);
  }
};
