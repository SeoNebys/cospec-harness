"""Bookmark manager — FastAPI backend with SQLite storage.

Run with:  uvicorn app:app --reload
Then open: http://127.0.0.1:8000
"""
from __future__ import annotations

import re
import sqlite3
import time
from contextlib import contextmanager
from html.parser import HTMLParser
from pathlib import Path
from typing import Iterable

import httpx
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "bookmarks.db"
STATIC_DIR = BASE_DIR / "static"


# --------------------------------------------------------------------------- #
# Database
# --------------------------------------------------------------------------- #
@contextmanager
def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
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
                notes       TEXT NOT NULL DEFAULT '',
                favorite    INTEGER NOT NULL DEFAULT 0,
                created_at  INTEGER NOT NULL,
                updated_at  INTEGER NOT NULL
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

            CREATE VIRTUAL TABLE IF NOT EXISTS bookmarks_fts USING fts5(
                url, title, description, notes, tags
            );
            """
        )


# --------------------------------------------------------------------------- #
# HTML metadata fetching
# --------------------------------------------------------------------------- #
class _MetaParser(HTMLParser):
    """Extract <title> and <meta name/property=description> from HTML."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.title = ""
        self.description = ""
        self._in_title = False

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag == "title":
            self._in_title = True
        elif tag == "meta":
            a = {k.lower(): (v or "") for k, v in attrs}
            key = a.get("name", "").lower() or a.get("property", "").lower()
            if key in ("description", "og:description") and not self.description:
                self.description = a.get("content", "").strip()
            elif key == "og:title" and not self.title:
                self.title = a.get("content", "").strip()

    def handle_endtag(self, tag: str) -> None:
        if tag == "title":
            self._in_title = False

    def handle_data(self, data: str) -> None:
        if self._in_title and not self.title:
            self.title = data.strip()


def fetch_metadata(url: str) -> tuple[str, str]:
    """Return (title, description) for a URL, best effort. Never raises."""
    try:
        headers = {"User-Agent": "Mozilla/5.0 (compatible; BookmarkManager/1.0)"}
        with httpx.Client(follow_redirects=True, timeout=8.0, headers=headers) as client:
            resp = client.get(url)
            resp.raise_for_status()
            ctype = resp.headers.get("content-type", "")
            if "html" not in ctype and ctype:
                return "", ""
            parser = _MetaParser()
            parser.feed(resp.text)
            title = re.sub(r"\s+", " ", parser.title).strip()
            desc = re.sub(r"\s+", " ", parser.description).strip()
            return title, desc
    except Exception:
        return "", ""


# Common browser root-folder names that add no useful signal as tags.
_ROOT_FOLDERS = {
    "bookmarks bar", "bookmarks toolbar", "bookmarks menu", "other bookmarks",
    "mobile bookmarks", "favorites bar", "favorites", "bookmarks",
}


class _NetscapeParser(HTMLParser):
    """Parse a Netscape bookmark file into {url, title, tags, created_at} dicts.

    Enclosing folder names (<H3>) are captured as tags, tracking <DL> nesting.
    """

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.items: list[dict] = []
        self._folders: list[str] = []      # stack of open folder names
        self._pending_folder: str | None = None  # folder whose <DL> hasn't opened yet
        self._capture_h3 = False
        self._cur: dict | None = None      # link currently being read (for its text)

    def handle_starttag(self, tag, attrs):
        tag = tag.lower()
        a = {k.lower(): (v or "") for k, v in attrs}
        if tag == "h3":
            self._capture_h3 = True
            self._pending_folder = ""
        elif tag == "dl":
            self._folders.append(self._pending_folder or "")
            self._pending_folder = None
        elif tag == "a" and a.get("href"):
            tags = [f for f in self._folders if f and f.lower() not in _ROOT_FOLDERS]
            created = a.get("add_date", "")
            self._cur = {
                "url": a["href"].strip(),
                "title": "",
                "tags": tags,
                "created_at": int(created) if created.isdigit() else None,
            }

    def handle_endtag(self, tag):
        tag = tag.lower()
        if tag == "h3":
            self._capture_h3 = False
        elif tag == "dl":
            if self._folders:
                self._folders.pop()
        elif tag == "a" and self._cur is not None:
            if not self._cur["title"]:
                self._cur["title"] = self._cur["url"]
            self.items.append(self._cur)
            self._cur = None

    def handle_data(self, data):
        if self._capture_h3:
            self._pending_folder = (self._pending_folder or "") + data
        elif self._cur is not None:
            self._cur["title"] += data


def parse_netscape_bookmarks(html: str) -> list[dict]:
    parser = _NetscapeParser()
    parser.feed(html)
    for item in parser.items:
        item["title"] = re.sub(r"\s+", " ", item["title"]).strip()
    return parser.items


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #
def _now() -> int:
    return int(time.time())


def _normalize_tags(tags: Iterable[str]) -> list[str]:
    seen: dict[str, None] = {}
    for t in tags:
        t = t.strip().lower()
        if t and t not in seen:
            seen[t] = None
    return list(seen)


def _set_tags(conn: sqlite3.Connection, bookmark_id: int, tags: list[str]) -> None:
    conn.execute("DELETE FROM bookmark_tags WHERE bookmark_id = ?", (bookmark_id,))
    for name in tags:
        conn.execute("INSERT OR IGNORE INTO tags(name) VALUES (?)", (name,))
        tag_id = conn.execute("SELECT id FROM tags WHERE name = ?", (name,)).fetchone()[0]
        conn.execute(
            "INSERT OR IGNORE INTO bookmark_tags(bookmark_id, tag_id) VALUES (?, ?)",
            (bookmark_id, tag_id),
        )


def _get_tags(conn: sqlite3.Connection, bookmark_id: int) -> list[str]:
    rows = conn.execute(
        """
        SELECT t.name FROM tags t
        JOIN bookmark_tags bt ON bt.tag_id = t.id
        WHERE bt.bookmark_id = ?
        ORDER BY t.name
        """,
        (bookmark_id,),
    ).fetchall()
    return [r[0] for r in rows]


def _sync_fts(conn: sqlite3.Connection, bookmark_id: int) -> None:
    row = conn.execute("SELECT * FROM bookmarks WHERE id = ?", (bookmark_id,)).fetchone()
    if row is None:
        return
    tags = " ".join(_get_tags(conn, bookmark_id))
    conn.execute("DELETE FROM bookmarks_fts WHERE rowid = ?", (bookmark_id,))
    conn.execute(
        "INSERT INTO bookmarks_fts(rowid, url, title, description, notes, tags) "
        "VALUES (?, ?, ?, ?, ?, ?)",
        (bookmark_id, row["url"], row["title"], row["description"], row["notes"], tags),
    )


def _serialize(conn: sqlite3.Connection, row: sqlite3.Row) -> dict:
    return {
        "id": row["id"],
        "url": row["url"],
        "title": row["title"],
        "description": row["description"],
        "notes": row["notes"],
        "favorite": bool(row["favorite"]),
        "tags": _get_tags(conn, row["id"]),
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


# --------------------------------------------------------------------------- #
# API models
# --------------------------------------------------------------------------- #
class BookmarkCreate(BaseModel):
    url: str = Field(..., min_length=1)
    title: str | None = None
    description: str | None = None
    notes: str = ""
    tags: list[str] = []
    fetch: bool = True


class BookmarkUpdate(BaseModel):
    url: str | None = None
    title: str | None = None
    description: str | None = None
    notes: str | None = None
    favorite: bool | None = None
    tags: list[str] | None = None


class ImportPayload(BaseModel):
    bookmarks: list[dict]


# --------------------------------------------------------------------------- #
# App
# --------------------------------------------------------------------------- #
app = FastAPI(title="Bookmark Manager")


@app.on_event("startup")
def _startup() -> None:
    init_db()


@app.get("/api/bookmarks")
def list_bookmarks(q: str | None = None, tag: str | None = None, favorite: bool | None = None):
    with get_db() as conn:
        params: list = []
        where: list[str] = []
        base = "SELECT DISTINCT b.* FROM bookmarks b"

        if tag:
            base += (
                " JOIN bookmark_tags bt ON bt.bookmark_id = b.id"
                " JOIN tags t ON t.id = bt.tag_id"
            )
            where.append("t.name = ?")
            params.append(tag.strip().lower())

        if q:
            where.append(
                "b.id IN (SELECT rowid FROM bookmarks_fts WHERE bookmarks_fts MATCH ?)"
            )
            params.append(_fts_query(q))

        if favorite:
            where.append("b.favorite = 1")

        if where:
            base += " WHERE " + " AND ".join(where)
        base += " ORDER BY b.created_at DESC"

        try:
            rows = conn.execute(base, params).fetchall()
        except sqlite3.OperationalError:
            rows = []
        return [_serialize(conn, r) for r in rows]


def _fts_query(q: str) -> str:
    """Turn a user query into a safe FTS5 prefix query."""
    terms = re.findall(r"\w+", q)
    if not terms:
        return '""'
    return " ".join(f"{t}*" for t in terms)


@app.get("/api/bookmarks/{bookmark_id}")
def get_bookmark(bookmark_id: int):
    with get_db() as conn:
        row = conn.execute("SELECT * FROM bookmarks WHERE id = ?", (bookmark_id,)).fetchone()
        if row is None:
            raise HTTPException(404, "Bookmark not found")
        return _serialize(conn, row)


@app.post("/api/bookmarks", status_code=201)
def create_bookmark(payload: BookmarkCreate):
    url = payload.url.strip()
    if not re.match(r"^https?://", url, re.I):
        url = "https://" + url

    title = payload.title or ""
    description = payload.description or ""
    if payload.fetch and (not title or not description):
        f_title, f_desc = fetch_metadata(url)
        title = title or f_title
        description = description or f_desc
    if not title:
        title = url

    now = _now()
    with get_db() as conn:
        cur = conn.execute(
            "INSERT INTO bookmarks(url, title, description, notes, created_at, updated_at) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (url, title, description, payload.notes, now, now),
        )
        bid = cur.lastrowid
        _set_tags(conn, bid, _normalize_tags(payload.tags))
        _sync_fts(conn, bid)
        row = conn.execute("SELECT * FROM bookmarks WHERE id = ?", (bid,)).fetchone()
        return _serialize(conn, row)


@app.put("/api/bookmarks/{bookmark_id}")
def update_bookmark(bookmark_id: int, payload: BookmarkUpdate):
    with get_db() as conn:
        row = conn.execute("SELECT * FROM bookmarks WHERE id = ?", (bookmark_id,)).fetchone()
        if row is None:
            raise HTTPException(404, "Bookmark not found")

        fields = {
            "url": payload.url,
            "title": payload.title,
            "description": payload.description,
            "notes": payload.notes,
            "favorite": None if payload.favorite is None else int(payload.favorite),
        }
        updates = {k: v for k, v in fields.items() if v is not None}
        if updates:
            updates["updated_at"] = _now()
            cols = ", ".join(f"{k} = ?" for k in updates)
            conn.execute(
                f"UPDATE bookmarks SET {cols} WHERE id = ?",
                (*updates.values(), bookmark_id),
            )
        if payload.tags is not None:
            _set_tags(conn, bookmark_id, _normalize_tags(payload.tags))

        _sync_fts(conn, bookmark_id)
        row = conn.execute("SELECT * FROM bookmarks WHERE id = ?", (bookmark_id,)).fetchone()
        return _serialize(conn, row)


@app.delete("/api/bookmarks/{bookmark_id}", status_code=204)
def delete_bookmark(bookmark_id: int):
    with get_db() as conn:
        cur = conn.execute("DELETE FROM bookmarks WHERE id = ?", (bookmark_id,))
        if cur.rowcount == 0:
            raise HTTPException(404, "Bookmark not found")
        conn.execute("DELETE FROM bookmarks_fts WHERE rowid = ?", (bookmark_id,))
        # Clean up orphaned tags.
        conn.execute(
            "DELETE FROM tags WHERE id NOT IN (SELECT tag_id FROM bookmark_tags)"
        )


@app.get("/api/tags")
def list_tags():
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
        return [{"name": r["name"], "count": r["count"]} for r in rows]


@app.get("/api/export")
def export_bookmarks():
    with get_db() as conn:
        rows = conn.execute("SELECT * FROM bookmarks ORDER BY created_at").fetchall()
        return {"bookmarks": [_serialize(conn, r) for r in rows]}


def _import_items(items: Iterable[dict]) -> int:
    """Insert bookmark dicts, skipping URLs that already exist. Returns count added."""
    imported = 0
    with get_db() as conn:
        existing = {r[0] for r in conn.execute("SELECT url FROM bookmarks").fetchall()}
        for item in items:
            url = (item.get("url") or "").strip()
            if not url or url in existing:
                continue
            now = _now()
            cur = conn.execute(
                "INSERT INTO bookmarks(url, title, description, notes, favorite, created_at, updated_at) "
                "VALUES (?, ?, ?, ?, ?, ?, ?)",
                (
                    url,
                    item.get("title") or url,
                    item.get("description") or "",
                    item.get("notes") or "",
                    int(bool(item.get("favorite"))),
                    int(item.get("created_at") or now),
                    now,
                ),
            )
            bid = cur.lastrowid
            _set_tags(conn, bid, _normalize_tags(item.get("tags") or []))
            _sync_fts(conn, bid)
            existing.add(url)
            imported += 1
    return imported


@app.post("/api/import")
def import_bookmarks(payload: ImportPayload):
    return {"imported": _import_items(payload.bookmarks)}


@app.post("/api/import/html")
async def import_bookmarks_html(request: Request):
    """Import a Netscape-format bookmark file (Chrome/Firefox/Safari export)."""
    raw = (await request.body()).decode("utf-8", errors="replace")
    items = parse_netscape_bookmarks(raw)
    return {"imported": _import_items(items), "found": len(items)}


# --------------------------------------------------------------------------- #
# Frontend
# --------------------------------------------------------------------------- #
@app.get("/")
def index():
    return FileResponse(STATIC_DIR / "index.html")


app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")
