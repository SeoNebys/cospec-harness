"""SQLite storage layer for bookmarks.

Tags are stored normalized in a separate table with a many-to-many join,
so we can list all known tags and filter cheaply.
"""

import json
import sqlite3
from contextlib import contextmanager
from pathlib import Path

DB_PATH = Path(__file__).parent / "bookmarks.db"


def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


@contextmanager
def get_db():
    conn = _connect()
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db() -> None:
    with get_db() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS bookmarks (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                url         TEXT NOT NULL,
                title       TEXT NOT NULL DEFAULT '',
                description TEXT NOT NULL DEFAULT '',
                favicon     TEXT NOT NULL DEFAULT '',
                created_at  TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS tags (
                id   INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE
            );

            CREATE TABLE IF NOT EXISTS bookmark_tags (
                bookmark_id INTEGER NOT NULL REFERENCES bookmarks(id) ON DELETE CASCADE,
                tag_id      INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
                PRIMARY KEY (bookmark_id, tag_id)
            );
            """
        )


def _set_tags(conn: sqlite3.Connection, bookmark_id: int, tags: list[str]) -> None:
    """Replace the tag set for a bookmark, creating tag rows as needed."""
    conn.execute("DELETE FROM bookmark_tags WHERE bookmark_id = ?", (bookmark_id,))
    for raw in tags:
        name = raw.strip().lower()
        if not name:
            continue
        conn.execute("INSERT OR IGNORE INTO tags(name) VALUES (?)", (name,))
        tag_id = conn.execute("SELECT id FROM tags WHERE name = ?", (name,)).fetchone()["id"]
        conn.execute(
            "INSERT OR IGNORE INTO bookmark_tags(bookmark_id, tag_id) VALUES (?, ?)",
            (bookmark_id, tag_id),
        )
    # Drop tags no longer referenced by any bookmark.
    conn.execute(
        "DELETE FROM tags WHERE id NOT IN (SELECT DISTINCT tag_id FROM bookmark_tags)"
    )


def _tags_for(conn: sqlite3.Connection, bookmark_id: int) -> list[str]:
    rows = conn.execute(
        """
        SELECT t.name FROM tags t
        JOIN bookmark_tags bt ON bt.tag_id = t.id
        WHERE bt.bookmark_id = ?
        ORDER BY t.name
        """,
        (bookmark_id,),
    ).fetchall()
    return [r["name"] for r in rows]


def _row_to_dict(conn: sqlite3.Connection, row: sqlite3.Row) -> dict:
    d = dict(row)
    d["tags"] = _tags_for(conn, row["id"])
    return d


def create_bookmark(url: str, title: str, description: str, favicon: str, tags: list[str]) -> dict:
    with get_db() as conn:
        cur = conn.execute(
            "INSERT INTO bookmarks(url, title, description, favicon) VALUES (?, ?, ?, ?)",
            (url, title, description, favicon),
        )
        bid = cur.lastrowid
        _set_tags(conn, bid, tags)
        row = conn.execute("SELECT * FROM bookmarks WHERE id = ?", (bid,)).fetchone()
        return _row_to_dict(conn, row)


def list_bookmarks(query: str = "", tag: str = "") -> list[dict]:
    with get_db() as conn:
        sql = "SELECT DISTINCT b.* FROM bookmarks b"
        params: list = []
        if tag:
            sql += (
                " JOIN bookmark_tags bt ON bt.bookmark_id = b.id"
                " JOIN tags t ON t.id = bt.tag_id AND t.name = ?"
            )
            params.append(tag.strip().lower())
        if query:
            like = f"%{query}%"
            sql += " WHERE (b.title LIKE ? OR b.url LIKE ? OR b.description LIKE ?)"
            params += [like, like, like]
        sql += " ORDER BY b.created_at DESC, b.id DESC"
        rows = conn.execute(sql, params).fetchall()
        return [_row_to_dict(conn, r) for r in rows]


def get_bookmark(bookmark_id: int) -> dict | None:
    with get_db() as conn:
        row = conn.execute("SELECT * FROM bookmarks WHERE id = ?", (bookmark_id,)).fetchone()
        return _row_to_dict(conn, row) if row else None


def update_bookmark(bookmark_id: int, fields: dict, tags: list[str] | None) -> dict | None:
    with get_db() as conn:
        row = conn.execute("SELECT * FROM bookmarks WHERE id = ?", (bookmark_id,)).fetchone()
        if row is None:
            return None
        allowed = {"url", "title", "description", "favicon"}
        updates = {k: v for k, v in fields.items() if k in allowed and v is not None}
        if updates:
            cols = ", ".join(f"{k} = ?" for k in updates)
            conn.execute(
                f"UPDATE bookmarks SET {cols} WHERE id = ?",
                [*updates.values(), bookmark_id],
            )
        if tags is not None:
            _set_tags(conn, bookmark_id, tags)
        row = conn.execute("SELECT * FROM bookmarks WHERE id = ?", (bookmark_id,)).fetchone()
        return _row_to_dict(conn, row)


def delete_bookmark(bookmark_id: int) -> bool:
    with get_db() as conn:
        cur = conn.execute("DELETE FROM bookmarks WHERE id = ?", (bookmark_id,))
        conn.execute(
            "DELETE FROM tags WHERE id NOT IN (SELECT DISTINCT tag_id FROM bookmark_tags)"
        )
        return cur.rowcount > 0


def list_tags() -> list[dict]:
    with get_db() as conn:
        rows = conn.execute(
            """
            SELECT t.name, COUNT(bt.bookmark_id) AS count
            FROM tags t
            LEFT JOIN bookmark_tags bt ON bt.tag_id = t.id
            GROUP BY t.id
            ORDER BY count DESC, t.name
            """
        ).fetchall()
        return [dict(r) for r in rows]


def export_all() -> list[dict]:
    return list_bookmarks()
