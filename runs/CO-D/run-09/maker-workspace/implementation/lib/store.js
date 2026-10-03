/*
 * Simple durable JSON store: { bookmarks, collections, prefs }.
 * Single-user app; synchronous file IO is adequate and keeps the design simple.
 */
const fs = require("fs");
const path = require("path");

const DATA_DIR = process.env.BM_DATA_DIR || path.join(__dirname, "..", "data");
const DB_FILE = path.join(DATA_DIR, "db.json");
const SNAP_DIR = path.join(DATA_DIR, "snapshots");

const DEFAULT_PREFS = { sort: "newest", pageSize: "25", fontSize: "medium" };

function ensureDirs() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(SNAP_DIR, { recursive: true });
}

function load() {
  ensureDirs();
  if (!fs.existsSync(DB_FILE)) {
    return { bookmarks: [], collections: [], prefs: { ...DEFAULT_PREFS } };
  }
  try {
    const raw = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
    return {
      bookmarks: raw.bookmarks || [],
      collections: raw.collections || [],
      prefs: { ...DEFAULT_PREFS, ...(raw.prefs || {}) },
    };
  } catch (e) {
    return { bookmarks: [], collections: [], prefs: { ...DEFAULT_PREFS } };
  }
}

function save(state) {
  ensureDirs();
  fs.writeFileSync(DB_FILE, JSON.stringify(state, null, 2));
}

// Address normalisation used for duplicate detection (SCN-003, SCN-004, SCN-021).
function normUrl(u) {
  return String(u || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/+$/, "");
}

function looksLikeLink(u) {
  const s = String(u || "").trim();
  if (!s || /\s/.test(s)) return false;
  return /^https?:\/\//i.test(s) || /\.[a-z]{2,}/i.test(s);
}

function domainOf(url) {
  try {
    const u = /^https?:\/\//i.test(url) ? url : "https://" + url;
    return new URL(u).hostname.replace(/^www\./, "");
  } catch (e) {
    return "";
  }
}

module.exports = { load, save, normUrl, looksLikeLink, domainOf, DATA_DIR, SNAP_DIR, DB_FILE, DEFAULT_PREFS };
