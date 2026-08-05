"""Tag model and the Bookmark<->Tag join table.

Tag names are stored canonically (lowercased) so "recipe"/"Recipe"/"Recipes"
do not drift into separate tags (FR-004a). Import folder names become tags
(FR-014). Fully used from User Story 3 onward; defined here as foundational
because multiple stories depend on it.
"""

from typing import TYPE_CHECKING, Optional

from sqlmodel import Field, Relationship, SQLModel

if TYPE_CHECKING:
    from .bookmark import Bookmark


class BookmarkTagLink(SQLModel, table=True):
    __tablename__ = "bookmark_tag_link"
    bookmark_id: Optional[int] = Field(default=None, foreign_key="bookmark.id", primary_key=True)
    tag_id: Optional[int] = Field(default=None, foreign_key="tag.id", primary_key=True)


class Tag(SQLModel, table=True):
    __tablename__ = "tag"
    id: Optional[int] = Field(default=None, primary_key=True)
    # Canonical (lowercased) name; unique so tags are reused, not duplicated.
    name: str = Field(index=True, unique=True)

    bookmarks: list["Bookmark"] = Relationship(
        back_populates="tags", link_model=BookmarkTagLink
    )

    @staticmethod
    def canonical(name: str) -> str:
        return name.strip().lower()
