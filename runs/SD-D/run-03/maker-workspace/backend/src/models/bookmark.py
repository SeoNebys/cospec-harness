"""Bookmark model — a saved link and its captured/edited metadata.

Fields map to data-model.md. `url` is unique so re-saving an existing address
opens it rather than duplicating (FR-011) and import can de-dupe (FR-014).
"""

from datetime import datetime, timezone
from typing import Optional

from sqlmodel import Field, Relationship, SQLModel

from .tag import BookmarkTagLink, Tag


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Bookmark(SQLModel, table=True):
    __tablename__ = "bookmark"
    id: Optional[int] = Field(default=None, primary_key=True)
    url: str = Field(index=True, unique=True)
    title: str
    icon: Optional[str] = Field(default=None)  # cached favicon (data URI or ref)
    description: Optional[str] = Field(default=None)
    notes: Optional[str] = Field(default=None)  # Markdown (FR-004b)
    # Save time, or original date preserved from an import file (FR-013, FR-014).
    date_added: datetime = Field(default_factory=_utcnow, index=True)
    # New saves default to read; unread (False) is the opt-in read-later pile (FR-017).
    is_read: bool = Field(default=True, index=True)
    is_archived: bool = Field(default=False, index=True)  # archive (FR-016)

    tags: list[Tag] = Relationship(back_populates="bookmarks", link_model=BookmarkTagLink)
