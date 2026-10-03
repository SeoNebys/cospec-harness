import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import type { Config } from '../config.js';

export type DB = Database.Database;
export function createDatabase(config: Config): DB {
  fs.mkdirSync(config.dataDir, { recursive: true });
  const db = new Database(path.join(config.dataDir, 'bookmarks.sqlite'));
  db.pragma('journal_mode = WAL'); db.pragma('foreign_keys = ON'); db.pragma('busy_timeout = 5000');
  migrate(db); return db;
}

export function migrate(db: DB): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS bookmarks (
      id TEXT PRIMARY KEY, url TEXT NOT NULL, normalized_url TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL CHECK(length(title) BETWEEN 1 AND 500), description TEXT CHECK(description IS NULL OR length(description)<=2000),
      notes TEXT CHECK(notes IS NULL OR length(notes)<=20000), favicon_asset_id TEXT, preview_asset_id TEXT,
      is_favorite INTEGER NOT NULL DEFAULT 0 CHECK(is_favorite IN (0,1)), read_state TEXT NOT NULL DEFAULT 'read' CHECK(read_state IN ('read','unread')),
      archived_at INTEGER, metadata_status TEXT NOT NULL DEFAULT 'pending' CHECK(metadata_status IN ('pending','complete','partial','failed')),
      metadata_error_code TEXT, metadata_refreshed_at INTEGER, title_source TEXT NOT NULL DEFAULT 'fallback', description_source TEXT,
      favicon_source TEXT, preview_source TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS tags (id TEXT PRIMARY KEY, name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 80), normalized_name TEXT NOT NULL UNIQUE, created_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS bookmark_tags (bookmark_id TEXT NOT NULL REFERENCES bookmarks(id) ON DELETE CASCADE, tag_id TEXT NOT NULL REFERENCES tags(id), created_at INTEGER NOT NULL, PRIMARY KEY(bookmark_id,tag_id));
    CREATE TABLE IF NOT EXISTS assets (id TEXT PRIMARY KEY, kind TEXT NOT NULL, relative_path TEXT NOT NULL UNIQUE, media_type TEXT NOT NULL, byte_size INTEGER NOT NULL, width INTEGER, height INTEGER, content_hash TEXT NOT NULL, created_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS page_snapshots (bookmark_id TEXT PRIMARY KEY REFERENCES bookmarks(id) ON DELETE CASCADE, asset_id TEXT REFERENCES assets(id), status TEXT NOT NULL DEFAULT 'pending', captured_url TEXT, captured_at INTEGER, limitation_code TEXT, error_message TEXT, refresh_status TEXT, updated_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS capture_jobs (id TEXT PRIMARY KEY, bookmark_id TEXT NOT NULL REFERENCES bookmarks(id) ON DELETE CASCADE, kind TEXT NOT NULL, status TEXT NOT NULL, replace_user_metadata INTEGER NOT NULL DEFAULT 0, attempt_count INTEGER NOT NULL DEFAULT 0, available_at INTEGER NOT NULL, started_at INTEGER, finished_at INTEGER, error_code TEXT, created_at INTEGER NOT NULL);
    CREATE UNIQUE INDEX IF NOT EXISTS one_active_job ON capture_jobs(bookmark_id) WHERE status IN ('pending','processing');
    CREATE INDEX IF NOT EXISTS bookmark_created ON bookmarks(created_at); CREATE INDEX IF NOT EXISTS bookmark_updated ON bookmarks(updated_at);
    CREATE INDEX IF NOT EXISTS bookmark_read_archive ON bookmarks(read_state,archived_at); CREATE INDEX IF NOT EXISTS bookmark_fav_archive ON bookmarks(is_favorite,archived_at);
    CREATE TABLE IF NOT EXISTS saved_views (id TEXT PRIMARY KEY, name TEXT NOT NULL, normalized_name TEXT NOT NULL UNIQUE, query TEXT NOT NULL CHECK(length(query)<=2000), filters_json TEXT NOT NULL, sort_field TEXT NOT NULL, sort_direction TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS preferences (singleton_key TEXT PRIMARY KEY CHECK(singleton_key='default'), theme TEXT NOT NULL DEFAULT 'system', density TEXT NOT NULL DEFAULT 'comfortable', updated_at INTEGER NOT NULL);
    INSERT OR IGNORE INTO preferences(singleton_key,theme,density,updated_at) VALUES('default','system','comfortable',unixepoch()*1000);
  `);
  db.prepare("UPDATE capture_jobs SET status='pending', started_at=NULL WHERE status='processing'").run();
}
