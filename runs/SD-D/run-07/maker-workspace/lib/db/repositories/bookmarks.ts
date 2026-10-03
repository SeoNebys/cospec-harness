import type Database from "better-sqlite3";
import type { Bookmark } from "@/lib/domain/types";

type Row = Record<string, string | number | null>;
export function rowToBookmark(db: Database.Database, row: Row): Bookmark {
  const tags=typeof row.tag_names==="string"?(row.tag_names?row.tag_names.split("\u001f"):[]):(db.prepare(`SELECT t.display_name name FROM tags t JOIN bookmark_tags bt ON bt.tag_id=t.id WHERE bt.bookmark_id=? ORDER BY t.normalized_name`).all(row.id) as {name:string}[]).map(t=>t.name);
  return { id:String(row.id), url:String(row.url_original), normalizedUrl:String(row.url_normalized), title:String(row.title), description:String(row.description||""), note:String(row.note||""), iconUrl:row.icon_url?String(row.icon_url):null, isFavorite:Boolean(row.is_favorite), isRead:Boolean(row.is_read), archivedAt:row.archived_at?String(row.archived_at):null, createdAt:String(row.created_at), updatedAt:String(row.updated_at), tags };
}
export function getBookmark(db: Database.Database,id:string) { const row=db.prepare("SELECT * FROM bookmarks WHERE id=?").get(id) as Row|undefined; return row?rowToBookmark(db,row):null; }
export function getByNormalizedUrl(db: Database.Database,url:string) { const row=db.prepare("SELECT * FROM bookmarks WHERE url_normalized=?").get(url) as Row|undefined; return row?rowToBookmark(db,row):null; }
