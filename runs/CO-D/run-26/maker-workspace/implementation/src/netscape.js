// Standard Netscape bookmark file import/export (SCN-017).
// Preserves title, address, tags (TAGS attribute), original saved date (ADD_DATE,
// unix seconds), and description (DD). Archived bookmarks are placed in an
// "Archived" folder on export and recognized as archived on import.

import { escapeHtml } from "./notes.js";

export function exportNetscape(bookmarks) {
  const lines = [
    "<!DOCTYPE NETSCAPE-Bookmark-file-1>",
    '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">',
    "<TITLE>Bookmarks</TITLE>",
    "<H1>Bookmarks</H1>",
    "<DL><p>",
  ];
  const emit = (b, indent) => {
    const add = Math.floor((b.addedAt || Date.now()) / 1000);
    let a = `${indent}<DT><A HREF="${escapeHtml(b.url)}" ADD_DATE="${add}"`;
    if (b.tags && b.tags.length) a += ` TAGS="${escapeHtml(b.tags.join(","))}"`;
    a += `>${escapeHtml(b.title || b.url)}</A>`;
    lines.push(a);
    if (b.description) lines.push(`${indent}<DD>${escapeHtml(b.description)}`);
  };
  bookmarks.filter((b) => !b.archived).forEach((b) => emit(b, "    "));
  const archived = bookmarks.filter((b) => b.archived);
  if (archived.length) {
    lines.push("    <DT><H3>Archived</H3>");
    lines.push("    <DL><p>");
    archived.forEach((b) => emit(b, "        "));
    lines.push("    </DL><p>");
  }
  lines.push("</DL><p>");
  return lines.join("\n") + "\n";
}

function decodeEntities(s) {
  return (s || "")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

// Isomorphic parser (no DOM): scans tokens in order, tracking folder nesting so
// bookmarks under an "Archived" folder are marked archived. A <DD> description
// immediately following an anchor is attached to it.
export function importNetscape(html) {
  const out = [];
  const folderStack = [];
  let pendingFolder = "";
  let lastAnchor = null;
  const tokenRe = /<h3\b[^>]*>([\s\S]*?)<\/h3>|<dl\b[^>]*>|<\/dl>|<a\b([^>]*)>([\s\S]*?)<\/a>|<dd\b[^>]*>([\s\S]*?)(?=<dt|<dd|<\/dl|<h3|$)/gi;
  let m;
  while ((m = tokenRe.exec(html))) {
    const raw = m[0].toLowerCase();
    if (m[1] !== undefined) { pendingFolder = decodeEntities(m[1].trim()); lastAnchor = null; continue; }
    if (raw === "</dl>") { folderStack.pop(); lastAnchor = null; continue; }
    if (raw.startsWith("<dl")) { folderStack.push(pendingFolder); pendingFolder = ""; lastAnchor = null; continue; }
    if (m[4] !== undefined) { // <dd> description
      if (lastAnchor) lastAnchor.description = decodeEntities(m[4].replace(/<[^>]*>/g, "").trim());
      continue;
    }
    // anchor
    const attrs = m[2] || "";
    const title = decodeEntities((m[3] || "").replace(/<[^>]*>/g, "").trim());
    const hrefM = /href\s*=\s*"([^"]*)"/i.exec(attrs) || /href\s*=\s*'([^']*)'/i.exec(attrs);
    const url = hrefM ? decodeEntities(hrefM[1]) : "";
    if (!/^https?:/i.test(url)) { lastAnchor = null; continue; }
    const tagsM = /tags\s*=\s*"([^"]*)"/i.exec(attrs);
    const tags = tagsM ? tagsM[1].split(",").map((t) => decodeEntities(t.trim())).filter(Boolean) : [];
    const addM = /add_date\s*=\s*"?(\d+)"?/i.exec(attrs);
    const addedAt = addM ? Number(addM[1]) * 1000 : Date.now();
    const archived = folderStack.some((f) => /^archived$/i.test(f));
    lastAnchor = { url, title: title || url, tags, addedAt, description: "", archived };
    out.push(lastAnchor);
  }
  return out;
}
