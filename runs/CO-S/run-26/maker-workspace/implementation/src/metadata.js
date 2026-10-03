// Reads a page's useful details (title, description, site) by fetching it.
// On any failure — network error, non-HTML, missing fields — it degrades
// gracefully and reports `unreadable: true` with a URL-derived fallback title,
// so a link is never lost. (SCN-001, SCN-007)

import { siteFromUrl, fallbackTitleFromUrl } from "../public/js/shared.mjs";

function decodeEntities(s) {
  if (!s) return s;
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n));
}

function extractTitle(html) {
  const og = html.match(
    /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i
  );
  if (og) return decodeEntities(og[1].trim());
  const t = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (t) return decodeEntities(t[1].replace(/\s+/g, " ").trim());
  return "";
}

function extractDescription(html) {
  const og = html.match(
    /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']*)["']/i
  );
  if (og) return decodeEntities(og[1].trim());
  const md = html.match(
    /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i
  );
  if (md) return decodeEntities(md[1].trim());
  return "";
}

/**
 * @param {string} url  a URL already validated as http/https
 * @param {object} [opts] { fetchImpl, timeoutMs }
 * @returns {Promise<{title, description, site, unreadable}>}
 */
export async function readPageDetails(url, opts = {}) {
  const fetchImpl = opts.fetchImpl || fetch;
  const timeoutMs = opts.timeoutMs ?? 6000;
  const site = siteFromUrl(url);
  const fallback = {
    title: fallbackTitleFromUrl(url),
    description: "",
    site,
    unreadable: true,
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: { "User-Agent": "BookmarksApp/1.0 (+personal)" },
    });
    if (!res.ok) return fallback;
    const ctype = res.headers.get("content-type") || "";
    if (!/text\/html|application\/xhtml/i.test(ctype)) return fallback;
    const html = await res.text();
    const title = extractTitle(html);
    const description = extractDescription(html);
    if (!title) return { ...fallback, description };
    return { title, description, site, unreadable: false };
  } catch {
    return fallback;
  } finally {
    clearTimeout(timer);
  }
}
