'use strict';
// SQLite persistence (Node built-in node:sqlite). Holds the single shared
// personal collection: the account, its bookmarks, saved-search collections and
// settings. Backs SCN-011 (one collection that persists and follows the account).
const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(path.join(DATA_DIR, 'snapshots'), { recursive: true });

const db = new DatabaseSync(path.join(DATA_DIR, 'bookmarks.db'));
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  pass_hash TEXT NOT NULL,
  pass_salt TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS bookmarks (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  url_key TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  favicon TEXT,
  preview_image TEXT,
  note TEXT NOT NULL DEFAULT '',
  tags TEXT NOT NULL DEFAULT '[]',
  read_later INTEGER NOT NULL DEFAULT 0,
  archived INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  seq INTEGER NOT NULL,
  fetch_failed INTEGER NOT NULL DEFAULT 0,
  snapshot_status TEXT NOT NULL DEFAULT 'none',
  snapshot_at INTEGER,
  snapshot_is_pdf INTEGER NOT NULL DEFAULT 0,
  snapshot_file TEXT,
  archiveorg_status TEXT NOT NULL DEFAULT 'none',
  archiveorg_url TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_bm_userkey ON bookmarks(user_id, url_key);
CREATE TABLE IF NOT EXISTS collections (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  query TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS settings (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  default_sort TEXT NOT NULL DEFAULT 'newest',
  density TEXT NOT NULL DEFAULT 'comfortable',
  font_size TEXT NOT NULL DEFAULT 'medium'
);
`);

// node:sqlite has no transaction() helper; provide a minimal wrapper.
function tx(fn) {
  db.exec('BEGIN');
  try { const r = fn(); db.exec('COMMIT'); return r; }
  catch (e) { try { db.exec('ROLLBACK'); } catch (_) { /* noop */ } throw e; }
}

// Monotonic per-account sequence for stable "insertion order" tiebreaks.
function nextSeq(userId) {
  const row = db.prepare('SELECT COALESCE(MAX(seq),0) AS m FROM bookmarks WHERE user_id=?').get(userId);
  return row.m + 1;
}

// Password hashing with scrypt (Node crypto; no external deps).
function hashPassword(password, salt) {
  salt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { hash, salt };
}
function verifyPassword(password, salt, expectedHash) {
  const { hash } = hashPassword(password, salt);
  const a = Buffer.from(hash, 'hex');
  const b = Buffer.from(expectedHash, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Seed the single review/personal account if none exists.
function ensureSeedUser() {
  const email = process.env.SEED_EMAIL || 'me@bookmarks.local';
  const password = process.env.SEED_PASSWORD || 'bookmarks';
  let user = db.prepare('SELECT * FROM users WHERE email=?').get(email);
  if (!user) {
    const { hash, salt } = hashPassword(password);
    const info = db.prepare('INSERT INTO users(email,pass_hash,pass_salt,created_at) VALUES(?,?,?,?)')
      .run(email, hash, salt, Date.now());
    db.prepare('INSERT INTO settings(user_id) VALUES(?)').run(info.lastInsertRowid);
    user = db.prepare('SELECT * FROM users WHERE id=?').get(info.lastInsertRowid);
  }
  return { email, password, user };
}

module.exports = { db, DATA_DIR, tx, nextSeq, hashPassword, verifyPassword, ensureSeedUser };
