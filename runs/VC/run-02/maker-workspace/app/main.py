"""FastAPI backend for the bookmarks app."""
from contextlib import asynccontextmanager
from pathlib import Path
from sqlite3 import Connection
from urllib.parse import urlparse

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from .db import get_conn, init_db
from .importer import parse_bookmarks
from .metadata import favicon_for, fetch_metadata, normalize_url

STATIC_DIR = Path(__file__).resolve().parent.parent / "static"


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(title="Bookmarks", lifespan=lifespan)


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------
class BookmarkIn(BaseModel):
    url: str = Field(..., min_length=1)
    title: str | None = None
    description: str = ""
    tags: list[str] = []


class BookmarkUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    tags: list[str] | None = None


class ImportIn(BaseModel):
    html: str
    folders_as_tags: bool = True


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _clean_tags(tags: list[str]) -> list[str]:
    """Trim, drop blanks, and de-duplicate (case-insensitive) while preserving order."""
    seen: set[str] = set()
    out: list[str] = []
    for t in tags:
        t = t.strip()
        if t and t.lower() not in seen:
            seen.add(t.lower())
            out.append(t)
    return out


def _set_tags(conn: Connection, bookmark_id: int, tags: list[str]) -> None:
    conn.execute("DELETE FROM bookmark_tags WHERE bookmark_id = ?", (bookmark_id,))
    for name in _clean_tags(tags):
        conn.execute("INSERT OR IGNORE INTO tags(name) VALUES (?)", (name,))
        row = conn.execute("SELECT id FROM tags WHERE name = ?", (name,)).fetchone()
        conn.execute(
            "INSERT OR IGNORE INTO bookmark_tags(bookmark_id, tag_id) VALUES (?, ?)",
            (bookmark_id, row["id"]),
        )
    # Clean up any tags no longer referenced by any bookmark.
    conn.execute(
        "DELETE FROM tags WHERE id NOT IN (SELECT tag_id FROM bookmark_tags)"
    )


def _tags_for(conn: Connection, bookmark_id: int) -> list[str]:
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


def _reindex(conn: Connection, bookmark_id: int) -> None:
    """Refresh a bookmark's row in the full-text index to match current state."""
    conn.execute("DELETE FROM bookmarks_fts WHERE rowid = ?", (bookmark_id,))
    row = conn.execute("SELECT * FROM bookmarks WHERE id = ?", (bookmark_id,)).fetchone()
    if row is None:
        return
    tags = " ".join(_tags_for(conn, bookmark_id))
    conn.execute(
        "INSERT INTO bookmarks_fts(rowid, title, url, description, tags) VALUES (?, ?, ?, ?, ?)",
        (bookmark_id, row["title"], row["url"], row["description"], tags),
    )


def _fts_query(search: str) -> str:
    """Turn free-text input into a safe FTS5 MATCH expression with prefix search.

    Each token is quoted (so punctuation can't break FTS syntax) and given a
    trailing ``*`` for prefix matching; tokens are implicitly AND-ed.
    """
    tokens = search.split()
    parts = []
    for tok in tokens:
        escaped = tok.replace('"', '""')
        parts.append(f'"{escaped}"*')
    return " ".join(parts)


def _serialize(conn: Connection, row) -> dict:
    return {
        "id": row["id"],
        "url": row["url"],
        "title": row["title"],
        "description": row["description"],
        "favicon": row["favicon"],
        "created_at": row["created_at"],
        "tags": _tags_for(conn, row["id"]),
    }


# ---------------------------------------------------------------------------
# API
# ---------------------------------------------------------------------------
@app.get("/api/bookmarks")
def list_bookmarks(search: str = "", tag: str = ""):
    conn = get_conn()
    try:
        query = "SELECT b.* FROM bookmarks b"
        params: list = []
        where: list[str] = []
        searching = bool(search.strip())

        if searching:
            # Join the full-text index; rank by relevance (bm25 via `rank`).
            query += " JOIN bookmarks_fts f ON f.rowid = b.id"
            where.append("bookmarks_fts MATCH ?")
            params.append(_fts_query(search))

        if tag:
            query += (
                " JOIN bookmark_tags bt ON bt.bookmark_id = b.id"
                " JOIN tags t ON t.id = bt.tag_id"
            )
            where.append("t.name = ? COLLATE NOCASE")
            params.append(tag)

        if where:
            query += " WHERE " + " AND ".join(where)
        # Relevance order when searching; newest-first otherwise.
        query += " ORDER BY f.rank" if searching else " ORDER BY b.created_at DESC, b.id DESC"

        rows = conn.execute(query, params).fetchall()
        return [_serialize(conn, r) for r in rows]
    finally:
        conn.close()


@app.post("/api/bookmarks", status_code=201)
async def create_bookmark(payload: BookmarkIn):
    url = normalize_url(payload.url)
    if not url:
        raise HTTPException(status_code=400, detail="URL is required")

    title = (payload.title or "").strip()
    # Auto-fetch title/favicon when the title wasn't supplied.
    fetched_title, favicon = await fetch_metadata(url)
    if not title:
        title = fetched_title

    conn = get_conn()
    try:
        cur = conn.execute(
            "INSERT INTO bookmarks(url, title, description, favicon) VALUES (?, ?, ?, ?)",
            (url, title, payload.description.strip(), favicon),
        )
        bookmark_id = cur.lastrowid
        _set_tags(conn, bookmark_id, payload.tags)
        _reindex(conn, bookmark_id)
        conn.commit()
        row = conn.execute("SELECT * FROM bookmarks WHERE id = ?", (bookmark_id,)).fetchone()
        return _serialize(conn, row)
    finally:
        conn.close()


@app.put("/api/bookmarks/{bookmark_id}")
def update_bookmark(bookmark_id: int, payload: BookmarkUpdate):
    conn = get_conn()
    try:
        row = conn.execute("SELECT * FROM bookmarks WHERE id = ?", (bookmark_id,)).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="Bookmark not found")

        title = row["title"] if payload.title is None else payload.title.strip()
        description = (
            row["description"] if payload.description is None else payload.description.strip()
        )
        conn.execute(
            "UPDATE bookmarks SET title = ?, description = ? WHERE id = ?",
            (title, description, bookmark_id),
        )
        if payload.tags is not None:
            _set_tags(conn, bookmark_id, payload.tags)
        _reindex(conn, bookmark_id)
        conn.commit()
        row = conn.execute("SELECT * FROM bookmarks WHERE id = ?", (bookmark_id,)).fetchone()
        return _serialize(conn, row)
    finally:
        conn.close()


@app.delete("/api/bookmarks/{bookmark_id}", status_code=204)
def delete_bookmark(bookmark_id: int):
    conn = get_conn()
    try:
        cur = conn.execute("DELETE FROM bookmarks WHERE id = ?", (bookmark_id,))
        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail="Bookmark not found")
        conn.execute("DELETE FROM bookmarks_fts WHERE rowid = ?", (bookmark_id,))
        # Drop tags orphaned by this deletion.
        conn.execute("DELETE FROM tags WHERE id NOT IN (SELECT tag_id FROM bookmark_tags)")
        conn.commit()
    finally:
        conn.close()


@app.post("/api/import")
def import_bookmarks(payload: ImportIn):
    links = parse_bookmarks(payload.html, folders_as_tags=payload.folders_as_tags)

    conn = get_conn()
    try:
        existing = {
            row["url"] for row in conn.execute("SELECT url FROM bookmarks").fetchall()
        }
        imported = 0
        skipped = 0
        for link in links:
            raw = link["url"].strip()
            # Only import real web links; skip javascript:, place:, data:, etc.
            # (Check the scheme *before* normalizing, which would otherwise
            # turn "javascript:foo" into "https://javascript:foo".)
            scheme = urlparse(raw).scheme.lower()
            if scheme and scheme not in ("http", "https"):
                skipped += 1
                continue
            url = normalize_url(raw)
            if not url.startswith(("http://", "https://")):
                skipped += 1
                continue
            if url in existing:
                skipped += 1
                continue
            existing.add(url)
            title = link["title"] or url
            cur = conn.execute(
                "INSERT INTO bookmarks(url, title, favicon) VALUES (?, ?, ?)",
                (url, title, favicon_for(url)),
            )
            _set_tags(conn, cur.lastrowid, link["tags"])
            _reindex(conn, cur.lastrowid)
            imported += 1
        conn.commit()
        return {"imported": imported, "skipped": skipped}
    finally:
        conn.close()


@app.get("/api/tags")
def list_tags():
    conn = get_conn()
    try:
        rows = conn.execute(
            """
            SELECT t.name AS name, COUNT(bt.bookmark_id) AS count
            FROM tags t
            LEFT JOIN bookmark_tags bt ON bt.tag_id = t.id
            GROUP BY t.id
            ORDER BY count DESC, t.name COLLATE NOCASE
            """
        ).fetchall()
        return [{"name": r["name"], "count": r["count"]} for r in rows]
    finally:
        conn.close()


# ---------------------------------------------------------------------------
# Frontend
# ---------------------------------------------------------------------------
@app.get("/")
def index():
    return FileResponse(STATIC_DIR / "index.html")


app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")
