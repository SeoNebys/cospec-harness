import { randomUUID } from "node:crypto";
import { sqlite } from "./connection";
import type { Bookmark, BookmarkInput, TagSummary } from "@/lib/contracts/bookmark";
import { cleanText, normalizeTag, parseBookmarkUrl, ValidationError } from "../validation";
import { DuplicateError, NotFoundError } from "../http-errors";

type BookmarkRow = { id: string; url: string; title: string; description: string | null; created_at: number; updated_at: number };

function hydrate(row: BookmarkRow): Bookmark {
  const tagRows = sqlite.prepare(`SELECT t.name FROM tags t JOIN bookmark_tags bt ON bt.tag_id=t.id WHERE bt.bookmark_id=? ORDER BY lower(t.name)`).all(row.id) as {name:string}[];
  return { id: row.id, url: row.url, title: row.title, description: row.description, tags: tagRows.map(t => t.name), createdAt: new Date(row.created_at).toISOString(), updatedAt: new Date(row.updated_at).toISOString() };
}

function normalizeInput(input: BookmarkInput) {
  const parsed = parseBookmarkUrl(input.url);
  const title = cleanText(input.title || parsed.url, 300) || parsed.url.slice(0, 300);
  const description = input.description ? cleanText(input.description, 300) : null;
  const tagMap = new Map<string,string>();
  for (const raw of input.tags) { const tag = normalizeTag(raw); if (tag.name) tagMap.set(tag.normalizedName, tag.name); }
  if (tagMap.size > 20) throw new ValidationError("Use no more than 20 tags.", "tags");
  return { ...parsed, title, description, tags: [...tagMap].map(([normalizedName,name]) => ({ normalizedName,name })) };
}

function attachTags(bookmarkId: string, tagList: {name:string;normalizedName:string}[]) {
  for (const tag of tagList) {
    const existing = sqlite.prepare("SELECT id FROM tags WHERE normalized_name=?").get(tag.normalizedName) as {id:string}|undefined;
    const id = existing?.id ?? randomUUID();
    if (!existing) sqlite.prepare("INSERT INTO tags(id,name,normalized_name) VALUES(?,?,?)").run(id,tag.name,tag.normalizedName);
    sqlite.prepare("INSERT OR IGNORE INTO bookmark_tags(bookmark_id,tag_id) VALUES(?,?)").run(bookmarkId,id);
  }
}

export function listBookmarks(q = "", tag = "") {
  const query = q.trim().toLocaleLowerCase("en-US");
  const normalizedTag = normalizeTag(tag).normalizedName;
  const rows = sqlite.prepare(`
    SELECT DISTINCT b.* FROM bookmarks b
    LEFT JOIN bookmark_tags bt ON bt.bookmark_id=b.id LEFT JOIN tags t ON t.id=bt.tag_id
    WHERE (?='' OR lower(b.title) LIKE ? OR lower(b.url) LIKE ? OR lower(coalesce(b.description,'')) LIKE ? OR lower(coalesce(t.name,'')) LIKE ?)
      AND (?='' OR EXISTS(SELECT 1 FROM bookmark_tags x JOIN tags xt ON xt.id=x.tag_id WHERE x.bookmark_id=b.id AND xt.normalized_name=?))
    ORDER BY b.created_at DESC
  `).all(query,`%${query}%`,`%${query}%`,`%${query}%`,`%${query}%`,normalizedTag,normalizedTag) as BookmarkRow[];
  return rows.map(hydrate);
}

export function createBookmark(input: BookmarkInput) {
  const n = normalizeInput(input); const existing = sqlite.prepare("SELECT id FROM bookmarks WHERE normalized_url=?").get(n.normalizedUrl) as {id:string}|undefined;
  if (existing) throw new DuplicateError(existing.id);
  const id=randomUUID(), now=Date.now();
  sqlite.transaction(() => { sqlite.prepare("INSERT INTO bookmarks(id,url,normalized_url,title,description,created_at,updated_at) VALUES(?,?,?,?,?,?,?)").run(id,n.url,n.normalizedUrl,n.title,n.description,now,now); attachTags(id,n.tags); })();
  return hydrate(sqlite.prepare("SELECT * FROM bookmarks WHERE id=?").get(id) as BookmarkRow);
}

export function updateBookmark(id: string, input: BookmarkInput) {
  if (!sqlite.prepare("SELECT id FROM bookmarks WHERE id=?").get(id)) throw new NotFoundError();
  const n=normalizeInput(input); const duplicate=sqlite.prepare("SELECT id FROM bookmarks WHERE normalized_url=? AND id<>?").get(n.normalizedUrl,id) as {id:string}|undefined;
  if (duplicate) throw new DuplicateError(duplicate.id);
  sqlite.transaction(() => {
    sqlite.prepare("UPDATE bookmarks SET url=?, normalized_url=?, title=?, description=?, updated_at=? WHERE id=?").run(n.url,n.normalizedUrl,n.title,n.description,Date.now(),id);
    sqlite.prepare("DELETE FROM bookmark_tags WHERE bookmark_id=?").run(id); attachTags(id,n.tags);
    sqlite.prepare("DELETE FROM tags WHERE NOT EXISTS(SELECT 1 FROM bookmark_tags WHERE tag_id=tags.id)").run();
  })();
  return hydrate(sqlite.prepare("SELECT * FROM bookmarks WHERE id=?").get(id) as BookmarkRow);
}

export function deleteBookmark(id: string) {
  sqlite.transaction(() => { const result=sqlite.prepare("DELETE FROM bookmarks WHERE id=?").run(id); if (!result.changes) throw new NotFoundError(); sqlite.prepare("DELETE FROM tags WHERE NOT EXISTS(SELECT 1 FROM bookmark_tags WHERE tag_id=tags.id)").run(); })();
}

export function listTags(): TagSummary[] {
  return sqlite.prepare("SELECT t.name, count(bt.bookmark_id) count FROM tags t JOIN bookmark_tags bt ON bt.tag_id=t.id GROUP BY t.id ORDER BY lower(t.name)").all() as TagSummary[];
}
