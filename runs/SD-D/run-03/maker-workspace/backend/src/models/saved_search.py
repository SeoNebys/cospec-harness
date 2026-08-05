"""SavedSearch model (FR-019) — a named, reusable filter combination.

Tag lists are stored comma-joined (tags are canonical and contain no commas).
This is the lower-priority, kept-but-deferrable feature; it adds no new concepts
beyond the filter values the UI already produces.
"""

from typing import Optional

from sqlmodel import Field, SQLModel


class SavedSearch(SQLModel, table=True):
    __tablename__ = "saved_search"
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(unique=True)
    keyword: Optional[str] = Field(default=None)
    include_tags: str = Field(default="")  # comma-joined
    exclude_tags: str = Field(default="")  # comma-joined
    unread_only: bool = Field(default=False)
