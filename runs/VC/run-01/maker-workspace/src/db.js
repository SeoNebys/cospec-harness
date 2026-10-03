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
  url           TEXT NOT NULL,
  url_norm      TEXT NOT NULL,
  title         TEXT NOT NULL DEFAULT '',
  description   TEXT NOT NULL DEFAULT '',
  notes         TEXT NOT NULL DEFAULT '',
  favicon       TEXT NOT NULL DEFAULT '',
  favorite      INTEGER NOT NULL DEFAULT 0,
  unread        INTEGER NOT NULL DEFAULT 1,
  archived      INTEGER NOT NULL DEFAULT 0,
  snapshot_html TEXT NOT NULL DEFAULT '',
  snapshot_pdf  TEXT NOT NULL DEFAULT '',
  snapshot_at   TEXT NOT NULL DEFAULT '',
  archive_url   TEXT NOT NULL DEFAULT '',
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_bookmarks_url_norm ON bookmarks(url_norm);
CREATE INDEX IF NOT EXISTS idx_bookmarks_archived ON bookmarks(archived);

CREATE TABLE IF NOT EXISTS tags (
  id   INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE COLLATE NOCASE
);

CREATE TABLE IF NOT EXISTS bookmark_tags (
  bookmark_id INTEGER NOT NULL REFERENCES bookmarks(id) ON DELETE CASCADE,
  tag_id      INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (bookmark_id, tag_id)
);

CREATE TABLE IF NOT EXISTS saved_searches (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  query      TEXT NOT NULL DEFAULT '',
  view       TEXT NOT NULL DEFAULT 'all',
  sort       TEXT NOT NULL DEFAULT 'created_desc',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS preferences (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`);

const DEFAULT_PREFS = {
  default_sort: 'created_desc',
  page_size: '25',
  text_size: 'medium',
  default_view: 'all'
};

const insPref = db.prepare('INSERT OR IGNORE INTO preferences (key, value) VALUES (?, ?)');
for (const [k, v] of Object.entries(DEFAULT_PREFS)) insPref.run(k, v);

module.exports = { db, DATA_DIR, SNAP_DIR, DEFAULT_PREFS };
