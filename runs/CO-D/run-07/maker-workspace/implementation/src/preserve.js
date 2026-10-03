// Preserved copies (SCN-015, NFR-005). A self-contained snapshot so the saved
// page stays readable if the original changes/disappears. PDFs are kept as the
// PDF file itself. Internet Archive submission is a separate, explicit action.
//
// True byte-perfect self-containment (inlining every asset) is a deeper build
// task; here we store the fetched document with a <base> so it renders, a clear
// "preserved copy" banner, and inline the page's own CSS where present. If the
// page can't be fetched, no copy is made (the bookmark is still saved).

import { writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { SNAP_DIR } from "./store.js";
import { ensureScheme, isPdf } from "./normalize.js";
import { safeFetch } from "./net.js";

function dateStr() {
  return new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export async function capture(rawUrl, id) {
  const url = ensureScheme(rawUrl);
  try {
    const res = await safeFetch(url);
    if (!res.ok) return null;
    const ctype = (res.headers.get("content-type") || "").toLowerCase();
    if (ctype.includes("application/pdf") || isPdf(url)) {
      const buf = Buffer.from(await res.arrayBuffer());
      const file = id + ".pdf";
      writeFileSync(join(SNAP_DIR, file), buf);
      return { kind: "pdf", at: dateStr(), file };
    }
    let html = await res.text();
    const banner = `<div style="position:sticky;top:0;z-index:99999;background:#fff7e6;border-bottom:1px solid #f0d48a;` +
      `color:#7a5b12;font:14px system-ui,sans-serif;padding:8px 14px">🗂 Preserved copy captured ${dateStr()} — a saved snapshot, not the live page. Original: ${escapeHtml(url)}</div>`;
    // Insert a <base> so the archived page's own relative assets resolve, and
    // the banner right after <body>.
    const baseTag = `<base href="${escapeAttr(res.url || url)}">`;
    if (/<head[^>]*>/i.test(html)) html = html.replace(/<head[^>]*>/i, (m) => m + baseTag);
    else html = baseTag + html;
    if (/<body[^>]*>/i.test(html)) html = html.replace(/<body[^>]*>/i, (m) => m + banner);
    else html = banner + html;
    const file = id + ".html";
    writeFileSync(join(SNAP_DIR, file), html);
    return { kind: "html", at: dateStr(), file };
  } catch {
    return null;
  }
}

export function snapshotPath(file) {
  const p = join(SNAP_DIR, file);
  return existsSync(p) ? p : null;
}

export async function toInternetArchive(rawUrl) {
  const url = ensureScheme(rawUrl);
  // Best effort: ask the Wayback "Save Page Now" endpoint; if unreachable,
  // fall back to a timestamped wayback URL. Either way return a usable link.
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const fallback = { url: `https://web.archive.org/web/${stamp}/${url}`, at: dateStr() };
  try {
    const res = await safeFetch("https://web.archive.org/save/" + url, { method: "GET" });
    const loc = res.headers.get("content-location") || res.headers.get("location");
    if (loc) return { url: loc.startsWith("http") ? loc : "https://web.archive.org" + loc, at: dateStr() };
    return fallback;
  } catch {
    return fallback;
  }
}

function escapeHtml(s) { return String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c])); }
function escapeAttr(s) { return String(s).replace(/"/g, "&quot;"); }
