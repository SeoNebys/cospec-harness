import type { AppDatabase } from '../db/connection.js';
import { normalizeTag } from '../search/compile.js';
import { publicId, timestamp, type RuntimeValues, runtimeValues } from './database.js';

export interface TagRow {
  id: number;
  public_id: string;
  label: string;
  normalized_label: string;
}

export class TagRepository {
  constructor(
    private db: AppDatabase,
    private runtime: RuntimeValues = runtimeValues,
  ) {}
  resolve(labels: string[]): TagRow[] {
    return labels.map((input) => {
      const label = input.trim().replace(/\s+/g, ' ').normalize('NFKC');
      const normalized = normalizeTag(label);
      const existing = this.db.prepare('SELECT * FROM tags WHERE normalized_label=?').get(normalized) as
        | TagRow
        | undefined;
      if (existing) return existing;
      const result = this.db
        .prepare('INSERT INTO tags(public_id,label,normalized_label,created_at) VALUES (?,?,?,?)')
        .run(publicId(this.runtime), label, normalized, timestamp(this.runtime));
      return this.db.prepare('SELECT * FROM tags WHERE id=?').get(result.lastInsertRowid) as TagRow;
    });
  }
  replace(bookmarkId: number, labels: string[]): TagRow[] {
    const tags = this.resolve(labels);
    this.db.prepare('DELETE FROM bookmark_tags WHERE bookmark_id=?').run(bookmarkId);
    const insert = this.db.prepare('INSERT INTO bookmark_tags(bookmark_id,tag_id,created_at) VALUES (?,?,?)');
    for (const tag of tags) insert.run(bookmarkId, tag.id, timestamp(this.runtime));
    return tags;
  }
  attached(bookmarkId: number): TagRow[] {
    return this.db
      .prepare(
        `SELECT t.* FROM tags t JOIN bookmark_tags bt ON bt.tag_id=t.id WHERE bt.bookmark_id=? ORDER BY t.label COLLATE NOCASE,t.id`,
      )
      .all(bookmarkId) as TagRow[];
  }
  suggest(input: string, excludeBookmarkId?: string): TagRow[] {
    const needle = `%${normalizeTag(input).replace(/[\\%_]/g, '\\$&')}%`;
    const prefix = `${normalizeTag(input).replace(/[\\%_]/g, '\\$&')}%`;
    return this.db
      .prepare(
        `SELECT t.* FROM tags t
      WHERE t.normalized_label LIKE ? ESCAPE '\\'
      AND (? IS NULL OR NOT EXISTS(SELECT 1 FROM bookmark_tags bt JOIN bookmarks b ON b.id=bt.bookmark_id WHERE bt.tag_id=t.id AND b.public_id=?))
      ORDER BY CASE WHEN t.normalized_label LIKE ? ESCAPE '\\' THEN 0 ELSE 1 END, t.label COLLATE NOCASE, t.id LIMIT 8`,
      )
      .all(needle, excludeBookmarkId ?? null, excludeBookmarkId ?? null, prefix) as TagRow[];
  }
}
