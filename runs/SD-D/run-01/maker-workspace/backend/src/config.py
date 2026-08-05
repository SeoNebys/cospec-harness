"""Runtime configuration. Single-user, local-first: everything lives in a local file."""

import os
from pathlib import Path


def resolve_db_path() -> str:
    """Resolve the SQLite database file path.

    Precedence:
    1. ``BOOKMARKS_DB`` — explicit full path (used by tests).
    2. ``BOOKMARKS_HOME`` — a directory to hold the db file.
    3. Default: ``~/.bookmark-manager/bookmarks.db``.

    The parent directory is created if missing so first launch "just works".
    """
    explicit = os.environ.get("BOOKMARKS_DB")
    if explicit:
        Path(explicit).parent.mkdir(parents=True, exist_ok=True)
        return explicit

    home = os.environ.get("BOOKMARKS_HOME")
    base = Path(home) if home else Path.home() / ".bookmark-manager"
    base.mkdir(parents=True, exist_ok=True)
    return str(base / "bookmarks.db")


DB_PATH = resolve_db_path()
