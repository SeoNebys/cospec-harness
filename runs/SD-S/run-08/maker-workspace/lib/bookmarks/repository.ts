import { randomUUID } from "node:crypto";
import type { Prisma, PrismaClient } from "../../generated/prisma/client";
import { AppError } from "../errors";
import { normalizeForSearch } from "../text/normalize";
import { normalizeTag } from "../tags/normalize";
import { normalizeUrl } from "../urls/normalize";
import { db } from "../db/client";
import { redeemIconToken } from "../metadata/icons";
import type { BookmarkListQuery, BookmarkWrite } from "./schemas";

type Client = PrismaClient | Prisma.TransactionClient;
type LoadedBookmark = Prisma.BookmarkGetPayload<{ include: { tags: { include: { tag: true } } } }>;

export type BookmarkView = {
  id: string; url: string; title: string; titleOrigin: "fetched" | "fallback" | "user";
  note: string; iconPath: string | null; tags: string[]; createdAt: string; updatedAt: string;
};

export type BookmarkPage = { items: BookmarkView[]; nextCursor: string | null };

const includeTags = { tags: { include: { tag: true } } } as const;

function present(row: LoadedBookmark): BookmarkView {
  return {
    id: row.id, url: row.url, title: row.title,
    titleOrigin: row.titleOrigin as BookmarkView["titleOrigin"], note: row.note,
    iconPath: row.iconAsset ? `/icons/${encodeURIComponent(row.iconAsset)}` : null,
    tags: row.tags.map(({ tag }) => tag.name).sort((a, b) => a.localeCompare(b)),
    createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(),
  };
}

async function replaceTags(tx: Prisma.TransactionClient, bookmarkId: string, values: string[]): Promise<void> {
  const unique = new Map<string, string>();
  for (const value of values) {
    const { name, nameKey } = normalizeTag(value);
    if (!name) throw new AppError("VALIDATION_ERROR", "Tags cannot be empty.", 422, "tags");
    if ([...name].length > 50) throw new AppError("VALIDATION_ERROR", "Tags must be 50 characters or fewer.", 422, "tags");
    if (!unique.has(nameKey)) unique.set(nameKey, name);
  }
  if (unique.size > 50) throw new AppError("VALIDATION_ERROR", "Use no more than 50 tags.", 422, "tags");

  await tx.bookmarkTag.deleteMany({ where: { bookmarkId } });
  for (const [nameKey, name] of unique) {
    const tag = await tx.tag.upsert({ where: { nameKey }, update: {}, create: { name, nameKey } });
    await tx.bookmarkTag.create({ data: { bookmarkId, tagId: tag.id } });
  }
  await tx.tag.deleteMany({ where: { bookmarks: { none: {} } } });
}

function writeData(input: BookmarkWrite) {
  const normalized = normalizeUrl(input.url);
  const title = input.title.trim();
  let iconAsset: string | null | undefined;
  if (input.iconToken === null) iconAsset = null;
  else if (input.iconToken !== undefined) {
    iconAsset = redeemIconToken(input.iconToken);
    if (!iconAsset) throw new AppError("VALIDATION_ERROR", "The site icon preview has expired. Save without it or request a new preview.", 422, "iconToken");
  }
  return {
    normalized,
    data: {
      url: normalized.url, urlKey: normalized.key, urlSearch: normalizeForSearch(normalized.url),
      title, titleSearch: normalizeForSearch(title), titleOrigin: input.titleOrigin,
      note: input.note, noteSearch: normalizeForSearch(input.note),
      ...(iconAsset !== undefined ? { iconAsset } : {}),
    },
  };
}

async function duplicateId(client: Client, urlKey: string, excludeId?: string) {
  return client.bookmark.findFirst({ where: { urlKey, ...(excludeId ? { id: { not: excludeId } } : {}) }, select: { id: true } });
}

export async function findBookmarkByUrlKey(urlKey: string, client: Client = db): Promise<{ id: string } | null> {
  return client.bookmark.findUnique({ where: { urlKey }, select: { id: true } });
}

export async function createBookmark(input: BookmarkWrite, client: PrismaClient = db): Promise<BookmarkView> {
  const { normalized, data } = writeData(input);
  const duplicate = await duplicateId(client, normalized.key);
  if (duplicate) throw new AppError("DUPLICATE_URL", "This bookmark is already saved.", 409, "url", duplicate.id);
  try {
    const row = await client.$transaction(async (tx) => {
      const created = await tx.bookmark.create({ data: { id: randomUUID(), ...data } });
      await replaceTags(tx, created.id, input.tags);
      return tx.bookmark.findUniqueOrThrow({ where: { id: created.id }, include: includeTags });
    });
    return present(row);
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") {
      const existing = await duplicateId(client, normalized.key);
      throw new AppError("DUPLICATE_URL", "This bookmark is already saved.", 409, "url", existing?.id);
    }
    throw error;
  }
}

export async function getBookmark(id: string, client: Client = db): Promise<BookmarkView | null> {
  const row = await client.bookmark.findUnique({ where: { id }, include: includeTags });
  return row ? present(row) : null;
}

export async function updateBookmark(id: string, input: BookmarkWrite, client: PrismaClient = db): Promise<BookmarkView> {
  const current = await client.bookmark.findUnique({ where: { id } });
  if (!current) throw new AppError("NOT_FOUND", "Bookmark not found.", 404);
  const { normalized, data } = writeData(input);
  const duplicate = await duplicateId(client, normalized.key, id);
  if (duplicate) throw new AppError("DUPLICATE_URL", "This bookmark is already saved.", 409, "url", duplicate.id);

  // Background metadata must never replace a title the user has claimed.
  if (current.titleOrigin === "user" && input.titleOrigin !== "user") {
    data.title = current.title;
    data.titleSearch = current.titleSearch;
    data.titleOrigin = "user";
  }
  try {
    const row = await client.$transaction(async (tx) => {
      await tx.bookmark.update({ where: { id }, data });
      await replaceTags(tx, id, input.tags);
      return tx.bookmark.findUniqueOrThrow({ where: { id }, include: includeTags });
    });
    return present(row);
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") {
      const existing = await duplicateId(client, normalized.key, id);
      throw new AppError("DUPLICATE_URL", "This bookmark is already saved.", 409, "url", existing?.id);
    }
    throw error;
  }
}

export async function deleteBookmark(id: string, client: PrismaClient = db): Promise<BookmarkView> {
  return client.$transaction(async (tx) => {
    const row = await tx.bookmark.findUnique({ where: { id }, include: includeTags });
    if (!row) throw new AppError("NOT_FOUND", "Bookmark not found.", 404);
    await tx.bookmark.delete({ where: { id } });
    await tx.tag.deleteMany({ where: { bookmarks: { none: {} } } });
    return present(row);
  });
}

type Cursor = { sort: BookmarkListQuery["sort"]; value: string; id: string };
function encodeCursor(value: Cursor) { return Buffer.from(JSON.stringify(value), "utf8").toString("base64url"); }
function decodeCursor(value: string | undefined, sort: BookmarkListQuery["sort"]): Cursor | null {
  if (!value) return null;
  try {
    const decoded = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Cursor;
    if (decoded.sort !== sort || typeof decoded.value !== "string" || typeof decoded.id !== "string") throw new Error();
    return decoded;
  } catch { throw new AppError("VALIDATION_ERROR", "The pagination cursor is invalid or stale.", 422, "cursor"); }
}

export async function listBookmarks(query: BookmarkListQuery, client: Client = db): Promise<BookmarkPage> {
  const needle = normalizeForSearch(query.q ?? "");
  const tagKey = query.tag ? normalizeTag(query.tag).nameKey : "";
  let rows = await client.bookmark.findMany({ include: includeTags });
  rows = rows.filter((row) => {
    const tagKeys = row.tags.map(({ tag }) => tag.nameKey);
    return (!tagKey || tagKeys.includes(tagKey)) && (!needle ||
      row.titleSearch.includes(needle) || row.urlSearch.includes(needle) || row.noteSearch.includes(needle) ||
      tagKeys.some((key) => key.includes(needle)));
  });
  rows.sort((a, b) => {
    if (query.sort === "alphabetical") return a.titleSearch.localeCompare(b.titleSearch) || a.id.localeCompare(b.id);
    const delta = a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id);
    return query.sort === "oldest" ? delta : -delta;
  });
  const cursor = decodeCursor(query.cursor, query.sort);
  if (cursor) {
    const index = rows.findIndex((row) => row.id === cursor.id &&
      (query.sort === "alphabetical" ? row.titleSearch : row.createdAt.toISOString()) === cursor.value);
    if (index < 0) throw new AppError("VALIDATION_ERROR", "The pagination cursor is invalid or stale.", 422, "cursor");
    rows = rows.slice(index + 1);
  }
  const visible = rows.slice(0, query.limit);
  const last = visible.at(-1);
  const nextCursor = rows.length > query.limit && last ? encodeCursor({
    sort: query.sort, value: query.sort === "alphabetical" ? last.titleSearch : last.createdAt.toISOString(), id: last.id,
  }) : null;
  return { items: visible.map(present), nextCursor };
}
