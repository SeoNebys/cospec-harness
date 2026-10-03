import type { TagSummary } from '../../shared/contracts/api.js';
import type { AppDatabase } from '../db/database.js';

export class TagRepository {
  constructor(private readonly db: AppDatabase) {}

  listWithBookmarkCounts(): TagSummary[] {
    return this.db.raw.prepare(`
      SELECT t.display_name AS name, count(bt.bookmark_id) AS bookmarkCount
      FROM tags t
      JOIN bookmark_tags bt ON bt.tag_id = t.id
      GROUP BY t.id
      ORDER BY search_normalize(t.display_name), t.id
    `).all() as TagSummary[];
  }
}
