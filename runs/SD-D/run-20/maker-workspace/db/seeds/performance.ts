import type { AppDatabase } from '../../src/server/db/connection';
import { replaceSearchRow } from '../../src/server/repositories/search-index';

export function seedPerformanceDatabase(db: AppDatabase, count = 10_000): void {
  const now = '2026-01-01T00:00:00.000Z';
  const insert = db.prepare(
    `INSERT INTO bookmarks(public_id,url,normalized_url,title,description,note_document,note_text,lifecycle_state,reading_state,metadata_status,created_at,updated_at) VALUES (?,?,?,?,?,NULL,?,'active',?,'fallback',?,?)`,
  );
  db.transaction(() => {
    const tagIds: number[] = [];
    const insertTag = db.prepare(
      'INSERT INTO tags(public_id,label,normalized_label,created_at) VALUES (?,?,?,?)',
    );
    for (let index = 0; index < 20; index += 1) {
      tagIds.push(
        Number(
          insertTag.run(
            `10000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
            `Topic ${index}`,
            `topic ${index}`,
            now,
          ).lastInsertRowid,
        ),
      );
    }
    const attach = db.prepare('INSERT INTO bookmark_tags(bookmark_id,tag_id,created_at) VALUES (?,?,?)');
    for (let index = 0; index < count; index++) {
      const id = Number(
        insert.run(
          `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
          `https://example.com/item-${index}`,
          `https://example.com/item-${index}`,
          `Bookmark ${String(index).padStart(5, '0')}`,
          `Reference material number ${index}`,
          index % 17 === 0 ? 'needle note' : '',
          index % 5 === 0 ? 'unread' : 'none',
          now,
          now,
        ).lastInsertRowid,
      );
      attach.run(id, tagIds[index % tagIds.length], now);
      replaceSearchRow(db, id);
    }
  })();
}
