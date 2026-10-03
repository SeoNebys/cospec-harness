import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';

// Verify the single shared collection survives a "restart" by reopening the same
// database file, and that no session key partitions the data (FR-042, SC-010).
// Env is set before any app module is imported so getDb() targets the temp file.
test('data persists across a simulated restart (FR-042/SC-005/SC-010)', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bm-persist-'));
  const dbFile = path.join(dir, 'bookmarks.db');
  process.env.BM_DATA_DIR = dir;
  process.env.BM_DB_FILE = dbFile;

  const { getDb } = await import('../../src/db/index.js');
  const { createBookmark } = await import('../../src/models/bookmark.js');
  const { createView } = await import('../../src/models/savedView.js');
  const { updatePreferences } = await import('../../src/models/preferences.js');

  const db = getDb();
  createBookmark({ url: 'https://persist.com', title: 'Persist', tags: ['keep'] }, db);
  createView({ name: 'Kept view', included_tags: ['keep'] }, db);
  updatePreferences({ items_per_page: 42, text_size: 'large' }, db);

  // "Restart": open the same file with a brand-new connection.
  const reopened = new Database(dbFile);
  const bookmarks = reopened.prepare('SELECT * FROM bookmarks').all();
  const views = reopened.prepare('SELECT * FROM saved_views').all();
  const prefs = reopened.prepare('SELECT * FROM preferences WHERE id = 1').get();

  assert.equal(bookmarks.length, 1);
  assert.equal(bookmarks[0].title, 'Persist');
  assert.equal(views.length, 1);
  assert.equal(prefs.items_per_page, 42);
  assert.equal(prefs.text_size, 'large');

  // No column keys data by session — schema has no session/user column (FR-042).
  const cols = reopened.prepare('PRAGMA table_info(bookmarks)').all().map((c) => c.name);
  assert.equal(cols.includes('session_id'), false);
  assert.equal(cols.includes('user_id'), false);

  reopened.close();
  delete process.env.BM_DATA_DIR;
  delete process.env.BM_DB_FILE;
});
