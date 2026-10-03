import type { Bookmark, BookmarkSummary, CollectionView, RichTextDocument } from '../../../shared/api/types.js';
import { EMPTY_NOTE } from '../../../shared/notes/schema.js';
import { fromBoolean, toIso } from '../rows.js';
import { inTransaction } from '../transactions.js';
import { BaseRepository } from './base-repository.js';
import { TagRepository } from './tag-repository.js';

export interface BookmarkWrite {
  url: string; normalizedUrl: string; title: string; description: string | null; notes: RichTextDocument; notesText: string;
  tags: string[]; favorite: boolean; toRead: boolean; iconAssetId?: string | null; previewAssetId?: string | null; metadataRefreshedAt?: number | null;
}

export interface QueryCandidate extends BookmarkSummary { notesText: string }

export class BookmarkRepository extends BaseRepository {
  private readonly tags = new TagRepository(this.db, this.now, this.uuid);

  findDuplicate(normalizedUrl: string, exceptId?: string): { id: string; title: string; archived: boolean } | null {
    const row = this.db.prepare(`SELECT id,title,archived_at FROM bookmarks WHERE normalized_url=? ${exceptId ? 'AND id<>?' : ''}`).get(...(exceptId ? [normalizedUrl, exceptId] : [normalizedUrl])) as any;
    return row ? { id: row.id, title: row.title, archived: row.archived_at !== null } : null;
  }

  create(input: BookmarkWrite): Bookmark {
    return inTransaction(this.db, () => {
      const id = this.uuid(); const now = this.now();
      this.db.prepare(`INSERT INTO bookmarks(id,url,normalized_url,title,description,notes_json,notes_text,favorite,to_read,icon_asset_id,preview_asset_id,metadata_refreshed_at,created_at,updated_at)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(id,input.url,input.normalizedUrl,input.title,input.description,JSON.stringify(input.notes),input.notesText,Number(input.favorite),Number(input.toRead),input.iconAssetId ?? null,input.previewAssetId ?? null,input.metadataRefreshedAt ?? null,now,now);
      this.tags.replace(id, input.tags);
      return this.get(id)!;
    });
  }

  get(id: string): Bookmark | null {
    const row = this.db.prepare('SELECT * FROM bookmarks WHERE id=?').get(id) as any;
    return row ? this.hydrate(row, true) as Bookmark : null;
  }

  allForView(view: CollectionView): QueryCandidate[] {
    const where = view === 'archive' ? 'archived_at IS NOT NULL' : view === 'to-read' ? 'archived_at IS NULL AND to_read=1' : 'archived_at IS NULL';
    const rows = this.db.prepare(`SELECT * FROM bookmarks WHERE ${where}`).all() as any[];
    return rows.map((row) => ({ ...(this.hydrate(row, false) as BookmarkSummary), notesText: row.notes_text }));
  }

  update(id: string, input: BookmarkWrite): Bookmark | null {
    return inTransaction(this.db, () => {
      const old = this.get(id); if (!old) return null;
      this.db.prepare(`UPDATE bookmarks SET url=?,normalized_url=?,title=?,description=?,notes_json=?,notes_text=?,favorite=?,to_read=?,icon_asset_id=?,preview_asset_id=?,metadata_refreshed_at=?,updated_at=? WHERE id=?`)
        .run(input.url,input.normalizedUrl,input.title,input.description,JSON.stringify(input.notes),input.notesText,Number(input.favorite),Number(input.toRead),input.iconAssetId ?? null,input.previewAssetId ?? null,input.metadataRefreshedAt ?? null,this.now(),id);
      this.tags.replace(id, input.tags);
      return this.get(id)!;
    });
  }

  patchFlags(id: string, fields: { favorite?: boolean; toRead?: boolean }): Bookmark | null {
    const existing = this.get(id); if (!existing) return null;
    const favorite = fields.favorite ?? existing.favorite; const toRead = fields.toRead ?? existing.toRead;
    if (favorite === existing.favorite && toRead === existing.toRead) return existing;
    this.db.prepare('UPDATE bookmarks SET favorite=?,to_read=?,updated_at=? WHERE id=?').run(Number(favorite),Number(toRead),this.now(),id);
    return this.get(id);
  }

  archive(id: string, archived: boolean): Bookmark | null {
    const existing = this.get(id); if (!existing) return null;
    if ((existing.archivedAt !== null) === archived) return existing;
    this.db.prepare('UPDATE bookmarks SET archived_at=?,updated_at=? WHERE id=?').run(archived ? this.now() : null,this.now(),id);
    return this.get(id);
  }

  delete(id: string): boolean {
    return inTransaction(this.db, () => { const changes = this.db.prepare('DELETE FROM bookmarks WHERE id=?').run(id).changes; this.tags.removeOrphans(); return changes > 0; });
  }

  private hydrate(row: any, includeNotes: boolean): Bookmark | BookmarkSummary {
    return {
      id: row.id, url: row.url, title: row.title, description: row.description,
      iconAssetUrl: row.icon_asset_id ? `/api/assets/${row.icon_asset_id}` : null,
      previewAssetUrl: row.preview_asset_id ? `/api/assets/${row.preview_asset_id}` : null,
      tags: this.tags.forBookmark(row.id), favorite: fromBoolean(row.favorite), toRead: fromBoolean(row.to_read),
      archivedAt: toIso(row.archived_at), createdAt: toIso(row.created_at)!, updatedAt: toIso(row.updated_at)!,
      ...(includeNotes ? { notes: JSON.parse(row.notes_json || JSON.stringify(EMPTY_NOTE)), metadataRefreshedAt: toIso(row.metadata_refreshed_at) } : {}),
    };
  }
}
