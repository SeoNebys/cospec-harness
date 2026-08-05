import type { DB } from '../db.js';
import { deriveTitle, type Fetcher } from './title.js';
import { duplicate, invalidUrl, notFound } from './errors.js';
import { invalidUrlHint, isValidHttpUrl, normalizeUrl } from './url.js';

export interface Bookmark {
  id: number;
  url: string;
  title: string;
  description: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateInput {
  url: string;
  title?: string;
  description?: string;
  tags?: string[];
}

export interface ListOptions {
  q?: string;
  tag?: string;
  sort?: 'created_desc' | 'created_asc' | 'title_asc';
}

interface Deps {
  now: () => string;
  fetchImpl?: Fetcher;
}

const defaultDeps: Deps = { now: () => new Date().toISOString() };

// --- Create (FR-001, FR-002, FR-003, FR-004, FR-014) ---------------------------

export async function createBookmark(
  db: DB,
  input: CreateInput,
  deps: Deps = defaultDeps,
): Promise<Bookmark> {
  if (!isValidHttpUrl(input.url)) throw invalidUrl(invalidUrlHint);

  const url = input.url.trim();
  const normalized = normalizeUrl(url);

  const existing = findActiveByNormalized(db, normalized);
  if (existing) {
    throw duplicate('A bookmark for this address already exists.', existing);
  }

  const title = await deriveTitle(url, input.title, deps.fetchImpl);
  const ts = deps.now();

  const info = db
    .prepare(
      `INSERT INTO bookmarks (url, url_normalized, title, description, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(url, normalized, title, input.description?.trim() ?? '', ts, ts);

  const id = Number(info.lastInsertRowid);
  if (input.tags?.length) attachTags(db, id, input.tags);

  return getBookmark(db, id)!;
}

// --- List (FR-006) -------------------------------------------------------------

export function listBookmarks(db: DB, opts: ListOptions = {}): Bookmark[] {
  const order =
    opts.sort === 'created_asc'
      ? 'b.created_at ASC'
      : opts.sort === 'title_asc'
        ? 'b.title COLLATE NOCASE ASC'
        : 'b.created_at DESC';

  const where: string[] = ['b.deleted_at IS NULL'];
  const params: unknown[] = [];

  // Keyword search over title, address, and tag names (FR-007). A bookmark
  // matches if any of those contain the keyword (case-insensitive).
  const q = opts.q?.trim();
  if (q) {
    const like = `%${q.toLowerCase()}%`;
    where.push(`(
      lower(b.title) LIKE ?
      OR lower(b.url) LIKE ?
      OR EXISTS (
        SELECT 1 FROM bookmark_tags bt
        JOIN tags t ON t.id = bt.tag_id
        WHERE bt.bookmark_id = b.id AND lower(t.name) LIKE ?
      )
    )`);
    params.push(like, like, like);
  }

  // Tag filter: restrict to bookmarks carrying the named tag (FR-010).
  const tag = opts.tag?.trim();
  if (tag) {
    where.push(`EXISTS (
      SELECT 1 FROM bookmark_tags bt
      JOIN tags t ON t.id = bt.tag_id
      WHERE bt.bookmark_id = b.id AND lower(t.name) = lower(?)
    )`);
    params.push(tag);
  }

  const rows = db
    .prepare(
      `SELECT b.id FROM bookmarks b WHERE ${where.join(' AND ')} ORDER BY ${order}`,
    )
    .all(...params) as { id: number }[];

  return rows.map((r) => getBookmark(db, r.id)!);
}

// --- Update (partial) ----------------------------------------------------------

export interface UpdateInput {
  url?: string;
  title?: string;
  description?: string;
  tags?: string[];
}

// Applies a partial update: any of url, title, description, tags. A changed url
// is re-validated and re-checked for duplicates (excluding this bookmark). Bumps
// updated_at (FR-009, FR-011).
export function updateBookmark(
  db: DB,
  id: number,
  input: UpdateInput,
  deps: Deps = defaultDeps,
): Bookmark {
  const current = db
    .prepare(
      `SELECT id, url_normalized FROM bookmarks WHERE id = ? AND deleted_at IS NULL`,
    )
    .get(id) as { id: number; url_normalized: string } | undefined;
  if (!current) throw notFound();

  const sets: string[] = [];
  const params: unknown[] = [];

  if (input.url !== undefined) {
    if (!isValidHttpUrl(input.url)) throw invalidUrl(invalidUrlHint);
    const url = input.url.trim();
    const normalized = normalizeUrl(url);
    if (normalized !== current.url_normalized) {
      const clash = findActiveByNormalized(db, normalized);
      if (clash && clash.id !== id) {
        throw duplicate('A bookmark for this address already exists.', clash);
      }
    }
    sets.push('url = ?', 'url_normalized = ?');
    params.push(url, normalized);
  }
  if (input.title !== undefined) {
    const title = input.title.trim();
    if (title) {
      sets.push('title = ?');
      params.push(title);
    }
  }
  if (input.description !== undefined) {
    sets.push('description = ?');
    params.push(input.description.trim());
  }

  const tx = db.transaction(() => {
    if (input.tags) {
      db.prepare(`DELETE FROM bookmark_tags WHERE bookmark_id = ?`).run(id);
      attachTags(db, id, input.tags);
    }
    sets.push('updated_at = ?');
    params.push(deps.now());
    db.prepare(`UPDATE bookmarks SET ${sets.join(', ')} WHERE id = ?`).run(
      ...params,
      id,
    );
  });
  tx();

  return getBookmark(db, id)!;
}

// --- Soft delete + undo (FR-012, FR-013) ---------------------------------------

export interface DeleteResult {
  id: number;
  undoToken: string;
}

// Soft-deletes an active bookmark so it drops out of lists/search/filter but can
// be restored. Returns an undo token for the immediate undo affordance.
export function deleteBookmark(
  db: DB,
  id: number,
  deps: Deps = defaultDeps,
): DeleteResult {
  const info = db
    .prepare(
      `UPDATE bookmarks SET deleted_at = ? WHERE id = ? AND deleted_at IS NULL`,
    )
    .run(deps.now(), id);
  if (info.changes === 0) throw notFound();
  return { id, undoToken: `undo-${id}-${deps.now()}` };
}

// Restores a soft-deleted bookmark with its tags intact. Fails with 404 if it
// was never deleted, or 409 if its address is now taken by an active bookmark
// (e.g. the same address was saved again while this one was deleted).
export function restoreBookmark(db: DB, id: number): Bookmark {
  const row = db
    .prepare(
      `SELECT url_normalized FROM bookmarks WHERE id = ? AND deleted_at IS NOT NULL`,
    )
    .get(id) as { url_normalized: string } | undefined;
  if (!row) throw notFound('Bookmark is not restorable');

  const clash = findActiveByNormalized(db, row.url_normalized);
  if (clash) {
    throw duplicate('A bookmark for this address already exists.', clash);
  }

  db.prepare(`UPDATE bookmarks SET deleted_at = NULL WHERE id = ?`).run(id);
  return getBookmark(db, id)!;
}

// --- Single fetch --------------------------------------------------------------

export function getBookmark(db: DB, id: number): Bookmark | null {
  const row = db
    .prepare(
      `SELECT id, url, title, description, created_at, updated_at
       FROM bookmarks WHERE id = ? AND deleted_at IS NULL`,
    )
    .get(id) as
    | {
        id: number;
        url: string;
        title: string;
        description: string;
        created_at: string;
        updated_at: string;
      }
    | undefined;
  if (!row) return null;

  return {
    id: row.id,
    url: row.url,
    title: row.title,
    description: row.description,
    tags: tagsFor(db, row.id),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// --- Helpers -------------------------------------------------------------------

function findActiveByNormalized(db: DB, normalized: string): Bookmark | null {
  const row = db
    .prepare(
      `SELECT id FROM bookmarks WHERE url_normalized = ? AND deleted_at IS NULL`,
    )
    .get(normalized) as { id: number } | undefined;
  return row ? getBookmark(db, row.id) : null;
}

function tagsFor(db: DB, bookmarkId: number): string[] {
  return (
    db
      .prepare(
        `SELECT t.name FROM tags t
         JOIN bookmark_tags bt ON bt.tag_id = t.id
         WHERE bt.bookmark_id = ? ORDER BY t.name COLLATE NOCASE`,
      )
      .all(bookmarkId) as { name: string }[]
  ).map((r) => r.name);
}

// Upserts each tag by case-insensitive name and links it to the bookmark.
export function attachTags(db: DB, bookmarkId: number, names: string[]): void {
  const insertTag = db.prepare(
    `INSERT INTO tags (name) VALUES (?)
     ON CONFLICT (lower(name)) DO NOTHING`,
  );
  const findTag = db.prepare(`SELECT id FROM tags WHERE lower(name) = lower(?)`);
  const link = db.prepare(
    `INSERT OR IGNORE INTO bookmark_tags (bookmark_id, tag_id) VALUES (?, ?)`,
  );
  for (const raw of names) {
    const name = raw.trim();
    if (!name) continue;
    insertTag.run(name);
    const { id } = findTag.get(name) as { id: number };
    link.run(bookmarkId, id);
  }
}
