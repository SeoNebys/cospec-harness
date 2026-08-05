import type { DB } from './connection';
import type { Bookmark, CreateBookmarkInput, EnrichStatus, TagFilter } from '../../shared/types';
import { normalizeAndKey } from '../services/url';
import { buildListQuery } from '../services/search';
import { renderNotes } from '../services/notes';

// Data-access layer. For the US1 MVP this covers: create, get-by-id, a simple
// newest-first list, and enrichment updates. Search/filter/batch/edit land in
// later stories (queries extended in US2/US3).

interface BookmarkRow {
  id: number;
  url: string;
  title: string;
  description: string;
  notes: string;
  icon_url: string | null;
  image_url: string | null;
  read_later: number;
  archived: number;
  enrich_status: string;
  created_at: string;
  updated_at: string;
}

function nowIso(): string {
  return new Date().toISOString();
}

function normalizeTag(name: string): string {
  return name.trim().toLowerCase();
}

/** Map a DB row (+ its tags) to the API/domain shape. */
function rowToBookmark(db: DB, row: BookmarkRow): Bookmark {
  const tags = db
    .prepare(
      `SELECT t.name FROM tags t
       JOIN bookmark_tags bt ON bt.tag_id = t.id
       WHERE bt.bookmark_id = ? ORDER BY t.name`
    )
    .all(row.id)
    .map((r) => (r as { name: string }).name);
  return {
    id: row.id,
    url: row.url,
    title: row.title,
    description: row.description,
    notes: row.notes,
    notesHtml: renderNotes(row.notes),
    iconUrl: row.icon_url,
    imageUrl: row.image_url,
    tags,
    readLater: row.read_later === 1,
    archived: row.archived === 1,
    enrichStatus: row.enrich_status as EnrichStatus,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function syncFts(db: DB, b: Bookmark): void {
  db.prepare('DELETE FROM bookmarks_fts WHERE rowid = ?').run(b.id);
  db.prepare(
    `INSERT INTO bookmarks_fts (rowid, title, url, description, notes, tags)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(b.id, b.title, b.url, b.description, b.notes, b.tags.join(' '));
}

/** Attach tags (creating any that don't exist) to a bookmark. */
function setTags(db: DB, bookmarkId: number, tags: string[]): void {
  const names = [...new Set(tags.map(normalizeTag).filter(Boolean))];
  db.prepare('DELETE FROM bookmark_tags WHERE bookmark_id = ?').run(bookmarkId);
  const insertTag = db.prepare('INSERT OR IGNORE INTO tags (name) VALUES (?)');
  const findTag = db.prepare('SELECT id FROM tags WHERE name = ?');
  const link = db.prepare(
    'INSERT OR IGNORE INTO bookmark_tags (bookmark_id, tag_id) VALUES (?, ?)'
  );
  for (const name of names) {
    insertTag.run(name);
    const tag = findTag.get(name) as { id: number };
    link.run(bookmarkId, tag.id);
  }
}

export function getById(db: DB, id: number): Bookmark | undefined {
  const row = db.prepare('SELECT * FROM bookmarks WHERE id = ?').get(id) as BookmarkRow | undefined;
  return row ? rowToBookmark(db, row) : undefined;
}

export function findByKey(db: DB, key: string): Bookmark | undefined {
  const row = db.prepare('SELECT * FROM bookmarks WHERE url_key = ?').get(key) as
    BookmarkRow | undefined;
  return row ? rowToBookmark(db, row) : undefined;
}

export interface CreateResult {
  bookmark: Bookmark;
  existing: boolean;
}

/**
 * Create a bookmark. If the normalized address already exists, returns that
 * existing bookmark with `existing: true` (FR-023) instead of inserting a copy.
 * A new bookmark starts as `pending` enrichment (FR-005) with a default title
 * derived from the address when none is supplied (FR-004).
 */
export function createBookmark(db: DB, input: CreateBookmarkInput): CreateResult {
  const { url, key } = normalizeAndKey(input.url);

  const existing = findByKey(db, key);
  if (existing) return { bookmark: existing, existing: true };

  const ts = nowIso();
  const title = (input.title ?? '').trim() || url; // default title (FR-004); page title may replace it during enrichment
  const description = (input.description ?? '').trim();
  const notes = input.notes ?? '';

  const tx = db.transaction(() => {
    const info = db
      .prepare(
        `INSERT INTO bookmarks (url, url_key, title, description, notes, enrich_status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)`
      )
      .run(url, key, title, description, notes, ts, ts);
    const id = Number(info.lastInsertRowid);
    setTags(db, id, input.tags ?? []);
    const bookmark = getById(db, id)!;
    syncFts(db, bookmark);
    return bookmark;
  });

  return { bookmark: tx(), existing: false };
}

/** Fields produced by the metadata fetch (all optional). */
export interface EnrichmentPatch {
  title?: string; // only applied if the user hadn't set a meaningful title
  description?: string;
  iconUrl?: string | null;
  imageUrl?: string | null;
}

/**
 * Apply best-effort metadata to a bookmark and mark enrichment done/failed.
 * Never overwrites a description the user already provided; fills the title only
 * when the current title is still the fallback (equal to the URL).
 */
export function applyEnrichment(
  db: DB,
  id: number,
  status: EnrichStatus,
  patch: EnrichmentPatch = {}
): Bookmark | undefined {
  const current = getById(db, id);
  if (!current) return undefined;

  const title = patch.title && current.title === current.url ? patch.title : current.title;
  const description = current.description || patch.description || '';
  const iconUrl = current.iconUrl ?? patch.iconUrl ?? null;
  const imageUrl = current.imageUrl ?? patch.imageUrl ?? null;

  db.prepare(
    `UPDATE bookmarks
     SET title = ?, description = ?, icon_url = ?, image_url = ?, enrich_status = ?, updated_at = ?
     WHERE id = ?`
  ).run(title, description, iconUrl, imageUrl, status, nowIso(), id);

  const updated = getById(db, id)!;
  syncFts(db, updated);
  return updated;
}

export interface UpdatePatch {
  url?: string;
  title?: string;
  description?: string;
  notes?: string;
  tags?: string[];
  readLater?: boolean;
  archived?: boolean;
}

export type UpdateResult =
  | { ok: true; bookmark: Bookmark }
  | { ok: false; reason: 'not_found' }
  | { ok: false; reason: 'duplicate_url'; existing: Bookmark };

/**
 * Update an existing bookmark (FR-003/FR-006/FR-013/FR-015/FR-016). Editing the
 * address re-normalizes it and, if it would collide with a *different* bookmark,
 * fails with `duplicate_url` rather than creating a collision (FR-023). Only
 * provided fields change; `updated_at` bumps.
 */
export function updateBookmark(db: DB, id: number, patch: UpdatePatch): UpdateResult {
  const current = getById(db, id);
  if (!current) return { ok: false, reason: 'not_found' };

  let url = current.url;
  let key: string | null = null;
  if (patch.url !== undefined) {
    const n = normalizeAndKey(patch.url); // throws InvalidUrlError on malformed input
    const collision = findByKey(db, n.key);
    if (collision && collision.id !== id) {
      return { ok: false, reason: 'duplicate_url', existing: collision };
    }
    url = n.url;
    key = n.key;
  }

  const title = patch.title !== undefined ? patch.title.trim() || url : current.title;
  const description = patch.description !== undefined ? patch.description : current.description;
  const notes = patch.notes !== undefined ? patch.notes : current.notes;
  const readLater =
    patch.readLater !== undefined ? (patch.readLater ? 1 : 0) : current.readLater ? 1 : 0;
  const archived =
    patch.archived !== undefined ? (patch.archived ? 1 : 0) : current.archived ? 1 : 0;

  const tx = db.transaction(() => {
    db.prepare(
      `UPDATE bookmarks
       SET url = ?, url_key = COALESCE(?, url_key), title = ?, description = ?, notes = ?,
           read_later = ?, archived = ?, updated_at = ?
       WHERE id = ?`
    ).run(url, key, title, description, notes, readLater, archived, nowIso(), id);
    if (patch.tags !== undefined) setTags(db, id, patch.tags);
    const updated = getById(db, id)!;
    syncFts(db, updated);
    return updated;
  });
  return { ok: true, bookmark: tx() };
}

/** Permanently delete a bookmark (FR-017). Cascades tags + FTS row. */
export function deleteBookmark(db: DB, id: number): boolean {
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM bookmarks_fts WHERE rowid = ?').run(id);
    const info = db.prepare('DELETE FROM bookmarks WHERE id = ?').run(id);
    return info.changes > 0;
  });
  return tx();
}

export type BatchAction = 'addTag' | 'archive' | 'unarchive' | 'delete';

/** Apply one action to many bookmarks in a single transaction (FR-019/FR-020). */
export function batchAction(
  db: DB,
  ids: number[],
  action: BatchAction,
  tag?: string
): { affected: number } {
  const tx = db.transaction(() => {
    let affected = 0;
    for (const id of ids) {
      const current = getById(db, id);
      if (!current) continue;
      if (action === 'delete') {
        if (deleteBookmark(db, id)) affected++;
      } else if (action === 'archive' || action === 'unarchive') {
        updateBookmark(db, id, { archived: action === 'archive' });
        affected++;
      } else if (action === 'addTag' && tag) {
        const next = [...new Set([...current.tags, tag.trim().toLowerCase()].filter(Boolean))];
        updateBookmark(db, id, { tags: next });
        affected++;
      }
    }
    return { affected };
  });
  return tx();
}

/** Newest-first list of non-archived bookmarks (MVP card view; FR-014 default). */
export function listRecent(db: DB): Bookmark[] {
  const rows = db
    .prepare('SELECT * FROM bookmarks WHERE archived = 0 ORDER BY created_at DESC, id DESC')
    .all() as BookmarkRow[];
  return rows.map((r) => rowToBookmark(db, r));
}

/** List bookmarks matching a full filter (text + tags + view + sort). US2. */
export function listBookmarks(db: DB, filter: TagFilter): Bookmark[] {
  const { sql, params } = buildListQuery(filter);
  const rows = db.prepare(sql).all(...params) as BookmarkRow[];
  return rows.map((r) => rowToBookmark(db, r));
}

// --- Saved searches (US5, FR-021) ---

import type { SavedSearch, TagFilter as _TagFilter } from '../../shared/types';

interface SavedRow {
  id: number;
  name: string;
  query_text: string;
  filter: string;
  created_at: string;
}

function rowToSaved(r: SavedRow): SavedSearch {
  let filter: _TagFilter = {};
  try {
    const v = JSON.parse(r.filter);
    if (v && typeof v === 'object') filter = v as _TagFilter;
  } catch {
    /* ignore malformed stored filter */
  }
  return { id: r.id, name: r.name, queryText: r.query_text, filter, createdAt: r.created_at };
}

export function listSavedSearches(db: DB): SavedSearch[] {
  return (db.prepare('SELECT * FROM saved_searches ORDER BY id ASC').all() as SavedRow[]).map(
    rowToSaved
  );
}

export function createSavedSearch(
  db: DB,
  input: { name: string; queryText?: string; filter: _TagFilter }
): SavedSearch {
  const info = db
    .prepare(
      'INSERT INTO saved_searches (name, query_text, filter, created_at) VALUES (?, ?, ?, ?)'
    )
    .run(input.name, input.queryText ?? '', JSON.stringify(input.filter ?? {}), nowIso());
  return rowToSaved(
    db
      .prepare('SELECT * FROM saved_searches WHERE id = ?')
      .get(Number(info.lastInsertRowid)) as SavedRow
  );
}

export function updateSavedSearch(
  db: DB,
  id: number,
  patch: { name?: string; queryText?: string; filter?: _TagFilter }
): SavedSearch | undefined {
  const current = db.prepare('SELECT * FROM saved_searches WHERE id = ?').get(id) as
    SavedRow | undefined;
  if (!current) return undefined;
  const name = patch.name ?? current.name;
  const queryText = patch.queryText ?? current.query_text;
  const filter = patch.filter !== undefined ? JSON.stringify(patch.filter) : current.filter;
  db.prepare('UPDATE saved_searches SET name = ?, query_text = ?, filter = ? WHERE id = ?').run(
    name,
    queryText,
    filter,
    id
  );
  return rowToSaved(db.prepare('SELECT * FROM saved_searches WHERE id = ?').get(id) as SavedRow);
}

export function deleteSavedSearch(db: DB, id: number): boolean {
  return db.prepare('DELETE FROM saved_searches WHERE id = ?').run(id).changes > 0;
}

/** Distinct tag names with usage counts (tag filter UI + suggestions). FR-012. */
export function distinctTags(db: DB): Array<{ name: string; count: number }> {
  return db
    .prepare(
      `SELECT t.name AS name, COUNT(bt.bookmark_id) AS count
       FROM tags t LEFT JOIN bookmark_tags bt ON bt.tag_id = t.id
       GROUP BY t.id ORDER BY count DESC, t.name ASC`
    )
    .all() as Array<{ name: string; count: number }>;
}
