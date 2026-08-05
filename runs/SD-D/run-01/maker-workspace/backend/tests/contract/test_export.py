"""Contract tests for GET /api/export (User Story 6)."""


def test_export_empty_collection_is_valid(client):
    resp = client.get("/api/export")
    assert resp.status_code == 200
    assert resp.headers["content-type"].startswith("text/html")
    assert "attachment" in resp.headers.get("content-disposition", "")
    body = resp.text
    assert "NETSCAPE-Bookmark-file-1" in body
    assert "<A " not in body.upper()  # no bookmarks


def test_export_contains_saved_bookmarks(client):
    client.post("/api/bookmarks", json={"url": "https://exp.example/one"})
    body = client.get("/api/export").text
    assert "https://exp.example/one" in body
    assert body.strip().endswith("</DL><p>")
