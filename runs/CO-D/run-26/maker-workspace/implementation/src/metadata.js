// Genuine page-metadata retrieval (SCN-001 / SCN-008).
// Fetches the page and extracts title, description, site icon, and a preview image.
// On failure (unreachable / unreadable) returns { failed: true } so the caller can
// still let the client save and fill in details manually.
import * as cheerio from "cheerio";
import { isPdf } from "./normalize.js";

const UA = "Mozilla/5.0 (compatible; BookmarksApp/1.0)";
const TIMEOUT_MS = 12000;

function absolute(base, ref) {
  try { return new URL(ref, base).href; } catch { return ""; }
}

export async function fetchMetadata(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml,*/*" }, redirect: "follow", signal: ctrl.signal });
    const finalUrl = res.url || url;
    const ctype = (res.headers.get("content-type") || "").toLowerCase();
    const host = safeHost(finalUrl);
    if (ctype.includes("application/pdf") || isPdf(finalUrl)) {
      return { failed: false, isPdf: true, title: pdfTitle(finalUrl), description: "", fav: faviconFallback(finalUrl), preview: "" };
    }
    if (!res.ok) return failed(finalUrl);
    const html = await res.text();
    const $ = cheerio.load(html);
    const title = ($('meta[property="og:title"]').attr("content") || $("title").first().text() || host || finalUrl).trim();
    const description = ($('meta[property="og:description"]').attr("content") || $('meta[name="description"]').attr("content") || "").trim();
    let preview = $('meta[property="og:image"]').attr("content") || $('meta[name="twitter:image"]').attr("content") || "";
    if (preview) preview = absolute(finalUrl, preview);
    let fav = $('link[rel~="icon"]').attr("href") || $('link[rel="shortcut icon"]').attr("href") || "";
    fav = fav ? absolute(finalUrl, fav) : faviconFallback(finalUrl);
    return { failed: false, isPdf: false, title: title || host, description, fav, preview };
  } catch {
    return failed(url);
  } finally {
    clearTimeout(timer);
  }
}

function safeHost(u) { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; } }
function faviconFallback(u) { const h = safeHost(u); return h ? `https://www.google.com/s2/favicons?domain=${h}&sz=64` : ""; }
function pdfTitle(u) {
  try { const p = new URL(u).pathname.split("/").filter(Boolean).pop() || safeHost(u); return decodeURIComponent(p); }
  catch { return u; }
}
function failed(u) { return { failed: true, isPdf: isPdf(u), title: "", description: "", fav: faviconFallback(u), preview: "" }; }
