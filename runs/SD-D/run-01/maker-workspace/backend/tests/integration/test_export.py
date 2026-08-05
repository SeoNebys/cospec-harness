"""Integration test: export round-trips back through import (User Story 6, SC-008)."""


def test_export_reimports_without_loss(client):
    a = client.post("/api/bookmarks", json={"url": "https://round.example/a"}).json()
    b = client.post("/api/bookmarks", json={"url": "https://round.example/b"}).json()
    client.patch(f"/api/bookmarks/{a['id']}", json={"title": "Alpha", "tags": ["keep", "mine"]})
    client.patch(f"/api/bookmarks/{b['id']}", json={"title": "Beta"})

    exported = client.get("/api/export").text

    # Re-importing into the SAME collection should skip everything (already present).
    reimport = client.post(
        "/api/import", files={"file": ("bookmarks.html", exported, "text/html")}
    ).json()
    assert reimport == {"added": 0, "skipped": 2}


def test_export_roundtrips_into_fresh_collection(client, monkeypatch):
    # Build a collection, export it, wipe, then import the export: nothing lost.
    a = client.post("/api/bookmarks", json={"url": "https://fresh.example/a"}).json()
    client.patch(f"/api/bookmarks/{a['id']}", json={"title": "Alpha", "tags": ["work"]})
    exported = client.get("/api/export").text

    client.delete(f"/api/bookmarks/{a['id']}")
    assert client.get("/api/bookmarks").json()["total"] == 0

    result = client.post(
        "/api/import", files={"file": ("bookmarks.html", exported, "text/html")}
    ).json()
    assert result["added"] == 1

    restored = client.get("/api/bookmarks").json()["items"][0]
    assert restored["url"] == "https://fresh.example/a"
    assert restored["title"] == "Alpha"
    assert restored["tags"] == ["work"]  # tags survived the round-trip
