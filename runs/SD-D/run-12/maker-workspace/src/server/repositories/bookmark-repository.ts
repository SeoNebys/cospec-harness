import type { Bookmark, BookmarkWrite, Tag } from '../../shared/contracts/types.js';
import { canonicalizeUrl, normalizeOptionalText, normalizeSearch, normalizeTag } from '../../shared/normalization/index.js';
import { AppError } from '../api/errors.js';
import type { AppDatabase } from '../db/database.js';
import type { IconStore } from '../metadata/icon-store.js';
import { parseSearch } from '../search/parser.js';
import { compileSearch } from '../search/sql-compiler.js';

type BookmarkRow = { id:number;url:string;title:string;description:string|null;notes:string|null;icon_asset_id:number|null;is_favorite:number;is_unread:number;created_at:string;updated_at:string };
export class BookmarkRepository {
  constructor(private db: AppDatabase, private icons: IconStore) {}
  private tagsFor(id:number): Tag[] { return this.db.prepare(`SELECT t.id,t.display_name name FROM tags t JOIN bookmark_tags bt ON bt.tag_id=t.id WHERE bt.bookmark_id=? ORDER BY t.display_name`).all(id) as Tag[]; }
  private map(row:BookmarkRow): Bookmark { return { id:row.id,url:row.url,title:row.title,description:row.description,notes:row.notes,iconUrl:row.icon_asset_id ? `/api/icons/${row.icon_asset_id}`:null,tags:this.tagsFor(row.id),isFavorite:Boolean(row.is_favorite),isUnread:Boolean(row.is_unread),createdAt:row.created_at,updatedAt:row.updated_at }; }
  private validate(data:BookmarkWrite): BookmarkWrite & {description:string|null;notes:string|null;tags:string[]} {
    const title = data.title.trim(); const description = normalizeOptionalText(data.description); const notes = normalizeOptionalText(data.notes);
    if ([...title].length < 1 || [...title].length > 512) throw new AppError(422,'validation_error','Title must be between 1 and 512 characters.');
    if (description && [...description].length > 2000) throw new AppError(422,'validation_error','Description must be at most 2,000 characters.');
    if (notes && [...notes].length > 10000) throw new AppError(422,'validation_error','Notes must be at most 10,000 characters.');
    const distinctTags = new Map<string,string>();
    for (const tag of data.tags ?? []) { const normalized = normalizeTag(tag); if (normalized && !distinctTags.has(normalized)) distinctTags.set(normalized, tag.trim()); }
    const tags = [...distinctTags.values()];
    if (tags.length > 50 || tags.some((tag) => [...tag].length > 64)) throw new AppError(422,'validation_error','Use at most 50 tags of 64 characters each.');
    return {...data,title,description,notes,tags};
  }
  create(input:BookmarkWrite): Bookmark {
    const data = this.validate(input); let url:string;
    try { url = canonicalizeUrl(data.url); } catch { throw new AppError(422,'invalid_url','Enter a complete web address.'); }
    if (!['http:','https:'].includes(new URL(url).protocol)) throw new AppError(422,'unsupported_scheme','Only HTTP and HTTPS web addresses are supported.');
    const transact = this.db.transaction(() => {
      const now = new Date().toISOString(); const iconId = this.icons.consume(data.iconUploadToken);
      let result;
      try { result = this.db.prepare(`INSERT INTO bookmarks (url,normalized_url,title,description,notes,icon_asset_id,is_favorite,is_unread,created_at,updated_at,url_search,title_search,description_search,notes_search) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(url,url,data.title,data.description,data.notes,iconId,data.isFavorite?1:0,data.isUnread?1:0,now,now,normalizeSearch(url),normalizeSearch(data.title),normalizeSearch(data.description??''),normalizeSearch(data.notes??'')); }
      catch (error) { if (String(error).includes('UNIQUE')) { const existing = this.db.prepare('SELECT id FROM bookmarks WHERE normalized_url=?').get(url) as {id:number}|undefined; throw new AppError(409,'duplicate_bookmark','This destination is already saved.',{existingBookmarkId:existing?.id}); } throw error; }
      const id = Number(result.lastInsertRowid);
      for (const display of data.tags) { const normalized = normalizeTag(display); this.db.prepare('INSERT OR IGNORE INTO tags (display_name,normalized_name,search_name,created_at) VALUES (?,?,?,?)').run(display,normalized,normalizeSearch(display),now); const tag = this.db.prepare('SELECT id FROM tags WHERE normalized_name=?').get(normalized) as {id:number}; this.db.prepare('INSERT INTO bookmark_tags (bookmark_id,tag_id) VALUES (?,?)').run(id,tag.id); }
      return id;
    });
    return this.get(transact());
  }
  get(id:number): Bookmark { const row = this.db.prepare('SELECT * FROM bookmarks WHERE id=?').get(id) as BookmarkRow|undefined; if (!row) throw new AppError(404,'not_found','Bookmark not found.'); return this.map(row); }
  update(id:number,patch:Partial<BookmarkWrite>):Bookmark{const current=this.get(id);const data=this.validate({url:patch.url??current.url,title:patch.title??current.title,description:patch.description===undefined?current.description:patch.description,notes:patch.notes===undefined?current.notes:patch.notes,tags:patch.tags??current.tags.map(tag=>tag.name),isFavorite:patch.isFavorite??current.isFavorite,isUnread:patch.isUnread??current.isUnread,iconUploadToken:patch.iconUploadToken});let url:string;try{url=canonicalizeUrl(data.url)}catch{throw new AppError(422,'invalid_url','Enter a complete web address.')}const transact=this.db.transaction(()=>{const previous=this.db.prepare('SELECT icon_asset_id FROM bookmarks WHERE id=?').get(id)as{icon_asset_id:number|null};const iconId=patch.iconUploadToken===undefined?previous.icon_asset_id:this.icons.consume(patch.iconUploadToken);try{this.db.prepare(`UPDATE bookmarks SET url=?,normalized_url=?,title=?,description=?,notes=?,icon_asset_id=?,is_favorite=?,is_unread=?,updated_at=?,url_search=?,title_search=?,description_search=?,notes_search=? WHERE id=?`).run(url,url,data.title,data.description,data.notes,iconId,data.isFavorite?1:0,data.isUnread?1:0,new Date().toISOString(),normalizeSearch(url),normalizeSearch(data.title),normalizeSearch(data.description??''),normalizeSearch(data.notes??''),id)}catch(error){if(String(error).includes('UNIQUE'))throw new AppError(409,'duplicate_bookmark','This destination is already saved.');throw error}this.db.prepare('DELETE FROM bookmark_tags WHERE bookmark_id=?').run(id);const now=new Date().toISOString();for(const display of data.tags){const normalized=normalizeTag(display);this.db.prepare('INSERT OR IGNORE INTO tags (display_name,normalized_name,search_name,created_at) VALUES (?,?,?,?)').run(display,normalized,normalizeSearch(display),now);const tag=this.db.prepare('SELECT id FROM tags WHERE normalized_name=?').get(normalized)as{id:number};this.db.prepare('INSERT INTO bookmark_tags (bookmark_id,tag_id) VALUES (?,?)').run(id,tag.id)}this.cleanupOrphans();});transact();return this.get(id)}
  delete(id:number):void{this.get(id);const transact=this.db.transaction(()=>{this.db.prepare('DELETE FROM bookmarks WHERE id=?').run(id);this.cleanupOrphans()});transact()}
  private cleanupOrphans(){this.db.prepare('DELETE FROM tags WHERE NOT EXISTS (SELECT 1 FROM bookmark_tags WHERE tag_id=tags.id)').run();this.db.prepare('DELETE FROM icon_assets WHERE NOT EXISTS (SELECT 1 FROM bookmarks WHERE icon_asset_id=icon_assets.id)').run()}
  list(options:{limit?:number;query?:string;tags?:string[];favorite?:boolean;unread?:boolean;cursor?:string}={}): {items:Bookmark[];nextCursor:string|null} {
    const limit=options.limit??100;const conditions:string[]=[];const params:unknown[]=[];
    const ast=parseSearch(options.query??'');if(ast){const compiled=compileSearch(ast);conditions.push(compiled.sql);params.push(...compiled.params)}
    for(const tag of options.tags??[]){conditions.push('EXISTS (SELECT 1 FROM bookmark_tags fbt JOIN tags ft ON ft.id=fbt.tag_id WHERE fbt.bookmark_id=b.id AND ft.normalized_name=?)');params.push(normalizeTag(tag))}
    if(options.favorite!==undefined){conditions.push('b.is_favorite=?');params.push(options.favorite?1:0)}if(options.unread!==undefined){conditions.push('b.is_unread=?');params.push(options.unread?1:0)}
    if(options.cursor){try{const[cursorDate,cursorId]=Buffer.from(options.cursor,'base64url').toString().split('|');conditions.push('(b.created_at < ? OR (b.created_at = ? AND b.id < ?))');params.push(cursorDate,cursorDate,Number(cursorId))}catch{throw new AppError(422,'invalid_cursor','The result cursor is invalid.')}}
    const sql=`SELECT b.* FROM bookmarks b ${conditions.length?`WHERE ${conditions.join(' AND ')}`:''} ORDER BY b.created_at DESC,b.id DESC LIMIT ?`;params.push(limit+1);
    const rows=this.db.prepare(sql).all(...params) as BookmarkRow[];const more=rows.length>limit;const visible=rows.slice(0,limit);const last=visible.at(-1);return{items:visible.map(row=>this.map(row)),nextCursor:more&&last?Buffer.from(`${last.created_at}|${last.id}`).toString('base64url'):null};
  }
  icon(id:number) { return this.icons.get(id); }
}
