"""User Story 3 — search, multi-tag filter, sort, edit, delete (FR-004..FR-013)."""

from __future__ import annotations


def _make(client, url, title=None, tags=None):
    body = {"url": url}
    if title:
        body["title"] = title
    if tags:
        body["tags"] = tags
    resp = client.post("/api/bookmarks", json=body)
    assert resp.status_code == 201, resp.text
    return resp.json()


def test_keyword_search_is_case_insensitive(client):
    _make(client, "https://a.example", title="Chicken Curry")
    _make(client, "https://b.example", title="Beef Stew")
    items = client.get("/api/bookmarks", params={"q": "chicken"}).json()["items"]
    assert [i["title"] for i in items] == ["Chicken Curry"]


def test_quoted_phrase_matches_exactly(client):
    _make(client, "https://a.example", title="quick brown fox")
    _make(client, "https://b.example", title="brown quick fox")
    items = client.get("/api/bookmarks", params={"q": '"quick brown"'}).json()["items"]
    assert [i["title"] for i in items] == ["quick brown fox"]


def test_tags_any_and_exclude(client):
    _make(client, "https://a.example", title="A", tags=["recipes"])
    _make(client, "https://b.example", title="B", tags=["baking"])
    _make(client, "https://c.example", title="C", tags=["recipes", "finished"])

    # any-of: recipes OR baking -> A, B, C
    any_items = client.get(
        "/api/bookmarks", params=[("tags_any", "recipes"), ("tags_any", "baking")]
    ).json()
    assert any_items["count"] == 3

    # recipes but NOT finished -> only A
    filtered = client.get(
        "/api/bookmarks", params=[("tags_any", "recipes"), ("tags_not", "finished")]
    ).json()
    assert [i["title"] for i in filtered["items"]] == ["A"]


def test_search_within_a_tag(client):
    _make(client, "https://a.example", title="Chicken", tags=["recipes"])
    _make(client, "https://b.example", title="Chicken", tags=["work"])
    items = client.get(
        "/api/bookmarks", params=[("q", "chicken"), ("tags_any", "recipes")]
    ).json()["items"]
    assert len(items) == 1
    assert items[0]["tags"] == ["recipes"]


def test_sort_recent_and_title(client):
    _make(client, "https://z.example", title="Zebra")
    _make(client, "https://a.example", title="Apple")
    titles_recent = [i["title"] for i in client.get("/api/bookmarks").json()["items"]]
    assert titles_recent == ["Apple", "Zebra"]  # newest first
    titles_alpha = [
        i["title"] for i in client.get("/api/bookmarks", params={"sort": "title"}).json()["items"]
    ]
    assert titles_alpha == ["Apple", "Zebra"]


def test_edit_updates_and_reuses_tags(client):
    bm = _make(client, "https://a.example", title="Old")
    resp = client.patch(
        f"/api/bookmarks/{bm['id']}",
        json={"title": "New", "notes": "**bold**", "tags": ["Recipes", "recipes"]},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["title"] == "New"
    assert body["notes"] == "**bold**"
    # "Recipes" and "recipes" collapse to a single canonical tag (FR-004a).
    assert body["tags"] == ["recipes"]


def test_blank_title_falls_back_to_url(client):
    bm = _make(client, "https://a.example", title="Something")
    resp = client.patch(f"/api/bookmarks/{bm['id']}", json={"title": "   "})
    assert resp.json()["title"] == "https://a.example"


def test_delete_removes_bookmark(client):
    bm = _make(client, "https://a.example", title="Doomed")
    assert client.delete(f"/api/bookmarks/{bm['id']}").status_code == 204
    assert client.get("/api/bookmarks").json()["count"] == 0


def test_tag_suggestions_and_in_use(client):
    _make(client, "https://a.example", title="A", tags=["recipes"])
    # prefix suggestion
    assert "recipes" in client.get("/api/tags", params={"prefix": "rec"}).json()
    # in-use only
    in_use = client.get("/api/tags", params={"in_use": "true"}).json()
    assert in_use == ["recipes"]
