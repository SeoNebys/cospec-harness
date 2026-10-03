import type Database from 'better-sqlite3';
import { getDb } from '../db/connection';
import { SavedFilter } from '../types';
import { tagNamesForIds } from './tags';

interface FilterRow {
  id: number;
  name: string;
  search_expression: string;
  included_tag_ids: string;
  excluded_tag_ids: string;
}

function rowToFilter(row: FilterRow, db: Database.Database): SavedFilter {
  const included: number[] = JSON.parse(row.included_tag_ids);
  const excluded: number[] = JSON.parse(row.excluded_tag_ids);
  return {
    id: row.id,
    name: row.name,
    search_expression: row.search_expression,
    includedTags: tagNamesForIds(included, db),
    excludedTags: tagNamesForIds(excluded, db),
  };
}

export function listFilters(db: Database.Database = getDb()): SavedFilter[] {
  const rows = db.prepare('SELECT * FROM saved_filters ORDER BY name COLLATE NOCASE').all() as FilterRow[];
  return rows.map((r) => rowToFilter(r, db));
}

export interface FilterInput {
  name: string;
  search_expression?: string;
  includedTagIds?: number[];
  excludedTagIds?: number[];
}

export function createFilter(input: FilterInput, db: Database.Database = getDb()): SavedFilter {
  const info = db
    .prepare(
      `INSERT INTO saved_filters (name, search_expression, included_tag_ids, excluded_tag_ids)
       VALUES (?, ?, ?, ?)`
    )
    .run(
      input.name.trim(),
      input.search_expression ?? '',
      JSON.stringify(input.includedTagIds ?? []),
      JSON.stringify(input.excludedTagIds ?? [])
    );
  return getFilter(Number(info.lastInsertRowid), db)!;
}

export function getFilter(id: number, db: Database.Database = getDb()): SavedFilter | undefined {
  const row = db.prepare('SELECT * FROM saved_filters WHERE id = ?').get(id) as FilterRow | undefined;
  return row ? rowToFilter(row, db) : undefined;
}

export function updateFilter(
  id: number,
  input: FilterInput,
  db: Database.Database = getDb()
): SavedFilter {
  db.prepare(
    `UPDATE saved_filters
     SET name = ?, search_expression = ?, included_tag_ids = ?, excluded_tag_ids = ?
     WHERE id = ?`
  ).run(
    input.name.trim(),
    input.search_expression ?? '',
    JSON.stringify(input.includedTagIds ?? []),
    JSON.stringify(input.excludedTagIds ?? []),
    id
  );
  return getFilter(id, db)!;
}

export function deleteFilter(id: number, db: Database.Database = getDb()): void {
  db.prepare('DELETE FROM saved_filters WHERE id = ?').run(id);
}
