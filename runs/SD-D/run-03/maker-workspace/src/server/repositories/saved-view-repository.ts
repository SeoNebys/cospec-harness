import type { SavedView, Scope, SortOrder } from "../../shared/contracts/api.js";
import type { AppDatabase } from "../db/database.js";

export interface NormalizedSavedViewName {
  displayName: string;
  nameKey: string;
}

export interface SavedViewTagValue {
  displayName: string;
  tagKey: string;
}

export interface SavedViewMutation {
  name: NormalizedSavedViewName;
  query: string;
  tags: readonly SavedViewTagValue[];
  scope: Scope;
  favorite: boolean | null;
  unread: boolean | null;
  sort: SortOrder;
  now: string;
}

interface SavedViewRow {
  id: number;
  display_name: string;
  name_key: string;
  query_text: string;
  grammar_version: 1;
  scope: Scope;
  favorite_filter: 0 | 1 | null;
  unread_filter: 0 | 1 | null;
  sort_order: SortOrder;
  created_at: string;
  updated_at: string;
}

export class InvalidSavedViewNameError extends Error {
  readonly code = "INVALID_SAVED_VIEW_NAME";
  readonly field = "name";
  readonly hint = "Enter a name containing at least one visible character";

  constructor(readonly sourceLength: number) {
    super("A saved-view name must contain at least one non-whitespace character.");
    this.name = "InvalidSavedViewNameError";
  }
}

export class DuplicateSavedViewNameError extends Error {
  constructor(readonly existingId: number) {
    super("A saved view with that name already exists.");
    this.name = "DuplicateSavedViewNameError";
  }
}

export class SavedViewNotFoundError extends Error {
  constructor() {
    super("Saved view not found.");
    this.name = "SavedViewNotFoundError";
  }
}

export function normalizeSavedViewName(value: string): NormalizedSavedViewName {
  const displayName = value.trim();
  if (displayName === "") throw new InvalidSavedViewNameError(value.length);
  return {
    displayName,
    nameKey: displayName.normalize("NFKC").toLocaleLowerCase("und"),
  };
}

function nullableBoolean(value: 0 | 1 | null): boolean | null {
  return value === null ? null : value === 1;
}

export class SavedViewRepository {
  constructor(private readonly database: AppDatabase) {}

  list(): SavedView[] {
    const rows = this.database
      .prepare("SELECT * FROM saved_views ORDER BY name_key ASC, id ASC")
      .all() as SavedViewRow[];
    return rows.map((row) => this.toSavedView(row));
  }

  get(id: number): SavedView {
    const row = this.database.prepare("SELECT * FROM saved_views WHERE id = ?").get(id) as
      | SavedViewRow
      | undefined;
    if (!row) throw new SavedViewNotFoundError();
    return this.toSavedView(row);
  }

  create(values: SavedViewMutation): SavedView {
    const create = this.database.transaction(() => {
      const conflict = this.findNameConflict(values.name.nameKey);
      if (conflict !== null) throw new DuplicateSavedViewNameError(conflict);

      const result = this.database
        .prepare(`
          INSERT INTO saved_views (
            display_name, name_key, query_text, grammar_version, scope,
            favorite_filter, unread_filter, sort_order, created_at, updated_at
          ) VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?, ?)
        `)
        .run(
          values.name.displayName,
          values.name.nameKey,
          values.query,
          values.scope,
          values.favorite === null ? null : values.favorite ? 1 : 0,
          values.unread === null ? null : values.unread ? 1 : 0,
          values.sort,
          values.now,
          values.now,
        );
      const id = Number(result.lastInsertRowid);
      this.replaceTags(id, values.tags);
      return this.get(id);
    });

    try {
      return create();
    } catch (error) {
      if (error instanceof DuplicateSavedViewNameError) throw error;
      const conflict = this.findNameConflict(values.name.nameKey);
      if (conflict !== null) throw new DuplicateSavedViewNameError(conflict);
      throw error;
    }
  }

  update(id: number, values: SavedViewMutation): SavedView {
    const update = this.database.transaction(() => {
      if (!this.exists(id)) throw new SavedViewNotFoundError();
      const conflict = this.findNameConflict(values.name.nameKey, id);
      if (conflict !== null) throw new DuplicateSavedViewNameError(conflict);

      this.database
        .prepare(`
          UPDATE saved_views SET
            display_name = ?, name_key = ?, query_text = ?, grammar_version = 1,
            scope = ?, favorite_filter = ?, unread_filter = ?, sort_order = ?, updated_at = ?
          WHERE id = ?
        `)
        .run(
          values.name.displayName,
          values.name.nameKey,
          values.query,
          values.scope,
          values.favorite === null ? null : values.favorite ? 1 : 0,
          values.unread === null ? null : values.unread ? 1 : 0,
          values.sort,
          values.now,
          id,
        );
      this.replaceTags(id, values.tags);
      return this.get(id);
    });

    try {
      return update();
    } catch (error) {
      if (error instanceof DuplicateSavedViewNameError || error instanceof SavedViewNotFoundError) {
        throw error;
      }
      const conflict = this.findNameConflict(values.name.nameKey, id);
      if (conflict !== null) throw new DuplicateSavedViewNameError(conflict);
      throw error;
    }
  }

  delete(id: number): void {
    const result = this.database.prepare("DELETE FROM saved_views WHERE id = ?").run(id);
    if (result.changes === 0) throw new SavedViewNotFoundError();
  }

  private exists(id: number): boolean {
    return Boolean(this.database.prepare("SELECT 1 FROM saved_views WHERE id = ?").get(id));
  }

  private findNameConflict(nameKey: string, exceptId?: number): number | null {
    const row = this.database
      .prepare(
        exceptId === undefined
          ? "SELECT id FROM saved_views WHERE name_key = ?"
          : "SELECT id FROM saved_views WHERE name_key = ? AND id <> ?",
      )
      .get(...(exceptId === undefined ? [nameKey] : [nameKey, exceptId])) as
      | { id: number }
      | undefined;
    return row?.id ?? null;
  }

  private replaceTags(id: number, tags: readonly SavedViewTagValue[]): void {
    this.database.prepare("DELETE FROM saved_view_tags WHERE saved_view_id = ?").run(id);
    const insert = this.database.prepare(
      "INSERT INTO saved_view_tags (saved_view_id, tag_key, display_name) VALUES (?, ?, ?)",
    );
    for (const tag of tags) insert.run(id, tag.tagKey, tag.displayName);
  }

  private tagsFor(id: number): string[] {
    return (
      this.database
        .prepare(
          "SELECT display_name FROM saved_view_tags WHERE saved_view_id = ? ORDER BY tag_key",
        )
        .all(id) as Array<{ display_name: string }>
    ).map(({ display_name }) => display_name);
  }

  private toSavedView(row: SavedViewRow): SavedView {
    return {
      id: row.id,
      name: row.display_name,
      query: row.query_text,
      tags: this.tagsFor(row.id),
      scope: row.scope,
      favorite: nullableBoolean(row.favorite_filter),
      unread: nullableBoolean(row.unread_filter),
      sort: row.sort_order,
      grammarVersion: row.grammar_version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
