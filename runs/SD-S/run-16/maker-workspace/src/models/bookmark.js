import { getDb } from '../db.js';

// Data access for bookmarks + tags (data-model.md).

function db() {
  return getDb();
}

// --- Tag helpers ---------------------------------------------------------

function upsertTag(name) {
  const trimmed = String(name).trim();
  if (!trimmed) return null;
  db().prepare('INSERT OR IGNORE INTO tags(name) VALUES (?)').run(trimmed);
  const row = db()
    .prepare('SELECT id FROM tags WHERE name = ? COLLATE NOCASE')
    .get(trimmed);
  return row ? row.id : null;
}

function setTags(bookmarkId, tags) {
  db().prepare('DELETE FROM bookmark_tags WHERE bookmark_id = ?').run(bookmarkId);
  if (!Array.isArray(tags)) return;
  const link = db().prepare(
    'INSERT OR IGNORE INTO bookmark_tags(bookmark_id, tag_id) VALUES (?, ?)'
  );
  const seen = new Set();
  for (const name of tags) {
    const clean = String(name).trim();
    if (!clean || seen.has(clean.toLowerCase())) continue;
    seen.add(clean.toLowerCase());
    const tagId = upsertTag(clean);
    if (tagId) link.run(bookmarkId, tagId);
  }
}

function tagsFor(bookmarkId) {
  return db()
    .prepare(
      `SELECT t.name FROM tags t
       JOIN bookmark_tags bt ON bt.tag_id = t.id
       WHERE bt.bookmark_id = ?
       ORDER BY t.name COLLATE NOCASE`
    )
    .all(bookmarkId)
    .map((r) => r.name);
}

// --- Serialization -------------------------------------------------------

function serialize(row) {
  if (!row) return null;
  return {
    id: row.id,
    url: row.url,
    title: row.title,
    description: row.description,
    faviconUrl: row.favicon_url,
    previewImageUrl: row.preview_image_url,
    notes: row.notes,
    tags: tagsFor(row.id),
    enrichmentStatus: row.enrichment_status,
    dateSaved: row.date_saved,
  };
}

// --- CRUD ----------------------------------------------------------------

export function create({ url, normalizedUrl, title, notes, tags }) {
  const now = new Date().toISOString();
  const info = db()
    .prepare(
      `INSERT INTO bookmarks
        (url, normalized_url, title, description, favicon_url, preview_image_url,
         notes, enrichment_status, date_saved)
       VALUES (?, ?, ?, NULL, NULL, NULL, ?, 'pending', ?)`
    )
    .run(url, normalizedUrl, title, notes ?? null, now);
  setTags(info.lastInsertRowid, tags);
  return getById(info.lastInsertRowid);
}

export function getById(id) {
  const row = db().prepare('SELECT * FROM bookmarks WHERE id = ?').get(id);
  return serialize(row);
}

export function findByNormalizedUrl(normalizedUrl) {
  const row = db()
    .prepare('SELECT * FROM bookmarks WHERE normalized_url = ?')
    .get(normalizedUrl);
  return serialize(row);
}

export function list({ q, tag } = {}) {
  const clauses = [];
  const params = [];

  if (q && String(q).trim() !== '') {
    const like = `%${String(q).trim().toLowerCase()}%`;
    clauses.push(
      `(LOWER(b.title) LIKE ? OR LOWER(b.url) LIKE ? OR LOWER(b.description) LIKE ?)`
    );
    params.push(like, like, like);
  }

  if (tag && String(tag).trim() !== '') {
    clauses.push(
      `b.id IN (
         SELECT bt.bookmark_id FROM bookmark_tags bt
         JOIN tags t ON t.id = bt.tag_id
         WHERE t.name = ? COLLATE NOCASE
       )`
    );
    params.push(String(tag).trim());
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const rows = db()
    .prepare(`SELECT * FROM bookmarks b ${where} ORDER BY b.date_saved DESC, b.id DESC`)
    .all(...params);
  return rows.map(serialize);
}

export function listTags() {
  return db()
    .prepare('SELECT name FROM tags ORDER BY name COLLATE NOCASE')
    .all()
    .map((r) => r.name);
}

// Update metadata from background enrichment. Only overwrite the title if the
// user has not customized it (i.e. it still equals the URL-derived default).
export function updateEnrichment(id, { title, description, faviconUrl, previewImageUrl, status, defaultTitle }) {
  const current = db().prepare('SELECT title FROM bookmarks WHERE id = ?').get(id);
  if (!current) return null;

  const keepTitle =
    defaultTitle !== undefined && current.title !== defaultTitle
      ? current.title // user edited it — leave alone
      : title ?? current.title;

  db()
    .prepare(
      `UPDATE bookmarks
       SET title = ?, description = ?, favicon_url = ?, preview_image_url = ?, enrichment_status = ?
       WHERE id = ?`
    )
    .run(
      keepTitle,
      description ?? null,
      faviconUrl ?? null,
      previewImageUrl ?? null,
      status,
      id
    );
  return getById(id);
}

// Full user edit (FR-009). Returns { changedUrl } so callers can re-enrich.
export function update(id, { url, normalizedUrl, title, description, notes, tags }) {
  const existing = db().prepare('SELECT * FROM bookmarks WHERE id = ?').get(id);
  if (!existing) return null;

  const urlChanged = normalizedUrl !== undefined && normalizedUrl !== existing.normalized_url;

  db()
    .prepare(
      `UPDATE bookmarks
       SET url = ?, normalized_url = ?, title = ?, description = ?, notes = ?,
           enrichment_status = ?
       WHERE id = ?`
    )
    .run(
      url ?? existing.url,
      normalizedUrl ?? existing.normalized_url,
      title !== undefined ? title : existing.title,
      description !== undefined ? description : existing.description,
      notes !== undefined ? notes : existing.notes,
      urlChanged ? 'pending' : existing.enrichment_status,
      id
    );

  if (tags !== undefined) setTags(id, tags);
  return { bookmark: getById(id), changedUrl: urlChanged };
}

export function remove(id) {
  const info = db().prepare('DELETE FROM bookmarks WHERE id = ?').run(id);
  return info.changes > 0;
}
