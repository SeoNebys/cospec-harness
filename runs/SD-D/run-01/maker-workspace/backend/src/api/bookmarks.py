"""Bookmark endpoints (User Stories 1 & 2). See contracts/api.md."""

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlmodel import Session

from ..db.engine import get_session
from ..services import bookmarks as service
from ..services.bookmarks import DuplicateURLError, InvalidURLError
from .schemas import (
    BookmarkListOut,
    CreateBookmarkRequest,
    UpdateBookmarkRequest,
    to_out,
)

router = APIRouter(prefix="/api/bookmarks", tags=["bookmarks"])


@router.get("", response_model=BookmarkListOut)
def list_bookmarks(
    q: str | None = Query(None),
    tag: str | None = Query(None),
    sort: str = Query("recent", pattern="^(recent|title)$"),
    session: Session = Depends(get_session),
) -> BookmarkListOut:
    items = service.list_bookmarks(session, q=q, tag=tag, sort=sort)
    return BookmarkListOut(items=[to_out(b) for b in items], total=len(items))


@router.post("")
def create_bookmark(
    body: CreateBookmarkRequest,
    response: Response,
    session: Session = Depends(get_session),
):
    try:
        bookmark, is_duplicate = service.create_bookmark(session, body.url)
    except InvalidURLError:
        raise HTTPException(
            status_code=422,
            detail={
                "code": "invalid_url",
                "message": "That doesn't look like a valid web address (must start with http:// or https://).",
            },
        )

    if is_duplicate:
        # Already saved — hand back the existing bookmark so the UI opens it for editing.
        response.status_code = 200
        return {"bookmark": to_out(bookmark), "duplicate": True}

    response.status_code = 201
    return to_out(bookmark)


@router.patch("/{bookmark_id}")
def update_bookmark(
    bookmark_id: int,
    body: UpdateBookmarkRequest,
    session: Session = Depends(get_session),
):
    # exclude_unset lets us change only the fields the client actually sent.
    provided = body.model_dump(exclude_unset=True)
    kwargs = {}
    if "url" in provided:
        kwargs["url"] = provided["url"]
    if "title" in provided:
        kwargs["title"] = provided["title"]
    if "noteHtml" in provided:
        kwargs["note_html"] = provided["noteHtml"]
    if "tags" in provided:
        kwargs["tags"] = provided["tags"] or []

    try:
        bookmark = service.update_bookmark(session, bookmark_id, **kwargs)
    except InvalidURLError:
        raise HTTPException(
            status_code=422,
            detail={
                "code": "invalid_url",
                "message": "That doesn't look like a valid web address (must start with http:// or https://).",
            },
        )
    except DuplicateURLError:
        raise HTTPException(
            status_code=409,
            detail={
                "code": "duplicate_url",
                "message": "Another bookmark already uses that address.",
            },
        )

    if bookmark is None:
        raise HTTPException(
            status_code=404,
            detail={"code": "not_found", "message": "Bookmark not found."},
        )
    return to_out(bookmark)


@router.delete("/{bookmark_id}", status_code=204)
def delete_bookmark(
    bookmark_id: int,
    session: Session = Depends(get_session),
) -> Response:
    if not service.delete_bookmark(session, bookmark_id):
        raise HTTPException(
            status_code=404,
            detail={"code": "not_found", "message": "Bookmark not found."},
        )
    return Response(status_code=204)


@router.get("/{bookmark_id}/favicon")
def get_favicon(
    bookmark_id: int,
    session: Session = Depends(get_session),
) -> Response:
    bookmark = service.get_bookmark(session, bookmark_id)
    if bookmark is None or not bookmark.favicon:
        raise HTTPException(status_code=404, detail={"code": "not_found", "message": "No icon."})
    return Response(
        content=bookmark.favicon,
        media_type=bookmark.favicon_mime or "image/x-icon",
    )


@router.get("/{bookmark_id}")
def get_bookmark(
    bookmark_id: int,
    session: Session = Depends(get_session),
):
    bookmark = service.get_bookmark(session, bookmark_id)
    if bookmark is None:
        raise HTTPException(
            status_code=404,
            detail={"code": "not_found", "message": "Bookmark not found."},
        )
    return to_out(bookmark)
