'use strict';

// Import / export of the Netscape bookmark file format used by browsers.

function decodeEntities(str) {
  return String(str || '')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'").replace(/&amp;/g, '&').trim();
}
function encodeEntities(str) {
  return String(str || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function attr(tag, name) {
  const re = new RegExp(name + '\\s*=\\s*"([^"]*)"', 'i');
  const m = re.exec(tag);
  return m ? decodeEntities(m[1]) : '';
}

// Parse a Netscape HTML file into an array of bookmark objects. Folder headings
// (<H3>) are tracked and applied as tags, in addition to any TAGS attribute.
function parseNetscape(html) {
  const items = [];
  const folderStack = [];
  // Split into structural tokens to keep folder nesting roughly correct.
  const tokenRe = /<DT>\s*<H3[^>]*>([\s\S]*?)<\/H3>|<\/DL>|<DT>\s*<A\b([^>]*)>([\s\S]*?)<\/A>(?:\s*<DD>([\s\S]*?)(?=<DT>|<\/DL>|$))?/gi;
  let m;
  while ((m = tokenRe.exec(html)) !== null) {
    if (m[1] !== undefined) {
      folderStack.push(decodeEntities(m[1].replace(/<[^>]+>/g, '')));
    } else if (m[0].toUpperCase().startsWith('</DL')) {
      folderStack.pop();
    } else if (m[2] !== undefined) {
      const tag = '<A ' + m[2] + '>';
      const href = attr(tag, 'href');
      if (!href || !/^https?:/i.test(href)) continue;
      const tagsAttr = attr(tag, 'tags');
      const tags = new Set();
      for (const f of folderStack) if (f) tags.add(f);
      for (const t of tagsAttr.split(',')) { const v = t.trim(); if (v) tags.add(v); }
      const addDate = attr(tag, 'add_date');
      let created = '';
      if (/^\d+$/.test(addDate)) {
        const d = new Date(parseInt(addDate, 10) * 1000);
        if (!isNaN(d)) created = d.toISOString().slice(0, 19).replace('T', ' ');
      }
      items.push({
        url: href,
        title: decodeEntities(m[3].replace(/<[^>]+>/g, '')),
        description: m[4] ? decodeEntities(m[4].replace(/<[^>]+>/g, '')) : '',
        tags: [...tags],
        favorite: /toolbar/i.test(folderStack.join(' ')) ? 0 : 0,
        created_at: created
      });
    }
  }
  return items;
}

// Build a Netscape bookmark file from bookmark rows (each with a `tags` array).
function buildNetscape(bookmarks) {
  const lines = [
    '<!DOCTYPE NETSCAPE-Bookmark-file-1>',
    '<!-- This is an automatically generated file. -->',
    '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">',
    '<TITLE>Bookmarks</TITLE>',
    '<H1>Bookmarks</H1>',
    '<DL><p>'
  ];
  for (const b of bookmarks) {
    const addDate = b.created_at ? Math.floor(new Date(b.created_at + 'Z').getTime() / 1000) : '';
    const tags = (b.tags || []).join(',');
    let a = `    <DT><A HREF="${encodeEntities(b.url)}"`;
    if (addDate) a += ` ADD_DATE="${addDate}"`;
    if (tags) a += ` TAGS="${encodeEntities(tags)}"`;
    a += `>${encodeEntities(b.title || b.url)}</A>`;
    lines.push(a);
    if (b.description) lines.push(`    <DD>${encodeEntities(b.description)}`);
  }
  lines.push('</DL><p>');
  return lines.join('\n') + '\n';
}

module.exports = { parseNetscape, buildNetscape };
