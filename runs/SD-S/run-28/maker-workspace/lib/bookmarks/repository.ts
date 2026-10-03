import type { AppDatabase } from "@/lib/db/client";
import { getDb } from "@/lib/db/client";
import { uuidv7 } from "@/lib/bookmarks/id";
import { ensureTags } from "@/lib/bookmarks/tags";
import type { BookmarkDto, BookmarkStatus, MetadataResult, TagDto, TitleSource } from "@/lib/bookmarks/types";
import { normalizeBookmarkUrl } from "@/lib/metadata/url";

interface BookmarkRow {
  id: string; url: string; title: string; title_source: TitleSource; description: string | null; notes: string | null;
  icon_asset_id: string | null; metadata_status: "complete"|"partial"|"failed"; metadata_message_code: string | null;
  is_favorite: number; status: BookmarkStatus; version: number; archived_at: string | null; created_at: string; updated_at: string;
}

const messages: Record<string,string> = {
  timeout: "The page took too long to respond, so we saved it with a fallback title.",
  unreachable: "The page could not be reached, so we saved it with a fallback title.",
  unsafe_destination: "Page details were unavailable for this address, but the bookmark was saved.",
  unsupported_content: "This page does not publish readable page details, but the bookmark was saved.",
  too_large: "The page was too large to preview, but the bookmark was saved.",
  no_title: "The page did not publish a title, so we created one from its address.",
  icon_unavailable: "The title was found, but the page icon could not be saved.",
  parse_error: "Page details could not be read, but the bookmark was saved.",
};

function tagsFor(database: AppDatabase, bookmarkId: string): TagDto[] {
  return database.prepare(`SELECT t.id, t.name FROM tags t JOIN bookmark_tags bt ON bt.tag_id=t.id WHERE bt.bookmark_id=? ORDER BY t.name COLLATE NOCASE`).all(bookmarkId) as TagDto[];
}

function dto(database: AppDatabase, row: BookmarkRow): BookmarkDto {
  return {
    id: row.id, url: row.url, title: row.title, titleSource: row.title_source, description: row.description, notes: row.notes,
    iconUrl: row.icon_asset_id ? `/api/icons/${row.icon_asset_id}` : null,
    metadataStatus: row.metadata_status, metadataMessage: row.metadata_message_code ? messages[row.metadata_message_code] ?? "Some page details were unavailable." : null,
    isFavorite: Boolean(row.is_favorite), status: row.status, tags: tagsFor(database,row.id), version: row.version,
    archivedAt: row.archived_at, createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

function refreshSearch(database: AppDatabase, bookmarkId: string): void {
  const row = database.prepare("SELECT id,user_id,title,url,description,notes FROM bookmarks WHERE id=?").get(bookmarkId) as {id:string;user_id:string;title:string;url:string;description:string|null;notes:string|null}|undefined;
  database.prepare("DELETE FROM bookmark_search WHERE bookmark_id=?").run(bookmarkId);
  if (!row) return;
  const tags = (database.prepare(`SELECT t.normalized_name FROM tags t JOIN bookmark_tags bt ON bt.tag_id=t.id WHERE bt.bookmark_id=?`).all(bookmarkId) as Array<{normalized_name:string}>).map((tag)=>tag.normalized_name).join(" ");
  database.prepare("INSERT INTO bookmark_search(bookmark_id,user_id,title,url,description,notes,tags) VALUES (?,?,?,?,?,?,?)").run(row.id,row.user_id,row.title,row.url,row.description??"",row.notes??"",tags);
}

function replaceTags(database: AppDatabase, bookmarkId: string, userId: string, names: string[]): void {
  const tags = ensureTags(database,userId,names);
  database.prepare("DELETE FROM bookmark_tags WHERE bookmark_id=?").run(bookmarkId);
  const insert = database.prepare("INSERT INTO bookmark_tags(bookmark_id,tag_id,created_at) VALUES (?,?,?)");
  for (const tag of tags) insert.run(bookmarkId,tag.id,new Date().toISOString());
}

export function findDuplicate(userId: string, hash: Buffer, database=getDb()): BookmarkDto | null {
  const row = database.prepare("SELECT * FROM bookmarks WHERE user_id=? AND normalized_url_hash=? ORDER BY created_at DESC LIMIT 1").get(userId,hash) as BookmarkRow|undefined;
  return row ? dto(database,row) : null;
}

export function createBookmarkRecord(input: {userId:string;url:string;hash:Buffer;fallbackTitle:string;metadata:MetadataResult;notes?:string;tags?:string[]}, database=getDb()): BookmarkDto {
  return database.transaction(() => {
    const now=new Date().toISOString(); const id=uuidv7();
    if (input.metadata.icon) database.prepare("INSERT OR IGNORE INTO icon_assets(id,media_type,content,byte_length,created_at) VALUES (?,?,?,?,?)").run(input.metadata.icon.id,input.metadata.icon.mediaType,input.metadata.icon.content,input.metadata.icon.content.length,now);
    const title=input.metadata.title ?? input.fallbackTitle;
    database.prepare(`INSERT INTO bookmarks(id,user_id,url,normalized_url_hash,title,title_source,description,notes,icon_asset_id,metadata_status,metadata_message_code,is_favorite,status,archived_at,version,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,0,'active',NULL,1,?,?)`).run(id,input.userId,input.url,input.hash,title,input.metadata.title?"metadata":"fallback",input.metadata.description,input.notes?.trim()||null,input.metadata.icon?.id??null,input.metadata.status,input.metadata.messageCode,now,now);
    if (input.tags?.length) replaceTags(database,id,input.userId,input.tags);
    refreshSearch(database,id);
    return getBookmark(input.userId,id,database)!;
  })();
}

export function getBookmark(userId:string,id:string,database=getDb()): BookmarkDto|null {
  const row=database.prepare("SELECT * FROM bookmarks WHERE id=? AND user_id=?").get(id,userId) as BookmarkRow|undefined;
  return row?dto(database,row):null;
}

export function listBookmarks(userId:string,input:{q?:string;tags?:string[];favorite?:boolean;status?:BookmarkStatus;cursor?:string;limit?:number},database=getDb()):{items:BookmarkDto[];nextCursor:string|null} {
  const where=["b.user_id = ?","b.status = ?"]; const args:unknown[]=[userId,input.status??"active"];
  const join="";
  if(input.q?.trim()) { where.push("b.id IN (SELECT bookmark_id FROM bookmark_search WHERE user_id=? AND bookmark_search MATCH ?)"); args.push(userId,input.q.trim().split(/\s+/).map((v)=>`\"${v.replaceAll('"','')}\"`).join(" AND ")); }
  if(input.favorite!==undefined){where.push("b.is_favorite=?");args.push(input.favorite?1:0);}
  for(const tag of input.tags??[]){where.push("EXISTS (SELECT 1 FROM bookmark_tags bt JOIN tags t ON t.id=bt.tag_id WHERE bt.bookmark_id=b.id AND t.user_id=b.user_id AND t.normalized_name=?)");args.push(tag.trim().normalize("NFKC").toLocaleLowerCase("en-US"));}
  if(input.cursor){try{const [created,id]=JSON.parse(Buffer.from(input.cursor,"base64url").toString()) as [string,string];where.push("(b.created_at < ? OR (b.created_at = ? AND b.id < ?))");args.push(created,created,id);}catch{throw new Error("CURSOR_INVALID");}}
  const limit=Math.min(100,Math.max(1,input.limit??50));
  const rows=database.prepare(`SELECT b.* FROM bookmarks b ${join} WHERE ${where.join(" AND ")} ORDER BY b.created_at DESC,b.id DESC LIMIT ?`).all(...args,limit+1) as BookmarkRow[];
  const hasMore=rows.length>limit; const page=rows.slice(0,limit); const last=page.at(-1);
  return {items:page.map((row)=>dto(database,row)),nextCursor:hasMore&&last?Buffer.from(JSON.stringify([last.created_at,last.id])).toString("base64url"):null};
}

export function updateBookmarkRecord(userId:string,id:string,input:{version:number;title?:string;url?:string;notes?:string|null;tags?:string[];isFavorite?:boolean;status?:BookmarkStatus},database=getDb()):BookmarkDto|null|"conflict" {
  return database.transaction(()=>{
    const current=database.prepare("SELECT * FROM bookmarks WHERE id=? AND user_id=?").get(id,userId) as BookmarkRow|undefined;
    if(!current)return null; if(current.version!==input.version)return "conflict";
    let url=current.url; let hash:Buffer|undefined;
    if(input.url!==undefined){const normalized=normalizeBookmarkUrl(input.url);url=normalized.storedUrl;hash=normalized.hash;}
    const title=input.title!==undefined?input.title.trim():current.title;
    if(!title||[...title].length>300)throw new Error("TITLE_INVALID");
    const notes=input.notes===undefined?current.notes:(input.notes?.trim()||null); if(notes&&[...notes].length>5000)throw new Error("NOTES_INVALID");
    const status=input.status??current.status; const now=new Date().toISOString(); const archivedAt=status==="archived"?(current.archived_at??now):null;
    const result=database.prepare(`UPDATE bookmarks SET url=?,normalized_url_hash=COALESCE(?,normalized_url_hash),title=?,title_source=?,notes=?,is_favorite=?,status=?,archived_at=?,version=version+1,updated_at=? WHERE id=? AND user_id=? AND version=?`).run(url,hash??null,title,input.title!==undefined?"user":current.title_source,notes,input.isFavorite===undefined?current.is_favorite:(input.isFavorite?1:0),status,archivedAt,now,id,userId,input.version);
    if(!result.changes)return "conflict"; if(input.tags!==undefined)replaceTags(database,id,userId,input.tags); refreshSearch(database,id); return getBookmark(userId,id,database)!;
  })();
}

export function deleteBookmarkRecord(userId:string,id:string,version:number,database=getDb()):"deleted"|"missing"|"conflict" {
  return database.transaction(()=>{const row=database.prepare("SELECT version FROM bookmarks WHERE id=? AND user_id=?").get(id,userId) as {version:number}|undefined;if(!row)return "missing";if(row.version!==version)return "conflict";database.prepare("DELETE FROM bookmark_search WHERE bookmark_id=?").run(id);database.prepare("DELETE FROM bookmarks WHERE id=? AND user_id=?").run(id,userId);return "deleted";})();
}

export function listTags(userId:string,database=getDb()):TagDto[]{return database.prepare("SELECT id,name FROM tags WHERE user_id=? ORDER BY name COLLATE NOCASE").all(userId) as TagDto[];}

export function getOwnedIcon(userId:string,id:string,database=getDb()):{mediaType:string;content:Buffer}|null {const row=database.prepare(`SELECT i.media_type mediaType,i.content FROM icon_assets i WHERE i.id=? AND EXISTS(SELECT 1 FROM bookmarks b WHERE b.icon_asset_id=i.id AND b.user_id=?)`).get(id,userId) as {mediaType:string;content:Buffer}|undefined;return row??null;}

export function rebuildSearch(database=getDb()):number{database.prepare("DELETE FROM bookmark_search").run();const rows=database.prepare("SELECT id FROM bookmarks").all() as Array<{id:string}>;for(const row of rows)refreshSearch(database,row.id);return rows.length;}
