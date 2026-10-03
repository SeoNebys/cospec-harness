/*
 * Page metadata fetch (auto-fill, SCN-001/011), preserved-copy capture (SCN-020),
 * and best-effort Internet Archive submission (SCN-020).
 * All network operations degrade gracefully: on failure the caller still saves the
 * bookmark and surfaces a retryable state.
 */
const fs = require("fs");
const path = require("path");
const { SNAP_DIR, domainOf } = require("./store");

const UA = "CalmBookmarks/1.0 (+bookmark manager)";
const TIMEOUT = 8000;

function pick(re, html) {
  const m = html.match(re);
  return m ? m[1].trim() : "";
}

function decode(s) {
  return String(s || "")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

// Fetch title/description/preview image/favicon for the editor's auto-fill.
async function fetchMetadata(url) {
  const full = /^https?:\/\//i.test(url) ? url : "https://" + url;
  const domain = domainOf(full);
  try {
    const res = await fetch(full, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(TIMEOUT), redirect: "follow" });
    const ct = (res.headers.get("content-type") || "").toLowerCase();
    const isPdf = ct.includes("application/pdf") || /\.pdf($|\?)/i.test(full);
    if (isPdf) {
      return { readable: true, isPdf: true, title: decodeURIComponent(full.split("/").pop()) || "PDF document", desc: "", preview: null, favicon: null, domain };
    }
    if (!res.ok) return { readable: false, isPdf: false, domain };
    const html = (await res.text()).slice(0, 500000);
    const ogTitle = decode(pick(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i, html));
    const title = decode(ogTitle || pick(/<title[^>]*>([\s\S]*?)<\/title>/i, html)).replace(/\s+/g, " ").trim();
    const desc = decode(
      pick(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i, html) ||
      pick(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']*)["']/i, html)
    );
    let preview = pick(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i, html) || null;
    if (preview && preview.startsWith("//")) preview = "https:" + preview;
    if (preview && preview.startsWith("/")) preview = new URL(preview, full).href;
    const favicon = "https://www.google.com/s2/favicons?domain=" + encodeURIComponent(domain) + "&sz=64";
    return { readable: true, isPdf: false, title: title || domain, desc, preview, favicon, domain };
  } catch (e) {
    return { readable: false, isPdf: false, domain };
  }
}

// Capture a preserved copy. Returns { copyKind, capturedAt } or throws on failure.
async function captureSnapshot(id, url) {
  const full = /^https?:\/\//i.test(url) ? url : "https://" + url;
  const res = await fetch(full, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(TIMEOUT), redirect: "follow" });
  if (!res.ok) throw new Error("fetch failed: " + res.status);
  const ct = (res.headers.get("content-type") || "").toLowerCase();
  const isPdf = ct.includes("application/pdf") || /\.pdf($|\?)/i.test(full);
  if (isPdf) {
    const buf = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(path.join(SNAP_DIR, id + ".pdf"), buf);
    return { copyKind: "pdf", capturedAt: new Date().toISOString().slice(0, 10) };
  }
  let html = await res.text();
  const banner =
    `<!-- Preserved copy saved by Calm Bookmarks on ${new Date().toISOString().slice(0, 10)} from ${full} -->\n` +
    `<base href="${full}">\n`;
  // Keep the copy self-contained enough to read: absolute base + saved markup.
  html = banner + html;
  fs.writeFileSync(path.join(SNAP_DIR, id + ".html"), html);
  return { copyKind: "page", capturedAt: new Date().toISOString().slice(0, 10) };
}

// Best-effort submission to the Internet Archive. Returns a wayback URL or throws.
async function submitInternetArchive(url) {
  const full = /^https?:\/\//i.test(url) ? url : "https://" + url;
  const res = await fetch("https://web.archive.org/save/" + full, {
    method: "GET",
    headers: { "User-Agent": UA },
    signal: AbortSignal.timeout(20000),
    redirect: "follow",
  });
  if (!res.ok && res.status !== 302) throw new Error("IA save failed: " + res.status);
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return "https://web.archive.org/web/" + stamp + "/" + full;
}

module.exports = { fetchMetadata, captureSnapshot, submitInternetArchive };
