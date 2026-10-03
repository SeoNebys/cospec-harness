import { resolve } from 'node:path';

import Database from 'better-sqlite3';

export function seedPerformanceBookmarks(count = 5_000): void {
  const db = new Database(resolve(process.cwd(), '.tmp/e2e.sqlite'));
  db.pragma('foreign_keys = ON');
  const insert = db.prepare(
    `INSERT INTO bookmarks
      (title, url, normalized_url, notes, is_favorite, is_archived, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 0, ?, ?)`,
  );
  db.transaction(() => {
    db.prepare('DELETE FROM bookmarks').run();
    db.prepare('DELETE FROM tags').run();
    for (let index = 1; index <= count; index += 1) {
      const padded = String(index).padStart(4, '0');
      const timestamp = new Date(Date.UTC(2026, 0, 1, 0, 0, index)).toISOString();
      insert.run(
        index === count ? 'Known performance target' : `Seed bookmark ${padded}`,
        `https://example.com/performance/${padded}`,
        `https://example.com/performance/${padded}`,
        index === count ? 'Unique needle for scale validation' : `Reference item ${padded}`,
        index % 10 === 0 ? 1 : 0,
        timestamp,
        timestamp,
      );
    }
  })();
  db.close();
}
