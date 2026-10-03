import { randomUUID } from 'node:crypto';
import type { Bookmark, CreateBookmark, Filters, SortDirection, SortField, UpdateBookmark } from '@bookmark/contracts';
import type { DB } from './client.js';
import type { SearchNode } from '../search/ast.js';

type Row = Record<string, any>;
const iso=(n:number|null)=>n?new Date(n).toISOString():null;
const fold=(s:string)=>s.normalize('NFKC').toLocaleLowerCase();
function match(node:SearchNode|null,b:Bookmark):boolean { if(!node)return true; switch(node.type){case'not':return !match(node.child,b);case'and':return match(node.left,b)&&match(node.right,b);case'or':return match(node.left,b)||match(node.right,b);case'tag':return b.tags.some(t=>fold(t.name)===fold(node.value));case'term':case'phrase':{const v=fold(node.value);return [b.title,b.url,b.description??'',b.notes??'',...b.tags.map(t=>t.name)].some(f=>fold(f).includes(v));}} }

export class BookmarkRepository {
  constructor(public db:DB){}
  private map(row:Row):Bookmark {
    const tags=this.db.prepare(`SELECT t.id,t.name,(SELECT count(*) FROM bookmark_tags x WHERE x.tag_id=t.id) usageCount FROM tags t JOIN bookmark_tags bt ON bt.tag_id=t.id WHERE bt.bookmark_id=? ORDER BY t.normalized_name`).all(row.id) as any[];
    const snap=this.db.prepare(`SELECT ps.*,a.id asset_id FROM page_snapshots ps LEFT JOIN assets a ON a.id=ps.asset_id WHERE ps.bookmark_id=?`).get(row.id) as any;
    return {id:row.id,url:row.url,title:row.title,description:row.description,notes:row.notes,
      faviconUrl:row.favicon_asset_id?`/api/assets/${row.favicon_asset_id}`:null,previewUrl:row.preview_asset_id?`/api/assets/${row.preview_asset_id}`:null,
      tags:tags.map(t=>({id:t.id,name:t.name,usageCount:t.usageCount})),isFavorite:!!row.is_favorite,readState:row.read_state,
      archiveState:row.archived_at?'archived':'active',metadataStatus:row.metadata_status,metadataErrorCode:row.metadata_error_code,
      snapshot:{status:snap?.status??'pending',available:!!snap?.asset_id,assetUrl:snap?.asset_id?`/api/assets/${snap.asset_id}`:null,capturedAt:iso(snap?.captured_at),capturedUrl:snap?.captured_url??null,limitationCode:snap?.limitation_code??null,message:snap?.error_message??null,refreshStatus:snap?.refresh_status??null},
      createdAt:iso(row.created_at)!,updatedAt:iso(row.updated_at)!};
  }
  get(id:string){const r=this.db.prepare('SELECT * FROM bookmarks WHERE id=?').get(id) as Row|undefined; return r?this.map(r):null;}
  byUrl(normalized:string){const r=this.db.prepare('SELECT * FROM bookmarks WHERE normalized_url=?').get(normalized) as Row|undefined; return r?this.map(r):null;}
  create(input:CreateBookmark,normalized:string){const now=Date.now(),id=randomUUID(),title=input.title?.trim()||new URL(normalized).hostname;
    this.db.transaction(()=>{this.db.prepare(`INSERT INTO bookmarks(id,url,normalized_url,title,description,notes,is_favorite,read_state,metadata_status,title_source,description_source,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(id,normalized,normalized,title,input.description?.trim()||null,input.notes?.trim()||null,input.isFavorite?1:0,input.readState??'read','pending',input.title?'user':'fallback',input.description?'user':null,now,now); this.setTags(id,input.tags??[]); this.db.prepare(`INSERT INTO page_snapshots(bookmark_id,status,updated_at) VALUES(?,'pending',?)`).run(id,now); this.db.prepare(`INSERT INTO capture_jobs(id,bookmark_id,kind,status,replace_user_metadata,attempt_count,available_at,created_at) VALUES(?,?,?,'pending',0,0,?,?)`).run(randomUUID(),id,'initial',now,now);})(); return this.get(id)!;}
  private setTags(id:string,names:string[]){this.db.prepare('DELETE FROM bookmark_tags WHERE bookmark_id=?').run(id); const now=Date.now(); for(const raw of [...new Set(names.map(n=>n.trim()).filter(Boolean))]){const norm=fold(raw); let tag=this.db.prepare('SELECT id FROM tags WHERE normalized_name=?').get(norm) as any; if(!tag){tag={id:randomUUID()};this.db.prepare('INSERT INTO tags(id,name,normalized_name,created_at) VALUES(?,?,?,?)').run(tag.id,raw,norm,now);} this.db.prepare('INSERT OR IGNORE INTO bookmark_tags(bookmark_id,tag_id,created_at) VALUES(?,?,?)').run(id,tag.id,now);}}
  update(id:string,input:UpdateBookmark){const current=this.get(id);if(!current)return null; const sets:string[]=[],vals:any[]=[]; const put=(col:string,v:any)=>{sets.push(`${col}=?`);vals.push(v)};
    if(input.url!==undefined){put('url',input.url);put('normalized_url',input.url)} if(input.title!==undefined){put('title',input.title.trim());put('title_source','user')} if(input.description!==undefined){put('description',input.description?.trim()||null);put('description_source','user')} if(input.notes!==undefined)put('notes',input.notes?.trim()||null); if(input.isFavorite!==undefined)put('is_favorite',input.isFavorite?1:0); if(input.readState!==undefined)put('read_state',input.readState); if(input.archiveState!==undefined)put('archived_at',input.archiveState==='archived'?Date.now():null); put('updated_at',Date.now());
    this.db.transaction(()=>{this.db.prepare(`UPDATE bookmarks SET ${sets.join(',')} WHERE id=?`).run(...vals,id);if(input.tags)this.setTags(id,input.tags)})();return this.get(id);}
  delete(id:string){return this.db.prepare('DELETE FROM bookmarks WHERE id=?').run(id).changes>0;}
  list(ast:SearchNode|null,filters:Filters,sort:SortField='createdAt',direction:SortDirection='desc') {let rows=(this.db.prepare('SELECT * FROM bookmarks').all() as Row[]).map(r=>this.map(r)).filter(b=>match(ast,b)); if(filters.archiveState!=='all')rows=rows.filter(b=>b.archiveState===(filters.archiveState??'active')); if(filters.readState)rows=rows.filter(b=>b.readState===filters.readState); if(filters.favorite!=null)rows=rows.filter(b=>b.isFavorite===filters.favorite); if(filters.tags?.length)rows=rows.filter(b=>filters.tags!.every(t=>b.tags.some(x=>fold(x.name)===fold(t)))); const key=(b:Bookmark)=>sort==='createdAt'?b.createdAt:sort==='updatedAt'?b.updatedAt:sort==='title'?fold(b.title):new URL(b.url).hostname; rows.sort((a,b)=>String(key(a)).localeCompare(String(key(b)))*(direction==='asc'?1:-1)); return rows;}
  suggestTags(q=''){const p=`%${fold(q)}%`;return this.db.prepare(`SELECT t.id,t.name,count(bt.bookmark_id) usageCount FROM tags t LEFT JOIN bookmark_tags bt ON bt.tag_id=t.id WHERE t.normalized_name LIKE ? GROUP BY t.id ORDER BY CASE WHEN t.normalized_name LIKE ? THEN 0 ELSE 1 END,usageCount DESC,t.normalized_name LIMIT 20`).all(p,`${fold(q)}%`);}
}
