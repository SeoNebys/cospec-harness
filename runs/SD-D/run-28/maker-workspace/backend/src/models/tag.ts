import type { DB } from '../db/db.ts';

/** Normalize a tag label: trimmed + lowercased. */
export function normalizeTag(name: string): string {
  return name.trim().toLowerCase();
}

/** Upsert a tag by name and return its id. */
export function upsertTag(db: DB, rawName: string): number | null {
  const name = normalizeTag(rawName);
  if (!name) return null;
  db.prepare('INSERT OR IGNORE INTO tag (name) VALUES (?)').run(name);
  const row = db.prepare('SELECT id FROM tag WHERE name = ?').get(name) as
    | { id: number }
    | undefined;
  return row ? row.id : null;
}

/** Replace the full set of tags on a bookmark. */
export function setBookmarkTags(db: DB, bookmarkId: string, tags: string[]): void {
  db.prepare('DELETE FROM bookmark_tag WHERE bookmark_id = ?').run(bookmarkId);
  const seen = new Set<number>();
  for (const raw of tags ?? []) {
    const id = upsertTag(db, raw);
    if (id == null || seen.has(id)) continue;
    seen.add(id);
    db.prepare(
      'INSERT OR IGNORE INTO bookmark_tag (bookmark_id, tag_id) VALUES (?, ?)',
    ).run(bookmarkId, id);
  }
}

export function getBookmarkTags(db: DB, bookmarkId: string): string[] {
  const rows = db
    .prepare(
      `SELECT t.name FROM tag t JOIN bookmark_tag bt ON bt.tag_id = t.id
       WHERE bt.bookmark_id = ? ORDER BY t.name`,
    )
    .all(bookmarkId) as { name: string }[];
  return rows.map((r) => r.name);
}

export interface TagCount {
  name: string;
  count: number;
}

/** List tags (optionally by prefix) with usage counts, for suggestions/filters. */
export function listTags(db: DB, prefix?: string): TagCount[] {
  const like = prefix ? `${normalizeTag(prefix)}%` : '%';
  return db
    .prepare(
      `SELECT t.name AS name, COUNT(bt.bookmark_id) AS count
       FROM tag t LEFT JOIN bookmark_tag bt ON bt.tag_id = t.id
       WHERE t.name LIKE ?
       GROUP BY t.id ORDER BY count DESC, t.name ASC`,
    )
    .all(like) as TagCount[];
}
