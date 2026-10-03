import { resolve } from 'node:path';

import Database from 'better-sqlite3';

export function resetE2eData(): void {
  const db = new Database(resolve(process.cwd(), '.tmp/e2e.sqlite'));
  db.pragma('foreign_keys = ON');
  db.transaction(() => {
    db.prepare('DELETE FROM bookmarks').run();
    db.prepare('DELETE FROM tags').run();
  })();
  db.close();
}
