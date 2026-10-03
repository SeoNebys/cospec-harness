import type { Bookmark, TagSummary } from '../../shared/types.js';
import type { CreateBookmarkInput, UpdateBookmarkInput } from '../../shared/schemas.js';
import { canonicalizeUrl, normalizeTag } from '../services/url-policy.js';
import type { BookmarkDatabase } from './client.js';

interface BookmarkRow {
  id: number;
  url: string;
  normalized_url: string;
  title: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  tags_json: string;
}

export class DuplicateBookmarkError extends Error {
  constructor(public readonly duplicates: Bookmark[]) {
    super('That web address is already in your library.');
    this.name = 'DuplicateBookmarkError';
  }
}

export class BookmarkNotFoundError extends Error {
  constructor() {
    super('That bookmark no longer exists.');
    this.name = 'BookmarkNotFoundError';
  }
}

export interface ListBookmarksOptions {
  query?: string;
  tag?: string;
}

const BOOKMARK_SELECT = `
  SELECT
    b.id,
    b.url,
    b.normalized_url,
    b.title,
    b.description,
    b.created_at,
    b.updated_at,
    COALESCE((
      SELECT json_group_array(name)
      FROM (
        SELECT t.name AS name
        FROM bookmark_tags bt
        JOIN tags t ON t.id = bt.tag_id
        WHERE bt.bookmark_id = b.id
        ORDER BY lower(t.name), t.name
      )
    ), '[]') AS tags_json
  FROM bookmarks b
`;

function mapBookmark(row: BookmarkRow): Bookmark {
  return {
    id: row.id,
    url: row.url,
    title: row.title,
    description: row.description,
    tags: JSON.parse(row.tags_json) as string[],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function cleanTags(tags: string[]): string[] {
  const byNormalized = new Map<string, string>();
  for (const candidate of tags) {
    const display = candidate.trim().replace(/\s+/g, ' ');
    const normalized = normalizeTag(display);
    if (display && normalized && !byNormalized.has(normalized)) {
      byNormalized.set(normalized, display);
    }
  }
  return [...byNormalized.values()].slice(0, 20);
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, '\\$&');
}

export class BookmarkRepository {
  constructor(private readonly database: BookmarkDatabase) {}

  getById(id: number): Bookmark | null {
    const row = this.database.prepare(`${BOOKMARK_SELECT} WHERE b.id = ?`).get(id) as BookmarkRow | undefined;
    return row ? mapBookmark(row) : null;
  }

  findDuplicates(normalizedUrl: string, excludeId?: number): Bookmark[] {
    const rows = this.database
      .prepare(`${BOOKMARK_SELECT} WHERE b.normalized_url = @normalizedUrl AND (@excludeId IS NULL OR b.id <> @excludeId) ORDER BY b.created_at DESC, b.id DESC`)
      .all({ normalizedUrl, excludeId: excludeId ?? null }) as BookmarkRow[];
    return rows.map(mapBookmark);
  }

  list(options: ListBookmarksOptions = {}): Bookmark[] {
    const query = options.query?.trim() ?? '';
    const tag = normalizeTag(options.tag ?? '');
    const clauses: string[] = [];
    const params: Record<string, string> = {};
    if (query) {
      params.term = `%${escapeLike(query.toLocaleLowerCase())}%`;
      clauses.push(`(
        lower(b.title) LIKE @term ESCAPE '\\'
        OR lower(b.url) LIKE @term ESCAPE '\\'
        OR lower(COALESCE(b.description, '')) LIKE @term ESCAPE '\\'
        OR EXISTS (
          SELECT 1 FROM bookmark_tags search_bt
          JOIN tags search_t ON search_t.id = search_bt.tag_id
          WHERE search_bt.bookmark_id = b.id AND lower(search_t.name) LIKE @term ESCAPE '\\'
        )
      )`);
    }
    if (tag) {
      params.tag = tag;
      clauses.push(`EXISTS (
        SELECT 1 FROM bookmark_tags filter_bt
        JOIN tags filter_t ON filter_t.id = filter_bt.tag_id
        WHERE filter_bt.bookmark_id = b.id AND filter_t.normalized_name = @tag
      )`);
    }
    const where = clauses.length ? ` WHERE ${clauses.join(' AND ')}` : '';
    const rows = this.database.prepare(`${BOOKMARK_SELECT}${where} ORDER BY b.created_at DESC, b.id DESC`).all(params) as BookmarkRow[];
    return rows.map(mapBookmark);
  }

  create(input: CreateBookmarkInput): Bookmark {
    const normalized = canonicalizeUrl(input.url);
    const duplicates = this.findDuplicates(normalized.normalized);
    if (duplicates.length > 0 && !input.allowDuplicate) {
      throw new DuplicateBookmarkError(duplicates);
    }

    const createTransaction = this.database.transaction(() => {
      const now = new Date().toISOString();
      const result = this.database
        .prepare(`INSERT INTO bookmarks (url, normalized_url, title, description, created_at, updated_at)
          VALUES (@url, @normalizedUrl, @title, @description, @createdAt, @updatedAt)`)
        .run({
          url: normalized.canonical,
          normalizedUrl: normalized.normalized,
          title: input.title.trim(),
          description: input.description?.trim() || null,
          createdAt: now,
          updatedAt: now,
        });
      const id = Number(result.lastInsertRowid);
      this.replaceTags(id, input.tags);
      return id;
    });

    const created = this.getById(createTransaction());
    if (!created) throw new Error('The saved bookmark could not be read back.');
    return created;
  }

  update(id: number, input: UpdateBookmarkInput): Bookmark {
    const current = this.getById(id);
    if (!current) throw new BookmarkNotFoundError();
    const normalized = input.url === undefined ? canonicalizeUrl(current.url) : canonicalizeUrl(input.url);
    const duplicates = this.findDuplicates(normalized.normalized, id);
    if (duplicates.length > 0 && !input.allowDuplicate) {
      throw new DuplicateBookmarkError(duplicates);
    }

    const updateTransaction = this.database.transaction(() => {
      const nextTitle = input.title === undefined ? current.title : input.title.trim();
      const nextDescription = input.description === undefined ? current.description : input.description?.trim() || null;
      this.database
        .prepare(`UPDATE bookmarks
          SET url = @url, normalized_url = @normalizedUrl, title = @title, description = @description, updated_at = @updatedAt
          WHERE id = @id`)
        .run({
          id,
          url: normalized.canonical,
          normalizedUrl: normalized.normalized,
          title: nextTitle,
          description: nextDescription,
          updatedAt: new Date().toISOString(),
        });
      if (input.tags !== undefined) this.replaceTags(id, input.tags);
      this.deleteOrphanTags();
    });
    updateTransaction();
    const updated = this.getById(id);
    if (!updated) throw new BookmarkNotFoundError();
    return updated;
  }

  delete(id: number): boolean {
    const remove = this.database.transaction(() => {
      const result = this.database.prepare('DELETE FROM bookmarks WHERE id = ?').run(id);
      this.deleteOrphanTags();
      return result.changes > 0;
    });
    return remove();
  }

  listTags(): TagSummary[] {
    return this.database
      .prepare(`SELECT t.name, COUNT(bt.bookmark_id) AS count
        FROM tags t JOIN bookmark_tags bt ON bt.tag_id = t.id
        GROUP BY t.id, t.name ORDER BY lower(t.name), t.name`)
      .all()
      .map((row) => ({ name: (row as { name: string }).name, count: Number((row as { count: number }).count) }));
  }

  count(): number {
    return Number((this.database.prepare('SELECT COUNT(*) AS count FROM bookmarks').get() as { count: number }).count);
  }

  private replaceTags(bookmarkId: number, tags: string[]): void {
    const cleaned = cleanTags(tags);
    this.database.prepare('DELETE FROM bookmark_tags WHERE bookmark_id = ?').run(bookmarkId);
    const insertTag = this.database.prepare('INSERT OR IGNORE INTO tags (name, normalized_name) VALUES (?, ?)');
    const findTag = this.database.prepare('SELECT id FROM tags WHERE normalized_name = ?');
    const associate = this.database.prepare('INSERT INTO bookmark_tags (bookmark_id, tag_id) VALUES (?, ?)');
    for (const name of cleaned) {
      const normalized = normalizeTag(name);
      insertTag.run(name, normalized);
      const tag = findTag.get(normalized) as { id: number };
      associate.run(bookmarkId, tag.id);
    }
  }

  private deleteOrphanTags(): void {
    this.database.prepare('DELETE FROM tags WHERE NOT EXISTS (SELECT 1 FROM bookmark_tags bt WHERE bt.tag_id = tags.id)').run();
  }
}
