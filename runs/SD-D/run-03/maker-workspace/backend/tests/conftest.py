"""Test fixtures: isolated temp database + hermetic (no-network) metadata.

The DB engine is created at import time from BOOKMARK_DB_PATH, so we set it to a
temp file *before* importing the app. Metadata enrichment is neutralized by
default so tests never touch the network; tests that care about enrichment can
re-patch it.
"""

from __future__ import annotations

import os
import tempfile

# Point the DB at a throwaway file before any app import triggers engine creation.
_tmpdir = tempfile.mkdtemp(prefix="bm-test-")
os.environ["BOOKMARK_DB_PATH"] = os.path.join(_tmpdir, "test.db")

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlmodel import SQLModel  # noqa: E402

from src import app as app_module  # noqa: E402
from src.api import bookmarks as bookmarks_api  # noqa: E402
from src.db import engine  # noqa: E402


@pytest.fixture(autouse=True)
def fresh_db():
    """Recreate all tables before each test for isolation."""
    SQLModel.metadata.drop_all(engine)
    SQLModel.metadata.create_all(engine)
    yield
    SQLModel.metadata.drop_all(engine)


@pytest.fixture(autouse=True)
def no_network_enrichment(monkeypatch):
    """Replace background metadata enrichment with a no-op (hermetic tests)."""
    monkeypatch.setattr(bookmarks_api, "enrich_bookmark", lambda *a, **k: None)


@pytest.fixture()
def client():
    with TestClient(app_module.app) as c:
        yield c
