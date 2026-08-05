"""Contract tests for search params and tag endpoints (User Story 4)."""


def test_tags_empty_initially(client):
    assert client.get("/api/tags").json() == []


def test_search_and_filter_params_accepted(client):
    client.post("/api/bookmarks", json={"url": "https://s.example"})
    assert client.get("/api/bookmarks", params={"q": "stub"}).status_code == 200
    assert client.get("/api/bookmarks", params={"tag": "none"}).status_code == 200
    assert client.get("/api/bookmarks", params={"sort": "title"}).status_code == 200


def test_tags_listed_with_counts(client):
    bm = client.post("/api/bookmarks", json={"url": "https://t.example"}).json()
    client.patch(f"/api/bookmarks/{bm['id']}", json={"tags": ["reading", "research"]})

    tags = client.get("/api/tags").json()
    names = {t["name"]: t["count"] for t in tags}
    assert names == {"reading": 1, "research": 1}


def test_tag_suggestions_by_prefix_case_insensitive(client):
    bm = client.post("/api/bookmarks", json={"url": "https://t2.example"}).json()
    client.patch(f"/api/bookmarks/{bm['id']}", json={"tags": ["Recipes", "Reading", "News"]})

    suggestions = client.get("/api/tags/suggest", params={"prefix": "re"}).json()
    assert set(suggestions) == {"Recipes", "Reading"}
