import db from './db.js';
import { fetchMetadata, titleFromAddress } from './metadata.js';

// --- Address validation & normalization (FR-002, FR-015) ---

// Accept only well-formed http/https URLs.
export function validateAddress(address) {
  if (typeof address !== 'string' || address.trim() === '') return null;
  let u;
  try {
    u = new URL(address.trim());
  } catch {
    return null;
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
  return u.href;
}

// Normalize for duplicate detection: lowercase scheme+host, strip a single
// trailing slash from the path (FR-015).
export function normalizeKey(address) {
  const u = new URL(address);
  const scheme = u.protocol.toLowerCase();
  const host = u.host.toLowerCase();
  let path = u.pathname.replace(/\/$/, '');
  return `${scheme}//${host}${path}${u.search}`;
}

// --- Tags (FR-009) ---

function upsertTag(name) {
  const trimmed = name.trim();
  if (!trimmed) return null;
  // Case-insensitive reuse: name column is UNIQUE COLLATE NOCASE.
  const existing = db.prepare('SELECT id FROM tags WHERE name = ? COLLATE NOCASE').get(trimmed);
  if (existing) return existing.id;
  const info = db.prepare('INSERT INTO tags (name) VALUES (?)').run(trimmed);
  return info.lastInsertRowid;
}

function setTags(bookmarkId, names) {
  if (!Array.isArray(names)) return;
  const clean = [...new Set(names.map((n) => (n || '').trim()).filter(Boolean))];
  db.prepare('DELETE FROM bookmark_tags WHERE bookmark_id = ?').run(bookmarkId);
  const link = db.prepare('INSERT OR IGNORE INTO bookmark_tags (bookmark_id, tag_id) VALUES (?, ?)');
  for (const name of clean) {
    const tagId = upsertTag(name);
    if (tagId) link.run(bookmarkId, tagId);
  }
  pruneOrphanTags();
}

// Remove tags no longer attached to any bookmark (spec edge case).
function pruneOrphanTags() {
  db.prepare(
    'DELETE FROM tags WHERE id NOT IN (SELECT DISTINCT tag_id FROM bookmark_tags)'
  ).run();
}

function tagsFor(bookmarkId) {
  return db
    .prepare(
      `SELECT t.name FROM tags t
       JOIN bookmark_tags bt ON bt.tag_id = t.id
       WHERE bt.bookmark_id = ?
       ORDER BY t.name COLLATE NOCASE`
    )
    .all(bookmarkId)
    .map((r) => r.name);
}

// --- Serialization ---

function toApi(row) {
  if (!row) return null;
  return {
    id: row.id,
    address: row.address,
    title: row.title || '',
    description: row.description || '',
    iconUrl: row.icon_url || '',
    tags: tagsFor(row.id),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function getRow(id) {
  return db.prepare('SELECT * FROM bookmarks WHERE id = ?').get(id);
}

export function getBookmark(id) {
  return toApi(getRow(id));
}

// --- Metadata enrichment (non-blocking) ---

// Fetch metadata and update the record; failures leave the fallback in place.
async function enrich(id, address) {
  const meta = await fetchMetadata(address);
  const row = getRow(id);
  if (!row) return; // deleted meanwhile
  const title = meta.title || row.title;
  db.prepare(
    'UPDATE bookmarks SET title = ?, description = ?, icon_url = ? WHERE id = ?'
  ).run(title, meta.description || '', meta.iconUrl || '', id);
}

// --- Create (FR-001, FR-014) ---

// Returns { bookmark, existing } — existing:true when the address is already
// saved, in which case the existing bookmark is returned for update (FR-014).
export function createBookmark(address, tags) {
  const valid = validateAddress(address);
  if (!valid) return { error: 'Please enter a valid http or https web address.' };

  const key = normalizeKey(valid);
  const dupe = db.prepare('SELECT * FROM bookmarks WHERE normalized_key = ?').get(key);
  if (dupe) {
    return { bookmark: toApi(dupe), existing: true };
  }

  const now = new Date().toISOString();
  const info = db
    .prepare(
      `INSERT INTO bookmarks (address, normalized_key, title, description, icon_url, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(valid, key, titleFromAddress(valid), '', '', now, now);
  const id = info.lastInsertRowid;
  if (tags) setTags(id, tags);

  // Non-blocking enrichment (SC-001): do not await.
  enrich(id, valid).catch(() => {});

  return { bookmark: toApi(getRow(id)), existing: false };
}

// --- List / search / filter (FR-006, FR-010, FR-011) ---

export function listBookmarks({ search, tag } = {}) {
  let rows = db.prepare('SELECT * FROM bookmarks ORDER BY created_at DESC, id DESC').all();

  if (tag && tag.trim()) {
    const wanted = tag.trim().toLowerCase();
    rows = rows.filter((r) => tagsFor(r.id).some((t) => t.toLowerCase() === wanted));
  }

  if (search && search.trim()) {
    const term = search.trim().toLowerCase();
    rows = rows.filter((r) => {
      const hay = [
        r.title || '',
        r.description || '',
        r.address || '',
        ...tagsFor(r.id),
      ]
        .join(' ')
        .toLowerCase();
      return hay.includes(term);
    });
  }

  return rows.map(toApi);
}

export function listTags() {
  return db
    .prepare(
      `SELECT DISTINCT t.name FROM tags t
       JOIN bookmark_tags bt ON bt.tag_id = t.id
       ORDER BY t.name COLLATE NOCASE`
    )
    .all()
    .map((r) => r.name);
}

// --- Update (FR-012) ---

export function updateBookmark(id, { address, title, description, tags } = {}) {
  const row = getRow(id);
  if (!row) return { notFound: true };

  let newAddress = row.address;
  let newKey = row.normalized_key;
  if (address !== undefined) {
    const valid = validateAddress(address);
    if (!valid) return { error: 'Please enter a valid http or https web address.' };
    newKey = normalizeKey(valid);
    const conflict = db
      .prepare('SELECT id FROM bookmarks WHERE normalized_key = ? AND id != ?')
      .get(newKey, id);
    if (conflict) return { conflict: true, existingId: conflict.id };
    newAddress = valid;
  }

  const newTitle = title !== undefined ? title : row.title;
  const newDesc = description !== undefined ? description : row.description;
  const now = new Date().toISOString();

  db.prepare(
    `UPDATE bookmarks SET address = ?, normalized_key = ?, title = ?, description = ?, updated_at = ?
     WHERE id = ?`
  ).run(newAddress, newKey, newTitle, newDesc, now, id);

  if (tags !== undefined) setTags(id, tags);

  return { bookmark: toApi(getRow(id)) };
}

// --- Delete (FR-013) ---

export function deleteBookmark(id) {
  const row = getRow(id);
  if (!row) return { notFound: true };
  db.prepare('DELETE FROM bookmarks WHERE id = ?').run(id);
  pruneOrphanTags();
  return { ok: true };
}
