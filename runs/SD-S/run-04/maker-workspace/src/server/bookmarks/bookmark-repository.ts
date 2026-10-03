import { randomUUID } from 'node:crypto';
import type { Database } from '../db/index.js';
import type {
  Bookmark,
  BookmarkInput,
  BookmarkStatus,
  Tag,
} from '../../shared/contracts/bookmarks.js';
import { normalizeUrl } from './url-normalization.js';
import { distinctTags, normalizeTag } from './tag-normalization.js';

type Row = Record<string, string | number | null>;

export class BookmarkRepository {
  constructor(private db: Database) {}

  private tagsFor(bookmarkId: string): Tag[] {
    return this.db
      .prepare(
        `SELECT t.id,t.name FROM tags t JOIN bookmark_tags bt ON bt.tag_id=t.id WHERE bt.bookmark_id=? ORDER BY t.normalized_name`,
      )
      .all(bookmarkId) as Tag[];
  }

  private map(row: Row): Bookmark {
    return {
      id: String(row.id),
      url: String(row.url),
      title: String(row.title),
      notes: String(row.notes),
      tags: this.tagsFor(String(row.id)),
      domain: new URL(String(row.url)).hostname,
      isFavorite: Boolean(row.is_favorite),
      status: row.status as BookmarkStatus,
      archivedAt: row.archived_at ? String(row.archived_at) : null,
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    };
  }

  findOwned(userId: string, id: string): Bookmark | undefined {
    const row = this.db
      .prepare('SELECT * FROM bookmarks WHERE user_id=? AND id=?')
      .get(userId, id) as Row | undefined;
    return row ? this.map(row) : undefined;
  }

  findDuplicate(userId: string, url: string, excludeId?: string): Bookmark | undefined {
    const row = this.db
      .prepare(
        `SELECT * FROM bookmarks WHERE user_id=? AND status='active' AND normalized_url=? AND (? IS NULL OR id<>?) ORDER BY created_at LIMIT 1`,
      )
      .get(userId, normalizeUrl(url), excludeId ?? null, excludeId ?? null) as Row | undefined;
    return row ? this.map(row) : undefined;
  }

  private replaceTags(userId: string, bookmarkId: string, values: string[], now: string) {
    this.db.prepare('DELETE FROM bookmark_tags WHERE bookmark_id=?').run(bookmarkId);
    for (const name of distinctTags(values)) {
      const normalized = normalizeTag(name);
      this.db
        .prepare(
          'INSERT OR IGNORE INTO tags(id,user_id,name,normalized_name,created_at) VALUES(?,?,?,?,?)',
        )
        .run(randomUUID(), userId, name, normalized, now);
      const tag = this.db
        .prepare('SELECT id FROM tags WHERE user_id=? AND normalized_name=?')
        .get(userId, normalized) as { id: string };
      this.db
        .prepare('INSERT INTO bookmark_tags(bookmark_id,tag_id) VALUES(?,?)')
        .run(bookmarkId, tag.id);
    }
  }

  create(userId: string, input: BookmarkInput): Bookmark {
    const id = randomUUID();
    const now = new Date().toISOString();
    this.db.exec('BEGIN IMMEDIATE');
    try {
      this.db
        .prepare(
          "INSERT INTO bookmarks(id,user_id,url,normalized_url,title,notes,is_favorite,status,archived_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,'active',NULL,?,?)",
        )
        .run(
          id,
          userId,
          input.url.trim(),
          normalizeUrl(input.url),
          input.title.trim(),
          input.notes.trim(),
          input.isFavorite ? 1 : 0,
          now,
          now,
        );
      this.replaceTags(userId, id, input.tags, now);
      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
    return this.findOwned(userId, id)!;
  }

  update(userId: string, id: string, input: BookmarkInput): Bookmark | undefined {
    const now = new Date().toISOString();
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const result = this.db
        .prepare(
          'UPDATE bookmarks SET url=?,normalized_url=?,title=?,notes=?,is_favorite=?,updated_at=? WHERE id=? AND user_id=?',
        )
        .run(
          input.url.trim(),
          normalizeUrl(input.url),
          input.title.trim(),
          input.notes.trim(),
          input.isFavorite ? 1 : 0,
          now,
          id,
          userId,
        );
      if (result.changes) this.replaceTags(userId, id, input.tags, now);
      this.db.exec('COMMIT');
      return result.changes ? this.findOwned(userId, id) : undefined;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  setFavorite(userId: string, id: string, value: boolean): Bookmark | undefined {
    const result = this.db
      .prepare('UPDATE bookmarks SET is_favorite=?,updated_at=? WHERE id=? AND user_id=?')
      .run(value ? 1 : 0, new Date().toISOString(), id, userId);
    return result.changes ? this.findOwned(userId, id) : undefined;
  }

  setStatus(userId: string, id: string, status: BookmarkStatus): Bookmark | undefined {
    const now = new Date().toISOString();
    const result = this.db
      .prepare('UPDATE bookmarks SET status=?,archived_at=?,updated_at=? WHERE id=? AND user_id=?')
      .run(status, status === 'archived' ? now : null, now, id, userId);
    return result.changes ? this.findOwned(userId, id) : undefined;
  }

  delete(userId: string, id: string): boolean {
    return Boolean(
      this.db.prepare('DELETE FROM bookmarks WHERE id=? AND user_id=?').run(id, userId).changes,
    );
  }

  list(
    userId: string,
    options: {
      view: BookmarkStatus;
      q?: string;
      tags?: string[];
      favorite?: boolean;
      cursor?: string;
      limit: number;
    },
  ) {
    const where = ['b.user_id=?', 'b.status=?'];
    const params: (string | number)[] = [userId, options.view];
    if (options.q) {
      const escaped = `%${options.q.replace(/[\\%_]/g, '\\$&')}%`;
      where.push(
        `(b.title LIKE ? ESCAPE '\\' COLLATE NOCASE OR b.url LIKE ? ESCAPE '\\' COLLATE NOCASE OR b.notes LIKE ? ESCAPE '\\' COLLATE NOCASE OR EXISTS(SELECT 1 FROM bookmark_tags qbt JOIN tags qt ON qt.id=qbt.tag_id WHERE qbt.bookmark_id=b.id AND qt.name LIKE ? ESCAPE '\\' COLLATE NOCASE))`,
      );
      params.push(escaped, escaped, escaped, escaped);
    }
    if (options.favorite !== undefined) {
      where.push('b.is_favorite=?');
      params.push(options.favorite ? 1 : 0);
    }
    if (options.tags?.length) {
      where.push(
        `b.id IN (SELECT bt.bookmark_id FROM bookmark_tags bt WHERE bt.tag_id IN (${options.tags.map(() => '?').join(',')}) GROUP BY bt.bookmark_id HAVING COUNT(DISTINCT bt.tag_id)=?)`,
      );
      params.push(...options.tags, options.tags.length);
    }
    if (options.cursor) {
      const [date, id] = Buffer.from(options.cursor, 'base64url').toString().split('|');
      where.push('(b.created_at<? OR (b.created_at=? AND b.id<?))');
      params.push(date, date, id);
    }
    const rows = this.db
      .prepare(
        `SELECT b.* FROM bookmarks b WHERE ${where.join(' AND ')} ORDER BY b.created_at DESC,b.id DESC LIMIT ?`,
      )
      .all(...params, options.limit + 1) as Row[];
    const hasMore = rows.length > options.limit;
    const visible = rows.slice(0, options.limit);
    const last = visible.at(-1);
    return {
      items: visible.map((row) => this.map(row)),
      nextCursor:
        hasMore && last ? Buffer.from(`${last.created_at}|${last.id}`).toString('base64url') : null,
    };
  }

  tagSummaries(userId: string, view: BookmarkStatus) {
    return this.db
      .prepare(
        `SELECT t.id,t.name,COUNT(b.id) bookmarkCount FROM tags t JOIN bookmark_tags bt ON bt.tag_id=t.id JOIN bookmarks b ON b.id=bt.bookmark_id AND b.status=? WHERE t.user_id=? GROUP BY t.id,t.name,t.normalized_name ORDER BY t.normalized_name`,
      )
      .all(view, userId);
  }
}
