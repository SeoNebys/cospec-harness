'use strict';
// Import/export of the standard Netscape bookmarks HTML file (SCN-015).
// Import preserves titles, tags (TAGS attribute + meaningful folder names) and
// original saved dates (ADD_DATE). Export round-trips the same.
const { withScheme } = require('./urls');

const GENERIC_FOLDERS = /^(bookmarks(\s*(bar|menu|toolbar))?|favorites|favourites|other bookmarks|mobile bookmarks|bookmarks toolbar)$/i;

function decodeEntities(s) {
  return String(s || '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .trim();
}
function attr(attrs, name) {
  const m = attrs.match(new RegExp(name + '\\s*=\\s*"([^"]*)"', 'i'));
  return m ? m[1] : null;
}

// Returns a list of { url, title, tags:[], createdAt } parsed in document order.
function parseBookmarksHtml(html) {
  const out = [];
  const stack = [];
  let pendingFolder = null;
  const re = /<h3[^>]*>([\s\S]*?)<\/h3>|<dl[^>]*>|<\/dl>|<a\s+([^>]*?)>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const tok = m[0].toLowerCase();
    if (tok.startsWith('<h3')) {
      pendingFolder = decodeEntities(m[1]);
    } else if (tok.startsWith('<dl')) {
      stack.push(pendingFolder);
      pendingFolder = null;
    } else if (tok.startsWith('</dl')) {
      stack.pop();
    } else if (tok.startsWith('<a')) {
      const attrs = m[2] || '';
      const href = attr(attrs, 'href');
      if (!href || !/^https?:/i.test(href)) continue;
      const title = decodeEntities(m[3]) || href;
      const addDate = parseInt(attr(attrs, 'add_date') || '', 10);
      const createdAt = addDate ? addDate * 1000 : Date.now();
      const tags = [];
      const tagsAttr = attr(attrs, 'tags');
      if (tagsAttr) decodeEntities(tagsAttr).split(',').forEach((t) => { const s = t.trim(); if (s) tags.push(s); });
      const folder = stack[stack.length - 1];
      if (folder && !GENERIC_FOLDERS.test(folder)) tags.push(folder);
      const seen = new Set();
      const dedup = [];
      for (const t of tags) { const k = t.toLowerCase(); if (!seen.has(k)) { seen.add(k); dedup.push(t); } }
      out.push({ url: withScheme(href), title, tags: dedup, createdAt });
    }
  }
  return out;
}

function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// bookmarks: [{ url, title, tags:[], createdAt }]
function generateBookmarksHtml(bookmarks) {
  let out = '<!DOCTYPE NETSCAPE-Bookmark-file-1>\n' +
    '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">\n' +
    '<TITLE>Bookmarks</TITLE>\n<H1>Bookmarks</H1>\n<DL><p>\n';
  for (const b of bookmarks) {
    const add = Math.floor((b.createdAt != null ? b.createdAt : Date.now()) / 1000);
    const tags = (b.tags || []).join(',');
    out += '    <DT><A HREF="' + esc(withScheme(b.url)) + '" ADD_DATE="' + add + '"' +
      (tags ? ' TAGS="' + esc(tags) + '"' : '') + '>' + esc(b.title || b.url) + '</A>\n';
  }
  out += '</DL><p>\n';
  return out;
}

module.exports = { parseBookmarksHtml, generateBookmarksHtml, GENERIC_FOLDERS };
