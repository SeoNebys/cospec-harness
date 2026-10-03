import type { AppDatabase } from '../db/connection.js';
import type { BookmarkDto, ListBookmarksQuery } from '../../shared/schemas/api.js';
import type { NoteDocument } from '../../shared/schemas/noteDocument.js';
import { compileSearch } from '../search/compile.js';
import { parseSearch } from '../search/parse.js';
import { pageOffset } from './database.js';
import { replaceSearchRow } from './search-index.js';
import { TagRepository } from './tagRepository.js';

export interface BookmarkRow {
  id: number;
  public_id: string;
  url: string;
  normalized_url: string;
  title: string;
  description: string | null;
  note_document: string | null;
  note_text: string;
  lifecycle_state: 'active' | 'archived';
  reading_state: 'none' | 'unread' | 'read';
  metadata_status: BookmarkDto['metadataStatus'];
  icon_asset_id: number | null;
  preview_asset_id: number | null;
  icon_public_id: string | null;
  preview_public_id: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

const select = `SELECT b.*,ia.public_id icon_public_id,pa.public_id preview_public_id FROM bookmarks b
 LEFT JOIN media_assets ia ON ia.id=b.icon_asset_id LEFT JOIN media_assets pa ON pa.id=b.preview_asset_id`;

export class BookmarkRepository {
  private tags: TagRepository;
  constructor(private db: AppDatabase) {
    this.tags = new TagRepository(db);
  }
  byId(publicId: string): BookmarkRow | undefined {
    return this.db.prepare(`${select} WHERE b.public_id=?`).get(publicId) as BookmarkRow | undefined;
  }
  byNormalizedUrl(url: string): BookmarkRow | undefined {
    return this.db.prepare(`${select} WHERE b.normalized_url=?`).get(url) as BookmarkRow | undefined;
  }
  byInternalId(id: number): BookmarkRow | undefined {
    return this.db.prepare(`${select} WHERE b.id=?`).get(id) as BookmarkRow | undefined;
  }
  insert(
    values: Omit<BookmarkRow, 'id' | 'icon_public_id' | 'preview_public_id'>,
    tagLabels: string[],
  ): BookmarkRow {
    const result = this.db
      .prepare(
        `INSERT INTO bookmarks(public_id,url,normalized_url,title,description,note_document,note_text,lifecycle_state,reading_state,metadata_status,icon_asset_id,preview_asset_id,created_at,updated_at,archived_at)
      VALUES (@public_id,@url,@normalized_url,@title,@description,@note_document,@note_text,@lifecycle_state,@reading_state,@metadata_status,@icon_asset_id,@preview_asset_id,@created_at,@updated_at,@archived_at)`,
      )
      .run(values);
    const id = Number(result.lastInsertRowid);
    this.tags.replace(id, tagLabels);
    replaceSearchRow(this.db, id);
    return this.byInternalId(id)!;
  }
  update(id: number, values: Partial<BookmarkRow>, tagLabels?: string[]): BookmarkRow {
    const allowed = [
      'url',
      'normalized_url',
      'title',
      'description',
      'note_document',
      'note_text',
      'lifecycle_state',
      'reading_state',
      'metadata_status',
      'icon_asset_id',
      'preview_asset_id',
      'updated_at',
      'archived_at',
    ];
    const entries = Object.entries(values).filter(([key]) => allowed.includes(key));
    if (entries.length)
      this.db
        .prepare(`UPDATE bookmarks SET ${entries.map(([key]) => `${key}=@${key}`).join(',')} WHERE id=@id`)
        .run(Object.fromEntries([...entries, ['id', id]]));
    if (tagLabels) this.tags.replace(id, tagLabels);
    replaceSearchRow(this.db, id);
    return this.byInternalId(id)!;
  }
  delete(id: number): void {
    this.db.prepare('DELETE FROM bookmark_search WHERE rowid=?').run(id);
    this.db.prepare('DELETE FROM bookmarks WHERE id=?').run(id);
  }
  toDto(row: BookmarkRow): BookmarkDto {
    return {
      id: row.public_id,
      url: row.url,
      normalizedUrl: row.normalized_url,
      title: row.title,
      description: row.description,
      noteDocument: row.note_document ? (JSON.parse(row.note_document) as NoteDocument) : null,
      tags: this.tags.attached(row.id).map((tag) => ({ id: tag.public_id, label: tag.label })),
      lifecycleState: row.lifecycle_state,
      readingState: row.reading_state,
      metadataStatus: row.metadata_status,
      iconUrl: row.icon_public_id ? `/api/media/${row.icon_public_id}` : null,
      previewImageUrl: row.preview_public_id ? `/api/media/${row.preview_public_id}` : null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      archivedAt: row.archived_at,
    };
  }
  list(query: ListBookmarksQuery): { items: BookmarkDto[]; total: number; page: number; pageSize: number } {
    const lifecycle = query.view === 'archived' ? 'archived' : 'active';
    const rows = this.db
      .prepare(
        `${select} WHERE b.lifecycle_state=? ${query.view === 'unread' ? "AND b.reading_state='unread'" : ''}`,
      )
      .all(lifecycle) as BookmarkRow[];
    const tagsByRow = new Map<number, ReturnType<TagRepository['attached']>>(rows.map((row) => [row.id, []]));
    const relevant = new Set(rows.map((row) => row.id));
    const tagRows = this.db
      .prepare(
        `SELECT bt.bookmark_id,t.* FROM bookmark_tags bt JOIN tags t ON t.id=bt.tag_id ORDER BY t.label COLLATE NOCASE,t.id`,
      )
      .all() as Array<ReturnType<TagRepository['attached']>[number] & { bookmark_id: number }>;
    for (const tag of tagRows) if (relevant.has(tag.bookmark_id)) tagsByRow.get(tag.bookmark_id)!.push(tag);
    const predicate = compileSearch(parseSearch(query.q).ast);
    const exactTags = query.tag.map((tag) =>
      tag.trim().replace(/\s+/g, ' ').normalize('NFKC').toLocaleLowerCase(),
    );
    const filtered = rows.filter((row) => {
      const tags = tagsByRow.get(row.id)!;
      if (!exactTags.every((filter) => tags.some((tag) => tag.normalized_label === filter))) return false;
      return predicate({
        title: row.title,
        url: row.url,
        description: row.description,
        noteText: row.note_text,
        tags,
      });
    });
    filtered.sort((a, b) => {
      const primary =
        query.sort === 'title'
          ? a.title.localeCompare(b.title, undefined, { sensitivity: 'base' })
          : a.created_at.localeCompare(b.created_at);
      return (query.direction === 'asc' ? primary : -primary) || a.id - b.id;
    });
    const items = filtered
      .slice(pageOffset(query.page, query.pageSize), pageOffset(query.page, query.pageSize) + query.pageSize)
      .map((row) => this.toDto(row));
    return { items, total: filtered.length, page: query.page, pageSize: query.pageSize };
  }
}
