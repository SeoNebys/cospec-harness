import type Database from 'better-sqlite3';
import { SCHEMA_SQL } from './schema';

// Apply the schema and seed the singleton preferences row.
export function migrate(db: Database.Database): void {
  db.exec(SCHEMA_SQL);
  db.prepare(
    `INSERT OR IGNORE INTO display_preferences (id, default_sort, page_size, text_size)
     VALUES (1, 'saved_desc', 50, 'medium')`
  ).run();
}
