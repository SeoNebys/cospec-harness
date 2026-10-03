import { randomUUID } from "node:crypto";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db, ensureDatabase } from "@/lib/db/client";
import { bookmarks, bookmarkTags, tags } from "@/lib/db/schema";
import type { BookmarkInput } from "@/lib/validation/bookmark";

export type BookmarkView = { id: string; title: string; url: string; tags: { id: string; name: string }[]; createdAt: string; updatedAt: string };

async function hydrate(ownerId: string, ids?: string[]): Promise<BookmarkView[]> {
  const where = ids ? and(eq(bookmarks.ownerId, ownerId), inArray(bookmarks.id, ids)) : eq(bookmarks.ownerId, ownerId);
  const rows = await db.select().from(bookmarks).where(where).orderBy(desc(bookmarks.createdAt), desc(bookmarks.id));
  if (!rows.length) return [];
  const links = await db.select({ bookmarkId: bookmarkTags.bookmarkId, id: tags.id, name: tags.name }).from(bookmarkTags)
    .innerJoin(tags, eq(tags.id, bookmarkTags.tagId)).where(and(eq(tags.ownerId, ownerId), inArray(bookmarkTags.bookmarkId, rows.map((row) => row.id))));
  return rows.map((row) => ({ id: row.id, title: row.title, url: row.url, tags: links.filter((tag) => tag.bookmarkId === row.id).map(({ id, name }) => ({ id, name })).sort((a,b) => a.name.localeCompare(b.name)), createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() }));
}

async function syncTags(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], ownerId: string, bookmarkId: string, input: BookmarkInput["tags"]) {
  await tx.delete(bookmarkTags).where(eq(bookmarkTags.bookmarkId, bookmarkId));
  for (const tag of input) {
    let [existing] = await tx.select().from(tags).where(and(eq(tags.ownerId, ownerId), eq(tags.normalizedName, tag.normalizedName))).limit(1);
    if (!existing) {
      const id = randomUUID();
      await tx.insert(tags).values({ id, ownerId, name: tag.name, normalizedName: tag.normalizedName }).onConflictDoNothing();
      [existing] = await tx.select().from(tags).where(and(eq(tags.ownerId, ownerId), eq(tags.normalizedName, tag.normalizedName))).limit(1);
    }
    await tx.insert(bookmarkTags).values({ bookmarkId, tagId: existing.id }).onConflictDoNothing();
  }
  await tx.delete(tags).where(and(eq(tags.ownerId, ownerId), sql`NOT EXISTS (SELECT 1 FROM bookmark_tags bt WHERE bt.tag_id = ${tags.id})`));
}

export async function listBookmarks(ownerId: string, q = "", tagId = "", limit = 50) {
  await ensureDatabase();
  let items = await hydrate(ownerId);
  const needle = q.trim().toLocaleLowerCase("en-US");
  if (needle) items = items.filter((item) => item.title.toLocaleLowerCase("en-US").includes(needle) || item.url.toLocaleLowerCase("en-US").includes(needle) || item.tags.some((tag) => tag.name.toLocaleLowerCase("en-US").includes(needle)));
  if (tagId) items = items.filter((item) => item.tags.some((tag) => tag.id === tagId));
  const total = items.length;
  return { items: items.slice(0, Math.min(limit, 50)), nextCursor: null, total };
}

export async function createBookmark(ownerId: string, input: BookmarkInput) {
  await ensureDatabase();
  const id = randomUUID();
  await db.transaction(async (tx) => {
    await tx.insert(bookmarks).values({ id, ownerId, title: input.title, url: input.url.url, normalizedUrl: input.url.normalizedUrl });
    await syncTags(tx, ownerId, id, input.tags);
  });
  return (await hydrate(ownerId, [id]))[0];
}

export async function findBookmarkByNormalizedUrl(ownerId: string, normalizedUrl: string) {
  await ensureDatabase();
  const [existing] = await db.select({ id: bookmarks.id }).from(bookmarks)
    .where(and(eq(bookmarks.ownerId, ownerId), eq(bookmarks.normalizedUrl, normalizedUrl))).limit(1);
  return existing ?? null;
}

export async function updateBookmark(ownerId: string, id: string, input: BookmarkInput) {
  await ensureDatabase();
  const existing = await db.select({ id: bookmarks.id }).from(bookmarks).where(and(eq(bookmarks.id, id), eq(bookmarks.ownerId, ownerId))).limit(1);
  if (!existing.length) return null;
  await db.transaction(async (tx) => {
    await tx.update(bookmarks).set({ title: input.title, url: input.url.url, normalizedUrl: input.url.normalizedUrl, updatedAt: new Date() }).where(and(eq(bookmarks.id, id), eq(bookmarks.ownerId, ownerId)));
    await syncTags(tx, ownerId, id, input.tags);
  });
  return (await hydrate(ownerId, [id]))[0];
}

export async function deleteBookmark(ownerId: string, id: string) {
  await ensureDatabase();
  const result = await db.delete(bookmarks).where(and(eq(bookmarks.id, id), eq(bookmarks.ownerId, ownerId))).returning({ id: bookmarks.id });
  await db.delete(tags).where(and(eq(tags.ownerId, ownerId), sql`NOT EXISTS (SELECT 1 FROM bookmark_tags bt WHERE bt.tag_id = ${tags.id})`));
  return result.length > 0;
}

export async function listTags(ownerId: string) {
  await ensureDatabase();
  return db.select({ id: tags.id, name: tags.name }).from(tags).where(eq(tags.ownerId, ownerId)).orderBy(tags.name);
}
