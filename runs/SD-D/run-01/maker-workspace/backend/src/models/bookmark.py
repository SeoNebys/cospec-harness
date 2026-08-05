"""Bookmark entity — a saved link. See specs/001-bookmark-manager/data-model.md."""

from datetime import datetime, timezone
from typing import List, Optional

from sqlalchemy import Column, LargeBinary
from sqlmodel import Field, Relationship, SQLModel

from .tag import BookmarkTag, Tag


def _now() -> datetime:
    return datetime.now(timezone.utc)


class Bookmark(SQLModel, table=True):
    __tablename__ = "bookmark"

    id: Optional[int] = Field(default=None, primary_key=True)

    # The address as entered by the user, plus a normalized form used for uniqueness.
    url: str
    url_normalized: str = Field(index=True, unique=True)

    # Title; never empty — falls back to the URL when no page title is captured.
    title: str

    # Site icon captured at save time (nullable when unavailable).
    favicon: Optional[bytes] = Field(default=None, sa_column=Column(LargeBinary))
    favicon_mime: Optional[str] = Field(default=None)

    # Rich-text note/description (sanitized HTML) plus a plain-text copy for search.
    note_html: Optional[str] = Field(default=None)
    note_text: Optional[str] = Field(default=None)

    # date_saved may originate from an import's ADD_DATE (User Story 5).
    date_saved: datetime = Field(default_factory=_now)
    date_modified: datetime = Field(default_factory=_now)

    tags: List[Tag] = Relationship(back_populates="bookmarks", link_model=BookmarkTag)
