// Fetches a page's basic details (title, site name, description) automatically
// when a link is saved (SCN-001). If the page can't be reached or parsed, it
// falls back to a best-guess derived from the address so the link is still saved
// (SCN-010). Kept dependency-free: a tiny targeted HTML scan rather than a full
// DOM parser.

import { deriveFallbackMeta, hostOf } from "../public/lib.js";

const FETCH_TIMEOUT_MS = 4000;
const MAX_BYTES = 512 * 1024; // only need the <head>

function decodeEntities(s) {
  if (!s) return s;
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .trim();
}

function metaContent(html, patterns) {
  for (const re of patterns) {
    const m = html.match(re);
    if (m && m[1]) return decodeEntities(m[1]);
  }
  return "";
}

export function parseMetadata(html, url) {
  const fallback = deriveFallbackMeta(url);
  const host = hostOf(url);

  const ogTitle = metaContent(html, [
    /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i,
  ]);
  const titleTag = (() => {
    const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    return m ? decodeEntities(m[1].replace(/\s+/g, " ")) : "";
  })();
  const description = metaContent(html, [
    /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i,
    /<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i,
    /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']*)["']/i,
  ]);
  const siteName = metaContent(html, [
    /<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:site_name["']/i,
  ]);

  const title = ogTitle || titleTag || fallback.title;
  return {
    host,
    title: title || fallback.title,
    site: siteName || fallback.site,
    description: description || "",
  };
}

// Returns { host, title, site, description }. Never throws; on any failure it
// returns the address-derived fallback.
export async function fetchMetadata(url, fetchImpl = globalThis.fetch) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    let html = "";
    try {
      const res = await fetchImpl(url, {
        signal: controller.signal,
        redirect: "follow",
        headers: { "user-agent": "BookmarksApp/1.0 (+metadata)" },
      });
      if (!res.ok) throw new Error("status " + res.status);
      const ct = res.headers.get("content-type") || "";
      if (!/text\/html|application\/xhtml/i.test(ct)) throw new Error("not html");
      html = await readCapped(res);
    } finally {
      clearTimeout(timer);
    }
    return parseMetadata(html, url);
  } catch {
    return deriveFallbackMeta(url);
  }
}

async function readCapped(res) {
  if (!res.body || !res.body.getReader) return await res.text();
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let out = "";
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    out += decoder.decode(value, { stream: true });
    if (total >= MAX_BYTES || /<\/head>/i.test(out)) {
      try { await reader.cancel(); } catch { /* ignore */ }
      break;
    }
  }
  return out;
}
