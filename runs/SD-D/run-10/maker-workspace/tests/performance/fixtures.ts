import { randomUUID } from 'node:crypto';
import type { AppDatabase } from '../../src/server/db/database';

export function seedBookmarks(database: AppDatabase, userId: number, count: number, prefix = 'benchmark') {
  const insertBookmark =
    database.prepare(`INSERT INTO bookmarks(public_id,user_id,url,url_normalized,title,description,note_markdown,note_plain,is_favorite,reading_state,created_at,updated_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`);
  const insertSearch = database.prepare(
    'INSERT INTO bookmark_search(rowid,title,url,description,note,tags) VALUES(?,?,?,?,?,?)',
  );
  const items: Array<{ id: string; version: number }> = [];
  database.transaction(() => {
    for (let index = 0; index < count; index += 1) {
      const publicId = `bmk_${randomUUID()}`;
      const url = `https://example.com/${prefix}/${index}`;
      const title = `${prefix} bookmark ${String(index).padStart(5, '0')}`;
      const now = 1_700_000_000_000 + index;
      const result = insertBookmark.run(
        publicId,
        userId,
        url,
        url,
        title,
        index % 10 === 0 ? 'needle climate policy' : 'ordinary record',
        null,
        '',
        0,
        'none',
        now,
        now,
      );
      insertSearch.run(
        result.lastInsertRowid,
        title,
        url,
        index % 10 === 0 ? 'needle climate policy' : 'ordinary record',
        '',
        '',
      );
      items.push({ id: publicId, version: 1 });
    }
  })();
  return items;
}
