// Persistent storage (SQLite via better-sqlite3). Single-user personal collection.
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { urlKey } from "./normalize.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.BM_DATA_DIR || path.join(__dirname, "..", "data");
fs.mkdirSync(DATA_DIR, { recursive: true });
const db = new Database(path.join(DATA_DIR, "app.db"));
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS bookmarks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    url TEXT NOT NULL,
    url_key TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    note TEXT NOT NULL DEFAULT '',
    tags TEXT NOT NULL DEFAULT '[]',
    read_later INTEGER NOT NULL DEFAULT 0,
    archived INTEGER NOT NULL DEFAULT 0,
    added_at INTEGER NOT NULL,
    fav TEXT NOT NULL DEFAULT '',
    preview TEXT NOT NULL DEFAULT '',
    preserved TEXT,
    ia TEXT
  );
  CREATE TABLE IF NOT EXISTS preserved_content (
    bookmark_id INTEGER PRIMARY KEY,
    content_type TEXT NOT NULL,
    data BLOB NOT NULL,
    FOREIGN KEY (bookmark_id) REFERENCES bookmarks(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS saved_filters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    query TEXT NOT NULL DEFAULT '',
    include TEXT NOT NULL DEFAULT '[]',
    exclude TEXT NOT NULL DEFAULT '[]',
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS prefs (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`);

function rowToBookmark(r) {
  if (!r) return null;
  return {
    id: r.id,
    url: r.url,
    title: r.title,
    description: r.description,
    note: r.note,
    tags: JSON.parse(r.tags || "[]"),
    readLater: !!r.read_later,
    archived: !!r.archived,
    addedAt: r.added_at,
    fav: r.fav,
    preview: r.preview,
    preserved: r.preserved ? JSON.parse(r.preserved) : null,
    ia: r.ia ? JSON.parse(r.ia) : null,
  };
}

export function listBookmarks() {
  return db.prepare("SELECT * FROM bookmarks ORDER BY added_at DESC").all().map(rowToBookmark);
}
export function getBookmark(id) {
  return rowToBookmark(db.prepare("SELECT * FROM bookmarks WHERE id = ?").get(id));
}
export function getByKey(key) {
  return rowToBookmark(db.prepare("SELECT * FROM bookmarks WHERE url_key = ?").get(key));
}

export function insertBookmark(b) {
  const info = db.prepare(`
    INSERT INTO bookmarks (url, url_key, title, description, note, tags, read_later, archived, added_at, fav, preview)
    VALUES (@url, @url_key, @title, @description, @note, @tags, @read_later, @archived, @added_at, @fav, @preview)
  `).run({
    url: b.url,
    url_key: urlKey(b.url),
    title: b.title || "",
    description: b.description || "",
    note: b.note || "",
    tags: JSON.stringify(b.tags || []),
    read_later: b.readLater ? 1 : 0,
    archived: b.archived ? 1 : 0,
    added_at: b.addedAt || Date.now(),
    fav: b.fav || "",
    preview: b.preview || "",
  });
  return getBookmark(info.lastInsertRowid);
}

export function updateBookmark(id, b) {
  db.prepare(`
    UPDATE bookmarks SET url=@url, url_key=@url_key, title=@title, description=@description,
      note=@note, tags=@tags, read_later=@read_later, archived=@archived, fav=@fav, preview=@preview
    WHERE id=@id
  `).run({
    id,
    url: b.url,
    url_key: urlKey(b.url),
    title: b.title || "",
    description: b.description || "",
    note: b.note || "",
    tags: JSON.stringify(b.tags || []),
    read_later: b.readLater ? 1 : 0,
    archived: b.archived ? 1 : 0,
    fav: b.fav || "",
    preview: b.preview || "",
  });
  return getBookmark(id);
}

export function deleteBookmark(id) {
  db.prepare("DELETE FROM preserved_content WHERE bookmark_id = ?").run(id);
  db.prepare("DELETE FROM bookmarks WHERE id = ?").run(id);
}

export function setPreserved(id, preserved) {
  db.prepare("UPDATE bookmarks SET preserved = ? WHERE id = ?").run(JSON.stringify(preserved), id);
  return getBookmark(id);
}
export function setIA(id, ia) {
  db.prepare("UPDATE bookmarks SET ia = ? WHERE id = ?").run(JSON.stringify(ia), id);
  return getBookmark(id);
}
export function savePreservedContent(id, contentType, data) {
  db.prepare("INSERT OR REPLACE INTO preserved_content (bookmark_id, content_type, data) VALUES (?, ?, ?)")
    .run(id, contentType, data);
}
export function getPreservedContent(id) {
  return db.prepare("SELECT content_type, data FROM preserved_content WHERE bookmark_id = ?").get(id);
}

export function listFilters() {
  return db.prepare("SELECT * FROM saved_filters ORDER BY created_at ASC").all().map((r) => ({
    id: r.id, name: r.name, query: r.query,
    include: JSON.parse(r.include || "[]"), exclude: JSON.parse(r.exclude || "[]"),
  }));
}
export function addFilter(f) {
  const info = db.prepare("INSERT INTO saved_filters (name, query, include, exclude, created_at) VALUES (?,?,?,?,?)")
    .run(f.name, f.query || "", JSON.stringify(f.include || []), JSON.stringify(f.exclude || []), Date.now());
  return db.prepare("SELECT * FROM saved_filters WHERE id = ?").get(info.lastInsertRowid);
}
export function deleteFilter(id) {
  db.prepare("DELETE FROM saved_filters WHERE id = ?").run(id);
}

export function getPrefs() {
  const rows = db.prepare("SELECT key, value FROM prefs").all();
  const out = {};
  for (const r of rows) out[r.key] = r.value;
  return out;
}
export function setPref(key, value) {
  db.prepare("INSERT OR REPLACE INTO prefs (key, value) VALUES (?, ?)").run(key, String(value));
}

export default db;
