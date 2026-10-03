'use strict';

const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DATA_DIR = path.join(__dirname, '..', 'data');
const SNAP_DIR = path.join(DATA_DIR, 'snapshots');
fs.mkdirSync(SNAP_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, 'bookmarks.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS bookmarks (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  url           TEXT NOT NULL UNIQUE,
  title         TEXT NOT NULL DEFAULT '',
  description   TEXT NOT NULL DEFAULT '',
  notes         TEXT NOT NULL DEFAULT '',
  icon          TEXT NOT NULL DEFAULT '',
  preview_image TEXT NOT NULL DEFAULT '',
  domain        TEXT NOT NULL DEFAULT '',
  read_later    INTEGER NOT NULL DEFAULT 0,
  archived      INTEGER NOT NULL DEFAULT 0,
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS tags (
  id   INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE COLLATE NOCASE
);

CREATE TABLE IF NOT EXISTS bookmark_tags (
  bookmark_id INTEGER NOT NULL REFERENCES bookmarks(id) ON DELETE CASCADE,
  tag_id      INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (bookmark_id, tag_id)
);

CREATE TABLE IF NOT EXISTS snapshots (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  bookmark_id INTEGER NOT NULL REFERENCES bookmarks(id) ON DELETE CASCADE,
  title       TEXT NOT NULL DEFAULT '',
  image_file  TEXT NOT NULL DEFAULT '',
  html_file   TEXT NOT NULL DEFAULT '',
  created_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS saved_searches (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  query      TEXT NOT NULL DEFAULT '',
  view       TEXT NOT NULL DEFAULT 'all',
  sort       TEXT NOT NULL DEFAULT 'created_desc',
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS preferences (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_bt_tag ON bookmark_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_bt_bookmark ON bookmark_tags(bookmark_id);
CREATE INDEX IF NOT EXISTS idx_snap_bookmark ON snapshots(bookmark_id);
`);

// Seed default preferences if absent.
const DEFAULT_PREFS = {
  default_sort: 'created_desc',
  default_view: 'all',
  font_size: 'medium'
};
const prefInsert = db.prepare(
  'INSERT OR IGNORE INTO preferences (key, value) VALUES (?, ?)'
);
for (const [k, v] of Object.entries(DEFAULT_PREFS)) prefInsert.run(k, v);

module.exports = { db, DATA_DIR, SNAP_DIR, DEFAULT_PREFS };
