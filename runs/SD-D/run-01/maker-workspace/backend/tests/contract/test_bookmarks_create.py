"""Contract tests for POST /api/bookmarks (User Story 1)."""

from src.services import bookmarks as bookmarks_service
from src.services.metadata import PageMetadata


def test_create_returns_201_with_bookmark(client):
    resp = client.post("/api/bookmarks", json={"url": "https://example.com"})
    assert resp.status_code == 201
    body = resp.json()
    assert body["url"] == "https://example.com"
    assert body["title"] == "Stub Title"
    assert body["tags"] == []
    assert "dateSaved" in body


def test_duplicate_returns_200_with_existing_for_edit(client):
    first = client.post("/api/bookmarks", json={"url": "https://example.com"})
    assert first.status_code == 201

    # Same address (with case/slash variation) → open the existing one, no duplicate.
    dup = client.post("/api/bookmarks", json={"url": "https://Example.com/"})
    assert dup.status_code == 200
    body = dup.json()
    assert body["duplicate"] is True
    assert body["bookmark"]["id"] == first.json()["id"]


def test_invalid_url_returns_422(client):
    resp = client.post("/api/bookmarks", json={"url": "not a url"})
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "invalid_url"


def test_unreachable_page_falls_back_to_url_as_title(client, monkeypatch):
    monkeypatch.setattr(
        bookmarks_service, "fetch_metadata", lambda url: PageMetadata()
    )
    resp = client.post("/api/bookmarks", json={"url": "https://no-title.example"})
    assert resp.status_code == 201
    assert resp.json()["title"] == "https://no-title.example"


def test_captured_description_seeds_note(client, monkeypatch):
    monkeypatch.setattr(
        bookmarks_service,
        "fetch_metadata",
        lambda url: PageMetadata(title="T", description="A short summary"),
    )
    resp = client.post("/api/bookmarks", json={"url": "https://desc.example"})
    assert resp.status_code == 201
    assert "A short summary" in (resp.json()["noteHtml"] or "")
