// Bookmark model (data-model.md).
import { normalizeUrl } from '../services/url.js';
import { setBookmarkTags, getBookmarkTagNames } from './tag.js';

function nowIso() {
  return new Date().toISOString();
}

export function serialize(db, row) {
  if (!row) return null;
  const snap = db.prepare('SELECT kind FROM snapshot WHERE bookmark_id = ?').get(row.id);
  return {
    id: row.id,
    url: row.url,
    title: row.title,
    description: row.description,
    favicon: row.favicon_path || row.favicon_url ? `/api/bookmarks/${row.id}/favicon` : null,
    preview: row.preview_path || row.preview_url ? `/api/bookmarks/${row.id}/preview` : null,
    note_md: row.note_md || '',
    read_state: row.read_state,
    archived: !!row.archived,
    metadata_status: row.metadata_status,
    tags: getBookmarkTagNames(db, row.id),
    internet_archive_url: row.internet_archive_url || null,
    snapshot: snap ? { kind: snap.kind, url: `/api/bookmarks/${row.id}/snapshot` } : null,
    date_added: row.date_added,
    date_updated: row.date_updated,
  };
}

export function getRow(db, id) {
  return db.prepare('SELECT * FROM bookmark WHERE id = ?').get(id);
}

export function getByUrlKey(db, urlKey) {
  return db.prepare('SELECT * FROM bookmark WHERE url_key = ?').get(urlKey);
}

// Create a bookmark. Returns { row, duplicate }.
export function createBookmark(db, { url, title, description, tags, note_md }) {
  const { url: normUrl, urlKey } = normalizeUrl(url);
  const existing = getByUrlKey(db, urlKey);
  if (existing) {
    return { row: existing, duplicate: true };
  }
  const ts = nowIso();
  const titleUserSet = title != null && String(title).trim() !== '' ? 1 : 0;
  const descUserSet = description != null && String(description).trim() !== '' ? 1 : 0;
  const info = db
    .prepare(
      `INSERT INTO bookmark
       (url, url_key, title, title_user_set, description, description_user_set,
        note_md, read_state, archived, metadata_status, date_added, date_updated)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'unread', 0, 'pending', ?, ?)`
    )
    .run(
      normUrl,
      urlKey,
      titleUserSet ? String(title).trim() : normUrl,
      titleUserSet,
      descUserSet ? String(description).trim() : null,
      descUserSet,
      note_md != null ? String(note_md) : null,
      ts,
      ts
    );
  const id = info.lastInsertRowid;
  if (Array.isArray(tags)) setBookmarkTags(db, id, tags);
  return { row: getRow(db, id), duplicate: false };
}

// Apply asynchronously fetched metadata. CRITICAL SAFEGUARD (R13, FR-004):
// only fill title/description for fields the user has NOT customized, using a
// conditional UPDATE guarded on *_user_set, so a late fetch never overwrites
// user input — even input entered while the fetch was in flight.
export function applyFetchedMetadata(db, id, meta) {
  const ts = nowIso();
  if (meta.title != null && String(meta.title).trim() !== '') {
    db.prepare(
      `UPDATE bookmark SET title = ? WHERE id = ? AND title_user_set = 0`
    ).run(String(meta.title).trim(), id);
  }
  if (meta.description != null && String(meta.description).trim() !== '') {
    db.prepare(
      `UPDATE bookmark SET description = ? WHERE id = ? AND description_user_set = 0`
    ).run(String(meta.description).trim(), id);
  }
  db.prepare(
    `UPDATE bookmark
     SET favicon_path = COALESCE(?, favicon_path),
         favicon_url = COALESCE(?, favicon_url),
         preview_path = COALESCE(?, preview_path),
         preview_url = COALESCE(?, preview_url),
         metadata_status = ?,
         date_updated = ?
     WHERE id = ?`
  ).run(
    meta.faviconPath ?? null,
    meta.faviconUrl ?? null,
    meta.previewPath ?? null,
    meta.previewUrl ?? null,
    meta.status || 'complete',
    ts,
    id
  );
  return getRow(db, id);
}

export function setMetadataStatus(db, id, status) {
  db.prepare('UPDATE bookmark SET metadata_status = ?, date_updated = ? WHERE id = ?').run(
    status,
    nowIso(),
    id
  );
}

// Edit a bookmark. Supplying title/description marks it user-set (safeguard).
export function updateBookmark(db, id, patch) {
  const row = getRow(db, id);
  if (!row) return null;
  const sets = [];
  const vals = [];

  if (patch.url !== undefined) {
    const { url: normUrl, urlKey } = normalizeUrl(patch.url);
    const clash = getByUrlKey(db, urlKey);
    if (clash && clash.id !== id) {
      const err = new Error('Another bookmark already uses that web address.');
      err.code = 'duplicate_url';
      err.existingId = clash.id;
      throw err;
    }
    sets.push('url = ?', 'url_key = ?');
    vals.push(normUrl, urlKey);
  }
  if (patch.title !== undefined) {
    sets.push('title = ?', 'title_user_set = 1');
    vals.push(String(patch.title));
  }
  if (patch.description !== undefined) {
    sets.push('description = ?', 'description_user_set = 1');
    vals.push(patch.description == null ? null : String(patch.description));
  }
  if (patch.note_md !== undefined) {
    sets.push('note_md = ?');
    vals.push(patch.note_md == null ? null : String(patch.note_md));
  }
  if (patch.read_state !== undefined) {
    if (!['unread', 'read'].includes(patch.read_state)) {
      const err = new Error('read_state must be "unread" or "read".');
      err.code = 'validation';
      throw err;
    }
    sets.push('read_state = ?');
    vals.push(patch.read_state);
  }
  if (patch.archived !== undefined) {
    sets.push('archived = ?');
    vals.push(patch.archived ? 1 : 0);
  }

  sets.push('date_updated = ?');
  vals.push(nowIso());
  vals.push(id);
  db.prepare(`UPDATE bookmark SET ${sets.join(', ')} WHERE id = ?`).run(...vals);

  if (patch.tags !== undefined) setBookmarkTags(db, id, patch.tags);
  return getRow(db, id);
}

export function deleteBookmark(db, id) {
  const info = db.prepare('DELETE FROM bookmark WHERE id = ?').run(id);
  // Orphan tags are pruned lazily by tag operations; prune here too.
  db.prepare('DELETE FROM tag WHERE id NOT IN (SELECT DISTINCT tag_id FROM bookmark_tag)').run();
  return info.changes > 0;
}
