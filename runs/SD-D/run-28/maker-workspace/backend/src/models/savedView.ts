import type { DB } from '../db/db.ts';
import { badRequest } from '../lib/errors.ts';

export interface SavedViewDTO {
  id: number;
  name: string;
  query: string;
  includeTags: string[];
  excludeTags: string[];
  dateCreated: string;
}

interface Row {
  id: number;
  name: string;
  query: string;
  include_tags: string;
  exclude_tags: string;
  date_created: string;
}

function serialize(row: Row): SavedViewDTO {
  return {
    id: row.id,
    name: row.name,
    query: row.query,
    includeTags: JSON.parse(row.include_tags || '[]'),
    excludeTags: JSON.parse(row.exclude_tags || '[]'),
    dateCreated: row.date_created,
  };
}

export function listViews(db: DB): SavedViewDTO[] {
  const rows = db.prepare('SELECT * FROM saved_view ORDER BY name COLLATE NOCASE').all() as Row[];
  return rows.map(serialize);
}

export function getView(db: DB, id: number): SavedViewDTO | null {
  const row = db.prepare('SELECT * FROM saved_view WHERE id = ?').get(id) as Row | undefined;
  return row ? serialize(row) : null;
}

export interface ViewInput {
  name: string;
  query?: string;
  includeTags?: string[];
  excludeTags?: string[];
}

export function createView(db: DB, input: ViewInput): SavedViewDTO {
  if (!input.name || !input.name.trim()) throw badRequest('View name is required.');
  const info = db
    .prepare(
      `INSERT INTO saved_view (name, query, include_tags, exclude_tags, date_created)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(
      input.name.trim(),
      input.query ?? '',
      JSON.stringify(input.includeTags ?? []),
      JSON.stringify(input.excludeTags ?? []),
      new Date().toISOString(),
    );
  return getView(db, Number(info.lastInsertRowid))!;
}

export function updateView(db: DB, id: number, input: ViewInput): SavedViewDTO | null {
  const existing = getView(db, id);
  if (!existing) return null;
  db.prepare(
    `UPDATE saved_view SET name = ?, query = ?, include_tags = ?, exclude_tags = ? WHERE id = ?`,
  ).run(
    input.name?.trim() || existing.name,
    input.query ?? existing.query,
    JSON.stringify(input.includeTags ?? existing.includeTags),
    JSON.stringify(input.excludeTags ?? existing.excludeTags),
    id,
  );
  return getView(db, id);
}

export function deleteView(db: DB, id: number): boolean {
  const info = db.prepare('DELETE FROM saved_view WHERE id = ?').run(id);
  return info.changes > 0;
}
