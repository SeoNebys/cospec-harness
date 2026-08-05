import type BetterSqlite3 from "better-sqlite3";
import { badRequest, duplicate, notFound } from "../api/errors.js";
import { rowToBookmark, type Bookmark, type BookmarkRow } from "../models/types.js";
import { validateAndNormalize } from "./url.js";
import { listBookmarkRows, type ListParams } from "./search.js";
import type { MetadataFetcher } from "./metadataFetcher.js";
import type { TagService } from "./tagService.js";

export interface CreateBookmarkInput {
  url: string;
  title?: string;
  note?: string;
  tags?: string[];
  allowDuplicate?: boolean;
}

export interface UpdateBookmarkInput {
  title?: string;
  note?: string;
  tags?: string[];
}

export interface BookmarkServiceDeps {
  db: BetterSqlite3.Database;
  tagService: TagService;
  fetchMetadata: MetadataFetcher;
  /** Injectable clock for deterministic tests. */
  now?: () => string;
}

export interface BookmarkService {
  create(input: CreateBookmarkInput): Bookmark;
  getById(id: number): Bookmark;
  getByIdOrNull(id: number): Bookmark | null;
  list(params: ListParams): Bookmark[];
  update(id: number, input: UpdateBookmarkInput): Bookmark;
  remove(id: number): void;
  /** Fetch metadata for a saved bookmark and update it (async enrichment). */
  enrich(id: number): Promise<void>;
}

function nonEmpty(v: string | undefined | null): string | null {
  return v && v.trim() ? v.trim() : null;
}

export function createBookmarkService(deps: BookmarkServiceDeps): BookmarkService {
  const { db, tagService, fetchMetadata } = deps;
  const now = deps.now ?? (() => new Date().toISOString());

  const findByNormalized = db.prepare("SELECT * FROM bookmarks WHERE normalized_url = ?");
  const selectById = db.prepare("SELECT * FROM bookmarks WHERE id = ?");
  const insertRow = db.prepare(
    `INSERT INTO bookmarks (url, normalized_url, title, note, fetch_status, created_at, updated_at)
     VALUES (@url, @normalized_url, @title, @note, 'pending', @created_at, @updated_at)`,
  );
  const deleteRow = db.prepare("DELETE FROM bookmarks WHERE id = ?");

  function hydrate(row: BookmarkRow): Bookmark {
    return rowToBookmark(row, tagService.tagsForBookmark(row.id));
  }

  function getByIdOrNull(id: number): Bookmark | null {
    const row = selectById.get(id) as BookmarkRow | undefined;
    return row ? hydrate(row) : null;
  }

  function getById(id: number): Bookmark {
    const b = getByIdOrNull(id);
    if (!b) throw notFound("Bookmark not found.");
    return b;
  }

  const create = db.transaction((input: CreateBookmarkInput): Bookmark => {
    const { url, normalized } = validateAndNormalize(input.url);

    if (!input.allowDuplicate) {
      const existing = findByNormalized.get(normalized) as BookmarkRow | undefined;
      if (existing) {
        throw duplicate("This link is already saved.", { existing: hydrate(existing) });
      }
    }

    const ts = now();
    const info = insertRow.run({
      url,
      normalized_url: normalized,
      title: nonEmpty(input.title),
      note: nonEmpty(input.note),
      created_at: ts,
      updated_at: ts,
    });
    const id = Number(info.lastInsertRowid);

    if (input.tags && input.tags.length) {
      tagService.setTagsForBookmark(id, input.tags);
    }
    return getById(id);
  });

  async function enrich(id: number): Promise<void> {
    const row = selectById.get(id) as BookmarkRow | undefined;
    if (!row) return;

    const meta = await fetchMetadata(row.url);
    const gotSomething = Boolean(meta.title || meta.description || meta.imageUrl);

    // A user-provided title always wins over the fetched one (FR-015).
    const title = row.title ?? meta.title ?? null;

    db.prepare(
      `UPDATE bookmarks
          SET title = ?, preview_description = ?, preview_image_url = ?, fetch_status = ?, updated_at = ?
        WHERE id = ?`,
    ).run(title, meta.description, meta.imageUrl, gotSomething ? "success" : "failed", now(), id);
  }

  function list(params: ListParams): Bookmark[] {
    return listBookmarkRows(db, params).map(hydrate);
  }

  const update = db.transaction((id: number, input: UpdateBookmarkInput): Bookmark => {
    const existing = selectById.get(id) as BookmarkRow | undefined;
    if (!existing) throw notFound("Bookmark not found.");

    if (input.title === undefined && input.note === undefined && input.tags === undefined) {
      throw badRequest("Nothing to update.");
    }

    const title = input.title !== undefined ? nonEmpty(input.title) : existing.title;
    const note = input.note !== undefined ? nonEmpty(input.note) : existing.note;

    db.prepare(
      "UPDATE bookmarks SET title = ?, note = ?, updated_at = ? WHERE id = ?",
    ).run(title, note, now(), id);

    if (input.tags !== undefined) {
      tagService.setTagsForBookmark(id, input.tags);
    }
    return getById(id);
  });

  function remove(id: number): void {
    const info = deleteRow.run(id);
    if (info.changes === 0) throw notFound("Bookmark not found.");
  }

  return {
    create: (input) => create(input),
    getById,
    getByIdOrNull,
    list,
    update: (id, input) => update(id, input),
    remove,
    enrich,
  };
}
