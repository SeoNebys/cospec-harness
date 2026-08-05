import type { DB } from '../db.js';
import { notFound } from './errors.js';

export interface TagSummary {
  id: number;
  name: string;
  count: number;
}

// Lists all tags with a count of active (non-deleted) bookmarks carrying each,
// which drives the tag-filter control (FR-010).
export function listTags(db: DB): TagSummary[] {
  return db
    .prepare(
      `SELECT t.id, t.name,
              COUNT(b.id) AS count
       FROM tags t
       LEFT JOIN bookmark_tags bt ON bt.tag_id = t.id
       LEFT JOIN bookmarks b ON b.id = bt.bookmark_id AND b.deleted_at IS NULL
       GROUP BY t.id, t.name
       ORDER BY t.name COLLATE NOCASE`,
    )
    .all() as TagSummary[];
}

// Renames a tag, propagating to every bookmark carrying it. If the new name
// already exists (case-insensitive), the two tags are merged (FR-009).
export function renameTag(db: DB, id: number, rawName: string): void {
  const name = rawName.trim();
  if (!name) throw notFound('Tag name cannot be empty');

  const tag = db.prepare(`SELECT id FROM tags WHERE id = ?`).get(id) as
    | { id: number }
    | undefined;
  if (!tag) throw notFound('Tag not found');

  const existing = db
    .prepare(`SELECT id FROM tags WHERE lower(name) = lower(?) AND id != ?`)
    .get(name, id) as { id: number } | undefined;

  const tx = db.transaction(() => {
    if (existing) {
      // Merge: repoint this tag's links to the existing tag (ignoring dup pairs),
      // then delete this now-empty tag.
      db.prepare(
        `INSERT OR IGNORE INTO bookmark_tags (bookmark_id, tag_id)
         SELECT bookmark_id, ? FROM bookmark_tags WHERE tag_id = ?`,
      ).run(existing.id, id);
      db.prepare(`DELETE FROM bookmark_tags WHERE tag_id = ?`).run(id);
      db.prepare(`DELETE FROM tags WHERE id = ?`).run(id);
    } else {
      db.prepare(`UPDATE tags SET name = ? WHERE id = ?`).run(name, id);
    }
  });
  tx();
}

// Removes a tag from all bookmarks that carry it (FR-009). The ON DELETE CASCADE
// on bookmark_tags clears the links.
export function removeTag(db: DB, id: number): void {
  const info = db.prepare(`DELETE FROM tags WHERE id = ?`).run(id);
  if (info.changes === 0) throw notFound('Tag not found');
}
