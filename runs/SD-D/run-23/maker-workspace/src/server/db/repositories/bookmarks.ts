import crypto from 'node:crypto';
import type { Db } from '../client.js';
import { normalizeBookmarkUrl } from '../../../shared/url.js';
import { plainTextFromMarkdown, titleSortKey } from '../../../shared/normalization.js';
import type { BookmarkDto, MetadataStatus, ReadState } from '../../../shared/types.js';

type Row = Record<string, any>;

export interface BookmarkWrite {
  url: string;
  title: string;
  description?: string | null;
  notesMarkdown?: string | null;
  siteIconUrl?: string | null;
  previewImageUrl?: string | null;
  metadataStatus?: MetadataStatus;
  metadataWarnings?: string[];
  tagIds?: string[];
  collectionId?: string | null;
  readState?: ReadState;
}

export function revision(db: Db, userId: number): number {
  db.prepare('UPDATE users SET library_revision=library_revision+1,updated_at=? WHERE id=?').run(new Date().toISOString(), userId);
  return (db.prepare('SELECT library_revision FROM users WHERE id=?').get(userId) as Row).library_revision;
}

function ownedCollection(db: Db, userId: number, publicId?: string | null): number | null {
  if (!publicId) return null;
  const row = db.prepare('SELECT id FROM collections WHERE user_id=? AND public_id=?').get(userId, publicId) as Row | undefined;
  if (!row) throw new Error('The selected collection is unavailable.');
  return row.id;
}

function ownedTags(db: Db, userId: number, publicIds: string[] = []): number[] {
  if (!publicIds.length) return [];
  const unique = [...new Set(publicIds)];
  const placeholders = unique.map(() => '?').join(',');
  const rows = db.prepare(`SELECT id,public_id FROM tags WHERE user_id=? AND public_id IN (${placeholders})`).all(userId, ...unique) as Row[];
  if (rows.length !== unique.length) throw new Error('One or more selected tags are unavailable.');
  return rows.map((row) => row.id);
}

function validate(write: BookmarkWrite): void {
  if (![...write.title.trim()].length || [...write.title].length > 200) throw new Error('Title must be between 1 and 200 characters.');
  if (write.description && [...write.description].length > 2000) throw new Error('Description must be 2,000 characters or fewer.');
  if (write.notesMarkdown && [...write.notesMarkdown].length > 20000) throw new Error('Notes must be 20,000 characters or fewer.');
}

export function createBookmark(db: Db, userId: number, write: BookmarkWrite): BookmarkDto {
  validate(write);
  const normalized = normalizeBookmarkUrl(write.url);
  const now = new Date().toISOString();
  const publicId = crypto.randomUUID();
  const collectionId = ownedCollection(db, userId, write.collectionId);
  const tagIds = ownedTags(db, userId, write.tagIds);
  try {
    db.transaction(() => {
      const result = db.prepare(`INSERT INTO bookmarks(public_id,user_id,url,normalized_url,title,description,notes_markdown,notes_search_text,site_icon_url,preview_image_url,metadata_status,metadata_warnings_json,collection_id,read_state,title_sort_key,created_at,updated_at)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(publicId, userId, normalized.url, normalized.key, write.title.trim(), write.description?.trim() || null, write.notesMarkdown || null, plainTextFromMarkdown(write.notesMarkdown || ''), write.siteIconUrl || null, write.previewImageUrl || null, write.metadataStatus || 'unavailable', JSON.stringify(write.metadataWarnings || []), collectionId, write.readState || 'unread', titleSortKey(write.title), now, now);
      const insertTag = db.prepare('INSERT INTO bookmark_tags(bookmark_id,tag_id,created_at) VALUES(?,?,?)');
      for (const tagId of tagIds) insertTag.run(result.lastInsertRowid, tagId, now);
      revision(db, userId);
    })();
  } catch (error: any) {
    if (String(error.message).includes('bookmarks.user_id, bookmarks.normalized_url')) {
      const existing = db.prepare('SELECT public_id,archived_at FROM bookmarks WHERE user_id=? AND normalized_url=?').get(userId, normalized.key) as Row;
      const duplicate: any = new Error('This destination is already saved.');
      duplicate.code = 'DUPLICATE'; duplicate.existingBookmarkId = existing.public_id; duplicate.archived = !!existing.archived_at;
      throw duplicate;
    }
    throw error;
  }
  return getBookmark(db, userId, publicId)!;
}

export function getBookmark(db: Db, userId: number, publicId: string): BookmarkDto | null {
  const row = db.prepare(`SELECT b.*,c.public_id collection_public_id,c.name collection_name FROM bookmarks b LEFT JOIN collections c ON c.id=b.collection_id WHERE b.user_id=? AND b.public_id=?`).get(userId, publicId) as Row | undefined;
  if (!row) return null;
  return mapBookmark(db, row);
}

export function mapBookmark(db: Db, row: Row): BookmarkDto {
  const tags = db.prepare(`SELECT t.public_id id,t.name FROM tags t JOIN bookmark_tags bt ON bt.tag_id=t.id WHERE bt.bookmark_id=? ORDER BY t.name_key`).all(row.id) as Array<{ id: string; name: string }>;
  return {
    id: row.public_id, url: row.url, normalizedUrl: row.normalized_url, title: row.title,
    description: row.description, notesMarkdown: row.notes_markdown,
    siteIconAvailable: !!row.site_icon_url, previewImageAvailable: !!row.preview_image_url,
    metadataStatus: row.metadata_status, metadataWarnings: JSON.parse(row.metadata_warnings_json || '[]'),
    tagIds: tags.map((tag) => tag.id), tags,
    collectionId: row.collection_public_id || null, collectionName: row.collection_name || null,
    readState: row.read_state, archived: !!row.archived_at, archivedAt: row.archived_at,
    version: row.version, createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

export function updateBookmark(db: Db, userId: number, publicId: string, expectedVersion: number, patch: Partial<BookmarkWrite> & { archived?: boolean }): BookmarkDto | null {
  const existing = db.prepare('SELECT * FROM bookmarks WHERE user_id=? AND public_id=?').get(userId, publicId) as Row | undefined;
  if (!existing) return null;
  if (existing.version !== expectedVersion) { const error: any = new Error('This bookmark changed. Refresh before editing it.'); error.code = 'STALE'; throw error; }
  const merged: BookmarkWrite = {
    url: patch.url ?? existing.url, title: patch.title ?? existing.title,
    description: patch.description !== undefined ? patch.description : existing.description,
    notesMarkdown: patch.notesMarkdown !== undefined ? patch.notesMarkdown : existing.notes_markdown,
    readState: patch.readState ?? existing.read_state,
  };
  validate(merged);
  const normalized = normalizeBookmarkUrl(merged.url);
  const collectionId = patch.collectionId !== undefined ? ownedCollection(db, userId, patch.collectionId) : existing.collection_id;
  const tagIds = patch.tagIds !== undefined ? ownedTags(db, userId, patch.tagIds) : null;
  const now = new Date().toISOString();
  const archivedAt = patch.archived === undefined ? existing.archived_at : patch.archived ? now : null;
  try {
    db.transaction(() => {
      db.prepare(`UPDATE bookmarks SET url=?,normalized_url=?,title=?,description=?,notes_markdown=?,notes_search_text=?,collection_id=?,read_state=?,archived_at=?,title_sort_key=?,version=version+1,updated_at=? WHERE id=?`)
        .run(normalized.url, normalized.key, merged.title.trim(), merged.description?.trim() || null, merged.notesMarkdown || null, plainTextFromMarkdown(merged.notesMarkdown || ''), collectionId, merged.readState || 'unread', archivedAt, titleSortKey(merged.title), now, existing.id);
      if (tagIds) {
        db.prepare('DELETE FROM bookmark_tags WHERE bookmark_id=?').run(existing.id);
        const insert = db.prepare('INSERT INTO bookmark_tags(bookmark_id,tag_id,created_at) VALUES(?,?,?)');
        for (const tagId of tagIds) insert.run(existing.id, tagId, now);
      }
      revision(db, userId);
    })();
  } catch (error: any) {
    if (String(error.message).includes('bookmarks.user_id, bookmarks.normalized_url')) { error.code = 'DUPLICATE'; }
    throw error;
  }
  return getBookmark(db, userId, publicId);
}

export function deleteBookmark(db: Db, userId: number, publicId: string, expectedVersion: number): boolean {
  return db.transaction(() => {
    const result = db.prepare('DELETE FROM bookmarks WHERE user_id=? AND public_id=? AND version=?').run(userId, publicId, expectedVersion);
    if (!result.changes) return false;
    revision(db, userId); return true;
  })();
}
