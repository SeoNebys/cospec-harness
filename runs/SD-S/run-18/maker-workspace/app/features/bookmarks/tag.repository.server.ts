import { and, asc, eq, sql } from "drizzle-orm";
import type { AppDatabase } from "~/db/client.server";
import { bookmarkTag, tag } from "~/db/schema";

export function normalizeTagName(value: string) {
  return value.normalize("NFKC").replace(/\s+/g, " ").trim().toLocaleLowerCase("en-US");
}

export function createTagRepository(db: AppDatabase) {
  function listForBookmark(ownerId: string, bookmarkId: string) {
    return db
      .select({ id: tag.id, name: tag.name })
      .from(bookmarkTag)
      .innerJoin(tag, and(eq(tag.id, bookmarkTag.tagId), eq(tag.ownerId, bookmarkTag.ownerId)))
      .where(and(eq(bookmarkTag.ownerId, ownerId), eq(bookmarkTag.bookmarkId, bookmarkId)))
      .orderBy(asc(tag.name))
      .all();
  }

  function cleanupOrphans(ownerId: string) {
    const ownerTags = db.select({ id: tag.id }).from(tag).where(eq(tag.ownerId, ownerId)).all();
    for (const ownerTag of ownerTags) {
      const association = db.select({ tagId: bookmarkTag.tagId }).from(bookmarkTag).where(and(eq(bookmarkTag.ownerId, ownerId), eq(bookmarkTag.tagId, ownerTag.id))).limit(1).get();
      if (!association) db.delete(tag).where(and(eq(tag.ownerId, ownerId), eq(tag.id, ownerTag.id))).run();
    }
  }

  return {
    listForBookmark,
    cleanupOrphans,
    listWithCounts(ownerId: string) {
      return db
        .select({ id: tag.id, name: tag.name, bookmarkCount: sql<number>`count(${bookmarkTag.bookmarkId})` })
        .from(tag)
        .innerJoin(bookmarkTag, and(eq(bookmarkTag.ownerId, tag.ownerId), eq(bookmarkTag.tagId, tag.id)))
        .where(eq(tag.ownerId, ownerId))
        .groupBy(tag.id, tag.name)
        .orderBy(asc(tag.name))
        .all()
        .map((item) => ({ ...item, bookmarkCount: Number(item.bookmarkCount) }));
    },
    replace(ownerId: string, bookmarkId: string, names: string[]) {
      const unique = new Map<string, string>();
      for (const rawName of names) {
        const name = rawName.normalize("NFKC").replace(/\s+/g, " ").trim();
        if (!name) continue;
        if (name.length > 50) throw new Error("Tag names cannot exceed 50 characters.");
        const normalized = normalizeTagName(name);
        if (!unique.has(normalized)) unique.set(normalized, name);
      }
      if (unique.size > 20) throw new Error("A bookmark can have at most 20 tags.");

      db.delete(bookmarkTag).where(and(eq(bookmarkTag.ownerId, ownerId), eq(bookmarkTag.bookmarkId, bookmarkId))).run();
      for (const [normalizedName, name] of unique) {
        let existing = db.select().from(tag).where(and(eq(tag.ownerId, ownerId), eq(tag.normalizedName, normalizedName))).limit(1).get();
        if (!existing) {
          existing = db.insert(tag).values({ id: crypto.randomUUID(), ownerId, name, normalizedName, createdAt: new Date() }).returning().get();
        }
        db.insert(bookmarkTag).values({ ownerId, bookmarkId, tagId: existing.id }).run();
      }

      cleanupOrphans(ownerId);
      return listForBookmark(ownerId, bookmarkId);
    },
  };
}
