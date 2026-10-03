import { randomUUID } from 'node:crypto';
import type { Bookmark, BookmarkList, ListCriteria } from '../../shared/api-types.js';
import type { BookmarkDatabase } from '../db/connection.js';
import type { NormalizedTag } from '../services/normalization.js';
import { escapeLike } from '../services/normalization.js';

interface BookmarkRow {
  id: string;
  url: string;
  normalized_url: string;
  title: string;
  notes: string;
  is_favorite: number;
  status: 'active' | 'archived';
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

export interface StoredBookmarkInput {
  id: string;
  url: string;
  normalizedUrl: string;
  title: string;
  notes: string;
  isFavorite: boolean;
  status: 'active' | 'archived';
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
  tags: NormalizedTag[];
}

export class BookmarkRepository {
  constructor(private readonly database: BookmarkDatabase) {}

  create(input: StoredBookmarkInput): Bookmark {
    const createTransaction = this.database.transaction(() => {
      this.database
        .prepare(`
          INSERT INTO bookmarks (
            id, url, normalized_url, title, notes, is_favorite, status, created_at, updated_at, archived_at
          ) VALUES (
            @id, @url, @normalizedUrl, @title, @notes, @isFavorite, @status, @createdAt, @updatedAt, @archivedAt
          )
        `)
        .run({ ...input, isFavorite: input.isFavorite ? 1 : 0 });
      this.replaceTags(input.id, input.tags, input.createdAt);
    });
    createTransaction();
    return this.getById(input.id)!;
  }

  getById(id: string): Bookmark | undefined {
    const row = this.database.prepare('SELECT * FROM bookmarks WHERE id = ?').get(id) as BookmarkRow | undefined;
    return row ? this.toBookmark(row, this.tagsForIds([id]).get(id) ?? []) : undefined;
  }

  findActiveDuplicate(normalizedUrl: string, excludeId?: string): Bookmark | undefined {
    const row = this.database
      .prepare(`SELECT * FROM bookmarks WHERE status = 'active' AND normalized_url = ? AND (? IS NULL OR id != ?) ORDER BY created_at LIMIT 1`)
      .get(normalizedUrl, excludeId ?? null, excludeId ?? null) as BookmarkRow | undefined;
    return row ? this.toBookmark(row, this.tagsForIds([row.id]).get(row.id) ?? []) : undefined;
  }

  list(criteria: ListCriteria): BookmarkList {
    const conditions = ['b.status = @scope'];
    const parameters: Record<string, string | number> = { scope: criteria.scope };

    if (criteria.q) {
      parameters.search = `%${escapeLike(criteria.q.toLocaleLowerCase('en-US'))}%`;
      conditions.push(`(
        lower(b.title) LIKE @search ESCAPE '\\' OR
        lower(b.url) LIKE @search ESCAPE '\\' OR
        lower(b.notes) LIKE @search ESCAPE '\\' OR
        EXISTS (
          SELECT 1 FROM bookmark_tags search_bt
          JOIN tags search_t ON search_t.id = search_bt.tag_id
          WHERE search_bt.bookmark_id = b.id AND lower(search_t.name) LIKE @search ESCAPE '\\'
        )
      )`);
    }
    if (criteria.tag) {
      parameters.tag = criteria.tag;
      conditions.push(`EXISTS (
        SELECT 1 FROM bookmark_tags filter_bt
        JOIN tags filter_t ON filter_t.id = filter_bt.tag_id
        WHERE filter_bt.bookmark_id = b.id AND filter_t.normalized_name = @tag
      )`);
    }
    if (criteria.favorite !== null) {
      parameters.favorite = criteria.favorite ? 1 : 0;
      conditions.push('b.is_favorite = @favorite');
    }

    const orderBy: Record<ListCriteria['sort'], string> = {
      newest: 'b.created_at DESC, b.id ASC',
      oldest: 'b.created_at ASC, b.id ASC',
      updated: 'b.updated_at DESC, b.id ASC',
      title: 'b.title COLLATE NOCASE ASC, b.id ASC',
    };
    const rows = this.database
      .prepare(`SELECT b.* FROM bookmarks b WHERE ${conditions.join(' AND ')} ORDER BY ${orderBy[criteria.sort]}`)
      .all(parameters) as BookmarkRow[];
    const tags = this.tagsForIds(rows.map((row) => row.id));
    const availableTags = this.database
      .prepare(`
        SELECT DISTINCT t.name
        FROM tags t
        JOIN bookmark_tags bt ON bt.tag_id = t.id
        JOIN bookmarks b ON b.id = bt.bookmark_id
        WHERE b.status = ?
        ORDER BY t.name COLLATE NOCASE
      `)
      .all(criteria.scope)
      .map((row) => (row as { name: string }).name);

    return {
      items: rows.map((row) => this.toBookmark(row, tags.get(row.id) ?? [])),
      total: rows.length,
      availableTags,
      criteria,
    };
  }

  update(input: StoredBookmarkInput): Bookmark | undefined {
    if (!this.getById(input.id)) return undefined;
    const updateTransaction = this.database.transaction(() => {
      this.database
        .prepare(`
          UPDATE bookmarks SET
            url = @url,
            normalized_url = @normalizedUrl,
            title = @title,
            notes = @notes,
            is_favorite = @isFavorite,
            status = @status,
            updated_at = @updatedAt,
            archived_at = @archivedAt
          WHERE id = @id
        `)
        .run({ ...input, isFavorite: input.isFavorite ? 1 : 0 });
      this.database.prepare('DELETE FROM bookmark_tags WHERE bookmark_id = ?').run(input.id);
      this.replaceTags(input.id, input.tags, input.updatedAt);
      this.deleteOrphanTags();
    });
    updateTransaction();
    return this.getById(input.id);
  }

  archive(id: string, timestamp: string): Bookmark | undefined {
    const result = this.database
      .prepare(`UPDATE bookmarks SET status = 'archived', archived_at = ?, updated_at = ? WHERE id = ? AND status = 'active'`)
      .run(timestamp, timestamp, id);
    return result.changes ? this.getById(id) : undefined;
  }

  restore(id: string, timestamp: string): Bookmark | undefined {
    const result = this.database
      .prepare(`UPDATE bookmarks SET status = 'active', archived_at = NULL, updated_at = ? WHERE id = ? AND status = 'archived'`)
      .run(timestamp, id);
    return result.changes ? this.getById(id) : undefined;
  }

  deleteArchived(id: string): boolean {
    const remove = this.database.transaction(() => {
      const result = this.database.prepare("DELETE FROM bookmarks WHERE id = ? AND status = 'archived'").run(id);
      this.deleteOrphanTags();
      return result.changes > 0;
    });
    return remove();
  }

  private replaceTags(bookmarkId: string, tags: NormalizedTag[], timestamp: string): void {
    const findTag = this.database.prepare('SELECT id FROM tags WHERE normalized_name = ?');
    const insertTag = this.database.prepare('INSERT INTO tags (id, name, normalized_name, created_at) VALUES (?, ?, ?, ?)');
    const attachTag = this.database.prepare('INSERT INTO bookmark_tags (bookmark_id, tag_id) VALUES (?, ?)');
    for (const tag of tags) {
      let tagId = (findTag.get(tag.normalizedName) as { id: string } | undefined)?.id;
      if (!tagId) {
        tagId = randomUUID();
        insertTag.run(tagId, tag.name, tag.normalizedName, timestamp);
      }
      attachTag.run(bookmarkId, tagId);
    }
  }

  private deleteOrphanTags(): void {
    this.database.prepare('DELETE FROM tags WHERE NOT EXISTS (SELECT 1 FROM bookmark_tags WHERE bookmark_tags.tag_id = tags.id)').run();
  }

  private tagsForIds(ids: string[]): Map<string, string[]> {
    const tags = new Map<string, string[]>();
    if (!ids.length) return tags;
    const placeholders = ids.map(() => '?').join(', ');
    const rows = this.database
      .prepare(`
        SELECT bt.bookmark_id, t.name
        FROM bookmark_tags bt
        JOIN tags t ON t.id = bt.tag_id
        WHERE bt.bookmark_id IN (${placeholders})
        ORDER BY t.name COLLATE NOCASE
      `)
      .all(...ids) as Array<{ bookmark_id: string; name: string }>;
    for (const row of rows) {
      const list = tags.get(row.bookmark_id) ?? [];
      list.push(row.name);
      tags.set(row.bookmark_id, list);
    }
    return tags;
  }

  private toBookmark(row: BookmarkRow, tags: string[]): Bookmark {
    return {
      id: row.id,
      url: row.url,
      title: row.title,
      notes: row.notes,
      tags,
      isFavorite: Boolean(row.is_favorite),
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      archivedAt: row.archived_at,
    };
  }
}
