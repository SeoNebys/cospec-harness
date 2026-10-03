// Page-detail collection (SCN-001, SCN-010).
// parseMetadata is a pure function (unit-tested against HTML fixtures).
// fetchMetadata performs the network request and degrades gracefully so saving
// stays possible even when a page's details cannot be read.

import { normalizeUrl, InvalidUrlError } from "./url.js";

function decodeEntities(s) {
  if (!s) return s;
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(parseInt(d, 10)))
    .trim();
}

function metaContent(html, matchers) {
  // Each matcher is a regex that captures the tag; we then read its content attr.
  for (const re of matchers) {
    const m = html.match(re);
    if (m) {
      const tag = m[0];
      const c = tag.match(/content\s*=\s*("([^"]*)"|'([^']*)')/i);
      if (c) return decodeEntities(c[2] ?? c[3] ?? "");
    }
  }
  return null;
}

function absolutize(href, baseUrl) {
  if (!href) return null;
  try {
    return new URL(href, baseUrl).href;
  } catch {
    return null;
  }
}

// Extract title, description, preview image, site name and icon from raw HTML.
export function parseMetadata(html, baseUrl) {
  html = String(html || "");
  const ogTitle = metaContent(html, [
    /<meta[^>]+property\s*=\s*["']og:title["'][^>]*>/i,
    /<meta[^>]+name\s*=\s*["']og:title["'][^>]*>/i,
  ]);
  let title = ogTitle;
  if (!title) {
    const t = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    title = t ? decodeEntities(t[1].replace(/\s+/g, " ")) : "";
  }

  const description = metaContent(html, [
    /<meta[^>]+property\s*=\s*["']og:description["'][^>]*>/i,
    /<meta[^>]+name\s*=\s*["']description["'][^>]*>/i,
  ]) || "";

  const image = absolutize(
    metaContent(html, [
      /<meta[^>]+property\s*=\s*["']og:image["'][^>]*>/i,
      /<meta[^>]+name\s*=\s*["']og:image["'][^>]*>/i,
    ]),
    baseUrl
  );

  const siteName = metaContent(html, [
    /<meta[^>]+property\s*=\s*["']og:site_name["'][^>]*>/i,
  ]);

  // Favicon: prefer a declared <link rel="...icon...">, else the site's default.
  let iconHref = null;
  const linkRe = /<link\b[^>]*>/gi;
  let lm;
  while ((lm = linkRe.exec(html))) {
    const tag = lm[0];
    if (/rel\s*=\s*("[^"]*icon[^"]*"|'[^']*icon[^']*')/i.test(tag)) {
      const hrefM = tag.match(/href\s*=\s*("([^"]*)"|'([^']*)')/i);
      if (hrefM) {
        iconHref = hrefM[2] ?? hrefM[3];
        break;
      }
    }
  }
  let icon = absolutize(iconHref, baseUrl);
  if (!icon) {
    try {
      icon = new URL("/favicon.ico", baseUrl).href;
    } catch {
      icon = null;
    }
  }

  let host = "";
  try {
    host = new URL(baseUrl).hostname.replace(/^www\./, "");
  } catch {
    /* baseUrl already validated by caller */
  }

  return {
    title: title || host,
    description,
    image: image || null,
    icon: icon || null,
    site: siteName || host,
  };
}

// Fetch a URL and return collected metadata.
// { ok:true, url, host, title, description, image, icon, site }
//   on success, or
// { ok:false, url, host, reason } when the page's details cannot be read.
// Throws InvalidUrlError only when the address itself is unusable.
export async function fetchMetadata(input, { timeoutMs = 8000, fetchImpl = fetch } = {}) {
  const { url, host } = normalizeUrl(input); // throws InvalidUrlError on bad input
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: { "user-agent": "BookmarksApp/1.0 (+private)" },
    });
    if (!res.ok) return { ok: false, url, host, reason: "http_" + res.status };
    const ctype = res.headers.get("content-type") || "";
    if (!/text\/html|application\/xhtml/i.test(ctype)) {
      return { ok: false, url, host, reason: "not_html" };
    }
    const html = await res.text();
    const meta = parseMetadata(html, url);
    return { ok: true, url, host, ...meta };
  } catch (err) {
    return { ok: false, url, host, reason: err && err.name === "AbortError" ? "timeout" : "unreachable" };
  } finally {
    clearTimeout(timer);
  }
}

export { InvalidUrlError };
