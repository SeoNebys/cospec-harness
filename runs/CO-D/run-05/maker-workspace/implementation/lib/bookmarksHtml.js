/*
 * Import/export in the standard (Netscape) bookmark HTML format (SCN-021).
 * Preserves title, tags (TAGS attribute), original saved date (ADD_DATE) and
 * note (<DD> description).
 */
const cheerio = require('cheerio');

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function generate(bookmarks) {
  let out = '<!DOCTYPE NETSCAPE-Bookmark-file-1>\n'
    + '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">\n'
    + '<TITLE>Bookmarks</TITLE>\n<H1>Bookmarks</H1>\n<DL><p>\n';
  for (const b of bookmarks) {
    const add = Math.floor((b.createdAt || Date.now()) / 1000);
    const tags = (b.tags && b.tags.length) ? ` TAGS="${esc(b.tags.join(','))}"` : '';
    out += `    <DT><A HREF="${esc(b.url)}" ADD_DATE="${add}"${tags}>${esc(b.title)}</A>\n`;
    if (b.note) out += `    <DD>${esc(b.note)}\n`;
  }
  out += '</DL><p>\n';
  return out;
}

function parse(html) {
  const $ = cheerio.load(html);
  const out = [];
  $('a[href]').each((_, el) => {
    const url = $(el).attr('href');
    if (!/^https?:/i.test(url || '')) return;
    const addAttr = $(el).attr('add_date');
    const createdAt = addAttr ? parseInt(addAttr, 10) * 1000 : Date.now();
    const tagsAttr = $(el).attr('tags') || '';
    const tags = tagsAttr ? tagsAttr.split(',').map(s => s.trim()).filter(Boolean) : [];
    // A <DD> description immediately follows the <DT> in the Netscape format.
    let note = '';
    const dt = $(el).closest('dt');
    const sib = dt.length ? dt.next() : $();
    if (sib.length && sib.get(0).tagName && sib.get(0).tagName.toLowerCase() === 'dd') {
      note = sib.text().trim();
    }
    out.push({ url, title: ($(el).text().trim() || url), tags, note, createdAt });
  });
  return out;
}

module.exports = { generate, parse };
