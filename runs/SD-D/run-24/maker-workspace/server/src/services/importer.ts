import type Database from 'better-sqlite3';
import { parse } from 'node-html-parser';
import { getDb } from '../db/connection';
import { isValidWebUrl, normalizeUrl } from './normalizeUrl';
import { create, getRawByNormalized } from '../models/bookmarks';
import { getBookmarkTags, setBookmarkTags } from '../models/tags';

export interface ImportResult {
  imported: number;
  merged: number;
  skippedInvalid: number;
}

interface ParsedEntry {
  url: string;
  title: string;
  tags: string[];
  savedAtIso: string;
}

export function parseNetscapeHtml(html: string): ParsedEntry[] {
  const root = parse(html);
  const anchors = root.querySelectorAll('a');
  const entries: ParsedEntry[] = [];
  for (const a of anchors) {
    const url = a.getAttribute('href') || a.getAttribute('HREF') || '';
    if (!url) continue;
    const addDate = a.getAttribute('add_date') || a.getAttribute('ADD_DATE');
    const tagsAttr = a.getAttribute('tags') || a.getAttribute('TAGS') || '';
    const tags = tagsAttr
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    const title = a.text.trim() || url;
    const savedAtIso = addDate
      ? new Date(Number(addDate) * 1000).toISOString()
      : new Date().toISOString();
    entries.push({ url, title, tags, savedAtIso });
  }
  return entries;
}

/**
 * Import entries, merging non-destructively into existing bookmarks by
 * normalized URL: union tags, keep the earliest saved date, preserve existing
 * title/description/note, fill only empty fields.
 */
export function importBookmarksHtml(html: string, db: Database.Database = getDb()): ImportResult {
  const entries = parseNetscapeHtml(html);
  const result: ImportResult = { imported: 0, merged: 0, skippedInvalid: 0 };

  const tx = db.transaction(() => {
    for (const entry of entries) {
      if (!isValidWebUrl(entry.url)) {
        result.skippedInvalid++;
        continue;
      }
      const normalized = normalizeUrl(entry.url);
      const existing = getRawByNormalized(normalized, db);

      if (!existing) {
        create(
          {
            url: entry.url,
            title: entry.title,
            tags: entry.tags,
            saved_at: entry.savedAtIso,
          },
          db
        );
        result.imported++;
        continue;
      }

      // Non-destructive merge.
      const currentTags = getBookmarkTags(existing.id, db);
      const unionTags = [...new Set([...currentTags, ...entry.tags])];
      setBookmarkTags(existing.id, unionTags, db);

      const earliest =
        new Date(entry.savedAtIso) < new Date(existing.saved_at)
          ? entry.savedAtIso
          : existing.saved_at;

      // Fill only empty fields; preserve existing title/description/note.
      const newTitle = existing.title?.trim() ? existing.title : entry.title;
      db.prepare('UPDATE bookmarks SET title = ?, saved_at = ? WHERE id = ?').run(
        newTitle,
        earliest,
        existing.id
      );
      result.merged++;
    }
  });
  tx();
  return result;
}
