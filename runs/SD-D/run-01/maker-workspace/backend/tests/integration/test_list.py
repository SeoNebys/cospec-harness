"""Integration test: bookmarks persist to the local DB file (User Story 2, FR-005)."""

from fastapi.testclient import TestClient

from src.api.main import app


def test_bookmarks_persist_across_new_client(client):
    client.post("/api/bookmarks", json={"url": "https://persist.example"})

    # A fresh client re-reads the same on-disk SQLite database — simulating a restart.
    with TestClient(app) as reopened:
        listed = reopened.get("/api/bookmarks").json()
    assert listed["total"] == 1
    assert listed["items"][0]["url"] == "https://persist.example"


def test_empty_state_is_reported(client):
    listed = client.get("/api/bookmarks").json()
    assert listed["items"] == []
    assert listed["total"] == 0
