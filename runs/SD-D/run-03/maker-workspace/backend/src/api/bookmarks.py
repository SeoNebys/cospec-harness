"""Bookmark API endpoints.

Save, list/search/filter/sort, edit, and delete bookmarks (User Stories 1–3).
Bulk and triage arrive in later stories.
"""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from fastapi import APIRouter, BackgroundTasks, HTTPException, Query, Response, status
from pydantic import BaseModel
from sqlmodel import select

from ..db import get_session
from ..models import Bookmark, Tag
from ..services.metadata import enrich_bookmark
from ..services.search import bookmark_matches, parse_query
from ..services.tags import get_or_create_tags
from ..services.url_util import InvalidUrlError, normalize_url

router = APIRouter(prefix="/api/bookmarks", tags=["bookmarks"])


class BookmarkCreate(BaseModel):
    url: str
    title: str | None = None
    description: str | None = None
    notes: str | None = None
    tags: list[str] | None = None


class BookmarkOut(BaseModel):
    id: int
    url: str
    title: str
    icon: str | None
    description: str | None
    notes: str | None
    date_added: datetime
    is_read: bool
    is_archived: bool
    tags: list[str]
    # Set on a save that matched an existing bookmark, so the UI opens it
    # for editing instead of showing a new entry (FR-011).
    existing: bool = False


def _to_out(bookmark: Bookmark, *, existing: bool = False) -> BookmarkOut:
    return BookmarkOut(
        id=bookmark.id,
        url=bookmark.url,
        title=bookmark.title,
        icon=bookmark.icon,
        description=bookmark.description,
        notes=bookmark.notes,
        date_added=bookmark.date_added,
        is_read=bookmark.is_read,
        is_archived=bookmark.is_archived,
        tags=sorted(t.name for t in bookmark.tags),
        existing=existing,
    )


class BookmarkUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    notes: str | None = None
    tags: list[str] | None = None
    is_read: bool | None = None
    is_archived: bool | None = None


class BookmarkList(BaseModel):
    items: list[BookmarkOut]
    count: int


class BulkFilter(BaseModel):
    q: str | None = None
    tags_any: list[str] = []
    tags_not: list[str] = []
    unread: bool = False
    archived: bool = False


class BulkTarget(BaseModel):
    # Either an explicit list of ids, OR a filter = "everything matching" (FR-018).
    ids: list[int] | None = None
    filter: BulkFilter | None = None


class BulkAction(BaseModel):
    type: Literal[
        "add_tag", "remove_tag", "archive", "unarchive", "mark_read", "mark_unread", "delete"
    ]
    tag: str | None = None
    confirm: bool = False  # required for delete (SC-005)


class BulkRequest(BaseModel):
    target: BulkTarget
    action: BulkAction


class BulkResult(BaseModel):
    affected: int


@router.post("", status_code=201)
def create_bookmark(
    payload: BookmarkCreate, background: BackgroundTasks, response: Response
) -> BookmarkOut:
    try:
        url = normalize_url(payload.url)
    except InvalidUrlError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    with get_session() as session:
        existing = session.exec(select(Bookmark).where(Bookmark.url == url)).first()
        if existing is not None:
            # FR-011: do not duplicate; hand back the existing one to edit.
            response.status_code = status.HTTP_200_OK
            return _to_out(existing, existing=True)

        bookmark = Bookmark(
            url=url,
            title=(payload.title.strip() if payload.title and payload.title.strip() else url),
            description=payload.description,
            notes=payload.notes,
        )
        if payload.tags:
            bookmark.tags = get_or_create_tags(session, payload.tags)
        session.add(bookmark)
        session.commit()
        session.refresh(bookmark)
        out = _to_out(bookmark)

    # Best-effort enrichment after responding — saving never blocks (FR-003).
    background.add_task(enrich_bookmark, out.id, url)
    return out


@router.get("", response_model=BookmarkList)
def list_bookmarks(
    q: str | None = Query(default=None),
    tags_any: list[str] = Query(default=[]),
    tags_not: list[str] = Query(default=[]),
    sort: str = Query(default="recent"),
    archived: bool = Query(default=False),
    unread: bool = Query(default=False),
) -> BookmarkList:
    """List bookmarks with optional keyword search, multi-tag filter, and sort.

    - `q`: case-insensitive keyword search; `"quoted"` = exact phrase (FR-009).
    - `tags_any`: include bookmarks carrying ANY of these tags (OR) (FR-010).
    - `tags_not`: exclude bookmarks carrying any of these tags (NOT) (FR-010).
    - `sort`: `recent` (newest first, default) or `title` (A–Z) (FR-013).
    - `archived`: main list (False) vs. archive view (True) (FR-016).
    - `unread`: restrict to the unread ("read later") pile (FR-017).
    Keyword and tag filters combine with AND (search within a tag).
    """
    with get_session() as session:
        matched = _resolve_matching(session, q, tags_any, tags_not, unread, archived)
        if sort == "title":
            matched.sort(key=lambda b: b.title.lower())
        else:  # recent (default)
            matched.sort(key=lambda b: b.date_added, reverse=True)
        items = [_to_out(b) for b in matched]
    return BookmarkList(items=items, count=len(items))


def _resolve_matching(
    session,
    q: str | None,
    tags_any: list[str],
    tags_not: list[str],
    unread: bool,
    archived: bool,
) -> list[Bookmark]:
    """Return bookmarks matching the given filter — shared by list and bulk.

    This is the single source of truth for "what matches the current view", so
    "select everything matching" (FR-018) applies to exactly what the user sees.
    """
    include = {t.strip().lower() for t in tags_any if t.strip()}
    exclude = {t.strip().lower() for t in tags_not if t.strip()}
    terms = parse_query(q)

    rows = session.exec(
        select(Bookmark).where(Bookmark.is_archived == archived)  # noqa: E712
    ).all()
    matched: list[Bookmark] = []
    for b in rows:
        if unread and b.is_read:
            continue
        tag_names = {t.name for t in b.tags}
        if include and tag_names.isdisjoint(include):
            continue
        if exclude and not tag_names.isdisjoint(exclude):
            continue
        if not bookmark_matches(b, terms):
            continue
        matched.append(b)
    return matched


@router.patch("/{bookmark_id}", response_model=BookmarkOut)
def update_bookmark(bookmark_id: int, payload: BookmarkUpdate) -> BookmarkOut:
    """Edit a bookmark's title, description, notes, and/or tags (FR-004, FR-007)."""
    with get_session() as session:
        bookmark = session.get(Bookmark, bookmark_id)
        if bookmark is None:
            raise HTTPException(status_code=404, detail="Bookmark not found.")

        fields = payload.model_dump(exclude_unset=True)
        if "title" in fields:
            new_title = (payload.title or "").strip()
            # Never allow a blank title — fall back to the address.
            bookmark.title = new_title or bookmark.url
        if "description" in fields:
            bookmark.description = payload.description
        if "notes" in fields:
            bookmark.notes = payload.notes
        if "tags" in fields:
            bookmark.tags = get_or_create_tags(session, payload.tags or [])
        if "is_read" in fields and payload.is_read is not None:
            bookmark.is_read = payload.is_read
        if "is_archived" in fields and payload.is_archived is not None:
            bookmark.is_archived = payload.is_archived

        session.add(bookmark)
        session.commit()
        session.refresh(bookmark)
        return _to_out(bookmark)


@router.delete("/{bookmark_id}", status_code=204)
def delete_bookmark(bookmark_id: int) -> Response:
    """Permanently delete a bookmark (FR-008). Confirmation is enforced in the UI."""
    with get_session() as session:
        bookmark = session.get(Bookmark, bookmark_id)
        if bookmark is None:
            raise HTTPException(status_code=404, detail="Bookmark not found.")
        session.delete(bookmark)
        session.commit()
    return Response(status_code=204)


@router.post("/bulk", response_model=BulkResult)
def bulk_action(payload: BulkRequest) -> BulkResult:
    """Apply one action to many bookmarks at once (FR-018).

    Target is either an explicit `ids` list or a `filter` (= "select everything
    matching the current view"). All changes happen in one transaction.
    """
    action = payload.action
    if action.type in ("add_tag", "remove_tag") and not (action.tag and action.tag.strip()):
        raise HTTPException(status_code=422, detail="A tag is required for that action.")
    if action.type == "delete" and not action.confirm:
        raise HTTPException(status_code=400, detail="Deletion must be confirmed.")

    with get_session() as session:
        target = payload.target
        if target.ids is not None:
            targets = [b for b in (session.get(Bookmark, i) for i in target.ids) if b is not None]
        elif target.filter is not None:
            f = target.filter
            targets = _resolve_matching(session, f.q, f.tags_any, f.tags_not, f.unread, f.archived)
        else:
            raise HTTPException(status_code=422, detail="No target specified.")

        tag_rows = (
            get_or_create_tags(session, [action.tag]) if action.type == "add_tag" else []
        )
        remove_tag = Tag.canonical(action.tag) if action.type == "remove_tag" and action.tag else None
        for bookmark in targets:
            if action.type == "add_tag":
                if tag_rows and tag_rows[0] not in bookmark.tags:
                    bookmark.tags.append(tag_rows[0])
            elif action.type == "remove_tag":
                bookmark.tags = [t for t in bookmark.tags if t.name != remove_tag]
            elif action.type == "archive":
                bookmark.is_archived = True
            elif action.type == "unarchive":
                bookmark.is_archived = False
            elif action.type == "mark_read":
                bookmark.is_read = True
            elif action.type == "mark_unread":
                bookmark.is_read = False
            elif action.type == "delete":
                session.delete(bookmark)
            if action.type != "delete":
                session.add(bookmark)
        affected = len(targets)
        session.commit()
    return BulkResult(affected=affected)
