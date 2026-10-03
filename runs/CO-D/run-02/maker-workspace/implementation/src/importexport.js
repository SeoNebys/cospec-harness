'use strict';
// Import/export (SCN-019). Parses browser bookmark HTML (Netscape format) and our
// JSON backup; generates a browser-compatible HTML file and a full JSON backup.
const { cleanTag, uniq } = require('./urlutil');

function decodeEntities(s) {
  return (s || '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ');
}
function attrOf(attrs, name) {
  const m = attrs.match(new RegExp(name + '\\s*=\\s*"([^"]*)"', 'i')) ||
            attrs.match(new RegExp(name + "\\s*=\\s*'([^']*)'", 'i'));
  return m ? m[1] : undefined;
}

// Token scanner for the Netscape bookmark format. Rather than rely on HTML5
// auto-closing of <DT>, it tracks folder depth directly: each <DL> after an
// <H3>Folder</H3> opens that folder; </DL> closes it; folder names on the path
// become tags (SCN-019). Robust across browser exports.
function parseNetscape(html) {
  const out = [];
  const stack = []; // folder name (or null) per open DL
  let pending = null; // folder name awaiting its DL
  const re = /<dl\b|<\/dl>|<h3[^>]*>([\s\S]*?)<\/h3>|<a\s+([^>]*?)>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(html))) {
    const tok = m[0].slice(0, 4).toLowerCase();
    if (tok === '<dl') { stack.push(pending); pending = null; }
    else if (m[0].toLowerCase() === '</dl>') { stack.pop(); }
    else if (m[1] !== undefined) { pending = decodeEntities(m[1].replace(/<[^>]+>/g, '').trim()); }
    else if (m[2] !== undefined) {
      const attrs = m[2];
      const href = attrOf(attrs, 'href'); if (!href) continue;
      const add = attrOf(attrs, 'add_date');
      const tagAttr = (attrOf(attrs, 'tags') || '').split(',');
      const folders = stack.filter(Boolean);
      out.push({
        url: href,
        title: decodeEntities(m[3].replace(/<[^>]+>/g, '').trim()),
        created: add ? parseInt(add, 10) * 1000 : Date.now(),
        tags: uniq(folders.concat(tagAttr).map(cleanTag).filter(Boolean)),
        description: '', note: '', toRead: false, archived: false
      });
    }
  }
  return out;
}

function parseImport(text) {
  const t = (text || '').trim();
  if (!t) return [];
  if (t[0] === '{' || t[0] === '[') {
    const data = JSON.parse(t);
    const arr = Array.isArray(data) ? data : (data.bookmarks || []);
    return arr.map(r => ({
      url: r.url,
      title: r.title || '',
      created: r.created || Date.now(),
      updated: r.updated,
      tags: uniq((r.tags || []).map(cleanTag).filter(Boolean)),
      description: r.description || '',
      note: r.note || '',
      toRead: !!r.toRead,
      archived: !!r.archived
    }));
  }
  return parseNetscape(text);
}

function esc(s) {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function toNetscape(bookmarks) {
  let s = '<!DOCTYPE NETSCAPE-Bookmark-file-1>\n' +
    '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">\n' +
    '<TITLE>Bookmarks</TITLE>\n<H1>Bookmarks</H1>\n<DL><p>\n';
  bookmarks.forEach(b => {
    const dt = Math.floor((b.created || Date.now()) / 1000);
    s += '    <DT><A HREF="' + esc(b.url) + '" ADD_DATE="' + dt + '"' +
      (b.tags && b.tags.length ? ' TAGS="' + esc(b.tags.join(',')) + '"' : '') +
      '>' + esc(b.title) + '</A>\n';
  });
  return s + '</DL><p>\n';
}

function toJson(bookmarks) {
  return JSON.stringify({
    app: 'calm-bookmarks', version: 1, exportedAt: new Date().toISOString(),
    bookmarks: bookmarks.map(b => ({
      url: b.url, title: b.title, description: b.description || '', note: b.note || '',
      tags: b.tags || [], created: b.created, updated: b.updated,
      toRead: !!b.toRead, archived: !!b.archived
    }))
  }, null, 2);
}

module.exports = { parseImport, parseNetscape, toNetscape, toJson };
