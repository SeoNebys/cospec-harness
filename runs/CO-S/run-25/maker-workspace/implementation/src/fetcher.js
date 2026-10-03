"use strict";
// Fetches a page to derive its title/description and to preserve a copy (SCN-001, SCN-007, SCN-011).
// - Regular pages: preserve readable content (title + text) as self-contained HTML.
// - Direct PDFs: preserve the original file bytes.
// The HTTP layer is injectable so tests run without network.

const { isPdf } = require("../shared/urls.js");

function decodeEntities(s) {
  return s
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ");
}
function escapeHtml(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
function stripTags(s) {
  return decodeEntities(s.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
}

function extractTitle(html) {
  let m = html.match(/<meta[^>]+property=["']og:title["'][^>]*content=["']([^"']+)["']/i);
  if (m) return decodeEntities(m[1]).trim();
  m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (m) return stripTags(m[1]);
  return "";
}
function extractDesc(html) {
  let m = html.match(/<meta[^>]+name=["']description["'][^>]*content=["']([^"']*)["']/i);
  if (m) return decodeEntities(m[1]).trim();
  m = html.match(/<meta[^>]+property=["']og:description["'][^>]*content=["']([^"']*)["']/i);
  if (m) return decodeEntities(m[1]).trim();
  return "";
}

// Build a self-contained readable HTML copy: the title plus extracted headings/paragraphs.
function buildReadable(html, title) {
  let body = html;
  const bm = html.match(/<body[\s\S]*?>([\s\S]*)<\/body>/i);
  if (bm) body = bm[1];
  body = body.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ");
  const blocks = [];
  const re = /<(h1|h2|h3|p|li)[^>]*>([\s\S]*?)<\/\1>/gi;
  let m;
  while ((m = re.exec(body)) !== null) {
    const text = stripTags(m[2]);
    if (!text) continue;
    const tag = m[1].toLowerCase();
    if (tag === "li") blocks.push("<li>" + escapeHtml(text) + "</li>");
    else if (tag === "p") blocks.push("<p>" + escapeHtml(text) + "</p>");
    else blocks.push("<" + tag + ">" + escapeHtml(text) + "</" + tag + ">");
  }
  const inner = blocks.length ? blocks.join("\n") : "<p>" + escapeHtml(stripTags(body).slice(0, 4000)) + "</p>";
  return (
    "<!DOCTYPE html><html><head><meta charset=\"utf-8\"><title>" +
    escapeHtml(title) +
    "</title></head><body><h1>" + escapeHtml(title) + "</h1>\n" + inner + "</body></html>"
  );
}

function filenameTitle(url) {
  try {
    const p = new URL(url).pathname.split("/").filter(Boolean).pop() || "";
    return decodeURIComponent(p) || new URL(url).hostname;
  } catch (e) { return url; }
}

function createFetcher(opts) {
  opts = opts || {};
  const fetchImpl = opts.fetchImpl || (typeof fetch !== "undefined" ? fetch : null);

  async function fetchAndPreserve(url) {
    if (!fetchImpl) return { ok: false };
    let res;
    try {
      res = await fetchImpl(url, { redirect: "follow" });
    } catch (e) {
      return { ok: false };
    }
    if (!res || (res.status && res.status >= 400)) return { ok: false };

    const ctype = (res.headers && res.headers.get && (res.headers.get("content-type") || "")) || "";
    const looksPdf = isPdf(url) || /application\/pdf/i.test(ctype);

    try {
      if (looksPdf) {
        const buf = Buffer.from(await res.arrayBuffer());
        return { ok: true, kind: "pdf", title: filenameTitle(url), desc: "", buffer: buf };
      }
      const html = await res.text();
      const title = extractTitle(html) || filenameTitle(url);
      const desc = extractDesc(html);
      const readable = buildReadable(html, title);
      return { ok: true, kind: "html", title, desc, buffer: Buffer.from(readable, "utf8") };
    } catch (e) {
      return { ok: false };
    }
  }

  return { fetchAndPreserve };
}

module.exports = { createFetcher, extractTitle, extractDesc, buildReadable, filenameTitle };
