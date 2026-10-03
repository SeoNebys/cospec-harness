// Private preserved copy (SCN-015).
// For an ordinary page: a single self-contained HTML file (styles and images
// inlined, scripts removed). For a PDF address: the PDF file itself.
import * as cheerio from "cheerio";
import { isPdf } from "./normalize.js";

const UA = "Mozilla/5.0 (compatible; BookmarksApp/1.0)";
const TIMEOUT_MS = 20000;
const MAX_ASSET_BYTES = 2 * 1024 * 1024; // cap per inlined asset
const MAX_IMAGES = 40;

async function fetchWithTimeout(url, opts = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...opts, headers: { "User-Agent": UA, ...(opts.headers || {}) }, redirect: "follow", signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function toDataUri(url) {
  try {
    const res = await fetchWithTimeout(url);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > MAX_ASSET_BYTES) return null;
    const type = res.headers.get("content-type") || "application/octet-stream";
    return `data:${type.split(";")[0]};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

export async function preserveCopy(url) {
  const res = await fetchWithTimeout(url, { headers: { Accept: "*/*" } });
  const finalUrl = res.url || url;
  const ctype = (res.headers.get("content-type") || "").toLowerCase();

  if (ctype.includes("application/pdf") || isPdf(finalUrl)) {
    const buf = Buffer.from(await res.arrayBuffer());
    return { kind: "pdf", contentType: "application/pdf", data: buf };
  }

  const html = await res.text();
  const $ = cheerio.load(html);
  $("script, noscript").remove();
  $("base").remove();

  // Inline stylesheets.
  const links = $('link[rel~="stylesheet"]').toArray();
  for (const el of links) {
    const href = $(el).attr("href");
    if (!href) continue;
    try {
      const abs = new URL(href, finalUrl).href;
      const r = await fetchWithTimeout(abs);
      if (r.ok) { const css = await r.text(); $(el).replaceWith(`<style>${css}</style>`); }
    } catch { /* leave as-is */ }
  }

  // Inline images (bounded).
  const imgs = $("img[src]").toArray().slice(0, MAX_IMAGES);
  for (const el of imgs) {
    const src = $(el).attr("src");
    if (!src || src.startsWith("data:")) continue;
    try {
      const abs = new URL(src, finalUrl).href;
      const dataUri = await toDataUri(abs);
      if (dataUri) $(el).attr("src", dataUri);
    } catch { /* leave as-is */ }
  }

  const banner = `<div style="position:sticky;top:0;background:#1c2330;color:#fff;padding:8px 14px;font:13px sans-serif;z-index:99999">Preserved copy · saved ${new Date().toLocaleString()} · original: ${escapeAttr(finalUrl)}</div>`;
  if ($("body").length) $("body").prepend(banner);
  else $.root().prepend(banner);

  return { kind: "page", contentType: "text/html; charset=utf-8", data: Buffer.from($.html(), "utf-8") };
}

function escapeAttr(s) {
  return (s || "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}
