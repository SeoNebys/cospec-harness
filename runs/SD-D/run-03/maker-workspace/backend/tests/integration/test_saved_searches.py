"""User Story 7 — saved searches (FR-019)."""

from __future__ import annotations


def test_create_list_and_delete_saved_search(client):
    created = client.post(
        "/api/saved-searches",
        json={
            "name": "unread cooking articles",
            "keyword": "chicken",
            "include_tags": ["Cooking"],
            "exclude_tags": [],
            "unread_only": True,
        },
    )
    assert created.status_code == 201
    body = created.json()
    assert body["name"] == "unread cooking articles"
    assert body["include_tags"] == ["cooking"]  # canonicalized
    assert body["unread_only"] is True

    listing = client.get("/api/saved-searches").json()
    assert [s["name"] for s in listing] == ["unread cooking articles"]

    assert client.delete(f"/api/saved-searches/{body['id']}").status_code == 204
    assert client.get("/api/saved-searches").json() == []


def test_duplicate_name_rejected(client):
    client.post("/api/saved-searches", json={"name": "dupe"})
    again = client.post("/api/saved-searches", json={"name": "dupe"})
    assert again.status_code == 409


def test_blank_name_rejected(client):
    assert client.post("/api/saved-searches", json={"name": "   "}).status_code == 422
