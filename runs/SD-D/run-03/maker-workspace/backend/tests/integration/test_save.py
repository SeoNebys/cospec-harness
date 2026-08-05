"""User Story 1 — Save a bookmark. Covers FR-001, FR-002, FR-003 fallback, FR-011."""

from __future__ import annotations


def test_save_valid_url_creates_bookmark(client):
    resp = client.post("/api/bookmarks", json={"url": "https://example.com/page"})
    assert resp.status_code == 201
    body = resp.json()
    assert body["url"] == "https://example.com/page"
    assert body["id"] > 0
    assert body["existing"] is False


def test_save_falls_back_to_url_as_title(client):
    # No title provided and enrichment is neutralized → title is the url (FR-003).
    resp = client.post("/api/bookmarks", json={"url": "https://no-title.example"})
    assert resp.status_code == 201
    assert resp.json()["title"] == "https://no-title.example"


def test_malformed_url_is_rejected(client):
    resp = client.post("/api/bookmarks", json={"url": "not a url"})
    assert resp.status_code == 422
    # Nothing was added.
    listing = client.get("/api/bookmarks").json()
    assert listing["count"] == 0


def test_resave_returns_existing_without_duplicating(client):
    first = client.post("/api/bookmarks", json={"url": "https://dup.example/x"})
    assert first.status_code == 201
    first_id = first.json()["id"]

    # Re-saving the same address (trailing slash differs) opens the existing one.
    again = client.post("/api/bookmarks", json={"url": "https://dup.example/x/"})
    assert again.status_code == 200
    body = again.json()
    assert body["existing"] is True
    assert body["id"] == first_id

    listing = client.get("/api/bookmarks").json()
    assert listing["count"] == 1
