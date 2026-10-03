import * as cheerio from 'cheerio';

// Parse a standard Netscape bookmark file (Chrome/Firefox/Safari export).
// Returns [{ url, title, description, tags, created_at }]. Enclosing folder
// names (H3) become tags, plus any explicit TAGS="a,b" attribute (Firefox).
export function parseNetscape(html) {
  const $ = cheerio.load(html);
  const items = [];

  $('a').each((_, el) => {
    const a = $(el);
    const url = (a.attr('href') || '').trim();
    if (!url || /^(place:|javascript:)/i.test(url)) return;

    const title = a.text().trim() || url;
    const tags = new Set();

    const attrTags = a.attr('tags');
    if (attrTags) attrTags.split(',').forEach((t) => t.trim() && tags.add(t.trim()));

    // Walk up folder structure: each enclosing <DL> is preceded by an <H3>.
    let node = a.closest('dl');
    while (node.length) {
      const h3 = node.prevAll('h3').first();
      const name = h3.text().trim();
      if (name && !/^(bookmarks(\s+(bar|menu|toolbar))?|bookmarks)$/i.test(name)) {
        tags.add(name);
      }
      node = node.parent().closest('dl');
    }

    const dd = a.closest('dt').next('dd');
    const description = dd.length ? dd.text().trim() : '';

    const addDate = a.attr('add_date');
    let created_at = '';
    if (addDate && /^\d+$/.test(addDate)) {
      const d = new Date(parseInt(addDate, 10) * 1000);
      if (!isNaN(d.getTime())) created_at = d.toISOString().slice(0, 19).replace('T', ' ');
    }

    items.push({ url, title, description, tags: [...tags], created_at });
  });

  return items;
}

function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Produce a standard Netscape bookmark file from bookmark rows (each with a
// `tags` array). Re-importable by any browser; tags stored in TAGS="".
export function exportNetscape(rows) {
  const lines = [
    '<!DOCTYPE NETSCAPE-Bookmark-file-1>',
    '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">',
    '<TITLE>Bookmarks</TITLE>',
    '<H1>Bookmarks</H1>',
    '<DL><p>',
  ];
  for (const b of rows) {
    const ts = b.created_at
      ? Math.floor(new Date(b.created_at.replace(' ', 'T') + 'Z').getTime() / 1000)
      : '';
    const attrs = [`HREF="${esc(b.url)}"`];
    if (ts) attrs.push(`ADD_DATE="${ts}"`);
    if (b.tags && b.tags.length) attrs.push(`TAGS="${esc(b.tags.join(','))}"`);
    lines.push(`    <DT><A ${attrs.join(' ')}>${esc(b.title || b.url)}</A>`);
    if (b.description) lines.push(`    <DD>${esc(b.description)}`);
  }
  lines.push('</DL><p>');
  return lines.join('\n');
}
