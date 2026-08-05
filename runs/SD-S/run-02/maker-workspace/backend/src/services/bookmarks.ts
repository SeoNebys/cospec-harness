import { randomUUID } from "node:crypto";
import type { DB } from "../db/index.js";
import { AppError, notFound } from "../errors.js";
import {
  type Bookmark,
  type BookmarkRow,
  type CreateBookmarkInput,
  type ListQuery,
  type UpdateBookmarkInput,
  rowToBookmark,
} from "../models/bookmark.js";
import { normalizeTags, validateAndNormalizeUrl } from "./url.js";
import { fetchTitle } from "./title.js";

export interface TagCount {
  name: string;
  count: number;
}

export interface DeleteResult {
  id: string;
  undoToken: string;
  undoExpiresAt: string;
}

export interface BookmarkServiceOptions {
  db: DB;
  undoWindowMs: number;
  /** Injectable for tests; defaults to the real network title fetch. */
  deriveTitle?: (url: string) => Promise<string | null>;
  /** Injectable clock for tests. */
  now?: () => number;
}

export class DuplicateError extends AppError {
  constructor(existing: Bookmark) {
    super(409, "duplicate", "A bookmark with this address already exists.", {
      existing,
    });
  }
}

export function createBookmarkService(opts: BookmarkServiceOptions) {
  const { db, undoWindowMs } = opts;
  const deriveTitle = opts.deriveTitle ?? fetchTitle;
  const clock = opts.now ?? (() => Date.now());
  const nowIso = () => new Date(clock()).toISOString();

  const findActiveByNormalized = db.prepare<[string], BookmarkRow>(
    "SELECT * FROM bookmarks WHERE normalizedUrl = ? AND deletedAt IS NULL",
  );
  const findActiveById = db.prepare<[string], BookmarkRow>(
    "SELECT * FROM bookmarks WHERE id = ? AND deletedAt IS NULL",
  );
  const findDeletedById = db.prepare<[string], BookmarkRow>(
    "SELECT * FROM bookmarks WHERE id = ? AND deletedAt IS NOT NULL",
  );

  /** Remove soft-deleted rows whose undo window has elapsed. */
  function purgeExpired(): void {
    const cutoff = new Date(clock() - undoWindowMs).toISOString();
    db.prepare("DELETE FROM bookmarks WHERE deletedAt IS NOT NULL AND deletedAt <= ?").run(
      cutoff,
    );
  }

  async function create(input: CreateBookmarkInput): Promise<Bookmark> {
    purgeExpired();
    const { url, normalizedUrl } = validateAndNormalizeUrl(input.url);

    const existing = findActiveByNormalized.get(normalizedUrl);
    if (existing) {
      throw new DuplicateError(rowToBookmark(existing));
    }

    let title = input.title?.trim();
    if (!title) {
      title = (await deriveTitle(url))?.trim() || url;
    }

    const tags = normalizeTags(input.tags);
    const ts = nowIso();
    const row: BookmarkRow = {
      id: randomUUID(),
      url,
      normalizedUrl,
      title,
      description: input.description?.trim() || null,
      tags: JSON.stringify(tags),
      createdAt: ts,
      updatedAt: ts,
      deletedAt: null,
    };

    db.prepare(
      `INSERT INTO bookmarks (id, url, normalizedUrl, title, description, tags, createdAt, updatedAt, deletedAt)
       VALUES (@id, @url, @normalizedUrl, @title, @description, @tags, @createdAt, @updatedAt, @deletedAt)`,
    ).run(row);

    return rowToBookmark(row);
  }

  function list(query: ListQuery): { items: Bookmark[]; total: number } {
    purgeExpired();
    const where: string[] = ["deletedAt IS NULL"];
    const params: unknown[] = [];

    if (query.q && query.q.trim() !== "") {
      const like = `%${query.q.trim().toLowerCase()}%`;
      where.push("(lower(title) LIKE ? OR lower(url) LIKE ? OR lower(tags) LIKE ?)");
      params.push(like, like, like);
    }

    const tags = Array.isArray(query.tag)
      ? query.tag
      : query.tag
        ? [query.tag]
        : [];
    for (const tag of normalizeTags(tags)) {
      // tags column stores a JSON array of lower-cased strings, e.g. ["tech","reading"].
      where.push("tags LIKE ?");
      params.push(`%${JSON.stringify(tag)}%`);
    }

    const whereClause = where.join(" AND ");
    const orderBy =
      query.sort === "title"
        ? "title COLLATE NOCASE ASC"
        : "createdAt DESC, id DESC";

    const total = (
      db
        .prepare<unknown[], { c: number }>(
          `SELECT COUNT(*) AS c FROM bookmarks WHERE ${whereClause}`,
        )
        .get(...params) ?? { c: 0 }
    ).c;

    const rows = db
      .prepare<unknown[], BookmarkRow>(
        `SELECT * FROM bookmarks WHERE ${whereClause} ORDER BY ${orderBy} LIMIT ? OFFSET ?`,
      )
      .all(...params, query.limit, query.offset);

    return { items: rows.map(rowToBookmark), total };
  }

  function get(id: string): Bookmark {
    purgeExpired();
    const row = findActiveById.get(id);
    if (!row) throw notFound();
    return rowToBookmark(row);
  }

  async function update(
    id: string,
    input: UpdateBookmarkInput,
  ): Promise<Bookmark> {
    purgeExpired();
    const current = findActiveById.get(id);
    if (!current) throw notFound();

    const next: BookmarkRow = { ...current };

    if (input.url !== undefined) {
      const { url, normalizedUrl } = validateAndNormalizeUrl(input.url);
      if (normalizedUrl !== current.normalizedUrl) {
        const clash = findActiveByNormalized.get(normalizedUrl);
        if (clash && clash.id !== id) {
          throw new DuplicateError(rowToBookmark(clash));
        }
      }
      next.url = url;
      next.normalizedUrl = normalizedUrl;
    }

    if (input.title !== undefined) {
      const t = input.title.trim();
      next.title = t || next.url;
    }
    if (input.description !== undefined) {
      next.description = input.description?.trim() || null;
    }
    if (input.tags !== undefined) {
      next.tags = JSON.stringify(normalizeTags(input.tags));
    }

    next.updatedAt = nowIso();

    db.prepare(
      `UPDATE bookmarks
       SET url=@url, normalizedUrl=@normalizedUrl, title=@title,
           description=@description, tags=@tags, updatedAt=@updatedAt
       WHERE id=@id`,
    ).run(next);

    return rowToBookmark(next);
  }

  function softDelete(id: string): DeleteResult {
    purgeExpired();
    const current = findActiveById.get(id);
    if (!current) throw notFound();
    const deletedAt = nowIso();
    db.prepare("UPDATE bookmarks SET deletedAt = ? WHERE id = ?").run(
      deletedAt,
      id,
    );
    return {
      id,
      undoToken: id,
      undoExpiresAt: new Date(clock() + undoWindowMs).toISOString(),
    };
  }

  function restore(id: string): Bookmark {
    purgeExpired();
    const row = findDeletedById.get(id);
    if (!row) {
      // Either never existed, still active, or already purged after the window.
      const active = findActiveById.get(id);
      if (active) return rowToBookmark(active); // idempotent restore
      throw new AppError(410, "undo_expired", "The undo window has elapsed.");
    }
    // Restoring could collide with a newer bookmark on the same address.
    const clash = findActiveByNormalized.get(row.normalizedUrl);
    if (clash) {
      throw new DuplicateError(rowToBookmark(clash));
    }
    db.prepare("UPDATE bookmarks SET deletedAt = NULL WHERE id = ?").run(id);
    return rowToBookmark({ ...row, deletedAt: null });
  }

  function listTags(): TagCount[] {
    purgeExpired();
    const rows = db
      .prepare<[], { tags: string }>(
        "SELECT tags FROM bookmarks WHERE deletedAt IS NULL",
      )
      .all();
    const counts = new Map<string, number>();
    for (const r of rows) {
      for (const tag of JSON.parse(r.tags) as string[]) {
        counts.set(tag, (counts.get(tag) ?? 0) + 1);
      }
    }
    return [...counts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }

  return {
    create,
    list,
    get,
    update,
    softDelete,
    restore,
    listTags,
    purgeExpired,
  };
}

export type BookmarkService = ReturnType<typeof createBookmarkService>;
