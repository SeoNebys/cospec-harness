"""SQLite storage layer for the bookmarks app."""
import os
import sqlite3
from pathlib import Path

# Allow overriding the DB location (used by tests); default sits next to the repo root.
DB_PATH = Path(os.environ.get("BOOKMARKS_DB", Path(__file__).resolve().parent.parent / "bookmarks.db"))


def get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db() -> None:
    conn = get_conn()
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS bookmarks (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            url         TEXT    NOT NULL,
            title       TEXT    NOT NULL DEFAULT '',
            description TEXT    NOT NULL DEFAULT '',
            favicon     TEXT    NOT NULL DEFAULT '',
            created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS tags (
            id   INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT    NOT NULL UNIQUE COLLATE NOCASE
        );

        CREATE TABLE IF NOT EXISTS bookmark_tags (
            bookmark_id INTEGER NOT NULL REFERENCES bookmarks(id) ON DELETE CASCADE,
            tag_id      INTEGER NOT NULL REFERENCES tags(id)      ON DELETE CASCADE,
            PRIMARY KEY (bookmark_id, tag_id)
        );

        -- Full-text index. rowid mirrors bookmarks.id; kept in sync by the app.
        CREATE VIRTUAL TABLE IF NOT EXISTS bookmarks_fts
            USING fts5(title, url, description, tags);
        """
    )

    # Backfill the FTS index for pre-existing rows (e.g. a DB created before
    # full-text search was added).
    has_bookmarks = conn.execute("SELECT COUNT(*) FROM bookmarks").fetchone()[0]
    indexed = conn.execute("SELECT COUNT(*) FROM bookmarks_fts").fetchone()[0]
    if has_bookmarks and not indexed:
        conn.execute(
            """
            INSERT INTO bookmarks_fts(rowid, title, url, description, tags)
            SELECT b.id, b.title, b.url, b.description,
                   COALESCE((
                       SELECT group_concat(t.name, ' ')
                       FROM tags t JOIN bookmark_tags bt ON bt.tag_id = t.id
                       WHERE bt.bookmark_id = b.id
                   ), '')
            FROM bookmarks b
            """
        )

    conn.commit()
    conn.close()
