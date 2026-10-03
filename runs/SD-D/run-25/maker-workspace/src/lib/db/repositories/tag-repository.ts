import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import { normalizeTagName } from "@/features/bookmarks/validation";

export function replaceBookmarkTags(sqlite: Database.Database, userId: string, bookmarkId: string, names: string[]): void {
  const unique = new Map(names.map((name) => { const normalized = normalizeTagName(name); return [normalized.normalizedName, normalized] as const; }));
  sqlite.prepare("DELETE FROM bookmark_tags WHERE bookmark_id = ?").run(bookmarkId);
  const get = sqlite.prepare("SELECT id FROM tags WHERE user_id = ? AND normalized_name = ?");
  const insert = sqlite.prepare("INSERT INTO tags (id, user_id, display_name, normalized_name, created_at) VALUES (?, ?, ?, ?, ?)");
  const link = sqlite.prepare("INSERT OR IGNORE INTO bookmark_tags (bookmark_id, tag_id) VALUES (?, ?)");
  for (const tag of unique.values()) {
    let row = get.get(userId, tag.normalizedName) as { id: string } | undefined;
    if (!row) {
      row = { id: randomUUID() };
      insert.run(row.id, userId, tag.displayName, tag.normalizedName, Date.now());
    }
    link.run(bookmarkId, row.id);
  }
  sqlite.prepare("DELETE FROM tags WHERE user_id = ? AND NOT EXISTS (SELECT 1 FROM bookmark_tags WHERE tag_id = tags.id)").run(userId);
}

export function listTags(sqlite: Database.Database, userId: string) {
  return sqlite.prepare(`
    SELECT t.display_name AS name, t.normalized_name AS normalizedName,
      SUM(CASE WHEN b.archived_at IS NULL THEN 1 ELSE 0 END) AS activeCount,
      SUM(CASE WHEN b.archived_at IS NOT NULL THEN 1 ELSE 0 END) AS archivedCount
    FROM tags t
    JOIN bookmark_tags bt ON bt.tag_id = t.id
    JOIN bookmarks b ON b.id = bt.bookmark_id AND b.user_id = t.user_id
    WHERE t.user_id = ?
    GROUP BY t.id ORDER BY t.display_name COLLATE NOCASE
  `).all(userId);
}
