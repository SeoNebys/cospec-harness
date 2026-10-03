// Durable, file-backed store (NFR-003: per-account persistence). This trial
// uses a single review account keyed by a session cookie; the shape allows more
// accounts later. Data survives restarts (JSON file) — bookmarks + preferences.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.BM_DATA_DIR || join(__dirname, "..", "data");
const STORE_FILE = join(DATA_DIR, "store.json");
export const SNAP_DIR = join(DATA_DIR, "snapshots");

function ensureDirs() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  if (!existsSync(SNAP_DIR)) mkdirSync(SNAP_DIR, { recursive: true });
}

const DEFAULT_PREFS = { sort: "new", autoCopy: true, pageSize: "25", textSize: "md" };

function emptyDb() {
  return { accounts: {} };
}
function emptyAccount() {
  return { bookmarks: [], views: [], prefs: { ...DEFAULT_PREFS }, seq: 0 };
}

let db = null;

function load() {
  ensureDirs();
  if (db) return db;
  if (existsSync(STORE_FILE)) {
    try { db = JSON.parse(readFileSync(STORE_FILE, "utf8")); }
    catch { db = emptyDb(); }
  } else db = emptyDb();
  if (!db.accounts) db.accounts = {};
  return db;
}
function persist() {
  ensureDirs();
  writeFileSync(STORE_FILE, JSON.stringify(db, null, 2));
}

export function getAccount(userId) {
  load();
  if (!db.accounts[userId]) db.accounts[userId] = emptyAccount();
  const a = db.accounts[userId];
  a.prefs = { ...DEFAULT_PREFS, ...(a.prefs || {}) };
  if (!Array.isArray(a.views)) a.views = [];
  if (typeof a.seq !== "number") a.seq = a.bookmarks.length;
  return a;
}

export function nextId(userId) {
  const a = getAccount(userId);
  a.seq += 1;
  return "bm" + a.seq;
}

export function save() { persist(); }

// Reset helper (used by tests via an env-guarded endpoint).
export function resetAccount(userId) {
  load();
  db.accounts[userId] = emptyAccount();
  persist();
}
