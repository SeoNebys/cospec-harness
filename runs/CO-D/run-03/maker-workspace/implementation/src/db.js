'use strict';
const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');

const DATA_DIR = process.env.BOOKMARKS_DATA_DIR || path.join(__dirname, '..', 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(path.join(DATA_DIR, 'copies'), { recursive: true });

const DB_PATH = process.env.BOOKMARKS_DB || path.join(DATA_DIR, 'bookmarks.db');
const db = new DatabaseSync(DB_PATH);

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS bookmarks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    url TEXT NOT NULL,
    url_key TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    site TEXT NOT NULL DEFAULT '',
    favicon TEXT,
    preview_image TEXT,
    note TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'toread',
    archived INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    copy_status TEXT NOT NULL DEFAULT 'pending',
    copy_kind TEXT,
    copy_path TEXT,
    copy_size INTEGER,
    copy_saved_at INTEGER,
    ia_status TEXT NOT NULL DEFAULT 'none',
    ia_url TEXT,
    ia_saved_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
  );

  CREATE TABLE IF NOT EXISTS bookmark_tags (
    bookmark_id INTEGER NOT NULL REFERENCES bookmarks(id) ON DELETE CASCADE,
    tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (bookmark_id, tag_id)
  );

  CREATE TABLE IF NOT EXISTS collections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    text TEXT NOT NULL DEFAULT '',
    inc_tags TEXT NOT NULL DEFAULT '[]',
    exc_tags TEXT NOT NULL DEFAULT '[]',
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_bookmarks_archived ON bookmarks(archived);
  CREATE INDEX IF NOT EXISTS idx_bookmarks_status ON bookmarks(status);
  CREATE INDEX IF NOT EXISTS idx_booktags_tag ON bookmark_tags(tag_id);
`);

module.exports = { db, DATA_DIR };
