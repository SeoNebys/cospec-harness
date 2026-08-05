"""User Story 5 — read-later and archive (FR-016, FR-017)."""

from __future__ import annotations


def _make(client, url, title):
    return client.post("/api/bookmarks", json={"url": url, "title": title}).json()


def test_new_bookmarks_default_to_read(client):
    b = _make(client, "https://a.example", "A")
    assert b["is_read"] is True
    # Read-later pile is empty until something is deliberately flagged (FR-017).
    assert client.get("/api/bookmarks", params={"unread": "true"}).json()["count"] == 0


def test_unread_filter_shows_only_flagged(client):
    a = _make(client, "https://a.example", "A")
    _make(client, "https://b.example", "B")
    # Flag A as read-later (unread); pile should then contain only A.
    client.patch(f"/api/bookmarks/{a['id']}", json={"is_read": False})
    unread = client.get("/api/bookmarks", params={"unread": "true"}).json()
    assert [i["title"] for i in unread["items"]] == ["A"]


def test_archive_removes_from_main_list_but_is_retained(client):
    a = _make(client, "https://a.example", "A")
    client.patch(f"/api/bookmarks/{a['id']}", json={"is_archived": True})

    main = client.get("/api/bookmarks").json()
    assert main["count"] == 0  # gone from main list

    archived = client.get("/api/bookmarks", params={"archived": "true"}).json()
    assert [i["title"] for i in archived["items"]] == ["A"]  # retained


def test_restore_brings_it_back_unchanged(client):
    a = _make(client, "https://a.example", "A")
    client.patch(f"/api/bookmarks/{a['id']}", json={"is_archived": True})
    client.patch(f"/api/bookmarks/{a['id']}", json={"is_archived": False})
    main = client.get("/api/bookmarks").json()
    assert [i["title"] for i in main["items"]] == ["A"]


def test_archived_items_excluded_from_default_search(client):
    a = _make(client, "https://a.example", "Chicken")
    client.patch(f"/api/bookmarks/{a['id']}", json={"is_archived": True})
    results = client.get("/api/bookmarks", params={"q": "chicken"}).json()
    assert results["count"] == 0
