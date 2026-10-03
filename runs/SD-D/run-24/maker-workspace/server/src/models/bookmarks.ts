import type Database from 'better-sqlite3';
import { getDb } from '../db/connection';
import { Bookmark, ListQuery, ListResult, SortOrder, ViewName } from '../types';
import { normalizeUrl, isValidWebUrl, InvalidUrlError } from '../services/normalizeUrl';
import { compileSearch } from '../search/evaluator';
import { getBookmarkTags, setBookmarkTags } from './tags';

export { InvalidUrlError };

export interface CreateInput {
  url: string;
  title?: string;
  description?: string;
  tags?: string[];
  note_markdown?: string;
  read?: boolean;
  icon_path?: string | null;
  preview_image_path?: string | null;
  saved_at?: string;
}

export interface CreateResult {
  bookmark: Bookmark;
  duplicate: boolean;
}

interface Row {
  id: number;
  url: string;
  normalized_url: string;
  title: string;
  description: string;
  icon_path: string | null;
  preview_image_path: string | null;
  note_markdown: string;
  read: number;
  archived: number;
  saved_at: string;
  updated_at: string;
}

const SORT_SQL: Record<SortOrder, string> = {
  saved_desc: 'b.saved_at DESC',
  saved_asc: 'b.saved_at ASC',
  title_asc: 'b.title COLLATE NOCASE ASC',
  title_desc: 'b.title COLLATE NOCASE DESC',
  updated_desc: 'b.updated_at DESC',
};

function nowIso(): string {
  return new Date().toISOString();
}

function rowToBookmark(row: Row, db: Database.Database): Bookmark {
  const copy = db
    .prepare('SELECT type, status, wayback_url FROM preserved_copies WHERE bookmark_id = ?')
    .get(row.id) as { type: string | null; status: string; wayback_url: string | null } | undefined;
  return {
    id: row.id,
    url: row.url,
    title: row.title,
    description: row.description,
    iconUrl: row.icon_path ? `/api/bookmarks/${row.id}/icon` : null,
    previewImageUrl: row.preview_image_path ? `/api/bookmarks/${row.id}/preview` : null,
    note_markdown: row.note_markdown,
    tags: getBookmarkTags(row.id, db),
    read: !!row.read,
    archived: !!row.archived,
    saved_at: row.saved_at,
    updated_at: row.updated_at,
    copy: {
      type: (copy?.type as Bookmark['copy']['type']) ?? null,
      status: (copy?.status as Bookmark['copy']['status']) ?? 'pending',
      wayback_url: copy?.wayback_url ?? null,
    },
  };
}

export function getRawByNormalized(normalized: string, db: Database.Database = getDb()): Row | undefined {
  return db.prepare('SELECT * FROM bookmarks WHERE normalized_url = ?').get(normalized) as
    | Row
    | undefined;
}

export function getById(id: number, db: Database.Database = getDb()): Bookmark | undefined {
  const row = db.prepare('SELECT * FROM bookmarks WHERE id = ?').get(id) as Row | undefined;
  return row ? rowToBookmark(row, db) : undefined;
}

export function getRawById(id: number, db: Database.Database = getDb()): Row | undefined {
  return db.prepare('SELECT * FROM bookmarks WHERE id = ?').get(id) as Row | undefined;
}

export function create(input: CreateInput, db: Database.Database = getDb()): CreateResult {
  if (!isValidWebUrl(input.url)) throw new InvalidUrlError('Invalid URL');
  const normalized = normalizeUrl(input.url);

  const existing = getRawByNormalized(normalized, db);
  if (existing) {
    return { bookmark: rowToBookmark(existing, db), duplicate: true };
  }

  const now = nowIso();
  const title = (input.title && input.title.trim()) || input.url.trim();
  const info = db
    .prepare(
      `INSERT INTO bookmarks
       (url, normalized_url, title, description, icon_path, preview_image_path,
        note_markdown, read, archived, saved_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`
    )
    .run(
      input.url.trim(),
      normalized,
      title,
      input.description ?? '',
      input.icon_path ?? null,
      input.preview_image_path ?? null,
      input.note_markdown ?? '',
      input.read === false ? 0 : 1,
      input.saved_at ?? now,
      now
    );
  const id = Number(info.lastInsertRowid);
  db.prepare(
    `INSERT INTO preserved_copies (bookmark_id, status) VALUES (?, 'pending')`
  ).run(id);
  if (input.tags?.length) setBookmarkTags(id, input.tags, db);
  return { bookmark: getById(id, db)!, duplicate: false };
}

export interface UpdateInput {
  url?: string;
  title?: string;
  description?: string;
  tags?: string[];
  note_markdown?: string;
  read?: boolean;
  archived?: boolean;
}

export class UrlConflictError extends Error {}

export function update(id: number, patch: UpdateInput, db: Database.Database = getDb()): Bookmark {
  const row = getRawById(id, db);
  if (!row) throw new Error('Not found');

  const fields: string[] = [];
  const params: unknown[] = [];

  if (patch.url !== undefined) {
    if (!isValidWebUrl(patch.url)) throw new InvalidUrlError('Invalid URL');
    const normalized = normalizeUrl(patch.url);
    const clash = getRawByNormalized(normalized, db);
    if (clash && clash.id !== id) throw new UrlConflictError('URL already saved');
    fields.push('url = ?', 'normalized_url = ?');
    params.push(patch.url.trim(), normalized);
  }
  if (patch.title !== undefined) {
    fields.push('title = ?');
    params.push(patch.title.trim() || row.url);
  }
  if (patch.description !== undefined) {
    fields.push('description = ?');
    params.push(patch.description);
  }
  if (patch.note_markdown !== undefined) {
    fields.push('note_markdown = ?');
    params.push(patch.note_markdown);
  }
  if (patch.read !== undefined) {
    fields.push('read = ?');
    params.push(patch.read ? 1 : 0);
  }
  if (patch.archived !== undefined) {
    fields.push('archived = ?');
    params.push(patch.archived ? 1 : 0);
  }
  fields.push('updated_at = ?');
  params.push(nowIso());

  db.prepare(`UPDATE bookmarks SET ${fields.join(', ')} WHERE id = ?`).run(...params, id);
  if (patch.tags !== undefined) setBookmarkTags(id, patch.tags, db);
  return getById(id, db)!;
}

export function remove(id: number, db: Database.Database = getDb()): void {
  db.prepare('DELETE FROM bookmarks WHERE id = ?').run(id);
}

// ---- Listing / searching ----

function buildWhere(query: ListQuery, db: Database.Database): { sql: string; params: unknown[] } {
  const clauses: string[] = [];
  const params: unknown[] = [];
  const view: ViewName = query.view ?? 'all';

  if (view === 'archive') {
    clauses.push('b.archived = 1');
  } else {
    clauses.push('b.archived = 0');
    if (view === 'readlater') clauses.push('b.read = 0');
  }

  if (query.q && query.q.trim()) {
    const pred = compileSearch(query.q); // may throw SearchSyntaxError
    clauses.push('(' + pred.sql + ')');
    params.push(...pred.params);
  }

  if (query.tag && query.tag.trim()) {
    clauses.push(
      `EXISTS (SELECT 1 FROM bookmark_tags bt JOIN tags t ON t.id = bt.tag_id
               WHERE bt.bookmark_id = b.id AND t.name = ? COLLATE NOCASE)`
    );
    params.push(query.tag.trim());
  }

  if (query.filterId) {
    const f = db
      .prepare('SELECT search_expression, included_tag_ids, excluded_tag_ids FROM saved_filters WHERE id = ?')
      .get(query.filterId) as
      | { search_expression: string; included_tag_ids: string; excluded_tag_ids: string }
      | undefined;
    if (f) {
      if (f.search_expression.trim()) {
        const pred = compileSearch(f.search_expression);
        clauses.push('(' + pred.sql + ')');
        params.push(...pred.params);
      }
      const included: number[] = JSON.parse(f.included_tag_ids);
      const excluded: number[] = JSON.parse(f.excluded_tag_ids);
      for (const tagId of included) {
        clauses.push(
          `EXISTS (SELECT 1 FROM bookmark_tags bt WHERE bt.bookmark_id = b.id AND bt.tag_id = ?)`
        );
        params.push(tagId);
      }
      for (const tagId of excluded) {
        clauses.push(
          `NOT EXISTS (SELECT 1 FROM bookmark_tags bt WHERE bt.bookmark_id = b.id AND bt.tag_id = ?)`
        );
        params.push(tagId);
      }
    }
  }

  return { sql: clauses.length ? 'WHERE ' + clauses.join(' AND ') : '', params };
}

export function list(query: ListQuery, db: Database.Database = getDb()): ListResult {
  const where = buildWhere(query, db);
  const sort = SORT_SQL[query.sort ?? 'saved_desc'] ?? SORT_SQL.saved_desc;
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(500, Math.max(1, query.pageSize ?? 50));
  const offset = (page - 1) * pageSize;

  const total = (
    db.prepare(`SELECT COUNT(*) AS c FROM bookmarks b ${where.sql}`).get(...where.params) as {
      c: number;
    }
  ).c;

  const rows = db
    .prepare(`SELECT b.* FROM bookmarks b ${where.sql} ORDER BY ${sort} LIMIT ? OFFSET ?`)
    .all(...where.params, pageSize, offset) as Row[];

  return { items: rows.map((r) => rowToBookmark(r, db)), total, page, pageSize };
}

/** Ids of all bookmarks matching a query (ignores paging) — for bulk "all matching". */
export function listMatchingIds(query: ListQuery, db: Database.Database = getDb()): number[] {
  const where = buildWhere(query, db);
  const rows = db.prepare(`SELECT b.id FROM bookmarks b ${where.sql}`).all(...where.params) as {
    id: number;
  }[];
  return rows.map((r) => r.id);
}
