// Netscape bookmark-file import/export (no DOM dependency).
'use strict';

var GENERIC_FOLDERS = [
  'bookmarks', 'bookmarks bar', 'bookmarks toolbar', 'bookmarks menu',
  'other bookmarks', 'mobile bookmarks', 'favorites', 'favorites bar', 'favourites'
];

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
  });
}
function decodeEntities(s) {
  return String(s == null ? '' : s)
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}
function getAttr(tag, name) {
  var re = new RegExp(name + '\\s*=\\s*"([^"]*)"', 'i');
  var m = tag.match(re);
  return m ? m[1] : null;
}

// Parse a Netscape bookmark file. Returns array of
// { url, title, addDate(ms|null), tags:[], note }
// Folder names (from <H3>) on the path become tags, except generic containers.
function parse(text) {
  var out = [];
  var folderStack = [];
  var pendingFolder = null; // set by an <H3>, consumed by the next <DL>
  // Tokenise the structural elements we care about, in order.
  var re = /<\s*(\/?)\s*(dl|h3|a|dd)\b([^>]*)>/gi;
  var m, lastAnchor = null, lastAnchorTextStart = -1;
  var i = 0;
  // We need anchor text (between <A ...> and </A>) and DD note text.
  // Simpler: split by anchors while tracking folder structure via a linear scan.
  var lower = text;
  var pos = 0;
  var tokenRe = /<\s*(\/?)(dl|h3|a|dd)\b([^>]*)>/gi;
  var tok;
  while ((tok = tokenRe.exec(text)) !== null) {
    var closing = tok[1] === '/';
    var name = tok[2].toLowerCase();
    var attrs = tok[3] || '';
    var tagEnd = tokenRe.lastIndex;
    if (name === 'dl') {
      if (closing) { folderStack.pop(); }
      else { folderStack.push(pendingFolder); pendingFolder = null; }
    } else if (name === 'h3' && !closing) {
      // read until </H3>
      var close = text.slice(tagEnd).search(/<\s*\/\s*h3\s*>/i);
      var nm = close >= 0 ? text.slice(tagEnd, tagEnd + close) : '';
      pendingFolder = decodeEntities(nm.replace(/<[^>]*>/g, '')).trim();
    } else if (name === 'a' && !closing) {
      var href = getAttr(attrs, 'href');
      var addDate = getAttr(attrs, 'add_date');
      var tagsAttr = getAttr(attrs, 'tags') || '';
      var close2 = text.slice(tagEnd).search(/<\s*\/\s*a\s*>/i);
      var title = close2 >= 0 ? text.slice(tagEnd, tagEnd + close2) : '';
      title = decodeEntities(title.replace(/<[^>]*>/g, '')).trim();
      if (href) {
        var tags = tagsAttr.split(',').map(function (t) { return t.trim().toLowerCase(); }).filter(Boolean);
        folderStack.forEach(function (f) {
          if (!f) return;
          var fl = f.toLowerCase();
          if (GENERIC_FOLDERS.indexOf(fl) < 0 && tags.indexOf(fl) < 0) tags.push(fl);
        });
        var ms = null;
        if (addDate && /^\d+$/.test(addDate)) {
          var secs = parseInt(addDate, 10);
          ms = secs * 1000;
          if (!isFinite(ms)) ms = null;
        }
        out.push({ url: decodeEntities(href), title: title, addDate: ms, tags: tags, note: '' });
      }
    } else if (name === 'dd' && !closing && out.length) {
      // DD note applies to the most recent anchor
      var close3 = text.slice(tagEnd).search(/<\s*(dt|dd|\/?dl)\b/i);
      var note = close3 >= 0 ? text.slice(tagEnd, tagEnd + close3) : text.slice(tagEnd);
      out[out.length - 1].note = decodeEntities(note.replace(/<[^>]*>/g, '')).trim();
    }
  }
  return out;
}

// Generate a Netscape bookmark file from bookmarks
// (each: {url,title,tags,note,saved(ms),updated(ms)}).
function generate(bookmarks) {
  var lines = [
    '<!DOCTYPE NETSCAPE-Bookmark-file-1>',
    '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">',
    '<TITLE>Bookmarks</TITLE>',
    '<H1>Bookmarks</H1>',
    '<DL><p>'
  ];
  bookmarks.forEach(function (b) {
    var add = Math.floor((b.saved || Date.now()) / 1000);
    var mod = Math.floor((b.updated || b.saved || Date.now()) / 1000);
    var attrs = 'HREF="' + escapeHtml(b.url) + '" ADD_DATE="' + add + '" LAST_MODIFIED="' + mod + '"';
    if (b.tags && b.tags.length) attrs += ' TAGS="' + escapeHtml(b.tags.join(',')) + '"';
    lines.push('    <DT><A ' + attrs + '>' + escapeHtml(b.title) + '</A>');
    if (b.note) lines.push('    <DD>' + escapeHtml(b.note));
  });
  lines.push('</DL><p>');
  return lines.join('\n') + '\n';
}

module.exports = { parse: parse, generate: generate, GENERIC_FOLDERS: GENERIC_FOLDERS };
