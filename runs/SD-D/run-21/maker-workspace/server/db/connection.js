import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

// Load the experimental built-in via require so bundlers (Vite/Vitest) do not
// attempt to statically resolve `node:sqlite`.
const require = createRequire(import.meta.url);
const { DatabaseSync } = require('node:sqlite');

const __dirname = dirname(fileURLToPath(import.meta.url));

// Repository-root-relative data directory (data/bookmarks.db).
export const DATA_DIR = resolve(__dirname, '../../data');
export const CAPTURES_DIR = resolve(DATA_DIR, 'captures');
const DB_PATH = process.env.BOOKMARKS_DB || resolve(DATA_DIR, 'bookmarks.db');

if (DB_PATH !== ':memory:') mkdirSync(CAPTURES_DIR, { recursive: true });

const sqlite = new DatabaseSync(DB_PATH);
sqlite.exec('PRAGMA journal_mode = WAL');
sqlite.exec('PRAGMA foreign_keys = ON');

// Thin wrapper giving the small subset of the better-sqlite3 API this app uses
// (prepare().run/get/all, exec, transaction), backed by node:sqlite.
const db = {
  exec: (sql) => sqlite.exec(sql),
  prepare: (sql) => sqlite.prepare(sql),
  // Runs fn() inside a transaction; returns a callable like better-sqlite3.
  transaction: (fn) => (...args) => {
    sqlite.exec('BEGIN');
    try {
      const result = fn(...args);
      sqlite.exec('COMMIT');
      return result;
    } catch (err) {
      sqlite.exec('ROLLBACK');
      throw err;
    }
  },
};

export default db;
