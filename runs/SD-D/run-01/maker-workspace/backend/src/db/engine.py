"""SQLite engine, schema initialization, and session dependency."""

from collections.abc import Iterator

from sqlmodel import Session, SQLModel, create_engine

from ..config import DB_PATH

# check_same_thread=False lets the single local process share the connection pool
# across FastAPI's threadpool workers safely for our read/write patterns.
engine = create_engine(
    f"sqlite:///{DB_PATH}",
    connect_args={"check_same_thread": False},
)


def init_db() -> None:
    """Create tables and the full-text search index if they don't exist."""
    # Import models so they register on SQLModel.metadata before create_all.
    from ..models.bookmark import Bookmark  # noqa: F401
    from ..models.tag import BookmarkTag, Tag  # noqa: F401
    from .fts import create_fts

    SQLModel.metadata.create_all(engine)
    create_fts(engine)


def get_session() -> Iterator[Session]:
    with Session(engine) as session:
        yield session
