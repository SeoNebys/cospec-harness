"""User Story 6 — bulk actions by ids and by filter (FR-018, SC-009)."""

from __future__ import annotations


def _make(client, url, title, tags=None):
    body = {"url": url, "title": title}
    if tags:
        body["tags"] = tags
    return client.post("/api/bookmarks", json=body).json()


def test_bulk_add_tag_by_ids(client):
    a = _make(client, "https://a.example", "A")
    b = _make(client, "https://b.example", "B")
    resp = client.post(
        "/api/bookmarks/bulk",
        json={"target": {"ids": [a["id"], b["id"]]}, "action": {"type": "add_tag", "tag": "keep"}},
    )
    assert resp.json() == {"affected": 2}
    items = client.get("/api/bookmarks").json()["items"]
    assert all("keep" in i["tags"] for i in items)


def test_bulk_archive_everything_matching_filter(client):
    _make(client, "https://a.example", "A", tags=["old-work"])
    _make(client, "https://b.example", "B", tags=["old-work"])
    _make(client, "https://c.example", "C", tags=["keep"])

    # "Select everything matching tag old-work" and archive it — no ids listed.
    resp = client.post(
        "/api/bookmarks/bulk",
        json={"target": {"filter": {"tags_any": ["old-work"]}}, "action": {"type": "archive"}},
    )
    assert resp.json() == {"affected": 2}
    # Main list now only has the "keep" one; the two old-work are archived.
    assert [i["title"] for i in client.get("/api/bookmarks").json()["items"]] == ["C"]
    assert client.get("/api/bookmarks", params={"archived": "true"}).json()["count"] == 2


def test_bulk_remove_tag_by_ids(client):
    a = _make(client, "https://a.example", "A", tags=["oops", "keep"])
    b = _make(client, "https://b.example", "B", tags=["oops"])
    resp = client.post(
        "/api/bookmarks/bulk",
        json={
            "target": {"ids": [a["id"], b["id"]]},
            "action": {"type": "remove_tag", "tag": "oops"},
        },
    )
    assert resp.json() == {"affected": 2}
    items = {i["title"]: i for i in client.get("/api/bookmarks").json()["items"]}
    assert items["A"]["tags"] == ["keep"]  # only "oops" removed
    assert items["B"]["tags"] == []


def test_bulk_remove_tag_requires_a_tag(client):
    a = _make(client, "https://a.example", "A", tags=["x"])
    resp = client.post(
        "/api/bookmarks/bulk",
        json={"target": {"ids": [a["id"]]}, "action": {"type": "remove_tag"}},
    )
    assert resp.status_code == 422


def test_bulk_mark_unread_by_ids(client):
    a = _make(client, "https://a.example", "A")
    client.post(
        "/api/bookmarks/bulk",
        json={"target": {"ids": [a["id"]]}, "action": {"type": "mark_unread"}},
    )
    assert client.get("/api/bookmarks", params={"unread": "true"}).json()["count"] == 1


def test_bulk_delete_requires_confirmation(client):
    a = _make(client, "https://a.example", "A")
    unconfirmed = client.post(
        "/api/bookmarks/bulk",
        json={"target": {"ids": [a["id"]]}, "action": {"type": "delete"}},
    )
    assert unconfirmed.status_code == 400
    assert client.get("/api/bookmarks").json()["count"] == 1

    confirmed = client.post(
        "/api/bookmarks/bulk",
        json={"target": {"ids": [a["id"]]}, "action": {"type": "delete", "confirm": True}},
    )
    assert confirmed.json() == {"affected": 1}
    assert client.get("/api/bookmarks").json()["count"] == 0
