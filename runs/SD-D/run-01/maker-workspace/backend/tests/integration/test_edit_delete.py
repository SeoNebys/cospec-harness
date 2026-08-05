"""Integration tests: edits persist and deletes remove (User Story 3)."""


def test_edit_persists_in_list(client):
    bm = client.post("/api/bookmarks", json={"url": "https://p.example"}).json()
    client.patch(f"/api/bookmarks/{bm['id']}", json={"title": "Edited"})

    listed = client.get("/api/bookmarks").json()["items"]
    assert listed[0]["title"] == "Edited"


def test_delete_removes_from_list(client):
    a = client.post("/api/bookmarks", json={"url": "https://one.example"}).json()
    client.post("/api/bookmarks", json={"url": "https://two.example"})

    client.delete(f"/api/bookmarks/{a['id']}")
    listed = client.get("/api/bookmarks").json()
    urls = [b["url"] for b in listed["items"]]
    assert "https://one.example" not in urls
    assert listed["total"] == 1
