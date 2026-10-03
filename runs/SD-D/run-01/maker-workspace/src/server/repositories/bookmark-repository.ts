import { randomUUID } from 'node:crypto';
import type { Database } from '../db/database.js';
import { transaction } from '../db/transaction.js';
import type { NormalizedIcon } from '../services/metadata/icon-normalizer.js';
import type { ReadLaterState } from '../services/bookmarks/read-later-state.js';
import { TagRepository } from './tag-repository.js';

interface BookmarkRow { id:string; user_id:string; url:string; canonical_key:string; title:string; description:string; notes:string; is_favorite:number; read_later_state:ReadLaterState; read_later_added_at:string|null; read_at:string|null; archived_at:string|null; created_at:string; updated_at:string }
export interface BookmarkCreate { url:string;canonicalKey:string;title:string;description:string;notes:string;tags:string[];isFavorite:boolean;readLaterState:ReadLaterState;readLaterAddedAt:string|null;readAt:string|null; icon?:NormalizedIcon; createdAt?:string; updatedAt?:string; archivedAt?:string|null }
export interface ListOptions { scope?:'active'|'read-later'|'archive';q?:string;tags?:string[];favorite?:boolean;readLaterState?:ReadLaterState;sort?:'title'|'createdAt';direction?:'asc'|'desc';limit?:number;offset?:number }

export class BookmarkRepository {
  private tags: TagRepository;
  constructor(private db: Database) { this.tags = new TagRepository(db); }
  create(userId: string, input: BookmarkCreate) {
    return transaction(this.db, () => {
      const id=randomUUID(); const now=new Date().toISOString(); const created=input.createdAt ?? now; const updated=input.updatedAt ?? created;
      this.db.prepare(`INSERT INTO bookmarks(id,user_id,url,canonical_key,title,description,notes,is_favorite,read_later_state,read_later_added_at,read_at,archived_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(id,userId,input.url,input.canonicalKey,input.title,input.description,input.notes,input.isFavorite?1:0,input.readLaterState,input.readLaterAddedAt,input.readAt,input.archivedAt ?? null,created,updated);
      for (const value of [...new Set(input.tags.map(t=>t.trim()).filter(Boolean))]) { const tag=this.tags.ensure(userId,value); this.db.prepare('INSERT OR IGNORE INTO bookmark_tags(bookmark_id,tag_id) VALUES (?,?)').run(id,tag.id); }
      if (input.icon) this.db.prepare('INSERT INTO bookmark_icons(bookmark_id,user_id,media_type,data,width,height) VALUES (?, ?, ?, ?, ?, ?)').run(id,userId,'image/png',input.icon.data,input.icon.width,input.icon.height);
      this.syncSearch(userId,id); return this.get(userId,id)!;
    });
  }
  get(userId:string,id:string) { const row=this.db.prepare('SELECT * FROM bookmarks WHERE user_id=? AND id=?').get(userId,id) as BookmarkRow|undefined; return row ? this.present(row) : undefined; }
  findByCanonical(userId:string,key:string) { const row=this.db.prepare('SELECT * FROM bookmarks WHERE user_id=? AND canonical_key=?').get(userId,key) as BookmarkRow|undefined; return row ? this.present(row) : undefined; }
  list(userId:string, options:ListOptions={}, fts?:string) {
    const where=['b.user_id=?']; const params:any[]=[userId]; const scope=options.scope??'active';
    if(scope==='archive') where.push('b.archived_at IS NOT NULL'); else where.push('b.archived_at IS NULL');
    if(scope==='read-later') where.push("b.read_later_state='unread'");
    if(options.favorite!==undefined){where.push('b.is_favorite=?');params.push(options.favorite?1:0);}
    if(options.readLaterState){where.push('b.read_later_state=?');params.push(options.readLaterState);}
    if(fts){where.push('b.id IN (SELECT bookmark_id FROM bookmark_search WHERE bookmark_search MATCH ? AND user_id=?)');params.push(fts,userId);}
    for(const tag of options.tags??[]){where.push('EXISTS (SELECT 1 FROM bookmark_tags bt JOIN tags t ON t.id=bt.tag_id WHERE bt.bookmark_id=b.id AND t.user_id=b.user_id AND t.name_key=lower(trim(?)))');params.push(tag);}
    const column=options.sort==='title'?'b.title COLLATE NOCASE':'b.created_at'; const direction=options.direction==='asc'?'ASC':'DESC'; const limit=Math.max(1,Math.min(options.limit??50,100)); const offset=Math.max(0,options.offset??0);
    const rows=this.db.prepare(`SELECT b.* FROM bookmarks b WHERE ${where.join(' AND ')} ORDER BY ${column} ${direction}, b.id ${direction} LIMIT ? OFFSET ?`).all(...params,limit,offset) as unknown as BookmarkRow[];
    const count=(this.db.prepare(`SELECT count(*) total FROM bookmarks b WHERE ${where.join(' AND ')}`).get(...params) as {total:number}).total;
    return {items:rows.map(row=>this.present(row)),total:count,limit,offset};
  }
  update(userId:string,id:string, values:Partial<BookmarkCreate>) {
    return transaction(this.db,()=>{ const current=this.db.prepare('SELECT * FROM bookmarks WHERE user_id=? AND id=?').get(userId,id) as BookmarkRow|undefined; if(!current)return undefined;
      const sets:string[]=[];const params:any[]=[];const map:Record<string,string>={url:'url',canonicalKey:'canonical_key',title:'title',description:'description',notes:'notes',isFavorite:'is_favorite',readLaterState:'read_later_state',readLaterAddedAt:'read_later_added_at',readAt:'read_at',archivedAt:'archived_at'};
      for(const [key,column] of Object.entries(map)){if(key in values){sets.push(`${column}=?`);let value=(values as any)[key];if(key==='isFavorite')value=value?1:0;params.push(value);}}
      sets.push('updated_at=?');params.push(new Date().toISOString(),userId,id);this.db.prepare(`UPDATE bookmarks SET ${sets.join(',')} WHERE user_id=? AND id=?`).run(...params);
      if(values.tags){this.db.prepare('DELETE FROM bookmark_tags WHERE bookmark_id=?').run(id);for(const value of [...new Set(values.tags)]){const tag=this.tags.ensure(userId,value);this.db.prepare('INSERT OR IGNORE INTO bookmark_tags(bookmark_id,tag_id) VALUES (?,?)').run(id,tag.id);}this.tags.cleanOrphans(userId);}
      this.syncSearch(userId,id);return this.get(userId,id);});
  }
  delete(userId:string,id:string){return transaction(this.db,()=>{const result=this.db.prepare('DELETE FROM bookmarks WHERE user_id=? AND id=?').run(userId,id);this.db.prepare('DELETE FROM bookmark_search WHERE user_id=? AND bookmark_id=?').run(userId,id);this.tags.cleanOrphans(userId);return result.changes>0;});}
  icon(userId:string,id:string){return this.db.prepare('SELECT data,width,height FROM bookmark_icons WHERE user_id=? AND bookmark_id=?').get(userId,id) as {data:Uint8Array;width:number;height:number}|undefined;}
  count(userId:string){return (this.db.prepare('SELECT count(*) total FROM bookmarks WHERE user_id=?').get(userId) as {total:number}).total;}
  private syncSearch(userId:string,id:string){this.db.prepare('DELETE FROM bookmark_search WHERE user_id=? AND bookmark_id=?').run(userId,id);const row=this.db.prepare(`SELECT b.id,b.user_id,b.title,b.url,b.description,b.notes,coalesce(group_concat(t.name,' '),'') tags FROM bookmarks b LEFT JOIN bookmark_tags bt ON bt.bookmark_id=b.id LEFT JOIN tags t ON t.id=bt.tag_id WHERE b.user_id=? AND b.id=? GROUP BY b.id`).get(userId,id) as any;if(row)this.db.prepare('INSERT INTO bookmark_search(bookmark_id,user_id,title,url,description,notes,tags) VALUES (?,?,?,?,?,?,?)').run(row.id,row.user_id,row.title,row.url,row.description,row.notes,row.tags);}
  private present(row:BookmarkRow){const tags=this.db.prepare('SELECT t.id,t.name FROM tags t JOIN bookmark_tags bt ON bt.tag_id=t.id WHERE bt.bookmark_id=? ORDER BY t.name COLLATE NOCASE').all(row.id);return {id:row.id,url:row.url,title:row.title,description:row.description,notes:row.notes,tags,isFavorite:Boolean(row.is_favorite),readLaterState:row.read_later_state,readLaterAddedAt:row.read_later_added_at,readAt:row.read_at,archived:Boolean(row.archived_at),archivedAt:row.archived_at,iconUrl:this.db.prepare('SELECT 1 FROM bookmark_icons WHERE bookmark_id=? AND user_id=?').get(row.id,row.user_id)?`/api/v1/bookmarks/${row.id}/icon`:null,createdAt:row.created_at,updatedAt:row.updated_at};}
}
