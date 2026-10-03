import { getDb } from '../db/index.js';
import { tagsForBookmark } from '../models/tag.js';

function escapeHtml(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Export the whole collection as a Netscape bookmark HTML file. */
export function exportNetscapeHtml() {
  const rows = getDb().prepare('SELECT * FROM bookmark ORDER BY date_added').all();
  const lines = [
    '<!DOCTYPE NETSCAPE-Bookmark-file-1>',
    '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">',
    '<TITLE>Bookmarks</TITLE>',
    '<H1>Bookmarks</H1>',
    '<DL><p>',
  ];
  for (const row of rows) {
    const addDate = Math.floor(new Date(row.date_added).getTime() / 1000);
    const tags = tagsForBookmark(row.id);
    const tagsAttr = tags.length ? ` TAGS="${escapeHtml(tags.join(','))}"` : '';
    lines.push(`    <DT><A HREF="${escapeHtml(row.url)}" ADD_DATE="${addDate}"${tagsAttr}>${escapeHtml(row.title)}</A>`);
    if (row.description) lines.push(`    <DD>${escapeHtml(row.description)}`);
  }
  lines.push('</DL><p>');
  return lines.join('\n') + '\n';
}
