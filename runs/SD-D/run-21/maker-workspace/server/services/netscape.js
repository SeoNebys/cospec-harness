import * as cheerio from 'cheerio';

// Parse a Netscape bookmark file into { url, title, tags[] } entries.
// Folder (<H3>) names along the path become tags (FR-021).
export function parseNetscape(html) {
  const $ = cheerio.load(String(html || ''));
  const entries = [];

  // Walk each <DL>, tracking the folder name from the preceding <H3>.
  function walk(dl, folderTags) {
    dl.children('dt').each((_, dt) => {
      const $dt = $(dt);
      const h3 = $dt.children('h3').first();
      const a = $dt.children('a').first();
      if (h3.length) {
        const name = h3.text().trim();
        const childDl = $dt.children('dl').first();
        const nextTags = name ? [...folderTags, name] : folderTags;
        if (childDl.length) walk(childDl, nextTags);
      } else if (a.length) {
        const href = a.attr('href');
        if (href && /^https?:/i.test(href)) {
          entries.push({
            url: href.trim(),
            title: a.text().trim() || href.trim(),
            tags: [...folderTags],
          });
        }
      }
    });
    // Some exports nest the child <DL> as a sibling of <DT> rather than inside.
    dl.children('dl').each((_, childDl) => walk($(childDl), folderTags));
  }

  const root = $('dl').first();
  if (root.length) walk(root, []);
  return entries;
}

// Generate a standards-compliant Netscape bookmark file (FR-022).
export function generateNetscape(bookmarks) {
  const esc = (s) =>
    String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  const lines = [
    '<!DOCTYPE NETSCAPE-Bookmark-file-1>',
    '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">',
    '<TITLE>Bookmarks</TITLE>',
    '<H1>Bookmarks</H1>',
    '<DL><p>',
  ];
  for (const b of bookmarks) {
    const addDate = b.createdAt ? Math.floor(new Date(b.createdAt).getTime() / 1000) : '';
    const tagsAttr = b.tags && b.tags.length ? ` TAGS="${esc(b.tags.join(','))}"` : '';
    lines.push(
      `    <DT><A HREF="${esc(b.url)}"${addDate ? ` ADD_DATE="${addDate}"` : ''}${tagsAttr}>${esc(b.title)}</A>`
    );
  }
  lines.push('</DL><p>');
  return lines.join('\n') + '\n';
}
