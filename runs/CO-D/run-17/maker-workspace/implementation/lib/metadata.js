/*
 * metadata.js — server-side page-detail fetch (SCN-001 auto-fill; SCN-002
 * fetch-failure fallback). Fetches the real page and extracts title,
 * description, site name, preview image, and favicon. On any failure or
 * unreachable page returns { ok:false } so the client offers manual entry.
 */
"use strict";
const { normalizeUrl } = require("../public/js/core.js");

function attr(tagHtml, name) {
  const m = tagHtml.match(new RegExp(name + '\\s*=\\s*"([^"]*)"', "i")) || tagHtml.match(new RegExp(name + "\\s*=\\s*'([^']*)'", "i"));
  return m ? decode(m[1]) : null;
}
function decode(s) {
  return String(s || "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#(\d+);/g, (m, n) => String.fromCharCode(parseInt(n, 10)));
}
function metaContent(html, prop) {
  // matches <meta property="og:x" content="..."> or name="..."
  const re = new RegExp('<meta[^>]*(?:property|name)\\s*=\\s*["\']' + prop + '["\'][^>]*>', "i");
  const m = html.match(re);
  return m ? attr(m[0], "content") : null;
}
function absolute(base, url) {
  if (!url) return null;
  try { return new URL(url, base).href; } catch (e) { return null; }
}

function parseMetadata(html, finalUrl) {
  const n = normalizeUrl(finalUrl) || {};
  const head = html.slice(0, 200000); // metadata lives near the top
  let title = metaContent(head, "og:title");
  if (!title) { const t = head.match(/<title[^>]*>([\s\S]*?)<\/title>/i); title = t ? decode(t[1]).trim() : null; }
  const description = metaContent(head, "og:description") || metaContent(head, "description") || "";
  const site = metaContent(head, "og:site_name") || n.domain || "";
  const image = absolute(finalUrl, metaContent(head, "og:image"));
  let favicon = null;
  const iconTag = head.match(/<link[^>]*rel\s*=\s*["'][^"']*icon[^"']*["'][^>]*>/i);
  if (iconTag) favicon = absolute(finalUrl, attr(iconTag[0], "href"));
  if (!favicon && n.url) favicon = absolute(finalUrl, "/favicon.ico");
  return {
    ok: true,
    title: (title && title.trim()) || (n.domain || ""),
    description: (description || "").trim(),
    site: site || n.domain || "",
    image: image || null,
    favicon: favicon || null,
    domain: n.domain || "",
  };
}

async function fetchMetadata(rawUrl, { timeoutMs = 8000, fetchImpl } = {}) {
  const doFetch = fetchImpl || globalThis.fetch;
  const n = normalizeUrl(rawUrl);
  if (!n.ok) return { ok: false, reason: "invalid" };
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await doFetch(n.url, {
      signal: ctl.signal, redirect: "follow",
      headers: { "User-Agent": "LinkLibrary/1.0 (+metadata)", "Accept": "text/html,application/xhtml+xml" },
    });
    if (!res.ok) return { ok: false, reason: "status", status: res.status };
    const ctype = res.headers.get("content-type") || "";
    if (/pdf/i.test(ctype) || /\.pdf($|\?|#)/i.test(n.url)) {
      return { ok: true, title: n.domain, description: "", site: n.domain, image: null, favicon: absolute(n.url, "/favicon.ico"), domain: n.domain, kind: "pdf" };
    }
    const html = await res.text();
    return parseMetadata(html, res.url || n.url);
  } catch (e) {
    return { ok: false, reason: "unreachable" };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { fetchMetadata, parseMetadata };
