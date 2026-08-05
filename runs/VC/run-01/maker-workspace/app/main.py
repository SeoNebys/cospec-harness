"""Bookmark manager — FastAPI backend.

A local, single-user web app. Run with::

    ./run.sh
    # or
    .venv/bin/uvicorn app.main:app --reload
"""
from __future__ import annotations

import sqlite3
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from .db import get_db, init_db
from .titles import fetch_title

STATIC_DIR = Path(__file__).resolve().parent / "static"

app = FastAPI(title="Bookmark Manager")


@app.on_event("startup")
def _startup() -> None:
    init_db()


# --------------------------------------------------------------------------- #
# Schemas
# --------------------------------------------------------------------------- #
class BookmarkIn(BaseModel):
    url: str = Field(..., min_length=1)
    title: str = ""
    description: str = ""
    tags: list[str] = []


class Bookmark(BookmarkIn):
    id: int
    created_at: str


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #
def _normalize_url(url: str) -> str:
    url = url.strip()
    if url and "://" not in url:
        url = "https://" + url
    return url


def _clean_tags(tags: list[str]) -> list[str]:
    """Trim, drop blanks, and dedupe case-insensitively (keeping first casing)."""
    out: list[str] = []
    lowered: set[str] = set()
    for t in tags:
        t = t.strip()
        if t and t.lower() not in lowered:
            lowered.add(t.lower())
            out.append(t)
    return out


def _set_tags(conn: sqlite3.Connection, bookmark_id: int, tags: list[str]) -> None:
    conn.execute("DELETE FROM bookmark_tags WHERE bookmark_id = ?", (bookmark_id,))
    for name in _clean_tags(tags):
        conn.execute("INSERT OR IGNORE INTO tags (name) VALUES (?)", (name,))
        row = conn.execute(
            "SELECT id FROM tags WHERE name = ? COLLATE NOCASE", (name,)
        ).fetchone()
        conn.execute(
            "INSERT OR IGNORE INTO bookmark_tags (bookmark_id, tag_id) VALUES (?, ?)",
            (bookmark_id, row["id"]),
        )


def _tags_for(conn: sqlite3.Connection, bookmark_id: int) -> list[str]:
    rows = conn.execute(
        """
        SELECT t.name FROM tags t
        JOIN bookmark_tags bt ON bt.tag_id = t.id
        WHERE bt.bookmark_id = ?
        ORDER BY t.name COLLATE NOCASE
        """,
        (bookmark_id,),
    ).fetchall()
    return [r["name"] for r in rows]


def _serialize(conn: sqlite3.Connection, row: sqlite3.Row) -> dict:
    return {
        "id": row["id"],
        "url": row["url"],
        "title": row["title"],
        "description": row["description"],
        "created_at": row["created_at"],
        "tags": _tags_for(conn, row["id"]),
    }


# --------------------------------------------------------------------------- #
# API
# --------------------------------------------------------------------------- #
@app.get("/api/bookmarks")
def list_bookmarks(q: str = "", tag: str = "") -> list[dict]:
    """List bookmarks, optionally filtered by free-text ``q`` and/or ``tag``."""
    sql = "SELECT DISTINCT b.* FROM bookmarks b"
    params: list = []
    where: list[str] = []

    if tag:
        sql += (
            " JOIN bookmark_tags bt ON bt.bookmark_id = b.id"
            " JOIN tags t ON t.id = bt.tag_id"
        )
        where.append("t.name = ? COLLATE NOCASE")
        params.append(tag)

    if q:
        like = f"%{q}%"
        where.append("(b.url LIKE ? OR b.title LIKE ? OR b.description LIKE ?)")
        params.extend([like, like, like])

    if where:
        sql += " WHERE " + " AND ".join(where)
    sql += " ORDER BY b.created_at DESC, b.id DESC"

    with get_db() as conn:
        rows = conn.execute(sql, params).fetchall()
        return [_serialize(conn, r) for r in rows]


@app.post("/api/bookmarks", status_code=201)
async def create_bookmark(data: BookmarkIn) -> dict:
    url = _normalize_url(data.url)
    if not url:
        raise HTTPException(status_code=422, detail="URL is required")

    title = data.title.strip()
    if not title:
        title = await fetch_title(url)

    with get_db() as conn:
        cur = conn.execute(
            "INSERT INTO bookmarks (url, title, description) VALUES (?, ?, ?)",
            (url, title, data.description.strip()),
        )
        bookmark_id = cur.lastrowid
        _set_tags(conn, bookmark_id, data.tags)
        row = conn.execute(
            "SELECT * FROM bookmarks WHERE id = ?", (bookmark_id,)
        ).fetchone()
        return _serialize(conn, row)


@app.put("/api/bookmarks/{bookmark_id}")
def update_bookmark(bookmark_id: int, data: BookmarkIn) -> dict:
    url = _normalize_url(data.url)
    if not url:
        raise HTTPException(status_code=422, detail="URL is required")

    with get_db() as conn:
        exists = conn.execute(
            "SELECT 1 FROM bookmarks WHERE id = ?", (bookmark_id,)
        ).fetchone()
        if not exists:
            raise HTTPException(status_code=404, detail="Bookmark not found")
        conn.execute(
            "UPDATE bookmarks SET url = ?, title = ?, description = ? WHERE id = ?",
            (url, data.title.strip(), data.description.strip(), bookmark_id),
        )
        _set_tags(conn, bookmark_id, data.tags)
        row = conn.execute(
            "SELECT * FROM bookmarks WHERE id = ?", (bookmark_id,)
        ).fetchone()
        return _serialize(conn, row)


@app.delete("/api/bookmarks/{bookmark_id}", status_code=204)
def delete_bookmark(bookmark_id: int) -> None:
    with get_db() as conn:
        cur = conn.execute("DELETE FROM bookmarks WHERE id = ?", (bookmark_id,))
        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail="Bookmark not found")


@app.get("/api/tags")
def list_tags() -> list[dict]:
    """All tags with how many bookmarks use each."""
    with get_db() as conn:
        rows = conn.execute(
            """
            SELECT t.name, COUNT(bt.bookmark_id) AS count
            FROM tags t
            LEFT JOIN bookmark_tags bt ON bt.tag_id = t.id
            GROUP BY t.id
            HAVING count > 0
            ORDER BY t.name COLLATE NOCASE
            """
        ).fetchall()
        return [{"name": r["name"], "count": r["count"]} for r in rows]


class TitleRequest(BaseModel):
    url: str


@app.post("/api/fetch-title")
async def preview_title(req: TitleRequest) -> dict:
    """Used by the UI to preview the auto-fetched title before saving."""
    return {"title": await fetch_title(_normalize_url(req.url))}


# --------------------------------------------------------------------------- #
# Frontend
# --------------------------------------------------------------------------- #
@app.get("/")
def index() -> FileResponse:
    return FileResponse(STATIC_DIR / "index.html")


app.mount("/", StaticFiles(directory=STATIC_DIR), name="static")
