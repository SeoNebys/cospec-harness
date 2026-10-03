import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let db;

// Open (or create) the single shared collection database. All application data
// lives here; nothing is keyed by session (FR-042).
export function getDb() {
  if (db) return db;
  const dataDir = process.env.BM_DATA_DIR || path.join(process.cwd(), 'data');
  fs.mkdirSync(dataDir, { recursive: true });
  fs.mkdirSync(path.join(dataDir, 'preserved'), { recursive: true });
  const dbFile = process.env.BM_DB_FILE || path.join(dataDir, 'bookmarks.db');
  db = new Database(dbFile);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  migrate(db);
  seedPreferences(db);
  return db;
}

// For tests: use an isolated in-memory database. Track instances and close them
// on process exit to avoid better-sqlite3's finalize-at-teardown assertion.
const _testDbs = [];
let _cleanupRegistered = false;
export function createTestDb() {
  const mem = new Database(':memory:');
  mem.pragma('foreign_keys = ON');
  migrate(mem);
  seedPreferences(mem);
  _testDbs.push(mem);
  if (!_cleanupRegistered) {
    _cleanupRegistered = true;
    process.on('exit', () => {
      for (const d of _testDbs) {
        try {
          d.close();
        } catch {
          /* ignore */
        }
      }
    });
  }
  return mem;
}

function migrate(database) {
  const migrationsDir = path.join(__dirname, 'migrations');
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  for (const file of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    database.exec(sql);
  }
}

// Ensure exactly one global preferences row exists (id = 1).
function seedPreferences(database) {
  const row = database.prepare('SELECT id FROM preferences WHERE id = 1').get();
  if (!row) {
    database
      .prepare(
        `INSERT INTO preferences (id, default_sort, items_per_page, text_size)
         VALUES (1, 'added_desc', 25, 'medium')`
      )
      .run();
  }
}

export function dataDirFor() {
  return process.env.BM_DATA_DIR || path.join(process.cwd(), 'data');
}
