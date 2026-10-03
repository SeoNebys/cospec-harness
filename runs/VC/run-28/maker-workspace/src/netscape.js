import * as cheerio from 'cheerio';

// Parse a Netscape bookmark file (the format all browsers export/import).
// Folder names on the path become tags. Returns an array of import items.
export function parseNetscape(html) {
  const $ = cheerio.load(html);
  const items = [];
  $('a').each((_, el) => {
    const a = $(el);
    const url = a.attr('href');
    if (!url || /^(place:|javascript:)/i.test(url)) return;

    // Folder path = every <h3> that precedes this link's <dl> ancestors.
    const folders = [];
    a.parentsUntil('body', 'dl').each((_, dl) => {
      const h3 = $(dl).prevAll('h3').first().text().trim();
      if (h3) folders.push(h3);
    });

    const tagAttr = (a.attr('tags') || '').split(',').map((s) => s.trim()).filter(Boolean);
    const tags = [...new Set([...folders, ...tagAttr])];

    const addDate = a.attr('add_date');
    let created_at;
    if (addDate && /^\d+$/.test(addDate)) {
      created_at = new Date(parseInt(addDate, 10) * 1000).toISOString();
    }

    items.push({
      url,
      title: a.text().trim(),
      tags,
      created_at,
    });
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

// Generate a Netscape bookmark file from export data.
export function toNetscape(exportData) {
  const lines = [
    '<!DOCTYPE NETSCAPE-Bookmark-file-1>',
    '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">',
    '<TITLE>Bookmarks</TITLE>',
    '<H1>Bookmarks</H1>',
    '<DL><p>',
  ];
  for (const b of exportData.bookmarks) {
    const date = b.created_at ? Math.floor(new Date(b.created_at).getTime() / 1000) : '';
    const tags = (b.tags || []).join(',');
    lines.push(
      `    <DT><A HREF="${esc(b.url)}"${date ? ` ADD_DATE="${date}"` : ''}` +
        `${tags ? ` TAGS="${esc(tags)}"` : ''}>${esc(b.title || b.url)}</A>`
    );
    if (b.description) lines.push(`    <DD>${esc(b.description)}`);
  }
  lines.push('</DL><p>');
  return lines.join('\n');
}
