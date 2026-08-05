"""Bookmark manager — FastAPI backend.

Run with:  uvicorn main:app --reload
Then open: http://127.0.0.1:8000
"""

import re
from html import unescape
from pathlib import Path

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

import db

app = FastAPI(title="Bookmarks")

STATIC_DIR = Path(__file__).parent / "static"


@app.on_event("startup")
def _startup() -> None:
    db.init_db()


# ---------- request models ----------

class BookmarkIn(BaseModel):
    url: str = Field(..., min_length=1)
    title: str | None = None
    description: str | None = None
    tags: list[str] | None = None


class BookmarkUpdate(BaseModel):
    url: str | None = None
    title: str | None = None
    description: str | None = None
    tags: list[str] | None = None


# ---------- helpers ----------

_TITLE_RE = re.compile(r"<title[^>]*>(.*?)</title>", re.IGNORECASE | re.DOTALL)


def _normalize_url(url: str) -> str:
    url = url.strip()
    if not re.match(r"^[a-zA-Z][a-zA-Z0-9+.-]*://", url):
        url = "https://" + url
    return url


async def _fetch_metadata(url: str) -> tuple[str, str]:
    """Best-effort fetch of a page's <title> and favicon URL. Never raises."""
    favicon = ""
    title = ""
    try:
        async with httpx.AsyncClient(
            follow_redirects=True,
            timeout=8.0,
            headers={"User-Agent": "Mozilla/5.0 (BookmarkManager)"},
        ) as client:
            resp = await client.get(url)
            host = str(resp.url).split("/")[0:3]
            favicon = "/".join(host) + "/favicon.ico"
            match = _TITLE_RE.search(resp.text)
            if match:
                title = unescape(match.group(1).strip())[:300]
    except Exception:
        pass
    return title, favicon


# ---------- API ----------

@app.get("/api/bookmarks")
def get_bookmarks(q: str = "", tag: str = ""):
    return db.list_bookmarks(query=q, tag=tag)


@app.post("/api/bookmarks", status_code=201)
async def add_bookmark(payload: BookmarkIn):
    url = _normalize_url(payload.url)
    title = (payload.title or "").strip()
    favicon = ""
    if not title:
        title, favicon = await _fetch_metadata(url)
    else:
        _, favicon = await _fetch_metadata(url)
    if not title:
        title = url
    return db.create_bookmark(
        url=url,
        title=title,
        description=(payload.description or "").strip(),
        favicon=favicon,
        tags=payload.tags or [],
    )


@app.put("/api/bookmarks/{bookmark_id}")
def edit_bookmark(bookmark_id: int, payload: BookmarkUpdate):
    fields = payload.model_dump(exclude_unset=True)
    tags = fields.pop("tags", None)
    if "url" in fields and fields["url"]:
        fields["url"] = _normalize_url(fields["url"])
    result = db.update_bookmark(bookmark_id, fields, tags)
    if result is None:
        raise HTTPException(status_code=404, detail="Bookmark not found")
    return result


@app.delete("/api/bookmarks/{bookmark_id}", status_code=204)
def remove_bookmark(bookmark_id: int):
    if not db.delete_bookmark(bookmark_id):
        raise HTTPException(status_code=404, detail="Bookmark not found")


@app.get("/api/tags")
def get_tags():
    return db.list_tags()


@app.get("/api/export")
def export_bookmarks():
    return JSONResponse(
        content=db.export_all(),
        headers={"Content-Disposition": "attachment; filename=bookmarks.json"},
    )


@app.post("/api/import")
async def import_bookmarks(items: list[BookmarkIn]):
    created = 0
    for item in items:
        url = _normalize_url(item.url)
        title = (item.title or "").strip() or url
        db.create_bookmark(
            url=url,
            title=title,
            description=(item.description or "").strip(),
            favicon="",
            tags=item.tags or [],
        )
        created += 1
    return {"imported": created}


# ---------- frontend ----------

@app.get("/")
def index():
    return FileResponse(STATIC_DIR / "index.html")


app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")
