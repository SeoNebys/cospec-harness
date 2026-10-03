'use strict';
// Simple durable JSON store (atomic writes). Chosen over a native DB to avoid a
// native build step in the trial image; adequate for a single user's bookmarks.
// See context/design-decisions.md (DD-1).
const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'data.json');
const SNAP_DIR = path.join(DATA_DIR, 'snapshots');

function ensureDirs() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(SNAP_DIR, { recursive: true });
}

const DEFAULT_PREFS = { defaultSort: 'added-desc', pageSize: 25, textSize: 'normal' };

let data = { seq: 1, bookmarks: [], savedSearches: [], savedSeq: 1, preferences: { ...DEFAULT_PREFS } };

function load() {
  ensureDirs();
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    data = Object.assign({ seq: 1, bookmarks: [], savedSearches: [], savedSeq: 1, preferences: { ...DEFAULT_PREFS } }, parsed);
    data.preferences = Object.assign({ ...DEFAULT_PREFS }, data.preferences || {});
  } catch (e) {
    // Fresh start; write an initial file.
    persist();
  }
}

function persist() {
  ensureDirs();
  const tmp = DATA_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, DATA_FILE); // atomic on same filesystem
}

module.exports = {
  DATA_DIR, SNAP_DIR,
  load, persist,
  get data() { return data; },
  nextId() { return data.seq++; },
  nextSavedId() { return data.savedSeq++; }
};
