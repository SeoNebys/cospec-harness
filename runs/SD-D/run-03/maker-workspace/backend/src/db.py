"""SQLite engine/session setup and table bootstrap.

The database is a single file in the OS per-user data directory so a single
local user's collection persists across restarts (FR-012). Override with the
BOOKMARK_DB_PATH env var (used by tests to point at a temp file).
"""

from __future__ import annotations

import os
from pathlib import Path

from sqlmodel import Session, SQLModel, create_engine


def _default_db_path() -> Path:
    """Per-user data directory, cross-platform, no config required."""
    env = os.environ.get("BOOKMARK_DB_PATH")
    if env:
        return Path(env)
    if os.name == "nt":  # Windows
        base = Path(os.environ.get("APPDATA", Path.home() / "AppData" / "Roaming"))
    else:  # macOS / Linux
        base = Path(os.environ.get("XDG_DATA_HOME", Path.home() / ".local" / "share"))
    return base / "bookmark-manager" / "bookmarks.db"


def _make_engine():
    db_path = _default_db_path()
    db_path.parent.mkdir(parents=True, exist_ok=True)
    return create_engine(
        f"sqlite:///{db_path}",
        connect_args={"check_same_thread": False},
    )


engine = _make_engine()


def init_db() -> None:
    """Create tables on startup. Imports models so they register with metadata."""
    from . import models  # noqa: F401  (ensures model tables are registered)

    SQLModel.metadata.create_all(engine)


def get_session() -> Session:
    return Session(engine)
