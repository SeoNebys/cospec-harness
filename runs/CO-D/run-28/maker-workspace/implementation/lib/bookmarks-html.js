/*
 * Import/export of the standard (Netscape) browser-bookmarks HTML file.
 * Basis: SCN-019 — export carries title, tags (TAGS), original date (ADD_DATE,
 * LAST_MODIFIED); import retains these and reports counts; caller skips duplicates.
 * Parsing is regex-based over anchor tags so it works in Node without a DOM.
 * UMD: Node (require) and browser (window.BookmarksHtml).
 */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory();
  else root.BookmarksHtml = factory();
})(typeof self !== 'undefined' ? self : this, function () {

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }
  function unesc(s) {
    return String(s == null ? '' : s)
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'").replace(/&amp;/g, '&');
  }

  function exportHtml(bookmarks) {
    let out = '<!DOCTYPE NETSCAPE-Bookmark-file-1>\n' +
      '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">\n' +
      '<TITLE>Bookmarks</TITLE>\n<H1>Bookmarks</H1>\n<DL><p>\n';
    for (const b of bookmarks) {
      const add = Math.floor((b.addedAt || Date.now()) / 1000);
      const mod = Math.floor((b.updatedAt || b.addedAt || Date.now()) / 1000);
      const tags = (b.tags || []).join(',');
      out += `    <DT><A HREF="${esc(b.url)}" ADD_DATE="${add}" LAST_MODIFIED="${mod}"` +
             (tags ? ` TAGS="${esc(tags)}"` : '') + `>${esc(b.title || b.url)}</A>\n`;
      if (b.description) out += `    <DD>${esc(b.description)}\n`;
    }
    out += '</DL><p>\n';
    return out;
  }

  // Parse anchors; return raw entries {url,title,tags[],addedAt,updatedAt}.
  function parseHtml(text) {
    const entries = [];
    const re = /<a\s+([^>]*?)href\s*=\s*"([^"]*)"([^>]*)>([\s\S]*?)<\/a>/gi;
    let m;
    while ((m = re.exec(text)) !== null) {
      const attrs = (m[1] || '') + ' ' + (m[3] || '');
      const url = unesc(m[2]);
      const title = unesc(m[4].replace(/<[^>]*>/g, '')).trim();
      const add = /add_date\s*=\s*"(\d+)"/i.exec(attrs);
      const mod = /last_modified\s*=\s*"(\d+)"/i.exec(attrs);
      const tagsAttr = /tags\s*=\s*"([^"]*)"/i.exec(attrs);
      const addedAt = add ? Number(add[1]) * 1000 : null;
      const updatedAt = mod ? Number(mod[1]) * 1000 : null;
      const tags = tagsAttr ? tagsAttr[1].split(',').map(t => t.trim().toLowerCase()).filter(Boolean) : [];
      entries.push({ url, title, tags, addedAt, updatedAt });
    }
    return entries;
  }

  return { exportHtml, parseHtml };
});
