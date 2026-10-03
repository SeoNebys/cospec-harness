import type { BookmarkDatabase } from './connection.js';
import type {
  Bookmark,
  ReadingState,
  ResolvedBookmarkListQuery,
  Tag,
} from '../../shared/contracts.js';
import { normalizeTagName, type NormalizedTag } from '../../shared/normalization.js';

interface BookmarkRow {
  id: string;
  url: string;
  title: string;
  description: string;
  reading_state: ReadingState;
  created_at: string;
  updated_at: string;
}

export interface CreateBookmarkRecord {
  url: string;
  urlKey: string;
  title: string;
  description: string;
  tags: NormalizedTag[];
  readingState: ReadingState;
}

export type ReplaceBookmarkRecord = CreateBookmarkRecord;

export interface BookmarkRepositoryOptions {
  now?: () => string;
  createId?: () => string;
}

const DEFAULT_QUERY: ResolvedBookmarkListQuery = {
  view: 'all',
  query: '',
  tag: [],
  sort: 'newest',
};

export class BookmarkRepository {
  private readonly now: () => string;
  private readonly createId: () => string;

  constructor(
    private readonly database: BookmarkDatabase,
    options: BookmarkRepositoryOptions = {},
  ) {
    this.now = options.now ?? (() => new Date().toISOString());
    this.createId = options.createId ?? (() => crypto.randomUUID());
  }

  private tagsForBookmark(bookmarkId: string): string[] {
    const rows = this.database
      .prepare(
        `SELECT t.display_name AS name
         FROM bookmark_tags bt
         JOIN tags t ON t.id = bt.tag_id
         WHERE bt.bookmark_id = ?
         ORDER BY bt.rowid ASC`,
      )
      .all(bookmarkId) as Array<{ name: string }>;
    return rows.map(({ name }) => name);
  }

  private mapRow(row: BookmarkRow): Bookmark {
    return {
      id: row.id,
      url: row.url,
      title: row.title,
      description: row.description,
      tags: this.tagsForBookmark(row.id),
      readingState: row.reading_state,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  get(bookmarkId: string): Bookmark | null {
    const row = this.database
      .prepare(
        `SELECT id, url, title, description, reading_state, created_at, updated_at
         FROM bookmarks WHERE id = ?`,
      )
      .get(bookmarkId) as BookmarkRow | undefined;
    return row ? this.mapRow(row) : null;
  }

  findDuplicate(urlKey: string, excludeId?: string): Bookmark | null {
    const row = this.database
      .prepare(
        `SELECT id, url, title, description, reading_state, created_at, updated_at
         FROM bookmarks
         WHERE url_key = ? AND (? IS NULL OR id <> ?)
         ORDER BY created_at ASC, id ASC
         LIMIT 1`,
      )
      .get(urlKey, excludeId ?? null, excludeId ?? null) as BookmarkRow | undefined;
    return row ? this.mapRow(row) : null;
  }

  create(record: CreateBookmarkRecord): Bookmark {
    const createTransaction = this.database.transaction(() => {
      const id = this.createId();
      const timestamp = this.now();
      this.database
        .prepare(
          `INSERT INTO bookmarks
           (id, url, url_key, title, description, reading_state, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          id,
          record.url,
          record.urlKey,
          record.title,
          record.description,
          record.readingState,
          timestamp,
          timestamp,
        );

      const findTag = this.database.prepare(
        'SELECT id FROM tags WHERE normalized_name = ?',
      );
      const insertTag = this.database.prepare(
        'INSERT INTO tags (id, display_name, normalized_name) VALUES (?, ?, ?)',
      );
      const attachTag = this.database.prepare(
        'INSERT INTO bookmark_tags (bookmark_id, tag_id) VALUES (?, ?)',
      );

      for (const tag of record.tags) {
        const existing = findTag.get(tag.normalizedName) as { id: string } | undefined;
        const tagId = existing?.id ?? this.createId();
        if (!existing) insertTag.run(tagId, tag.displayName, tag.normalizedName);
        attachTag.run(id, tagId);
      }

      return id;
    });

    const id = createTransaction();
    const bookmark = this.get(id);
    if (!bookmark) throw new Error('Created bookmark could not be loaded.');
    return bookmark;
  }

  replace(bookmarkId: string, record: ReplaceBookmarkRecord): Bookmark | null {
    const replaceTransaction = this.database.transaction(() => {
      const result = this.database
        .prepare(
          `UPDATE bookmarks
           SET url = ?, url_key = ?, title = ?, description = ?, reading_state = ?, updated_at = ?
           WHERE id = ?`,
        )
        .run(
          record.url,
          record.urlKey,
          record.title,
          record.description,
          record.readingState,
          this.now(),
          bookmarkId,
        );
      if (result.changes === 0) return false;

      this.database.prepare('DELETE FROM bookmark_tags WHERE bookmark_id = ?').run(bookmarkId);
      const findTag = this.database.prepare('SELECT id FROM tags WHERE normalized_name = ?');
      const insertTag = this.database.prepare(
        'INSERT INTO tags (id, display_name, normalized_name) VALUES (?, ?, ?)',
      );
      const attachTag = this.database.prepare(
        'INSERT INTO bookmark_tags (bookmark_id, tag_id) VALUES (?, ?)',
      );
      for (const tag of record.tags) {
        const existing = findTag.get(tag.normalizedName) as { id: string } | undefined;
        const tagId = existing?.id ?? this.createId();
        if (!existing) insertTag.run(tagId, tag.displayName, tag.normalizedName);
        attachTag.run(bookmarkId, tagId);
      }
      this.database.prepare(
        'DELETE FROM tags WHERE NOT EXISTS (SELECT 1 FROM bookmark_tags WHERE tag_id = tags.id)',
      ).run();
      return true;
    });

    return replaceTransaction() ? this.get(bookmarkId) : null;
  }

  list(query: ResolvedBookmarkListQuery = DEFAULT_QUERY): Bookmark[] {
    const conditions: string[] = [];
    const parameters: Array<string | number> = [];

    if (query.view === 'read-later') conditions.push("b.reading_state = 'to_read'");

    if (query.query) {
      const escaped = query.query.toLowerCase().replaceAll('\\', '\\\\').replaceAll('%', '\\%').replaceAll('_', '\\_');
      const pattern = `%${escaped}%`;
      conditions.push(`(
        lower(b.title) LIKE ? ESCAPE '\\' OR
        lower(b.url) LIKE ? ESCAPE '\\' OR
        lower(b.description) LIKE ? ESCAPE '\\' OR
        EXISTS (
          SELECT 1 FROM bookmark_tags search_bt
          JOIN tags search_t ON search_t.id = search_bt.tag_id
          WHERE search_bt.bookmark_id = b.id
            AND lower(search_t.display_name) LIKE ? ESCAPE '\\'
        )
      )`);
      parameters.push(pattern, pattern, pattern, pattern);
    }

    for (const tag of query.tag) {
      conditions.push(`EXISTS (
        SELECT 1 FROM bookmark_tags filter_bt
        JOIN tags filter_t ON filter_t.id = filter_bt.tag_id
        WHERE filter_bt.bookmark_id = b.id AND filter_t.normalized_name = ?
      )`);
      parameters.push(normalizeTagName(tag));
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const order =
      query.sort === 'oldest'
        ? 'b.created_at ASC, b.id ASC'
        : query.sort === 'title'
          ? 'lower(b.title) ASC, b.id ASC'
          : 'b.created_at DESC, b.id ASC';

    const rows = this.database
      .prepare(
        `SELECT b.id, b.url, b.title, b.description, b.reading_state, b.created_at, b.updated_at
         FROM bookmarks b ${where}
         ORDER BY ${order}`,
      )
      .all(...parameters) as BookmarkRow[];
    return rows.map((row) => this.mapRow(row));
  }

  listTags(): Tag[] {
    return this.database
      .prepare(
        `SELECT t.display_name AS name,
                t.normalized_name AS normalizedName,
                COUNT(bt.bookmark_id) AS bookmarkCount
         FROM tags t
         JOIN bookmark_tags bt ON bt.tag_id = t.id
         GROUP BY t.id, t.display_name, t.normalized_name
         HAVING COUNT(bt.bookmark_id) > 0
         ORDER BY lower(t.display_name) ASC, t.normalized_name ASC`,
      )
      .all() as Tag[];
  }

  delete(bookmarkId: string): boolean {
    const remove = this.database.transaction(() => {
      const result = this.database.prepare('DELETE FROM bookmarks WHERE id = ?').run(bookmarkId);
      if (result.changes > 0) {
        this.database.prepare(
          'DELETE FROM tags WHERE NOT EXISTS (SELECT 1 FROM bookmark_tags WHERE tag_id = tags.id)',
        ).run();
      }
      return result.changes > 0;
    });
    return remove();
  }

  updateReadingState(bookmarkId: string, readingState: ReadingState): Bookmark | null {
    const result = this.database
      .prepare(
        `UPDATE bookmarks
         SET reading_state = ?, updated_at = ?
         WHERE id = ?`,
      )
      .run(readingState, this.now(), bookmarkId);
    return result.changes > 0 ? this.get(bookmarkId) : null;
  }
}
