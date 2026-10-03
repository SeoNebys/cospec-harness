// Server-side page inspection: fetch a URL, read its real content type, extract
// title/description/preview, decide PDF-ness from the actual response (SCN-011),
// capture a self-contained readable copy, and submit to the Internet Archive.
// All network calls fail gracefully; callers get a usable fallback.
import { deriveVisual, hostOf } from "./public/shared/visuals.js";
import { looksLikePdf } from "./public/shared/normalize.js";

const UA = "MyBookmarks/1.0 (+personal bookmark manager)";

async function fetchWithTimeout(url, opts = {}, ms = 9000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { redirect: "follow", signal: ctrl.signal, headers: { "User-Agent": UA, ...(opts.headers || {}) }, ...opts });
  } finally { clearTimeout(t); }
}

function pick(re, html) { const m = re.exec(html); return m ? m[1].trim() : ""; }
function decode(s) {
  return String(s || "")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, " ").trim();
}
function titleFromUrl(url) {
  try {
    const u = new URL(url);
    const seg = u.pathname.split("/").filter(Boolean).pop();
    if (seg) return decodeURIComponent(seg).replace(/\.[a-z0-9]+$/i, "").replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    return hostOf(url);
  } catch { return url; }
}

// Returns { title, description, icon, preview, isPdf, failed }
export async function fetchMetadata(url) {
  const vis = deriveVisual(url);
  const base = { title: titleFromUrl(url), description: "", icon: vis.icon, preview: vis.preview, isPdf: false, failed: false };
  try {
    const res = await fetchWithTimeout(url, {});
    const ct = (res.headers.get("content-type") || "").toLowerCase();
    if (ct.includes("application/pdf") || (!ct && looksLikePdf(url))) {
      return { ...base, isPdf: true };
    }
    if (!ct.includes("text/html") && !ct.includes("application/xhtml")) {
      // Non-HTML, non-PDF (e.g. image) — keep the fallback details.
      return base;
    }
    const html = (await res.text()).slice(0, 500000);
    const title = decode(pick(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i, html))
      || decode(pick(/<title[^>]*>([\s\S]*?)<\/title>/i, html)) || base.title;
    const description = decode(pick(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i, html))
      || decode(pick(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i, html)) || "";
    return { ...base, title, description };
  } catch {
    return { ...base, failed: true };
  }
}

// Build a single, self-contained HTML document from a fetched page: strip scripts
// (safety + would need the network), inline stylesheets and images as data URIs so
// the copy still renders if the original disappears, and absolutize remaining links.
// Bounded so a heavy page can't hang or bloat the store.
async function inlineResource(absUrl, maxBytes) {
  const r = await fetchWithTimeout(absUrl, {}, 6000);
  if (!r.ok) throw new Error("bad status");
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length > maxBytes) throw new Error("too big");
  const mime = (r.headers.get("content-type") || "application/octet-stream").split(";")[0].trim();
  return { mime, buf };
}
async function selfContain(url, html) {
  html = html.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/ on[a-z]+="[^"]*"/gi, "").replace(/ on[a-z]+='[^']*'/gi, "");
  const abs = (u) => { try { return new URL(u, url).href; } catch { return null; } };

  // Inline stylesheets: <link rel="stylesheet" href> -> <style>
  const links = [...html.matchAll(/<link\b[^>]*rel=["']?stylesheet["']?[^>]*>/gi)].slice(0, 12);
  await Promise.allSettled(links.map(async (m) => {
    const href = pick(/href=["']([^"']+)["']/i, m[0]); const a = href && abs(href);
    if (!a) return;
    try { const { buf } = await inlineResource(a, 700000); html = html.replace(m[0], `<style>${buf.toString("utf8")}</style>`); }
    catch { /* leave as-is */ }
  }));

  // Inline images: <img src> -> data URI (bounded count/size + total budget)
  const imgs = [...html.matchAll(/<img\b[^>]*>/gi)].slice(0, 60);
  let budget = 12 * 1024 * 1024;
  await Promise.allSettled(imgs.map(async (m) => {
    const src = pick(/\bsrc=["']([^"']+)["']/i, m[0]); const a = src && abs(src);
    if (!a || a.startsWith("data:")) return;
    try {
      const { mime, buf } = await inlineResource(a, 2 * 1024 * 1024);
      if (buf.length > budget) return; budget -= buf.length;
      const data = `data:${mime};base64,${buf.toString("base64")}`;
      html = html.replace(m[0], m[0].replace(/\bsrc=["'][^"']+["']/i, `src="${data}"`));
    } catch { /* leave as-is */ }
  }));

  // Absolutize remaining hyperlinks so they still point somewhere.
  html = html.replace(/(<a\b[^>]*\bhref=["'])(?!https?:|data:|mailto:|#)([^"']+)(["'])/gi, (mm, p1, href, p3) => { const a = abs(href); return a ? p1 + a + p3 : mm; });

  const banner = `\n<!-- Preserved by My Bookmarks on ${new Date().toISOString()} from ${url} -->\n`;
  return banner + html;
}

// Returns { kind:'page', mime:'text/html', content } or { kind:'pdf', mime, bytes } or throws.
export async function captureSnapshot(url) {
  const res = await fetchWithTimeout(url, {}, 20000);
  const ct = (res.headers.get("content-type") || "").toLowerCase();
  if (ct.includes("application/pdf") || (!ct && looksLikePdf(url))) {
    const buf = new Uint8Array(await res.arrayBuffer());
    return { kind: "pdf", mime: "application/pdf", bytes: buf };
  }
  const html = await res.text();
  const contained = await selfContain(url, html.slice(0, 3_000_000));
  return { kind: "page", mime: "text/html", content: contained };
}

// Best-effort Internet Archive submission (Save Page Now); returns a permanent
// archived-version URL. Falls back to the standard timestamped URL form.
export async function archiveOnline(url) {
  const stamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
  let archiveUrl = "https://web.archive.org/web/" + stamp + "/" + url;
  try {
    const res = await fetchWithTimeout("https://web.archive.org/save/" + url, { method: "GET" }, 20000);
    const loc = res.headers.get("content-location") || res.headers.get("location");
    if (loc) archiveUrl = loc.startsWith("http") ? loc : "https://web.archive.org" + loc;
  } catch { /* keep timestamped fallback */ }
  return { url: archiveUrl, archivedAt: Date.now() };
}
