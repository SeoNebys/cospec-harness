"""Import / export API (FR-014, FR-015).

Import accepts either a standard browser bookmark file (Netscape HTML) or this
app's own JSON backup — the latter restores everything with no loss (SC-008).
Export offers both formats; the UI must make clear which is which.
"""

from __future__ import annotations

import json
from datetime import datetime

from fastapi import APIRouter, BackgroundTasks, File, Query, UploadFile
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel
from sqlmodel import select

from ..db import get_session
from ..models import Bookmark
from ..services.export_html import export_html
from ..services.export_json import export_json
from ..services.metadata import enrich_bookmark
from ..services.netscape import parse_netscape
from ..services.tags import get_or_create_tags
from ..services.url_util import InvalidUrlError, normalize_url

router = APIRouter(prefix="/api", tags=["porting"])


class ImportResult(BaseModel):
    imported: int
    skipped_duplicates: int


@router.post("/import", response_model=ImportResult)
async def import_bookmarks(
    background: BackgroundTasks, file: UploadFile = File(...)
) -> ImportResult:
    raw = (await file.read()).decode("utf-8", errors="replace")

    # Detect our JSON backup vs. a browser HTML file.
    backup = _try_parse_backup(raw)
    imported = 0
    skipped = 0
    to_enrich: list[tuple[int, str]] = []

    with get_session() as session:
        existing_urls = {
            row for row in session.exec(select(Bookmark.url)).all()
        }

        entries = backup if backup is not None else _entries_from_html(raw)
        for entry in entries:
            try:
                url = normalize_url(entry["url"])
            except InvalidUrlError:
                continue
            if url in existing_urls:
                skipped += 1
                continue
            existing_urls.add(url)

            bookmark = Bookmark(
                url=url,
                title=entry.get("title") or url,
                description=entry.get("description"),
                notes=entry.get("notes"),
                # Imports default to read (like a normal save); a JSON backup
                # restore carries its stored value so read-later state round-trips.
                is_read=bool(entry.get("is_read", True)),
                is_archived=bool(entry.get("is_archived", False)),
            )
            if entry.get("date_added"):
                bookmark.date_added = entry["date_added"]
            tag_names = entry.get("tags") or []
            if tag_names:
                bookmark.tags = get_or_create_tags(session, tag_names)
            session.add(bookmark)
            session.flush()
            imported += 1
            # Enrich icon/description only for browser imports (JSON is complete).
            if backup is None:
                to_enrich.append((bookmark.id, url))
        session.commit()

    for bookmark_id, url in to_enrich:
        background.add_task(enrich_bookmark, bookmark_id, url)

    return ImportResult(imported=imported, skipped_duplicates=skipped)


def _try_parse_backup(raw: str) -> list[dict] | None:
    """Return normalized entries if `raw` is our JSON backup, else None."""
    text = raw.strip()
    if not text.startswith("{"):
        return None
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        return None
    if not isinstance(data, dict) or "bookmarks" not in data:
        return None
    entries = []
    for b in data["bookmarks"]:
        entry = dict(b)
        if entry.get("date_added"):
            try:
                entry["date_added"] = datetime.fromisoformat(entry["date_added"])
            except ValueError:
                entry.pop("date_added", None)
        entries.append(entry)
    return entries


def _entries_from_html(raw: str) -> list[dict]:
    entries = []
    for parsed in parse_netscape(raw):
        entries.append(
            {
                "url": parsed.url,
                "title": parsed.title,
                "description": parsed.description,
                "date_added": parsed.add_date,
                "tags": parsed.all_tags(),
            }
        )
    return entries


@router.get("/export")
def export_bookmarks(format: str = Query(default="json")) -> PlainTextResponse:
    with get_session() as session:
        bookmarks = session.exec(select(Bookmark).order_by(Bookmark.date_added)).all()
        if format == "html":
            body = export_html(bookmarks)
            media, filename = "text/html", "bookmarks.html"
        else:
            body = export_json(bookmarks)
            media, filename = "application/json", "bookmarks-backup.json"
    return PlainTextResponse(
        content=body,
        media_type=media,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
