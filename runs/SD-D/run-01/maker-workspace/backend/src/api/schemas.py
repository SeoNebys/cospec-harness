"""Request/response shapes for the API (see contracts/api.md)."""

from pydantic import BaseModel

from ..models.bookmark import Bookmark


class CreateBookmarkRequest(BaseModel):
    url: str


class UpdateBookmarkRequest(BaseModel):
    url: str | None = None
    title: str | None = None
    noteHtml: str | None = None
    tags: list[str] | None = None


class BookmarkOut(BaseModel):
    id: int
    url: str
    title: str
    faviconUrl: str | None
    noteHtml: str | None
    tags: list[str]
    dateSaved: str
    dateModified: str


class BookmarkListOut(BaseModel):
    items: list[BookmarkOut]
    total: int


def to_out(bookmark: Bookmark) -> BookmarkOut:
    return BookmarkOut(
        id=bookmark.id,
        url=bookmark.url,
        title=bookmark.title,
        faviconUrl=f"/api/bookmarks/{bookmark.id}/favicon" if bookmark.favicon else None,
        noteHtml=bookmark.note_html,
        tags=[tag.name for tag in bookmark.tags],
        dateSaved=bookmark.date_saved.isoformat(),
        dateModified=bookmark.date_modified.isoformat(),
    )
