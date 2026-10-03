import Database from 'better-sqlite3';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCHEMA = join(__dirname, '..', 'src', 'db', 'schema.sql');

export function makeDb(t) {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  db.exec(readFileSync(SCHEMA, 'utf8'));
  // Close on test teardown — better-sqlite3 asserts if a live DB is finalized
  // during process/isolate teardown under the node:test runner.
  if (t && typeof t.after === 'function') t.after(() => db.close());
  return db;
}
