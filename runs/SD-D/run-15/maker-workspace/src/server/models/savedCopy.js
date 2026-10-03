// T052 [US11]: Saved-copy data-access.
import db from '../db/connection.js';

export function create({ bookmark_id, kind, location }) {
  const info = db
    .prepare(
      `INSERT INTO saved_copies (bookmark_id, kind, location, created_at)
       VALUES (?, ?, ?, ?)`
    )
    .run(bookmark_id, kind, location, new Date().toISOString());
  return get(info.lastInsertRowid);
}

export function get(id) {
  return db.prepare('SELECT * FROM saved_copies WHERE id = ?').get(id) || null;
}

export function listForBookmark(bookmarkId) {
  return db
    .prepare('SELECT * FROM saved_copies WHERE bookmark_id = ? ORDER BY created_at DESC, id DESC')
    .all(bookmarkId);
}

/** Remove an existing copy of the same kind (so re-snapshotting replaces it). */
export function removeKind(bookmarkId, kind) {
  return db.prepare('DELETE FROM saved_copies WHERE bookmark_id = ? AND kind = ?').run(bookmarkId, kind).changes;
}
