/**
 * Tag model. Tags are unique case-insensitively (FR-018 reuse) and linked to
 * bookmarks many-to-many.
 */
import type Database from 'better-sqlite3';

function normalizeTagName(name: string): string {
  return name.trim();
}

export function tagsForBookmark(db: Database.Database, bookmarkId: number): string[] {
  const rows = db
    .prepare(
      `SELECT t.name FROM tags t
       JOIN bookmark_tags bt ON bt.tag_id = t.id
       WHERE bt.bookmark_id = ?
       ORDER BY t.name COLLATE NOCASE`
    )
    .all(bookmarkId) as { name: string }[];
  return rows.map((r) => r.name);
}

function upsertTag(db: Database.Database, name: string): number {
  db.prepare(`INSERT OR IGNORE INTO tags (name) VALUES (?)`).run(name);
  const row = db.prepare(`SELECT id FROM tags WHERE name = ? COLLATE NOCASE`).get(name) as
    | { id: number }
    | undefined;
  return row!.id;
}

/** Replace a bookmark's tags with exactly the given set. */
export function setTags(db: Database.Database, bookmarkId: number, names: string[]): void {
  const clean = [...new Set(names.map(normalizeTagName).filter(Boolean))];
  db.prepare(`DELETE FROM bookmark_tags WHERE bookmark_id = ?`).run(bookmarkId);
  const link = db.prepare(`INSERT OR IGNORE INTO bookmark_tags (bookmark_id, tag_id) VALUES (?, ?)`);
  for (const name of clean) link.run(bookmarkId, upsertTag(db, name));
  cleanupOrphans(db);
}

export function addTag(db: Database.Database, bookmarkId: number, name: string): void {
  const clean = normalizeTagName(name);
  if (!clean) return;
  db.prepare(`INSERT OR IGNORE INTO bookmark_tags (bookmark_id, tag_id) VALUES (?, ?)`).run(
    bookmarkId,
    upsertTag(db, clean)
  );
}

export function removeTag(db: Database.Database, bookmarkId: number, name: string): void {
  db.prepare(
    `DELETE FROM bookmark_tags
     WHERE bookmark_id = ? AND tag_id = (SELECT id FROM tags WHERE name = ? COLLATE NOCASE)`
  ).run(bookmarkId, normalizeTagName(name));
  cleanupOrphans(db);
}

/** Suggestions while typing (FR-018): existing tags matching a prefix. */
export function suggestTags(db: Database.Database, prefix: string, limit = 10): string[] {
  const rows = db
    .prepare(
      `SELECT name FROM tags WHERE name LIKE ? COLLATE NOCASE ORDER BY name COLLATE NOCASE LIMIT ?`
    )
    .all(`${prefix.replace(/[%_]/g, '')}%`, limit) as { name: string }[];
  return rows.map((r) => r.name);
}

function cleanupOrphans(db: Database.Database): void {
  db.exec(`DELETE FROM tags WHERE id NOT IN (SELECT DISTINCT tag_id FROM bookmark_tags)`);
}
