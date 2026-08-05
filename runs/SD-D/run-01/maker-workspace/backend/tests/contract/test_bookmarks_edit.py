"""Contract tests for PATCH and DELETE /api/bookmarks/{id} (User Story 3)."""


def _create(client, url="https://edit.example"):
    return client.post("/api/bookmarks", json={"url": url}).json()


def test_patch_title_persists(client):
    bm = _create(client)
    resp = client.patch(f"/api/bookmarks/{bm['id']}", json={"title": "New Title"})
    assert resp.status_code == 200
    assert resp.json()["title"] == "New Title"


def test_patch_invalid_url_returns_422(client):
    bm = _create(client)
    resp = client.patch(f"/api/bookmarks/{bm['id']}", json={"url": "nonsense"})
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "invalid_url"


def test_patch_url_conflict_returns_409(client):
    a = _create(client, "https://a.example")
    _create(client, "https://b.example")
    # Editing A's url to B's address collides → 409.
    resp = client.patch(f"/api/bookmarks/{a['id']}", json={"url": "https://b.example"})
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "duplicate_url"


def test_patch_note_is_sanitized(client):
    bm = _create(client)
    dirty = "<p><b>keep</b><script>alert(1)</script> <a href='https://x.example'>link</a></p>"
    resp = client.patch(f"/api/bookmarks/{bm['id']}", json={"noteHtml": dirty})
    assert resp.status_code == 200
    note = resp.json()["noteHtml"]
    assert "<b>keep</b>" in note
    assert "href" in note
    assert "<script>" not in note


def test_patch_missing_returns_404(client):
    resp = client.patch("/api/bookmarks/9999", json={"title": "x"})
    assert resp.status_code == 404


def test_delete_removes_bookmark(client):
    bm = _create(client)
    assert client.delete(f"/api/bookmarks/{bm['id']}").status_code == 204
    assert client.get(f"/api/bookmarks/{bm['id']}").status_code == 404


def test_delete_missing_returns_404(client):
    assert client.delete("/api/bookmarks/9999").status_code == 404
