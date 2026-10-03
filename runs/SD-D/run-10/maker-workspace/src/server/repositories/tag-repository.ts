import type { AppDatabase } from '../db/database.js';
import type { TagSummary } from '../../shared/contracts/organization.js';

export type TagRow = {
  id: number;
  publicId: string;
  userId: number;
  name: string;
  nameNormalized: string;
  version: number;
};

export class TagRepository {
  constructor(private readonly database: AppDatabase) {}

  list(userId: number, suggest = '', limit = 50): TagSummary[] {
    const normalized = suggest.trim().toLocaleLowerCase('en-US');
    const rows = this.database
      .prepare(
        `SELECT t.*, COUNT(bt.bookmark_id) AS bookmark_count, MAX(bt.created_at) AS last_used
       FROM tags t LEFT JOIN bookmark_tags bt ON bt.tag_id = t.id
       WHERE t.user_id = ? AND (? = '' OR t.name_normalized LIKE ? || '%')
       GROUP BY t.id
       ORDER BY CASE WHEN t.name_normalized = ? THEN 0 ELSE 1 END, last_used DESC, t.name COLLATE NOCASE
       LIMIT ?`,
      )
      .all(userId, normalized, normalized, normalized, limit) as Array<Record<string, unknown>>;
    return rows.map((row) => ({
      id: row.public_id as string,
      name: row.name as string,
      bookmarkCount: row.bookmark_count as number,
      version: row.version as number,
    }));
  }

  getOwned(userId: number, publicId: string): TagRow | null {
    return this.map(
      this.database.prepare('SELECT * FROM tags WHERE user_id = ? AND public_id = ?').get(userId, publicId),
    );
  }

  getByNormalized(userId: number, normalized: string): TagRow | null {
    return this.map(
      this.database
        .prepare('SELECT * FROM tags WHERE user_id = ? AND name_normalized = ?')
        .get(userId, normalized),
    );
  }

  create(userId: number, publicId: string, name: string, normalized: string): TagRow {
    const now = Date.now();
    this.database
      .prepare(
        `INSERT INTO tags(public_id,user_id,name,name_normalized,created_at,updated_at)
       VALUES(?,?,?,?,?,?)`,
      )
      .run(publicId, userId, name, normalized, now, now);
    return this.getOwned(userId, publicId)!;
  }

  rename(
    userId: number,
    publicId: string,
    expectedVersion: number,
    name: string,
    normalized: string,
  ): TagRow | null {
    const result = this.database
      .prepare(
        `UPDATE tags SET name=?, name_normalized=?, updated_at=?, version=version+1
       WHERE user_id=? AND public_id=? AND version=?`,
      )
      .run(name, normalized, Date.now(), userId, publicId, expectedVersion);
    return result.changes ? this.getOwned(userId, publicId) : null;
  }

  impact(userId: number, publicId: string): { bookmarkCount: number; savedSearchCount: number } | null {
    const row = this.database
      .prepare(
        `SELECT COUNT(DISTINCT bt.bookmark_id) AS bookmark_count,
              COUNT(DISTINCT sst.saved_search_id) AS saved_search_count
       FROM tags t
       LEFT JOIN bookmark_tags bt ON bt.tag_id=t.id
       LEFT JOIN saved_search_tags sst ON sst.tag_id=t.id
       WHERE t.user_id=? AND t.public_id=? GROUP BY t.id`,
      )
      .get(userId, publicId) as { bookmark_count: number; saved_search_count: number } | undefined;
    return row ? { bookmarkCount: row.bookmark_count, savedSearchCount: row.saved_search_count } : null;
  }

  merge(
    userId: number,
    source: TagRow,
    target: TagRow,
  ): { movedBookmarks: number; changedSavedSearches: number } {
    return this.database.transaction(() => {
      const bookmarks = this.database
        .prepare('SELECT bookmark_id FROM bookmark_tags WHERE tag_id=?')
        .all(source.id) as Array<{ bookmark_id: number }>;
      const searches = this.database
        .prepare('SELECT saved_search_id, polarity FROM saved_search_tags WHERE tag_id=?')
        .all(source.id) as Array<{ saved_search_id: number; polarity: string }>;
      const addBookmark = this.database.prepare(
        'INSERT OR IGNORE INTO bookmark_tags(bookmark_id,tag_id,created_at) VALUES(?,?,?)',
      );
      for (const row of bookmarks) addBookmark.run(row.bookmark_id, target.id, Date.now());
      const addSearch = this.database.prepare(
        'INSERT OR IGNORE INTO saved_search_tags(saved_search_id,tag_id,polarity) VALUES(?,?,?)',
      );
      for (const row of searches) addSearch.run(row.saved_search_id, target.id, row.polarity);
      this.database.prepare('DELETE FROM tags WHERE id=? AND user_id=?').run(source.id, userId);
      return { movedBookmarks: bookmarks.length, changedSavedSearches: searches.length };
    })();
  }

  delete(userId: number, row: TagRow): void {
    this.database.prepare('DELETE FROM tags WHERE id=? AND user_id=?').run(row.id, userId);
  }

  bookmarkIds(tagIds: number[]): number[] {
    if (tagIds.length === 0) return [];
    const placeholders = tagIds.map(() => '?').join(',');
    return (
      this.database
        .prepare(`SELECT DISTINCT bookmark_id AS id FROM bookmark_tags WHERE tag_id IN (${placeholders})`)
        .all(...tagIds) as Array<{ id: number }>
    ).map((row) => row.id);
  }

  private map(value: unknown): TagRow | null {
    const row = value as Record<string, unknown> | undefined;
    return row
      ? {
          id: row.id as number,
          publicId: row.public_id as string,
          userId: row.user_id as number,
          name: row.name as string,
          nameNormalized: row.name_normalized as string,
          version: row.version as number,
        }
      : null;
  }
}
