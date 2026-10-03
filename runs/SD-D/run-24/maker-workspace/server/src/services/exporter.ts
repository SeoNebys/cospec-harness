import type Database from 'better-sqlite3';
import { getDb } from '../db/connection';
import { getBookmarkTags } from '../models/tags';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Export all bookmarks to Netscape bookmark HTML with the TAGS attribute. */
export function exportBookmarksHtml(db: Database.Database = getDb()): string {
  const rows = db
    .prepare('SELECT id, url, title, saved_at FROM bookmarks ORDER BY saved_at ASC')
    .all() as { id: number; url: string; title: string; saved_at: string }[];

  const lines: string[] = [
    '<!DOCTYPE NETSCAPE-Bookmark-file-1>',
    '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">',
    '<TITLE>Bookmarks</TITLE>',
    '<H1>Bookmarks</H1>',
    '<DL><p>',
  ];

  for (const row of rows) {
    const tags = getBookmarkTags(row.id, db);
    const addDate = Math.floor(new Date(row.saved_at).getTime() / 1000);
    const tagsAttr = tags.length ? ` TAGS="${escapeHtml(tags.join(','))}"` : '';
    lines.push(
      `  <DT><A HREF="${escapeHtml(row.url)}" ADD_DATE="${addDate}"${tagsAttr}>${escapeHtml(
        row.title
      )}</A>`
    );
  }

  lines.push('</DL><p>', '');
  return lines.join('\n');
}
