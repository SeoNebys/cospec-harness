"""Tag entity and the Bookmark<->Tag join table.

Tags are compared case-insensitively at the service layer (a tag "Recipe" and "recipe"
are the same); the tag service (User Story 4) owns that normalization. In the MVP tags
exist as a model but are not yet created through the UI.
"""

from typing import TYPE_CHECKING, List, Optional

from sqlmodel import Field, Relationship, SQLModel

if TYPE_CHECKING:
    from .bookmark import Bookmark


class BookmarkTag(SQLModel, table=True):
    __tablename__ = "bookmark_tag"

    bookmark_id: Optional[int] = Field(
        default=None, foreign_key="bookmark.id", primary_key=True, ondelete="CASCADE"
    )
    tag_id: Optional[int] = Field(
        default=None, foreign_key="tag.id", primary_key=True
    )


class Tag(SQLModel, table=True):
    __tablename__ = "tag"

    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(index=True, unique=True)

    bookmarks: List["Bookmark"] = Relationship(
        back_populates="tags", link_model=BookmarkTag
    )
