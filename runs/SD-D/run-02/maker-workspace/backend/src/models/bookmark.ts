/**
 * Bookmark model + repository. Owns bookmark rows, tag associations, and FTS sync.
 */
import type Database from 'better-sqlite3';
import { reindexBookmark, removeFromIndex } from '../db/fts.js';
import { setTags, tagsForBookmark } from './tag.js';

export interface Bookmark {
  id: number;
  url: string;
  normalized_url: string;
  title: string;
  description: string;
  notes: string;
  icon_ref: string | null;
  preview_ref: string | null;
  read_state: 'to_read' | 'read';
  archived: boolean;
  created_at: string;
  updated_at: string;
  tags: string[];
}

interface Row {
  id: number;
  url: string;
  normalized_url: string;
  title: string;
  description: string;
  notes: string;
  icon_ref: string | null;
  preview_ref: string | null;
  read_state: 'to_read' | 'read';
  archived: number;
  created_at: string;
  updated_at: string;
}

function hydrate(db: Database.Database, row: Row): Bookmark {
  return { ...row, archived: !!row.archived, tags: tagsForBookmark(db, row.id) };
}

export function findByNormalized(db: Database.Database, normalized: string): Bookmark | null {
  const row = db
    .prepare(`SELECT * FROM bookmarks WHERE normalized_url = ?`)
    .get(normalized) as Row | undefined;
  return row ? hydrate(db, row) : null;
}

export function getById(db: Database.Database, id: number): Bookmark | null {
  const row = db.prepare(`SELECT * FROM bookmarks WHERE id = ?`).get(id) as Row | undefined;
  return row ? hydrate(db, row) : null;
}

export interface CreateInput {
  url: string;
  normalized_url: string;
  title: string;
  description?: string;
  notes?: string;
  tags?: string[];
  read_state?: 'to_read' | 'read';
  now: string;
}

export function create(db: Database.Database, input: CreateInput): Bookmark {
  const info = db
    .prepare(
      `INSERT INTO bookmarks (url, normalized_url, title, description, notes, read_state, created_at, updated_at)
       VALUES (@url, @normalized_url, @title, @description, @notes, @read_state, @now, @now)`
    )
    .run({
      url: input.url,
      normalized_url: input.normalized_url,
      title: input.title,
      description: input.description ?? '',
      notes: input.notes ?? '',
      read_state: input.read_state ?? 'read',
      now: input.now,
    });
  const id = Number(info.lastInsertRowid);
  if (input.tags) setTags(db, id, input.tags);
  reindexBookmark(db, id);
  return getById(db, id)!;
}

export interface UpdateFields {
  url?: string;
  normalized_url?: string;
  title?: string;
  description?: string;
  notes?: string;
  icon_ref?: string | null;
  preview_ref?: string | null;
  read_state?: 'to_read' | 'read';
  archived?: boolean;
  tags?: string[];
}

export function update(db: Database.Database, id: number, fields: UpdateFields, now: string): Bookmark | null {
  const existing = getById(db, id);
  if (!existing) return null;

  const cols: string[] = [];
  const params: Record<string, unknown> = { id, now };
  for (const key of ['url', 'normalized_url', 'title', 'description', 'notes', 'icon_ref', 'preview_ref', 'read_state'] as const) {
    if (fields[key] !== undefined) {
      cols.push(`${key} = @${key}`);
      params[key] = fields[key];
    }
  }
  if (fields.archived !== undefined) {
    cols.push(`archived = @archived`);
    params.archived = fields.archived ? 1 : 0;
  }
  cols.push(`updated_at = @now`);
  db.prepare(`UPDATE bookmarks SET ${cols.join(', ')} WHERE id = @id`).run(params);

  if (fields.tags !== undefined) setTags(db, id, fields.tags);
  reindexBookmark(db, id);
  return getById(db, id);
}

export function remove(db: Database.Database, id: number): boolean {
  removeFromIndex(db, id);
  const info = db.prepare(`DELETE FROM bookmarks WHERE id = ?`).run(id);
  return info.changes > 0;
}

export interface ListQuery {
  sort?: 'newest' | 'oldest' | 'title';
  read_state?: 'to_read' | 'read';
  archived?: boolean;
  tag?: string;
  ids?: number[];
}

export function list(db: Database.Database, q: ListQuery): Bookmark[] {
  const where: string[] = [];
  const params: Record<string, unknown> = {};

  where.push(`b.archived = @archived`);
  params.archived = q.archived ? 1 : 0;

  if (q.read_state) {
    where.push(`b.read_state = @read_state`);
    params.read_state = q.read_state;
  }
  if (q.tag) {
    where.push(`b.id IN (SELECT bt.bookmark_id FROM bookmark_tags bt JOIN tags t ON t.id = bt.tag_id WHERE t.name = @tag COLLATE NOCASE)`);
    params.tag = q.tag;
  }
  if (q.ids && q.ids.length) {
    const names = q.ids.map((_, i) => `@id_${i}`);
    where.push(`b.id IN (${names.join(',')})`);
    q.ids.forEach((v, i) => { params[`id_${i}`] = v; });
  }

  const order =
    q.sort === 'oldest' ? `b.created_at ASC` :
    q.sort === 'title' ? `b.title COLLATE NOCASE ASC` :
    `b.created_at DESC`;

  const sql = `SELECT b.* FROM bookmarks b WHERE ${where.join(' AND ')} ORDER BY ${order}`;
  const rows = db.prepare(sql).all(params) as Row[];
  return rows.map((r) => hydrate(db, r));
}
