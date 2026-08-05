"""Model exports. Importing this module registers all tables with SQLModel."""

from .bookmark import Bookmark
from .saved_search import SavedSearch
from .tag import BookmarkTagLink, Tag

__all__ = ["Bookmark", "Tag", "BookmarkTagLink", "SavedSearch"]
