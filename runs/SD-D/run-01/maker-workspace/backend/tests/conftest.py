"""Test fixtures: an isolated temp SQLite DB and a TestClient, with a stubbed fetch.

Metadata fetching is patched by default so tests never touch the network (fast and
deterministic). Individual tests can override the stub via ``monkeypatch``.
"""

import os
import tempfile

# Point the app at a throwaway DB file BEFORE importing anything that builds the engine.
_TMP_DB = tempfile.mktemp(suffix=".db")
os.environ["BOOKMARKS_DB"] = _TMP_DB

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import text  # noqa: E402
from sqlmodel import SQLModel  # noqa: E402

from src.api.main import app  # noqa: E402
from src.db.engine import engine, init_db  # noqa: E402
from src.services import bookmarks as bookmarks_service  # noqa: E402
from src.services.metadata import PageMetadata  # noqa: E402


@pytest.fixture(autouse=True)
def fresh_db(monkeypatch):
    # Reset schema between tests.
    SQLModel.metadata.drop_all(engine)
    with engine.connect() as conn:
        conn.execute(text("DROP TABLE IF EXISTS bookmarks_fts"))
        conn.commit()
    init_db()

    # Default: no network — a page with a simple title and no icon/description.
    monkeypatch.setattr(
        bookmarks_service,
        "fetch_metadata",
        lambda url: PageMetadata(title="Stub Title"),
    )
    yield


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)
