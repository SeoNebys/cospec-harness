// Import/export in the standard Netscape bookmark HTML format (SCN-016).
// Import: folders -> tags, ADD_DATE preserved, optional TAGS attribute honoured.
// Export: interoperable file (titles/tags/dates for other tools) plus
// app-specific attributes (STATUS, ARCHIVED) and notes as <DD> for re-import.

function escAttr(s) {
  return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}
function escHtml(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Minimal, tolerant parser for the Netscape bookmark format. Tracks the current
// folder heading (H3) in document order and applies it as a tag.
export function parseNetscape(html) {
  const out = [];
  const src = String(html || "");
  // Token scan over <H3>…</H3> and <A …>…</A> in order.
  const re = /<h3[^>]*>([\s\S]*?)<\/h3>|<a\s+([^>]*?)>([\s\S]*?)<\/a>/gi;
  let m;
  let folder = "";
  while ((m = re.exec(src))) {
    if (m[1] !== undefined) {
      folder = stripTags(m[1]).trim().toLowerCase();
      continue;
    }
    const attrs = parseAttrs(m[2]);
    const href = attrs.href;
    if (!href) continue;
    const title = stripTags(m[3]).trim();
    const add = parseInt(attrs.add_date || "0", 10) || 0;
    const explicitTags = (attrs.tags || "").split(",").map((s) => s.trim()).filter(Boolean);
    const tags = explicitTags.length ? explicitTags : (folder ? [folder] : []);
    const item = { url: href, title, addDate: add, tags };
    if (attrs.status) item.status = attrs.status;
    if (attrs.archived) item.archived = attrs.archived === "1" || attrs.archived === "true";
    out.push(item);
  }
  return out;
}

function stripTags(s) {
  return String(s).replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"');
}
function parseAttrs(s) {
  const attrs = {};
  const re = /([a-z_]+)\s*=\s*"([^"]*)"/gi;
  let m;
  while ((m = re.exec(s))) attrs[m[1].toLowerCase()] = m[2];
  return attrs;
}

export function buildNetscape(items) {
  const rows = items.map((b) => {
    const date = Math.floor((b.ts || Date.now()) / 1000);
    let line = `  <DT><A HREF="${escAttr(b.url)}" ADD_DATE="${date}" TAGS="${escAttr((b.tags || []).join(","))}"` +
      ` STATUS="${escAttr(b.status || "toread")}"${b.archived ? ' ARCHIVED="1"' : ""}>${escHtml(b.title)}</A>`;
    if (b.note) line += `\n  <DD>${escHtml(b.note)}`;
    return line;
  }).join("\n");
  return "<!DOCTYPE NETSCAPE-Bookmark-file-1>\n" +
    "<!-- Exported from My Bookmarks. Titles, tags and saved dates are portable;\n" +
    "     STATUS/ARCHIVED attributes and <DD> notes are preserved for re-import. -->\n" +
    "<META HTTP-EQUIV=\"Content-Type\" CONTENT=\"text/html; charset=UTF-8\">\n" +
    "<TITLE>Bookmarks</TITLE>\n<H1>Bookmarks</H1>\n<DL><p>\n" + rows + "\n</DL><p>\n";
}
