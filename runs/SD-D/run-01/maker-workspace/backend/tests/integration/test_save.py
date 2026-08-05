"""Integration test: saving then finding a bookmark, incl. favicon (User Story 1)."""

from src.services import bookmarks as bookmarks_service
from src.services.metadata import PageMetadata


def test_saved_bookmark_appears_in_list(client):
    client.post("/api/bookmarks", json={"url": "https://example.com/page"})
    listed = client.get("/api/bookmarks").json()
    assert listed["total"] == 1
    assert listed["items"][0]["url"] == "https://example.com/page"


def test_favicon_served_when_captured(client, monkeypatch):
    monkeypatch.setattr(
        bookmarks_service,
        "fetch_metadata",
        lambda url: PageMetadata(
            title="Icon Site", favicon=b"\x00\x01icon-bytes", favicon_mime="image/png"
        ),
    )
    created = client.post("/api/bookmarks", json={"url": "https://icons.example"}).json()
    assert created["faviconUrl"] == f"/api/bookmarks/{created['id']}/favicon"

    icon = client.get(created["faviconUrl"])
    assert icon.status_code == 200
    assert icon.content == b"\x00\x01icon-bytes"
    assert icon.headers["content-type"].startswith("image/png")


def test_favicon_404_when_absent(client):
    created = client.post("/api/bookmarks", json={"url": "https://noicon.example"}).json()
    assert created["faviconUrl"] is None
    assert client.get(f"/api/bookmarks/{created['id']}/favicon").status_code == 404
