import type { AppDatabase } from "~/db/client.server";
import { bookmarkInputSchema, type BookmarkInput } from "./bookmark.validation";
import { createBookmarkRepository, toBookmarkView } from "./bookmark.repository.server";
import { createTagRepository } from "./tag.repository.server";
import { normalizeBookmarkUrl } from "./url-normalization";

export class BookmarkServiceError extends Error {
  constructor(
    public readonly code: "DUPLICATE_BOOKMARK" | "BOOKMARK_NOT_FOUND",
    public readonly existing?: { id: string; title: string },
  ) {
    super(code);
  }
}

function isUniqueError(error: unknown) {
  return error instanceof Error && /UNIQUE constraint failed/i.test(error.message);
}

export function createBookmarkService(db: AppDatabase) {
  const repository = createBookmarkRepository(db);
  const tagRepository = createTagRepository(db);
  return {
    findDuplicate(ownerId: string, normalizedUrl: string) {
      const existing = repository.findByNormalizedUrl(ownerId, normalizedUrl);
      return existing ? { id: existing.id, title: existing.title } : null;
    },
    create(ownerId: string, rawInput: BookmarkInput) {
      const input = bookmarkInputSchema.parse(rawInput);
      const normalizedUrl = normalizeBookmarkUrl(input.url);
      const now = new Date();
      try {
        return db.transaction((transaction) => {
          const txBookmarks = createBookmarkRepository(transaction as unknown as AppDatabase);
          const txTags = createTagRepository(transaction as unknown as AppDatabase);
          const row = txBookmarks.insert({
            id: crypto.randomUUID(), ownerId, url: normalizedUrl, normalizedUrl,
            title: input.title, description: input.description, createdAt: now, updatedAt: now,
          });
          const tags = txTags.replace(ownerId, row.id, input.tags);
          return toBookmarkView(row, tags);
        });
      } catch (error) {
        if (isUniqueError(error)) {
          const existing = repository.findByNormalizedUrl(ownerId, normalizedUrl);
          throw new BookmarkServiceError("DUPLICATE_BOOKMARK", existing ? { id: existing.id, title: existing.title } : undefined);
        }
        throw error;
      }
    },
    list(ownerId: string, options: { limit?: number; query?: string | undefined; tag?: string | undefined; cursor?: string | null | undefined }) {
      const limit = options.limit ?? 50;
      const cursor = options.cursor ? decodeCursor(options.cursor) : undefined;
      const rows = repository.list(ownerId, { limit: limit + 1, query: options.query, tag: options.tag, cursor });
      const hasNext = rows.length > limit;
      const items = rows.slice(0, limit).map((row) => toBookmarkView(row, tagRepository.listForBookmark(ownerId, row.id)));
      const last = rows.at(Math.min(rows.length, limit) - 1);
      return { items, nextCursor: hasNext && last ? encodeCursor(last.createdAt, last.id) : null };
    },
    get(ownerId: string, id: string) {
      const row = repository.findById(ownerId, id);
      if (!row) throw new BookmarkServiceError("BOOKMARK_NOT_FOUND");
      return toBookmarkView(row, tagRepository.listForBookmark(ownerId, id));
    },
    update(ownerId: string, id: string, rawInput: BookmarkInput) {
      const input = bookmarkInputSchema.parse(rawInput);
      const existing = repository.findById(ownerId, id);
      if (!existing) throw new BookmarkServiceError("BOOKMARK_NOT_FOUND");
      const normalizedUrl = normalizeBookmarkUrl(input.url);
      const now = new Date(Math.max(Date.now(), existing.updatedAt.getTime() + 1));
      try {
        return db.transaction((transaction) => {
          const txBookmarks = createBookmarkRepository(transaction as unknown as AppDatabase);
          const txTags = createTagRepository(transaction as unknown as AppDatabase);
          const row = txBookmarks.update(ownerId, id, {
            url: normalizedUrl, normalizedUrl, title: input.title,
            description: input.description, updatedAt: now,
          });
          if (!row) throw new BookmarkServiceError("BOOKMARK_NOT_FOUND");
          return toBookmarkView(row, txTags.replace(ownerId, id, input.tags));
        });
      } catch (error) {
        if (isUniqueError(error)) {
          const duplicate = repository.findByNormalizedUrl(ownerId, normalizedUrl);
          throw new BookmarkServiceError("DUPLICATE_BOOKMARK", duplicate ? { id: duplicate.id, title: duplicate.title } : undefined);
        }
        throw error;
      }
    },
    delete(ownerId: string, id: string) {
      return db.transaction((transaction) => {
        const txBookmarks = createBookmarkRepository(transaction as unknown as AppDatabase);
        const txTags = createTagRepository(transaction as unknown as AppDatabase);
        const deleted = txBookmarks.delete(ownerId, id);
        if (!deleted) throw new BookmarkServiceError("BOOKMARK_NOT_FOUND");
        txTags.cleanupOrphans(ownerId);
      });
    },
  };
}

function encodeCursor(createdAt: Date, id: string) {
  return Buffer.from(JSON.stringify([createdAt.getTime(), id])).toString("base64url");
}

function decodeCursor(cursor: string) {
  try {
    const value: unknown = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
    if (!Array.isArray(value) || value.length !== 2 || typeof value[0] !== "number" || typeof value[1] !== "string") throw new Error();
    const createdAt = new Date(value[0]);
    if (Number.isNaN(createdAt.getTime())) throw new Error();
    return { createdAt, id: value[1] };
  } catch {
    throw new Error("INVALID_CURSOR");
  }
}
