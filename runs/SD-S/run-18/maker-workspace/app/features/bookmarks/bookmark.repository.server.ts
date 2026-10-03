import { and, desc, eq, lt, or, sql, type SQL } from "drizzle-orm";
import type { AppDatabase } from "~/db/client.server";
import { bookmark, bookmarkTag, tag } from "~/db/schema";

export type BookmarkRecord = typeof bookmark.$inferSelect;
export type BookmarkView = {
  id: string;
  url: string;
  title: string;
  description: string | null;
  tags: { id: string; name: string }[];
  createdAt: string;
  updatedAt: string;
};

export function toBookmarkView(row: BookmarkRecord, tags: BookmarkView["tags"] = []): BookmarkView {
  return {
    id: row.id,
    url: row.url,
    title: row.title,
    description: row.description,
    tags,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function createBookmarkRepository(db: AppDatabase) {
  return {
    findByNormalizedUrl(ownerId: string, normalizedUrl: string) {
      return db.select().from(bookmark).where(and(eq(bookmark.ownerId, ownerId), eq(bookmark.normalizedUrl, normalizedUrl))).limit(1).get();
    },
    findById(ownerId: string, id: string) {
      return db.select().from(bookmark).where(and(eq(bookmark.ownerId, ownerId), eq(bookmark.id, id))).limit(1).get();
    },
    insert(values: typeof bookmark.$inferInsert) {
      return db.insert(bookmark).values(values).returning().get();
    },
    list(ownerId: string, options: { limit?: number; query?: string | undefined; tag?: string | undefined; cursor?: { createdAt: Date; id: string } | undefined } = {}) {
      const conditions: SQL[] = [eq(bookmark.ownerId, ownerId)];
      const query = options.query?.trim();
      if (query) {
        const escaped = query.toLocaleLowerCase("en-US").replace(/[\\%_]/g, "\\$&");
        const pattern = `%${escaped}%`;
        conditions.push(sql`(
          lower(${bookmark.title}) LIKE ${pattern} ESCAPE '\\'
          OR lower(${bookmark.url}) LIKE ${pattern} ESCAPE '\\'
          OR lower(coalesce(${bookmark.description}, '')) LIKE ${pattern} ESCAPE '\\'
          OR EXISTS (
            SELECT 1 FROM ${bookmarkTag}
            INNER JOIN ${tag} ON ${tag.id} = ${bookmarkTag.tagId} AND ${tag.ownerId} = ${bookmarkTag.ownerId}
            WHERE ${bookmarkTag.ownerId} = ${ownerId}
              AND ${bookmarkTag.bookmarkId} = ${bookmark.id}
              AND lower(${tag.name}) LIKE ${pattern} ESCAPE '\\'
          )
        )`);
      }
      const normalizedTag = options.tag?.normalize("NFKC").replace(/\s+/g, " ").trim().toLocaleLowerCase("en-US");
      if (normalizedTag) {
        conditions.push(sql`EXISTS (
          SELECT 1 FROM ${bookmarkTag}
          INNER JOIN ${tag} ON ${tag.id} = ${bookmarkTag.tagId} AND ${tag.ownerId} = ${bookmarkTag.ownerId}
          WHERE ${bookmarkTag.ownerId} = ${ownerId}
            AND ${bookmarkTag.bookmarkId} = ${bookmark.id}
            AND ${tag.normalizedName} = ${normalizedTag}
        )`);
      }
      if (options.cursor) {
        conditions.push(or(
          lt(bookmark.createdAt, options.cursor.createdAt),
          and(eq(bookmark.createdAt, options.cursor.createdAt), lt(bookmark.id, options.cursor.id)),
        )!);
      }
      return db.select().from(bookmark)
        .where(and(...conditions))
        .orderBy(desc(bookmark.createdAt), desc(bookmark.id))
        .limit(options.limit ?? 50)
        .all();
    },
    update(ownerId: string, id: string, values: Partial<Pick<BookmarkRecord, "url" | "normalizedUrl" | "title" | "description" | "updatedAt">>) {
      return db.update(bookmark).set(values).where(and(eq(bookmark.ownerId, ownerId), eq(bookmark.id, id))).returning().get();
    },
    delete(ownerId: string, id: string) {
      return db.delete(bookmark).where(and(eq(bookmark.ownerId, ownerId), eq(bookmark.id, id))).returning().get();
    },
  };
}
