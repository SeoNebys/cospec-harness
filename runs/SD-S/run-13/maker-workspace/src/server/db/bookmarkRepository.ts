import { randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import type { Bookmark, BookmarkInput, BookmarkList, CreateBookmarkInput, SortOrder } from '../../shared/types.js';
import { normalizeTags } from '../../shared/tagNormalization.js';
import { normalizedComparisonUrl, normalizeUrl } from '../services/urlPolicy.js';

type Row = { id:string; url:string; title:string; description:string|null; notes:string|null; is_favorite:number; created_at:string; updated_at:string; tags_json:string };
export class DuplicateBookmarkError extends Error { constructor(public existingBookmarkId: string) { super('This address is already saved.'); } }
export class BookmarkNotFoundError extends Error {}

function toBookmark(row: Row): Bookmark {
  return { id: row.id, url: row.url, title: row.title, description: row.description, notes: row.notes, isFavorite: Boolean(row.is_favorite), tags: JSON.parse(row.tags_json), createdAt: row.created_at, updatedAt: row.updated_at };
}
const baseSelect = `SELECT b.*, COALESCE((SELECT json_group_array(t.name) FROM bookmark_tags bt JOIN tags t ON t.id=bt.tag_id WHERE bt.bookmark_id=b.id ORDER BY t.normalized_name),'[]') tags_json FROM bookmarks b`;

export class BookmarkRepository {
  constructor(private db: DatabaseSync) {}

  private attachTags(bookmarkId: string, tags: string[]): void {
    for (const name of normalizeTags(tags)) {
      const normalized = name.toLocaleLowerCase();
      this.db.prepare('INSERT OR IGNORE INTO tags(name,normalized_name) VALUES(?,?)').run(name, normalized);
      const tag = this.db.prepare('SELECT id FROM tags WHERE normalized_name=?').get(normalized) as {id:number};
      this.db.prepare('INSERT INTO bookmark_tags(bookmark_id,tag_id) VALUES(?,?)').run(bookmarkId, tag.id);
    }
  }

  private duplicateId(normalizedUrl: string, excludeId?: string): string | undefined {
    const row = this.db.prepare(`SELECT id FROM bookmarks WHERE normalized_url=? ${excludeId ? 'AND id<>?' : ''} LIMIT 1`).get(...(excludeId ? [normalizedUrl, excludeId] : [normalizedUrl])) as {id:string}|undefined;
    return row?.id;
  }

  create(input: CreateBookmarkInput): Bookmark {
    const url = normalizeUrl(input.url).href, normalizedUrl = normalizedComparisonUrl(url);
    const duplicate = this.duplicateId(normalizedUrl);
    if (duplicate && !input.allowDuplicate) throw new DuplicateBookmarkError(duplicate);
    const id = randomUUID(), now = new Date().toISOString();
    this.db.exec('BEGIN IMMEDIATE');
    try {
      this.db.prepare('INSERT INTO bookmarks(id,url,normalized_url,title,description,notes,is_favorite,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)')
        .run(id, url, normalizedUrl, input.title.trim(), input.description?.trim() || null, input.notes?.trim() || null, input.isFavorite ? 1 : 0, now, now);
      this.attachTags(id, input.tags); this.db.exec('COMMIT');
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
    return this.get(id);
  }

  get(id: string): Bookmark {
    const row = this.db.prepare(`${baseSelect} WHERE b.id=?`).get(id) as Row|undefined;
    if (!row) throw new BookmarkNotFoundError('Bookmark not found.');
    return toBookmark(row);
  }

  update(id: string, input: BookmarkInput): Bookmark {
    this.get(id);
    const url = normalizeUrl(input.url).href, normalizedUrl = normalizedComparisonUrl(url);
    const duplicate = this.duplicateId(normalizedUrl, id); if (duplicate) throw new DuplicateBookmarkError(duplicate);
    this.db.exec('BEGIN IMMEDIATE');
    try {
      this.db.prepare('UPDATE bookmarks SET url=?,normalized_url=?,title=?,description=?,notes=?,is_favorite=?,updated_at=? WHERE id=?')
        .run(url, normalizedUrl, input.title.trim(), input.description?.trim() || null, input.notes?.trim() || null, input.isFavorite ? 1 : 0, new Date().toISOString(), id);
      this.db.prepare('DELETE FROM bookmark_tags WHERE bookmark_id=?').run(id); this.attachTags(id, input.tags);
      this.db.exec('DELETE FROM tags WHERE NOT EXISTS (SELECT 1 FROM bookmark_tags WHERE tag_id=tags.id)');
      this.db.exec('COMMIT');
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
    return this.get(id);
  }

  delete(id: string): void {
    const result = this.db.prepare('DELETE FROM bookmarks WHERE id=?').run(id);
    if (!result.changes) throw new BookmarkNotFoundError('Bookmark not found.');
    this.db.exec('DELETE FROM tags WHERE NOT EXISTS (SELECT 1 FROM bookmark_tags WHERE tag_id=tags.id)');
  }

  list(filters: {query?:string; tag?:string; favorite?:boolean; sort?:SortOrder} = {}): BookmarkList {
    const clauses:string[]=[]; const params:Array<string|number>=[];
    if (filters.query?.trim()) { const q=`%${filters.query.trim().toLocaleLowerCase()}%`; clauses.push(`(lower(b.title) LIKE ? OR lower(b.url) LIKE ? OR lower(COALESCE(b.description,'')) LIKE ? OR lower(COALESCE(b.notes,'')) LIKE ? OR EXISTS (SELECT 1 FROM bookmark_tags qs JOIN tags qt ON qt.id=qs.tag_id WHERE qs.bookmark_id=b.id AND lower(qt.name) LIKE ?))`); params.push(q,q,q,q,q); }
    if (filters.tag) { clauses.push('EXISTS (SELECT 1 FROM bookmark_tags ft JOIN tags tt ON tt.id=ft.tag_id WHERE ft.bookmark_id=b.id AND tt.normalized_name=?)'); params.push(filters.tag.trim().toLocaleLowerCase()); }
    if (filters.favorite !== undefined) { clauses.push('b.is_favorite=?'); params.push(filters.favorite ? 1 : 0); }
    const order = filters.sort === 'oldest' ? 'b.created_at ASC, b.id ASC' : filters.sort === 'title' ? 'lower(b.title) ASC, b.id ASC' : 'b.created_at DESC, b.id DESC';
    const where=clauses.length ? ` WHERE ${clauses.join(' AND ')}` : '';
    const items=(this.db.prepare(`${baseSelect}${where} ORDER BY ${order}`).all(...params) as Row[]).map(toBookmark);
    const tags=this.db.prepare('SELECT t.name, COUNT(*) count FROM tags t JOIN bookmark_tags bt ON bt.tag_id=t.id GROUP BY t.id ORDER BY t.normalized_name').all() as Array<{name:string;count:number}>;
    return { items, total: items.length, tags };
  }
}
