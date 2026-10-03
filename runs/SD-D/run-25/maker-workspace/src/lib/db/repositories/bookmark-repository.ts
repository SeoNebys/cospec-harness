import { randomUUID } from "node:crypto";
import { getSqlite } from "@/lib/db/client";
import { parseSearchQuery } from "@/features/bookmarks/search-parser";
import { compileSearch } from "@/features/bookmarks/search-compiler";
import type { Bookmark, CollectionView, SortOrder } from "@/features/bookmarks/types";
import type { MetadataStatus, ReadingState } from "@/lib/db/schema";
import { assertOwnerScope } from "./owned-repository";
import { replaceBookmarkTags } from "./tag-repository";
import { syncBookmarkSearch } from "./search-repository";

type BookmarkRow = {
  id: string; url: string; normalized_url: string; title: string; page_description: string | null;
  icon_key: string | null; note_markdown: string | null; reading_state: ReadingState; archived_at: number | null;
  metadata_status: MetadataStatus; metadata_fetched_at: number | null; created_at: number; updated_at: number;
  tags: string | null;
};

function mapBookmark(row: BookmarkRow): Bookmark {
  return {
    id: row.id,
    url: row.url,
    normalizedUrl: row.normalized_url,
    title: row.title,
    pageDescription: row.page_description,
    iconKey: row.icon_key,
    iconUrl: `/api/bookmarks/${row.id}/icon`,
    noteMarkdown: row.note_markdown,
    readingState: row.reading_state,
    archived: row.archived_at !== null,
    archivedAt: row.archived_at ? new Date(row.archived_at).toISOString() : null,
    metadataStatus: row.metadata_status,
    metadataFetchedAt: row.metadata_fetched_at ? new Date(row.metadata_fetched_at).toISOString() : null,
    tags: row.tags ? row.tags.split("\u001f") : [],
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
    domain: new URL(row.url).hostname.replace(/^www\./, ""),
  };
}

const selectFields = `b.id, b.url, b.normalized_url, b.title, b.page_description, b.icon_key, b.note_markdown,
 b.reading_state, b.archived_at, b.metadata_status, b.metadata_fetched_at, b.created_at, b.updated_at,
 GROUP_CONCAT(t.display_name, char(31)) AS tags`;
const joins = `FROM bookmarks b LEFT JOIN bookmark_tags bt ON bt.bookmark_id = b.id LEFT JOIN tags t ON t.id = bt.tag_id`;

export function findBookmark(userId: string, id: string, sqlite = getSqlite()): Bookmark | null {
  assertOwnerScope({ userId });
  const row = sqlite.prepare(`SELECT ${selectFields} ${joins} WHERE b.user_id = ? AND b.id = ? GROUP BY b.id`).get(userId, id) as BookmarkRow | undefined;
  return row ? mapBookmark(row) : null;
}

export function findDuplicate(userId: string, normalizedUrl: string, excludeId?: string, sqlite = getSqlite()): Bookmark | null {
  const row = sqlite.prepare(`SELECT ${selectFields} ${joins} WHERE b.user_id = ? AND b.normalized_url = ? ${excludeId ? "AND b.id <> ?" : ""} GROUP BY b.id`).get(...(excludeId ? [userId, normalizedUrl, excludeId] : [userId, normalizedUrl])) as BookmarkRow | undefined;
  return row ? mapBookmark(row) : null;
}

export function listBookmarks(userId: string, options: { view?: CollectionView; q?: string; tag?: string; readingState?: ReadingState; sort?: SortOrder; limit?: number } = {}, sqlite = getSqlite()): Bookmark[] {
  assertOwnerScope({ userId });
  const view = options.view ?? "active";
  const conditions = ["b.user_id = ?"];
  const params: unknown[] = [userId];
  if (view === "archive") conditions.push("b.archived_at IS NOT NULL");
  else conditions.push("b.archived_at IS NULL");
  if (view === "unread") conditions.push("b.reading_state = 'unread'");
  if (options.readingState) { conditions.push("b.reading_state = ?"); params.push(options.readingState); }
  if (options.tag) {
    conditions.push("EXISTS (SELECT 1 FROM bookmark_tags bt_filter JOIN tags t_filter ON t_filter.id = bt_filter.tag_id WHERE bt_filter.bookmark_id = b.id AND t_filter.normalized_name = ?)");
    params.push(options.tag.normalize("NFC").trim().toLocaleLowerCase("und"));
  }
  if (options.q?.trim()) {
    const compiled = compileSearch(parseSearchQuery(options.q), "b");
    conditions.push(compiled.sql);
    params.push(...compiled.params);
  }
  const order = options.sort === "oldest" ? "b.created_at ASC, b.id ASC" : options.sort === "title" ? "b.title COLLATE NOCASE ASC, b.id ASC" : "b.created_at DESC, b.id DESC";
  const limit = Math.min(Math.max(options.limit ?? 100, 1), 100);
  params.push(limit);
  const rows = sqlite.prepare(`SELECT ${selectFields} ${joins} WHERE ${conditions.join(" AND ")} GROUP BY b.id ORDER BY ${order} LIMIT ?`).all(...params) as BookmarkRow[];
  return rows.map(mapBookmark);
}

export type CreateBookmarkRecord = {
  userId: string; url: string; normalizedUrl: string; title: string; pageDescription: string | null;
  iconKey: string | null; noteMarkdown?: string | null; notePlainText?: string; readingState?: ReadingState;
  metadataStatus: MetadataStatus; tags?: string[];
};

export function createBookmark(input: CreateBookmarkRecord, sqlite = getSqlite()): Bookmark {
  assertOwnerScope({ userId: input.userId });
  const id = randomUUID();
  const now = Date.now();
  sqlite.transaction(() => {
    sqlite.prepare(`INSERT INTO bookmarks
      (id,user_id,url,normalized_url,normalization_version,title,title_user_edited,page_description,description_user_edited,icon_key,note_markdown,note_plain_text,reading_state,metadata_status,metadata_fetched_at,created_at,updated_at)
      VALUES (?,?,?,?,1,?,1,?,1,?,?,?,?,?,?,?,?)`).run(
        id, input.userId, input.url, input.normalizedUrl, input.title, input.pageDescription, input.iconKey,
        input.noteMarkdown ?? null, input.notePlainText ?? "", input.readingState ?? "none", input.metadataStatus, now, now, now,
      );
    replaceBookmarkTags(sqlite, input.userId, id, input.tags ?? []);
    syncBookmarkSearch(sqlite, id);
  })();
  return findBookmark(input.userId, id, sqlite)!;
}

export function updateBookmarkRecord(userId: string, id: string, values: Partial<CreateBookmarkRecord> & { archived?: boolean }, sqlite = getSqlite()): Bookmark | null {
  assertOwnerScope({ userId });
  if (!findBookmark(userId, id, sqlite)) return null;
  sqlite.transaction(() => {
    const sets: string[] = [];
    const params: unknown[] = [];
    const add = (column: string, value: unknown) => { sets.push(`${column} = ?`); params.push(value); };
    if (values.url !== undefined) add("url", values.url);
    if (values.normalizedUrl !== undefined) add("normalized_url", values.normalizedUrl);
    if (values.title !== undefined) { add("title", values.title); add("title_user_edited", 1); }
    if (values.pageDescription !== undefined) { add("page_description", values.pageDescription); add("description_user_edited", 1); }
    if (values.iconKey !== undefined) add("icon_key", values.iconKey);
    if (values.noteMarkdown !== undefined) add("note_markdown", values.noteMarkdown);
    if (values.notePlainText !== undefined) add("note_plain_text", values.notePlainText);
    if (values.readingState !== undefined) add("reading_state", values.readingState);
    if (values.metadataStatus !== undefined) { add("metadata_status", values.metadataStatus); add("metadata_fetched_at", Date.now()); }
    if (values.archived !== undefined) add("archived_at", values.archived ? Date.now() : null);
    add("updated_at", Date.now());
    sqlite.prepare(`UPDATE bookmarks SET ${sets.join(", ")} WHERE user_id = ? AND id = ?`).run(...params, userId, id);
    if (values.tags) replaceBookmarkTags(sqlite, userId, id, values.tags);
    syncBookmarkSearch(sqlite, id);
  })();
  return findBookmark(userId, id, sqlite);
}

export function permanentlyDelete(userId: string, ids: string[], sqlite = getSqlite()): string[] {
  assertOwnerScope({ userId });
  const found = sqlite.prepare(`SELECT id FROM bookmarks WHERE user_id = ? AND id IN (${ids.map(() => "?").join(",")})`).all(userId, ...ids) as { id: string }[];
  sqlite.transaction(() => {
    for (const row of found) {
      sqlite.prepare("DELETE FROM bookmark_search WHERE bookmark_id = ?").run(row.id);
      sqlite.prepare("DELETE FROM bookmarks WHERE user_id = ? AND id = ?").run(userId, row.id);
    }
    sqlite.prepare("DELETE FROM tags WHERE user_id = ? AND NOT EXISTS (SELECT 1 FROM bookmark_tags WHERE tag_id = tags.id)").run(userId);
  })();
  return found.map((row) => row.id);
}
