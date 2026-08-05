"""Smoke tests for the bookmarks API. Runs against a temp DB with no network."""
import os
import tempfile

import pytest
from fastapi.testclient import TestClient


@pytest.fixture()
def client(monkeypatch):
    tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
    tmp.close()
    os.environ["BOOKMARKS_DB"] = tmp.name

    # Import after setting the env var so the DB path is picked up.
    import importlib
    import app.db as db
    import app.main as main
    importlib.reload(db)
    importlib.reload(main)

    # Avoid real network calls during tests.
    async def fake_fetch(url):
        return "Example Domain", "https://icon/x.png"

    monkeypatch.setattr(main, "fetch_metadata", fake_fetch)

    with TestClient(main.app) as c:
        yield c

    os.unlink(tmp.name)


def test_create_and_list(client):
    resp = client.post("/api/bookmarks", json={"url": "example.com", "tags": ["news", "Tech"]})
    assert resp.status_code == 201
    data = resp.json()
    assert data["url"] == "https://example.com"  # scheme auto-added
    assert data["title"] == "Example Domain"  # auto-fetched
    assert sorted(data["tags"], key=str.lower) == ["news", "Tech"]

    items = client.get("/api/bookmarks").json()
    assert len(items) == 1


def test_explicit_title_wins(client):
    resp = client.post("/api/bookmarks", json={"url": "https://a.com", "title": "My Title"})
    assert resp.json()["title"] == "My Title"


def test_search_and_tag_filter(client):
    client.post("/api/bookmarks", json={"url": "https://python.org", "title": "Python", "tags": ["lang"]})
    client.post("/api/bookmarks", json={"url": "https://rust-lang.org", "title": "Rust", "tags": ["lang"]})
    client.post("/api/bookmarks", json={"url": "https://news.com", "title": "News", "tags": ["news"]})

    assert len(client.get("/api/bookmarks?search=python").json()) == 1
    assert len(client.get("/api/bookmarks?tag=lang").json()) == 2
    assert len(client.get("/api/bookmarks?tag=LANG").json()) == 2  # case-insensitive


def test_fts_prefix_and_tag_text(client):
    client.post("/api/bookmarks", json={"url": "https://python.org", "title": "Python", "tags": ["programming"]})
    client.post("/api/bookmarks", json={"url": "https://example.com", "title": "Example", "description": "a demo site"})

    # Prefix matching: "pyth" finds "Python".
    assert len(client.get("/api/bookmarks?search=pyth").json()) == 1
    # Description is searchable.
    assert len(client.get("/api/bookmarks?search=demo").json()) == 1
    # Tag text is part of the full-text index.
    hits = client.get("/api/bookmarks?search=programming").json()
    assert len(hits) == 1 and hits[0]["title"] == "Python"
    # Multiple tokens are AND-ed.
    assert len(client.get("/api/bookmarks?search=demo example").json()) == 1
    assert len(client.get("/api/bookmarks?search=demo python").json()) == 0


def test_fts_special_chars_dont_crash(client):
    client.post("/api/bookmarks", json={"url": "https://c.com", "title": "C++ notes"})
    # Punctuation-heavy queries must not raise FTS syntax errors.
    for q in ['c++', '"unterminated', 'a AND b', 'foo:bar', '*']:
        assert client.get(f"/api/bookmarks?search={q}").status_code == 200


def test_fts_updates_on_edit(client):
    b = client.post("/api/bookmarks", json={"url": "https://x.com", "title": "Original"}).json()
    assert len(client.get("/api/bookmarks?search=original").json()) == 1
    client.put(f"/api/bookmarks/{b['id']}", json={"title": "Renamed"})
    # Index reflects the new title and forgets the old one.
    assert client.get("/api/bookmarks?search=original").json() == []
    assert len(client.get("/api/bookmarks?search=renamed").json()) == 1


def test_delete_cleans_up_tags(client):
    b = client.post("/api/bookmarks", json={"url": "https://x.com", "tags": ["solo"]}).json()
    assert any(t["name"] == "solo" for t in client.get("/api/tags").json())

    assert client.delete(f"/api/bookmarks/{b['id']}").status_code == 204
    assert client.get("/api/bookmarks").json() == []
    assert client.get("/api/tags").json() == []  # orphaned tag removed


def test_update(client):
    b = client.post("/api/bookmarks", json={"url": "https://x.com"}).json()
    resp = client.put(f"/api/bookmarks/{b['id']}", json={"title": "Renamed", "tags": ["updated"]})
    assert resp.status_code == 200
    assert resp.json()["title"] == "Renamed"
    assert resp.json()["tags"] == ["updated"]


def test_404_on_missing(client):
    assert client.delete("/api/bookmarks/999").status_code == 404
    assert client.put("/api/bookmarks/999", json={"title": "x"}).status_code == 404


SAMPLE_EXPORT = """<!DOCTYPE NETSCAPE-Bookmark-file-1>
<DL><p>
    <DT><H3>Dev</H3>
    <DL><p>
        <DT><A HREF="https://python.org">Python &amp; Friends</A>
        <DT><H3>Rust</H3>
        <DL><p>
            <DT><A HREF="https://rust-lang.org">Rust</A>
        </DL><p>
    </DL><p>
    <DT><A HREF="https://nofolder.com" TAGS="misc,read">No Folder</A>
    <DT><A HREF="javascript:void(0)">Bookmarklet</A>
</DL><p>
"""


def test_parse_bookmarks():
    from app.importer import parse_bookmarks

    links = parse_bookmarks(SAMPLE_EXPORT, folders_as_tags=True)
    by_url = {l["url"]: l for l in links}

    assert by_url["https://python.org"]["title"] == "Python & Friends"
    assert by_url["https://python.org"]["tags"] == ["Dev"]
    # Nested folder -> nested tags.
    assert by_url["https://rust-lang.org"]["tags"] == ["Dev", "Rust"]
    # Firefox per-link TAGS attribute is picked up.
    assert by_url["https://nofolder.com"]["tags"] == ["misc", "read"]


def test_import_endpoint(client):
    result = client.post("/api/import", json={"html": SAMPLE_EXPORT}).json()
    # 3 real web links; the javascript: bookmarklet is skipped.
    assert result == {"imported": 3, "skipped": 1}

    urls = {b["url"] for b in client.get("/api/bookmarks").json()}
    assert "https://python.org" in urls
    assert "https://rust-lang.org" in urls

    # Re-importing skips everything as duplicates.
    again = client.post("/api/import", json={"html": SAMPLE_EXPORT}).json()
    assert again == {"imported": 0, "skipped": 4}

    # Folder names became filterable tags.
    assert len(client.get("/api/bookmarks?tag=Dev").json()) == 2


def test_import_without_folder_tags(client):
    result = client.post(
        "/api/import", json={"html": SAMPLE_EXPORT, "folders_as_tags": False}
    ).json()
    assert result["imported"] == 3
    # Folder tags absent, but explicit TAGS attribute still applies.
    assert client.get("/api/bookmarks?tag=Dev").json() == []
    assert len(client.get("/api/bookmarks?tag=misc").json()) == 1
