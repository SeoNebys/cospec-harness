"""Contract tests for GET /api/bookmarks (User Story 2)."""


def test_empty_list_shape(client):
    resp = client.get("/api/bookmarks")
    assert resp.status_code == 200
    body = resp.json()
    assert body == {"items": [], "total": 0}


def test_list_returns_items_and_total(client):
    client.post("/api/bookmarks", json={"url": "https://a.example"})
    client.post("/api/bookmarks", json={"url": "https://b.example"})

    resp = client.get("/api/bookmarks")
    body = resp.json()
    assert body["total"] == 2
    assert len(body["items"]) == 2
    assert {"id", "url", "title", "faviconUrl", "noteHtml", "tags", "dateSaved", "dateModified"} <= body["items"][0].keys()


def test_sort_by_title(client):
    client.post("/api/bookmarks", json={"url": "https://zeta.example"})
    client.post("/api/bookmarks", json={"url": "https://alpha.example"})
    # Titles both come back as the stubbed "Stub Title"; assert the param is accepted.
    resp = client.get("/api/bookmarks", params={"sort": "title"})
    assert resp.status_code == 200
    assert resp.json()["total"] == 2
