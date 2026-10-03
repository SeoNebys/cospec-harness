import type { BookmarkDetail } from '../../shared/contracts/bookmarks.js';
import type { AppDatabase } from '../db/database.js';

type BookmarkRow = Record<string, unknown>;

export type BookmarkRecord = BookmarkDetail & {
  internalId: number;
  userId: number;
  normalizedUrl: string;
  createdAtMs: number;
};

export type BookmarkCursor = { createdAt: number; internalId: number };

const selectColumns = `
  SELECT b.*,
         fav.public_id AS favicon_public_id,
         prev.public_id AS preview_public_id,
         c.public_id AS collection_public_id,
         c.name AS collection_name,
         COALESCE((SELECT json_group_array(json_object('id', t.public_id, 'name', t.name))
                   FROM bookmark_tags bt JOIN tags t ON t.id = bt.tag_id
                   WHERE bt.bookmark_id = b.id), '[]') AS tags_json
  FROM bookmarks b
  LEFT JOIN media_assets fav ON fav.id = b.favicon_asset_id
  LEFT JOIN media_assets prev ON prev.id = b.preview_asset_id
  LEFT JOIN collections c ON c.id = b.collection_id
`;

export class BookmarkRepository {
  constructor(private readonly database: AppDatabase) {}

  findByNormalizedUrl(userId: number, normalizedUrl: string): BookmarkRecord | null {
    return this.map(
      this.database
        .prepare(`${selectColumns} WHERE b.user_id = ? AND b.url_normalized = ?`)
        .get(userId, normalizedUrl),
    );
  }

  getOwned(userId: number, publicId: string): BookmarkRecord | null {
    return this.map(
      this.database.prepare(`${selectColumns} WHERE b.user_id = ? AND b.public_id = ?`).get(userId, publicId),
    );
  }

  getOwnedMany(userId: number, publicIds: string[]): BookmarkRecord[] {
    if (publicIds.length === 0) return [];
    const placeholders = publicIds.map(() => '?').join(',');
    const rows = this.database
      .prepare(`${selectColumns} WHERE b.user_id = ? AND b.public_id IN (${placeholders})`)
      .all(userId, ...publicIds);
    const mapped = new Map(
      rows.map((row) => {
        const item = this.map(row)!;
        return [item.id, item];
      }),
    );
    return publicIds.map((id) => mapped.get(id)).filter((item): item is BookmarkRecord => Boolean(item));
  }

  listActive(
    userId: number,
    limit = 50,
    cursor?: BookmarkCursor,
  ): { items: BookmarkRecord[]; total: number; hasMore: boolean; next: BookmarkCursor | null } {
    const cursorClause = cursor
      ? 'AND (b.created_at < @createdAt OR (b.created_at = @createdAt AND b.id < @internalId))'
      : '';
    const rows = this.database
      .prepare(
        `${selectColumns}
         WHERE b.user_id = @userId AND b.archived_at IS NULL ${cursorClause}
         ORDER BY b.created_at DESC, b.id DESC LIMIT @rowLimit`,
      )
      .all({ userId, rowLimit: limit + 1, ...cursor });
    const total = (
      this.database
        .prepare('SELECT COUNT(*) AS count FROM bookmarks WHERE user_id = ? AND archived_at IS NULL')
        .get(userId) as { count: number }
    ).count;
    const hasMore = rows.length > limit;
    const items = rows.slice(0, limit).map((row) => this.map(row)!);
    const last = items.at(-1);
    return {
      items,
      total,
      hasMore,
      next: hasMore && last ? { createdAt: last.createdAtMs, internalId: last.internalId } : null,
    };
  }

  create(input: {
    publicId: string;
    userId: number;
    url: string;
    normalizedUrl: string;
    title: string;
    description: string | null;
    noteMarkdown: string | null;
    notePlain: string | null;
    faviconAssetId: number | null;
    previewAssetId: number | null;
    collectionId: number | null;
    tagIds: number[];
    isFavorite: boolean;
    readingState: 'none' | 'unread' | 'read';
  }): BookmarkRecord {
    const now = Date.now();
    const create = this.database.transaction(() => {
      this.database
        .prepare(
          `INSERT INTO bookmarks(public_id, user_id, url, url_normalized, title, description,
          note_markdown, note_plain, favicon_asset_id, preview_asset_id, collection_id, is_favorite,
          reading_state, created_at, updated_at)
         VALUES (@publicId, @userId, @url, @normalizedUrl, @title, @description,
          @noteMarkdown, @notePlain, @faviconAssetId, @previewAssetId, @collectionId, @isFavorite,
          @readingState, @now, @now)`,
        )
        .run({ ...input, isFavorite: input.isFavorite ? 1 : 0, now });
      const bookmark = this.getOwned(input.userId, input.publicId)!;
      const insertTag = this.database.prepare(
        'INSERT INTO bookmark_tags(bookmark_id, tag_id, created_at) VALUES (?, ?, ?)',
      );
      for (const tagId of input.tagIds) insertTag.run(bookmark.internalId, tagId, now);
    });
    create();
    return this.getOwned(input.userId, input.publicId)!;
  }

  update(
    userId: number,
    publicId: string,
    expectedVersion: number,
    changes: {
      url: string;
      normalizedUrl: string;
      title: string;
      description: string | null;
      noteMarkdown: string | null;
      notePlain: string | null;
      faviconAssetId: number | null;
      previewAssetId: number | null;
      collectionId: number | null;
      tagIds: number[];
      isFavorite: boolean;
      readingState: 'none' | 'unread' | 'read';
    },
  ): BookmarkRecord | null {
    const perform = this.database.transaction(() => {
      const result = this.database
        .prepare(
          `UPDATE bookmarks
         SET url = @url, url_normalized = @normalizedUrl, title = @title,
             description = @description, note_markdown = @noteMarkdown, note_plain = @notePlain,
             favicon_asset_id = @faviconAssetId, preview_asset_id = @previewAssetId,
             collection_id = @collectionId,
             is_favorite = @isFavorite, reading_state = @readingState,
             updated_at = @now, version = version + 1
         WHERE user_id = @userId AND public_id = @publicId AND version = @expectedVersion`,
        )
        .run({
          ...changes,
          isFavorite: changes.isFavorite ? 1 : 0,
          userId,
          publicId,
          expectedVersion,
          now: Date.now(),
        });
      if (!result.changes) return false;
      const row = this.database
        .prepare('SELECT id FROM bookmarks WHERE user_id = ? AND public_id = ?')
        .get(userId, publicId) as { id: number };
      this.database.prepare('DELETE FROM bookmark_tags WHERE bookmark_id = ?').run(row.id);
      const insertTag = this.database.prepare(
        'INSERT INTO bookmark_tags(bookmark_id, tag_id, created_at) VALUES (?, ?, ?)',
      );
      for (const tagId of changes.tagIds) insertTag.run(row.id, tagId, Date.now());
      return true;
    });
    const changed = perform();
    return changed ? this.getOwned(userId, publicId) : null;
  }

  updateState(
    userId: number,
    publicId: string,
    expectedVersion: number,
    changes: { readingState?: 'none' | 'unread' | 'read'; isFavorite?: boolean; archivedAt?: number | null },
  ): BookmarkRecord | null {
    const sets = ['updated_at = @now', 'version = version + 1'];
    const params: Record<string, unknown> = { userId, publicId, expectedVersion, now: Date.now() };
    if (changes.readingState !== undefined) {
      sets.push('reading_state = @readingState');
      params.readingState = changes.readingState;
    }
    if (changes.isFavorite !== undefined) {
      sets.push('is_favorite = @isFavorite');
      params.isFavorite = changes.isFavorite ? 1 : 0;
    }
    if (changes.archivedAt !== undefined) {
      sets.push('archived_at = @archivedAt');
      params.archivedAt = changes.archivedAt;
    }
    const result = this.database
      .prepare(
        `UPDATE bookmarks SET ${sets.join(', ')} WHERE user_id = @userId AND public_id = @publicId AND version = @expectedVersion`,
      )
      .run(params);
    return result.changes ? this.getOwned(userId, publicId) : null;
  }

  deleteOwned(userId: number, publicId: string, expectedVersion: number): boolean {
    const transaction = this.database.transaction(() => {
      const row = this.database
        .prepare('SELECT id FROM bookmarks WHERE user_id = ? AND public_id = ? AND version = ?')
        .get(userId, publicId, expectedVersion) as { id: number } | undefined;
      if (!row) return false;
      this.database.prepare('DELETE FROM bookmark_search WHERE rowid = ?').run(row.id);
      this.database.prepare('DELETE FROM bookmarks WHERE id = ?').run(row.id);
      return true;
    });
    return transaction();
  }

  private map(value: unknown): BookmarkRecord | null {
    const row = value as BookmarkRow | undefined;
    if (!row) return null;
    const faviconId = row.favicon_public_id as string | null;
    const previewId = row.preview_public_id as string | null;
    return {
      internalId: row.id as number,
      userId: row.user_id as number,
      normalizedUrl: row.url_normalized as string,
      createdAtMs: row.created_at as number,
      id: row.public_id as string,
      url: row.url as string,
      title: row.title as string,
      description: row.description as string | null,
      noteMarkdown: row.note_markdown as string | null,
      notePlain: row.note_plain as string | null,
      favicon: faviconId ? { id: faviconId, url: `/api/media/${faviconId}` } : null,
      previewImage: previewId ? { id: previewId, url: `/api/media/${previewId}` } : null,
      tags: JSON.parse((row.tags_json as string) || '[]') as Array<{ id: string; name: string }>,
      collection: row.collection_public_id
        ? { id: row.collection_public_id as string, name: row.collection_name as string }
        : null,
      isFavorite: Boolean(row.is_favorite),
      readingState: row.reading_state as 'none' | 'unread' | 'read',
      archivedAt: row.archived_at ? new Date(row.archived_at as number).toISOString() : null,
      createdAt: new Date(row.created_at as number).toISOString(),
      updatedAt: new Date(row.updated_at as number).toISOString(),
      version: row.version as number,
    };
  }
}

export function toDetail(record: BookmarkRecord): BookmarkDetail {
  return {
    id: record.id,
    url: record.url,
    title: record.title,
    description: record.description,
    noteMarkdown: record.noteMarkdown,
    notePlain: record.notePlain,
    favicon: record.favicon,
    previewImage: record.previewImage,
    tags: record.tags,
    collection: record.collection,
    isFavorite: record.isFavorite,
    readingState: record.readingState,
    archivedAt: record.archivedAt,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    version: record.version,
  };
}
