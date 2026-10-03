// Snapshot model (FR-032).
function nowIso() {
  return new Date().toISOString();
}

export function getSnapshot(db, bookmarkId) {
  return db.prepare('SELECT * FROM snapshot WHERE bookmark_id = ?').get(bookmarkId);
}

export function upsertSnapshot(db, bookmarkId, { kind, file_path, byte_size }) {
  const existing = getSnapshot(db, bookmarkId);
  if (existing) {
    db.prepare(
      'UPDATE snapshot SET kind = ?, file_path = ?, byte_size = ?, date_captured = ? WHERE bookmark_id = ?'
    ).run(kind, file_path, byte_size, nowIso(), bookmarkId);
  } else {
    db.prepare(
      'INSERT INTO snapshot (bookmark_id, kind, file_path, byte_size, date_captured) VALUES (?, ?, ?, ?, ?)'
    ).run(bookmarkId, kind, file_path, byte_size, nowIso());
  }
  return getSnapshot(db, bookmarkId);
}
