/*
 * Import/export of the standard Netscape bookmark HTML format (SCN-021).
 * Import preserves title, labels (folder path + TAGS, de-duplicated case-insensitively),
 * and the added date. Export writes the whole collection preserving titles, labels, dates.
 */

function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function decodeEntities(s) {
  return String(s || "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function mergeLabels(list) {
  const out = [];
  const seen = new Set();
  for (const t of list) {
    if (!t) continue;
    const k = t.toLowerCase();
    if (!seen.has(k)) { seen.add(k); out.push(t); }
  }
  return out;
}

// Parse a Netscape bookmark HTML string into [{ url, title, tags, addedAt }].
function parse(html) {
  const items = [];
  const folderStack = [];
  let pendingFolder = null;
  const re = /<h3[^>]*>([\s\S]*?)<\/h3>|<dl[^>]*>|<\/dl>|<a\s+([^>]*)>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(html))) {
    if (m[1] !== undefined) {
      pendingFolder = decodeEntities(m[1].replace(/<[^>]*>/g, "").trim());
    } else if (/^<dl/i.test(m[0])) {
      folderStack.push(pendingFolder);
      pendingFolder = null;
    } else if (/^<\/dl/i.test(m[0])) {
      folderStack.pop();
    } else if (m[2] !== undefined) {
      const attrs = m[2];
      const title = decodeEntities(m[3].replace(/<[^>]*>/g, "").trim());
      const href = (attrs.match(/href\s*=\s*"([^"]*)"/i) || [])[1];
      if (!href || !/^https?:/i.test(href)) continue;
      const addDate = (attrs.match(/add_date\s*=\s*"(\d+)"/i) || [])[1];
      const tagAttr = (attrs.match(/tags\s*=\s*"([^"]*)"/i) || [])[1] || "";
      const tagList = tagAttr.split(",").map((s) => s.trim()).filter(Boolean);
      const folders = folderStack.filter(Boolean);
      const tags = mergeLabels([...tagList, ...folders]);
      const addedAt = addDate
        ? new Date(parseInt(addDate, 10) * 1000).toISOString().slice(0, 10)
        : null;
      items.push({ url: href, title: title || href, tags, addedAt });
    }
  }
  return items;
}

// Generate a Netscape bookmark HTML string for the whole collection.
function generate(bookmarks) {
  const rows = bookmarks
    .map((b) => {
      const secs = b.addedAt ? Math.floor(new Date(b.addedAt).getTime() / 1000) : Math.floor(Date.now() / 1000);
      const tags = (b.tags || []).join(",");
      const tagAttr = tags ? ` TAGS="${escapeHtml(tags)}"` : "";
      return `    <DT><A HREF="${escapeHtml(b.url)}" ADD_DATE="${secs}"${tagAttr}>${escapeHtml(b.title)}</A>`;
    })
    .join("\n");
  return (
    "<!DOCTYPE NETSCAPE-Bookmark-file-1>\n" +
    '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">\n' +
    "<TITLE>Bookmarks</TITLE>\n<H1>Bookmarks</H1>\n<DL><p>\n" +
    rows +
    "\n</DL><p>\n"
  );
}

module.exports = { parse, generate, mergeLabels, escapeHtml };
