import type { BookmarkDatabase } from '../db/database.js';
import { DuplicateUrlError, NotFoundError } from '../errors.js';
import type {
  Bookmark,
  BookmarkListResponse,
  BookmarkQuery,
  CreateBookmarkInput,
  TagSummary,
  UpdateBookmarkInput,
} from '../../shared/bookmark-types.js';
import { normalizeTags } from '../../shared/normalize-tag.js';
import { normalizeUrl } from '../../shared/normalize-url.js';

interface BookmarkRow {
  id: number;
  title: string;
  url: string;
  notes: string;
  is_favorite: number;
  is_archived: number;
  created_at: string;
  updated_at: string;
}

interface TagRow {
  bookmark_id: number;
  name: string;
}

const defaultQuery: BookmarkQuery = {
  q: '',
  tags: [],
  archived: false,
  sort: 'newest',
};

export class BookmarkRepository {
  constructor(
    private readonly db: BookmarkDatabase,
    private readonly clock: () => string = () => new Date().toISOString(),
  ) {}

  create(input: CreateBookmarkInput): Bookmark {
    const normalizedUrl = normalizeUrl(input.url);
    const duplicate = this.db
      .prepare('SELECT id FROM bookmarks WHERE normalized_url = ?')
      .get(normalizedUrl) as { id: number } | undefined;
    if (duplicate) throw new DuplicateUrlError(duplicate.id);

    const tags = normalizeTags(input.tags);
    const now = this.clock();
    const createTransaction = this.db.transaction(() => {
      try {
        const result = this.db
          .prepare(
            `INSERT INTO bookmarks
              (title, url, normalized_url, notes, is_favorite, is_archived, created_at, updated_at)
             VALUES (?, ?, ?, ?, 0, 0, ?, ?)`,
          )
          .run(input.title, input.url, normalizedUrl, input.notes, now, now);
        const bookmarkId = Number(result.lastInsertRowid);
        this.replaceTags(bookmarkId, tags);
        return bookmarkId;
      } catch (error) {
        const existing = this.db
          .prepare('SELECT id FROM bookmarks WHERE normalized_url = ?')
          .get(normalizedUrl) as { id: number } | undefined;
        if (existing) throw new DuplicateUrlError(existing.id);
        throw error;
      }
    });

    return this.get(createTransaction());
  }

  get(id: number): Bookmark {
    const row = this.db.prepare('SELECT * FROM bookmarks WHERE id = ?').get(id) as
      BookmarkRow | undefined;
    if (!row) throw new NotFoundError();
    return this.hydrate([row])[0]!;
  }

  list(query: BookmarkQuery = defaultQuery): BookmarkListResponse {
    const conditions = ['b.is_archived = ?'];
    const parameters: Array<string | number> = [query.archived ? 1 : 0];

    if (query.favorite !== undefined) {
      conditions.push('b.is_favorite = ?');
      parameters.push(query.favorite ? 1 : 0);
    }

    if (query.q) {
      const search = `%${this.escapeLike(query.q.toLowerCase())}%`;
      conditions.push(`(
        LOWER(b.title) LIKE ? ESCAPE '\\'
        OR LOWER(b.url) LIKE ? ESCAPE '\\'
        OR LOWER(b.notes) LIKE ? ESCAPE '\\'
        OR EXISTS (
          SELECT 1 FROM bookmark_tags search_bt
          JOIN tags search_t ON search_t.id = search_bt.tag_id
          WHERE search_bt.bookmark_id = b.id
            AND search_t.normalized_name LIKE ? ESCAPE '\\'
        )
      )`);
      parameters.push(search, search, search, search);
    }

    for (const tag of normalizeTags(query.tags)) {
      conditions.push(`EXISTS (
        SELECT 1 FROM bookmark_tags filter_bt
        JOIN tags filter_t ON filter_t.id = filter_bt.tag_id
        WHERE filter_bt.bookmark_id = b.id AND filter_t.normalized_name = ?
      )`);
      parameters.push(tag.normalizedName);
    }

    const orderBy = {
      newest: 'b.created_at DESC, b.id DESC',
      oldest: 'b.created_at ASC, b.id ASC',
      title: 'LOWER(b.title) ASC, b.id ASC',
      updated: 'b.updated_at DESC, b.id DESC',
    }[query.sort];

    const rows = this.db
      .prepare(
        `SELECT b.* FROM bookmarks b
         WHERE ${conditions.join(' AND ')}
         ORDER BY ${orderBy}`,
      )
      .all(...parameters) as BookmarkRow[];
    return { items: this.hydrate(rows), total: rows.length };
  }

  listTags(archived = false): TagSummary[] {
    const rows = this.db
      .prepare(
        `SELECT t.name, COUNT(*) AS bookmark_count
         FROM tags t
         JOIN bookmark_tags bt ON bt.tag_id = t.id
         JOIN bookmarks b ON b.id = bt.bookmark_id
         WHERE b.is_archived = ?
         GROUP BY t.id, t.name
         ORDER BY LOWER(t.name), t.id`,
      )
      .all(archived ? 1 : 0) as Array<{ name: string; bookmark_count: number }>;
    return rows.map((row) => ({ name: row.name, bookmarkCount: row.bookmark_count }));
  }

  update(id: number, input: UpdateBookmarkInput): Bookmark {
    const current = this.get(id);
    const url = input.url ?? current.url;
    const normalizedUrl = normalizeUrl(url);
    const duplicate = this.db
      .prepare('SELECT id FROM bookmarks WHERE normalized_url = ? AND id <> ?')
      .get(normalizedUrl, id) as { id: number } | undefined;
    if (duplicate) throw new DuplicateUrlError(duplicate.id);

    const tags = input.tags === undefined ? undefined : normalizeTags(input.tags);
    const updateTransaction = this.db.transaction(() => {
      try {
        this.db
          .prepare(
            `UPDATE bookmarks SET
              title = ?, url = ?, normalized_url = ?, notes = ?,
              is_favorite = ?, is_archived = ?, updated_at = ?
             WHERE id = ?`,
          )
          .run(
            input.title ?? current.title,
            url,
            normalizedUrl,
            input.notes ?? current.notes,
            (input.isFavorite ?? current.isFavorite) ? 1 : 0,
            (input.isArchived ?? current.isArchived) ? 1 : 0,
            this.clock(),
            id,
          );
        if (tags) {
          this.db.prepare('DELETE FROM bookmark_tags WHERE bookmark_id = ?').run(id);
          this.replaceTags(id, tags);
          this.removeOrphanTags();
        }
      } catch (error) {
        const existing = this.db
          .prepare('SELECT id FROM bookmarks WHERE normalized_url = ? AND id <> ?')
          .get(normalizedUrl, id) as { id: number } | undefined;
        if (existing) throw new DuplicateUrlError(existing.id);
        throw error;
      }
    });
    updateTransaction();
    return this.get(id);
  }

  delete(id: number): void {
    const deleteTransaction = this.db.transaction(() => {
      const result = this.db.prepare('DELETE FROM bookmarks WHERE id = ?').run(id);
      if (result.changes === 0) throw new NotFoundError();
      this.removeOrphanTags();
    });
    deleteTransaction();
  }

  private replaceTags(bookmarkId: number, tags: ReturnType<typeof normalizeTags>): void {
    const upsertTag = this.db.prepare(
      `INSERT INTO tags (name, normalized_name) VALUES (?, ?)
       ON CONFLICT(normalized_name) DO NOTHING`,
    );
    const findTag = this.db.prepare('SELECT id FROM tags WHERE normalized_name = ?');
    const linkTag = this.db.prepare(
      'INSERT OR IGNORE INTO bookmark_tags (bookmark_id, tag_id) VALUES (?, ?)',
    );

    for (const tag of tags) {
      upsertTag.run(tag.name, tag.normalizedName);
      const row = findTag.get(tag.normalizedName) as { id: number };
      linkTag.run(bookmarkId, row.id);
    }
  }

  private escapeLike(value: string): string {
    return value.replace(/[\\%_]/gu, (character) => `\\${character}`);
  }

  private removeOrphanTags(): void {
    this.db
      .prepare(
        'DELETE FROM tags WHERE NOT EXISTS (SELECT 1 FROM bookmark_tags WHERE tag_id = tags.id)',
      )
      .run();
  }

  private hydrate(rows: BookmarkRow[]): Bookmark[] {
    if (rows.length === 0) return [];
    const placeholders = rows.map(() => '?').join(',');
    const tagRows = this.db
      .prepare(
        `SELECT bt.bookmark_id, t.name
         FROM bookmark_tags bt
         JOIN tags t ON t.id = bt.tag_id
         WHERE bt.bookmark_id IN (${placeholders})
         ORDER BY bt.rowid`,
      )
      .all(...rows.map(({ id }) => id)) as TagRow[];
    const tagsByBookmark = new Map<number, string[]>();
    for (const tag of tagRows) {
      const values = tagsByBookmark.get(tag.bookmark_id) ?? [];
      values.push(tag.name);
      tagsByBookmark.set(tag.bookmark_id, values);
    }
    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      url: row.url,
      notes: row.notes,
      tags: tagsByBookmark.get(row.id) ?? [],
      isFavorite: Boolean(row.is_favorite),
      isArchived: Boolean(row.is_archived),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }
}
