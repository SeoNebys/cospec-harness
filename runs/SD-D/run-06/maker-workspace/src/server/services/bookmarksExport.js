import { getDb } from '../db/connection.js';
import { getTagsForBookmark } from '../db/tags.repo.js';

function escapeAttr(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}
function escapeText(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Emit a standard Netscape bookmark HTML file preserving title/tags/dates
// (FR-032). Other browsers/tools can import the result.
export function exportNetscape() {
  const rows = getDb()
    .prepare('SELECT * FROM bookmark ORDER BY date_added ASC')
    .all();

  const lines = [
    '<!DOCTYPE NETSCAPE-Bookmark-file-1>',
    '<!-- This is an automatically generated file. -->',
    '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">',
    '<TITLE>Bookmarks</TITLE>',
    '<H1>Bookmarks</H1>',
    '<DL><p>',
  ];

  for (const b of rows) {
    const addDate = Math.floor(new Date(b.date_added).getTime() / 1000);
    const tags = getTagsForBookmark(b.id);
    const tagsAttr = tags.length ? ` TAGS="${escapeAttr(tags.join(','))}"` : '';
    lines.push(
      `    <DT><A HREF="${escapeAttr(b.url)}" ADD_DATE="${addDate}"${tagsAttr}>${escapeText(b.title)}</A>`
    );
  }

  lines.push('</DL><p>');
  return lines.join('\n') + '\n';
}
