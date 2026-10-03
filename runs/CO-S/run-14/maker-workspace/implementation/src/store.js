/*
 * Persistence layer: a single JSON document on disk, mutated synchronously
 * (single-user personal app). Snapshot files live under <dataDir>/snapshots.
 * DATA_DIR env overrides the location (used by tests for isolation).
 */
'use strict';
const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const SNAP_DIR = path.join(DATA_DIR, 'snapshots');

const DEFAULT_PREFERENCES = {
  theme: 'light',            // light | dark | system
  density: 'comfortable',    // comfortable | compact
  textSize: 'medium',        // small | medium | large
  showPreview: true,
  pageSize: 25,              // number | 'all'
  defaultView: 'all',        // all | toread | archived
  defaultSort: 'newest',     // newest | oldest | title | updated
  autoCopy: false            // auto-save a full-page copy on new bookmark
};

function emptyDb() {
  return { seq: 1, bookmarks: [], savedSearches: [], preferences: { ...DEFAULT_PREFERENCES } };
}

let db = null;

function ensureDirs() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(SNAP_DIR, { recursive: true });
}

function load() {
  ensureDirs();
  if (db) return db;
  if (fs.existsSync(DB_FILE)) {
    try {
      db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
      db.preferences = Object.assign({ ...DEFAULT_PREFERENCES }, db.preferences || {});
      db.bookmarks = db.bookmarks || [];
      db.savedSearches = db.savedSearches || [];
      db.seq = db.seq || 1;
    } catch (e) {
      db = emptyDb();
    }
  } else {
    db = emptyDb();
    persist();
  }
  return db;
}

function persist() {
  ensureDirs();
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, DB_FILE);
}

function mutate(fn) {
  load();
  const result = fn(db);
  persist();
  return result;
}

function nextId() {
  load();
  return String(db.seq++);
}

module.exports = {
  DATA_DIR, SNAP_DIR, DEFAULT_PREFERENCES,
  load, persist, mutate, nextId,
  // test helper: reset in-memory + on-disk state
  _reset() { db = emptyDb(); ensureDirs(); persist(); }
};
