'use strict';
// Parse and build Netscape bookmark HTML (SCN-017 import/export).

// Parse a Netscape bookmark file into [{url, title, addDate(ms), tags[]}].
// Folders (<H3>) become tags; TAGS attribute is honoured; ADD_DATE (seconds)
// becomes the original date.
function parseNetscape(html) {
  const out = [];
  const tokenRe = /<dt>\s*<h3[^>]*>([\s\S]*?)<\/h3>|<dt>\s*<a\b([^>]*)>([\s\S]*?)<\/a>|<\/dl>/gi;
  const folderStack = [];
  // We approximate nesting: each <H3> pushes a folder; each </DL> pops one.
  let m;
  while ((m = tokenRe.exec(html))) {
    if (m[1] !== undefined) {
      folderStack.push(decode(m[1]).trim());
    } else if (m[2] !== undefined) {
      const attrs = m[2];
      const href = attr(attrs, 'href');
      if (!href) continue;
      const title = decode(m[3]).replace(/\s+/g, ' ').trim() || href;
      const add = parseInt(attr(attrs, 'add_date') || '', 10);
      const tagsAttr = (attr(attrs, 'tags') || '').split(',').map(s => s.trim()).filter(Boolean);
      out.push({
        url: href,
        title,
        addDate: isFinite(add) && add > 0 ? add * 1000 : null,
        tags: [...tagsAttr, ...folderStack],
      });
    } else {
      // </dl> closes the current folder
      if (folderStack.length) folderStack.pop();
    }
  }
  return out;
}

function attr(attrs, name) {
  const re = new RegExp(name + '\\s*=\\s*["\']([^"\']*)["\']', 'i');
  const m = re.exec(attrs);
  return m ? m[1] : '';
}
function decode(s) {
  return String(s || '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}
function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Build a browser-compatible export (title, tags, original date).
function buildNetscape(bookmarks) {
  let html = '<!DOCTYPE NETSCAPE-Bookmark-file-1>\n'
    + '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">\n'
    + '<TITLE>Bookmarks</TITLE>\n<H1>Bookmarks</H1>\n<DL><p>\n';
  for (const b of bookmarks) {
    const add = Math.floor((b.createdAt || Date.now()) / 1000);
    html += '  <DT><A HREF="' + esc(b.url) + '" ADD_DATE="' + add + '"'
      + (b.tags && b.tags.length ? ' TAGS="' + esc(b.tags.join(',')) + '"' : '')
      + '>' + esc(b.title) + '</A>\n';
  }
  html += '</DL><p>\n';
  return html;
}

module.exports = { parseNetscape, buildNetscape };
