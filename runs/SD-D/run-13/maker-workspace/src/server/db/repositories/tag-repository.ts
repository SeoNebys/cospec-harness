import { normalizeTag, validateTags } from '../../../shared/tags/normalize-tag.js';
import { BaseRepository } from './base-repository.js';

export class TagRepository extends BaseRepository {
  replace(bookmarkId: string, rawTags: string[]): void {
    const tags = validateTags(rawTags);
    this.db.prepare('DELETE FROM bookmark_tags WHERE bookmark_id=?').run(bookmarkId);
    const insertTag = this.db.prepare('INSERT OR IGNORE INTO tags(name,normalized_name,created_at) VALUES(?,?,?)');
    const getTag = this.db.prepare('SELECT id FROM tags WHERE normalized_name=?');
    const attach = this.db.prepare('INSERT INTO bookmark_tags(bookmark_id,tag_id) VALUES(?,?)');
    for (const name of tags) {
      const normalized = normalizeTag(name);
      insertTag.run(name, normalized, this.now());
      const row = getTag.get(normalized) as { id: number };
      attach.run(bookmarkId, row.id);
    }
    this.removeOrphans();
  }

  forBookmark(bookmarkId: string): Array<{ id: number; name: string }> {
    return this.db.prepare(`SELECT t.id,t.name FROM tags t JOIN bookmark_tags bt ON bt.tag_id=t.id WHERE bt.bookmark_id=? ORDER BY t.name COLLATE NOCASE,t.id`).all(bookmarkId) as any;
  }

  suggestions(prefix = '', limit = 10) {
    const normalized = normalizeTag(prefix);
    return this.db.prepare(`SELECT t.id,t.name,count(bt.bookmark_id) AS bookmarkCount FROM tags t JOIN bookmark_tags bt ON bt.tag_id=t.id WHERE t.normalized_name LIKE ? ESCAPE '\\' GROUP BY t.id ORDER BY bookmarkCount DESC,t.name COLLATE NOCASE LIMIT ?`)
      .all(`${normalized.replace(/[\\%_]/gu, '\\$&')}%`, limit) as Array<{ id: number; name: string; bookmarkCount: number }>;
  }

  removeOrphans(): void { this.db.prepare('DELETE FROM tags WHERE NOT EXISTS(SELECT 1 FROM bookmark_tags WHERE tag_id=tags.id)').run(); }
}
