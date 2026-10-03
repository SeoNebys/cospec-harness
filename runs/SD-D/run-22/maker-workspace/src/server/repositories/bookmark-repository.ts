import type { AppDatabase } from '../db/database.js';
import type { BookmarkInput, BookmarkPatch, ReadingStateInput } from '../../shared/contracts/api.js';
import type { RuntimeDependencies } from '../runtime.js';
import type { SearchCompileInput } from '../search/compile-query.js';
import { compileBookmarkQuery } from '../search/compile-query.js';
import { normalizeTagValue } from '../../shared/search/ast.js';

type BookmarkRow = {
  id: string; url: string; title: string; description: string | null; icon_path: string | null;
  notes: string | null; read_later: number; is_read: number; created_at: string; updated_at: string;
};

export class DuplicateBookmarkError extends Error {
  constructor(public readonly existingId: string) { super('This address is already saved.'); }
}

export type StoredBookmark = {
  id: string; url: string; title: string; description: string | null; iconUrl: string | null; notes: string | null;
  tags: string[]; readLater: boolean; isRead: boolean; createdAt: string; updatedAt: string;
};

export class BookmarkRepository {
  constructor(private readonly db: AppDatabase, private readonly runtime: RuntimeDependencies) {}

  private tagsFor(id: string): string[] {
    return (this.db.raw.prepare(`SELECT t.display_name FROM tags t JOIN bookmark_tags bt ON bt.tag_id=t.id WHERE bt.bookmark_id=? ORDER BY lower(t.display_name)`).all(id) as Array<{display_name:string}>).map((r) => r.display_name);
  }
  private map(row: BookmarkRow): StoredBookmark {
    return { id: row.id, url: row.url, title: row.title, description: row.description, iconUrl: row.icon_path ? `/api/icons/${row.icon_path}` : null, notes: row.notes, tags: this.tagsFor(row.id), readLater: Boolean(row.read_later), isRead: Boolean(row.is_read), createdAt: row.created_at, updatedAt: row.updated_at };
  }
  findById(id: string): StoredBookmark | null {
    const row = this.db.raw.prepare('SELECT * FROM bookmarks WHERE id=?').get(id) as BookmarkRow | undefined;
    return row ? this.map(row) : null;
  }
  findByNormalizedUrl(normalizedUrl: string): StoredBookmark | null {
    const row = this.db.raw.prepare('SELECT * FROM bookmarks WHERE normalized_url=?').get(normalizedUrl) as BookmarkRow | undefined;
    return row ? this.map(row) : null;
  }
  list(input: SearchCompileInput): StoredBookmark[] {
    const compiled = compileBookmarkQuery(input);
    const rows = this.db.raw.prepare(`SELECT b.* FROM bookmarks b WHERE ${compiled.where} ORDER BY ${compiled.orderBy}`).all(...(compiled.parameters as Array<string | number | null>)) as BookmarkRow[];
    return rows.map((row) => this.map(row));
  }
  create(input: BookmarkInput, normalizedUrl: string, iconPath: string | null): StoredBookmark {
    const duplicate = this.findByNormalizedUrl(normalizedUrl); if (duplicate) throw new DuplicateBookmarkError(duplicate.id);
    const id = this.runtime.ids.uuid(); const now = this.runtime.clock.now().toISOString();
    this.db.transaction(() => {
      this.db.raw.prepare(`INSERT INTO bookmarks(id,url,normalized_url,title,description,icon_path,notes,read_later,is_read,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)`).run(id,input.url,normalizedUrl,input.title.trim(),input.description ?? null,iconPath,input.notes ?? null,input.readLater ? 1 : 0,0,now,now);
      this.replaceTags(id, input.tags);
    });
    return this.findById(id)!;
  }
  update(id: string, patch: BookmarkPatch, normalizedUrl?: string, iconPath?: string | null): StoredBookmark | null {
    const existing = this.findById(id); if (!existing) return null;
    if (normalizedUrl) { const dup=this.findByNormalizedUrl(normalizedUrl); if (dup && dup.id!==id) throw new DuplicateBookmarkError(dup.id); }
    const now=this.runtime.clock.now().toISOString();
    const next={...existing,...patch};
    this.db.transaction(() => {
      this.db.raw.prepare(`UPDATE bookmarks SET url=?, normalized_url=coalesce(?,normalized_url), title=?, description=?, icon_path=?, notes=?, updated_at=? WHERE id=?`).run(next.url,normalizedUrl ?? null,next.title.trim(),next.description ?? null,iconPath === undefined ? existing.iconUrl?.split('/').pop() ?? null : iconPath,next.notes ?? null,now,id);
      if (patch.tags) this.replaceTags(id, patch.tags);
    });
    return this.findById(id);
  }
  private replaceTags(bookmarkId: string, names: string[]): void {
    this.db.raw.prepare('DELETE FROM bookmark_tags WHERE bookmark_id=?').run(bookmarkId);
    const seen=new Set<string>();
    for (const display of names.map((v)=>v.trim()).filter(Boolean)) {
      const normalized=normalizeTagValue(display); if(seen.has(normalized)) continue; seen.add(normalized);
      this.db.raw.prepare('INSERT INTO tags(display_name,normalized_name) VALUES(?,?) ON CONFLICT(normalized_name) DO NOTHING').run(display,normalized);
      const tag=this.db.raw.prepare('SELECT id FROM tags WHERE normalized_name=?').get(normalized) as {id:number};
      this.db.raw.prepare('INSERT INTO bookmark_tags(bookmark_id,tag_id) VALUES(?,?)').run(bookmarkId,tag.id);
    }
    this.db.raw.exec('DELETE FROM tags WHERE NOT EXISTS (SELECT 1 FROM bookmark_tags WHERE bookmark_tags.tag_id=tags.id)');
  }
  updateReadingState(id: string, state: ReadingStateInput): StoredBookmark | null {
    const now=this.runtime.clock.now().toISOString();
    const result=this.db.raw.prepare('UPDATE bookmarks SET read_later=?,is_read=?,updated_at=? WHERE id=?').run(state.readLater?1:0,state.readLater&&state.isRead?1:0,now,id);
    return Number(result.changes) ? this.findById(id) : null;
  }
  delete(id: string): boolean {
    return this.db.transaction(()=>{const r=this.db.raw.prepare('DELETE FROM bookmarks WHERE id=?').run(id);this.db.raw.exec('DELETE FROM tags WHERE NOT EXISTS (SELECT 1 FROM bookmark_tags WHERE bookmark_tags.tag_id=tags.id)');return Number(r.changes)>0;});
  }
  tagSummaries(): Array<{name:string;bookmarkCount:number}> {
    return this.db.raw.prepare(`SELECT display_name name,count(*) bookmarkCount FROM tags t JOIN bookmark_tags bt ON bt.tag_id=t.id GROUP BY t.id ORDER BY lower(display_name)`).all() as Array<{name:string;bookmarkCount:number}>;
  }
}
