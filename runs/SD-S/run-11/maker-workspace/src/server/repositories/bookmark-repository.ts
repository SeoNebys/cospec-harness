import { randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import type { Bookmark, Tag } from '../../shared/types/bookmark.ts';
import { comparisonText, normalizeText } from '../../shared/url/normalize.ts';

type Row = Record<string, unknown>;
export interface BookmarkWrite { url: string; canonicalUrl: string; title: string; description: string | null; tags: string[]; favorite: boolean }

export class BookmarkRepository {
  constructor(private db: DatabaseSync, private now = () => new Date().toISOString()) {}
  private tagsFor(id: string): Tag[] {
    return this.db.prepare(`SELECT t.id,t.name,(SELECT count(*) FROM bookmark_tags x WHERE x.tag_id=t.id) bookmark_count FROM tags t JOIN bookmark_tags bt ON bt.tag_id=t.id WHERE bt.bookmark_id=? ORDER BY t.normalized_name`).all(id).map((r: Row) => ({ id: String(r.id), name: String(r.name), bookmarkCount: Number(r.bookmark_count) }));
  }
  private map(row: Row): Bookmark { return { id: String(row.id), url: String(row.url), title: String(row.title), description: row.description == null ? null : String(row.description), favorite: Boolean(row.is_favorite), archivedAt: row.archived_at == null ? null : String(row.archived_at), createdAt: String(row.created_at), updatedAt: String(row.updated_at), tags: this.tagsFor(String(row.id)) }; }
  get(id: string) { const row = this.db.prepare('SELECT * FROM bookmarks WHERE id=?').get(id) as Row | undefined; return row ? this.map(row) : null; }
  findByCanonical(canonical: string) { const row = this.db.prepare('SELECT * FROM bookmarks WHERE canonical_url=?').get(canonical) as Row | undefined; return row ? this.map(row) : null; }
  list() {
    const rows=this.db.prepare('SELECT * FROM bookmarks').all() as Row[];
    const grouped=new Map<string,Tag[]>();
    for(const row of this.db.prepare(`SELECT bt.bookmark_id,t.id,t.name,count(*) OVER (PARTITION BY bt.tag_id) bookmark_count FROM bookmark_tags bt JOIN tags t ON t.id=bt.tag_id ORDER BY t.normalized_name`).all() as Row[]){const key=String(row.bookmark_id);const values=grouped.get(key)??[];values.push({id:String(row.id),name:String(row.name),bookmarkCount:Number(row.bookmark_count)});grouped.set(key,values);}
    return rows.map(row=>{const bookmark=this.mapWithoutTags(row);bookmark.tags=grouped.get(bookmark.id)??[];return bookmark});
  }
  private mapWithoutTags(row:Row):Bookmark{return { id: String(row.id), url: String(row.url), title: String(row.title), description: row.description == null ? null : String(row.description), favorite: Boolean(row.is_favorite), archivedAt: row.archived_at == null ? null : String(row.archived_at), createdAt: String(row.created_at), updatedAt: String(row.updated_at), tags:[] };}
  listTags(view: 'active'|'archived') {
    const condition = view === 'active' ? 'b.archived_at IS NULL' : 'b.archived_at IS NOT NULL';
    return this.db.prepare(`SELECT t.id,t.name,count(*) bookmark_count FROM tags t JOIN bookmark_tags bt ON bt.tag_id=t.id JOIN bookmarks b ON b.id=bt.bookmark_id WHERE ${condition} GROUP BY t.id,t.name ORDER BY t.normalized_name`).all().map((r: Row) => ({ id: String(r.id), name: String(r.name), bookmarkCount: Number(r.bookmark_count) }));
  }
  private setTags(bookmarkId: string, tags: string[], now: string) {
    this.db.prepare('DELETE FROM bookmark_tags WHERE bookmark_id=?').run(bookmarkId);
    for (const raw of [...new Set(tags.map(normalizeText).filter(Boolean))]) {
      const key = comparisonText(raw);
      let row = this.db.prepare('SELECT id FROM tags WHERE normalized_name=?').get(key) as Row | undefined;
      if (!row) { const id = randomUUID(); this.db.prepare('INSERT INTO tags(id,name,normalized_name,created_at) VALUES (?,?,?,?)').run(id, raw, key, now); row = { id }; }
      this.db.prepare('INSERT OR IGNORE INTO bookmark_tags(bookmark_id,tag_id) VALUES (?,?)').run(bookmarkId, String(row.id));
    }
    this.db.exec('DELETE FROM tags WHERE NOT EXISTS (SELECT 1 FROM bookmark_tags bt WHERE bt.tag_id=tags.id)');
  }
  create(input: BookmarkWrite) {
    const id = randomUUID(), now = this.now(); this.db.exec('BEGIN IMMEDIATE');
    try { this.db.prepare('INSERT INTO bookmarks(id,url,canonical_url,title,description,is_favorite,archived_at,created_at,updated_at) VALUES (?,?,?,?,?,?,NULL,?,?)').run(id,input.url,input.canonicalUrl,input.title,input.description,input.favorite?1:0,now,now); this.setTags(id,input.tags,now); this.db.exec('COMMIT'); }
    catch (error) { this.db.exec('ROLLBACK'); throw error; }
    return this.get(id)!;
  }
  update(id: string, input: Partial<BookmarkWrite>) {
    const current = this.get(id); if (!current) return null;
    const now=this.now(), merged={url:input.url??current.url,canonicalUrl:input.canonicalUrl??this.findCanonicalForId(id),title:input.title??current.title,description:input.description===undefined?current.description:input.description,favorite:input.favorite??current.favorite,tags:input.tags??current.tags.map(t=>t.name)};
    this.db.exec('BEGIN IMMEDIATE');
    try { this.db.prepare('UPDATE bookmarks SET url=?,canonical_url=?,title=?,description=?,is_favorite=?,updated_at=? WHERE id=?').run(merged.url,merged.canonicalUrl,merged.title,merged.description,merged.favorite?1:0,now,id); if(input.tags) this.setTags(id,merged.tags,now); this.db.exec('COMMIT'); }
    catch(error){ this.db.exec('ROLLBACK'); throw error; }
    return this.get(id)!;
  }
  private findCanonicalForId(id:string){ return String((this.db.prepare('SELECT canonical_url FROM bookmarks WHERE id=?').get(id) as Row).canonical_url); }
  setArchived(id:string, archived:boolean){ const result=this.db.prepare('UPDATE bookmarks SET archived_at=?,updated_at=? WHERE id=?').run(archived?this.now():null,this.now(),id); return result.changes ? this.get(id) : null; }
  delete(id:string){ this.db.exec('BEGIN IMMEDIATE'); try { const r=this.db.prepare('DELETE FROM bookmarks WHERE id=?').run(id); this.db.exec('DELETE FROM tags WHERE NOT EXISTS (SELECT 1 FROM bookmark_tags bt WHERE bt.tag_id=tags.id)'); this.db.exec('COMMIT'); return r.changes>0; } catch(e){this.db.exec('ROLLBACK');throw e;} }
}
