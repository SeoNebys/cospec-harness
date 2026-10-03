import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { runMigrations } from './migrations.js';

let db = null;
let currentPath = null;
let hooked = false;

// Close cleanly on exit/termination so no better-sqlite3 handle is finalized
// during teardown (which can trip its native assertion).
function registerHooks() {
  if (hooked) return;
  hooked = true;
  process.once('exit', () => {
    try {
      if (db) db.close();
    } catch {
      /* ignore */
    }
  });
  // Graceful shutdown on signals in real server use only. Under the test runner
  // the worker receives signals during teardown; running SQLite there can trip
  // better-sqlite3's native finalizer assertion, so skip it.
  if (!process.env.VITEST) {
    for (const sig of ['SIGINT', 'SIGTERM']) {
      process.once(sig, () => {
        closeDb();
        process.exit(0);
      });
    }
  }
}

// Resolve the DB path from env (tests/e2e override it) or default to data/bookmarks.db.
export function dbPath() {
  return resolve(process.env.BOOKMARKS_DB || 'data/bookmarks.db');
}

export function getDb() {
  if (db) return db;
  const path = dbPath();
  mkdirSync(dirname(path), { recursive: true });
  db = new Database(path);
  db.pragma('foreign_keys = ON');
  runMigrations(db);
  currentPath = path;
  registerHooks();
  return db;
}

// Close and reopen — used by the restart-persistence test to simulate a process
// restart against the same on-disk database.
export function closeDb() {
  if (db) {
    db.close();
    db = null;
    currentPath = null;
  }
}

export function reopenDb() {
  closeDb();
  return getDb();
}

export function activeDbPath() {
  return currentPath;
}
