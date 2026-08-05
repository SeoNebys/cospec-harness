"""User Story 4 — import/export (FR-014, FR-015, SC-007, SC-008)."""

from __future__ import annotations

import io

NETSCAPE = """<!DOCTYPE NETSCAPE-Bookmark-file-1>
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
<DL><p>
    <DT><H3 ADD_DATE="1600000000">Cooking</H3>
    <DL><p>
        <DT><A HREF="https://recipes.example/curry" ADD_DATE="1500000000">Curry</A>
        <DD>A tasty curry
        <DT><H3>Baking</H3>
        <DL><p>
            <DT><A HREF="https://recipes.example/bread" ADD_DATE="1400000000">Bread</A>
        </DL><p>
    </DL><p>
    <DT><A HREF="https://news.example/a" ADD_DATE="1300000000">News A</A>
</DL><p>
"""


def _upload(client, content: str, filename: str):
    return client.post(
        "/api/import",
        files={"file": (filename, io.BytesIO(content.encode()), "text/html")},
    )


def test_import_html_folders_become_tags_and_dates_preserved(client):
    resp = _upload(client, NETSCAPE, "bookmarks.html")
    assert resp.status_code == 200
    assert resp.json() == {"imported": 3, "skipped_duplicates": 0}

    items = {i["title"]: i for i in client.get("/api/bookmarks").json()["items"]}
    # Folder path became tags (nested folder → multiple tags).
    assert items["Curry"]["tags"] == ["cooking"]
    assert sorted(items["Bread"]["tags"]) == ["baking", "cooking"]
    # Original date preserved (1500000000 = 2017), not reset to import time.
    assert items["Curry"]["date_added"].startswith("2017")


WRAPPED = """<!DOCTYPE NETSCAPE-Bookmark-file-1>
<DL><p>
    <DT><H3>Bookmarks Bar</H3>
    <DL><p>
        <DT><H3>Cooking</H3>
        <DL><p>
            <DT><A HREF="https://recipes.example/curry">Curry</A>
        </DL><p>
    </DL><p>
</DL><p>
"""


def test_import_skips_wrapper_folders(client):
    _upload(client, WRAPPED, "bookmarks.html")
    items = client.get("/api/bookmarks").json()["items"]
    # "Bookmarks Bar" wrapper dropped; only the meaningful "cooking" folder tags it.
    assert items[0]["tags"] == ["cooking"]


def test_import_skips_existing_duplicates(client):
    client.post("/api/bookmarks", json={"url": "https://news.example/a", "title": "Existing"})
    resp = _upload(client, NETSCAPE, "bookmarks.html")
    body = resp.json()
    assert body["imported"] == 2
    assert body["skipped_duplicates"] == 1


def test_export_json_then_reimport_is_lossless(client):
    # Create a bookmark with tags + notes + read/archived-ish state.
    created = client.post(
        "/api/bookmarks",
        json={"url": "https://a.example/x", "title": "Full", "notes": "**b**", "tags": ["work"]},
    ).json()
    client.patch(f"/api/bookmarks/{created['id']}", json={"tags": ["work", "keep"]})

    export = client.get("/api/export", params={"format": "json"})
    assert export.status_code == 200
    backup = export.text

    # Wipe, then re-import the backup.
    client.delete(f"/api/bookmarks/{created['id']}")
    assert client.get("/api/bookmarks").json()["count"] == 0

    resp = client.post(
        "/api/import",
        files={"file": ("bookmarks-backup.json", io.BytesIO(backup.encode()), "application/json")},
    )
    assert resp.json()["imported"] == 1
    restored = client.get("/api/bookmarks").json()["items"][0]
    assert restored["title"] == "Full"
    assert restored["notes"] == "**b**"
    assert sorted(restored["tags"]) == ["keep", "work"]


def test_export_html_contains_links_and_tags(client):
    client.post(
        "/api/bookmarks",
        json={"url": "https://a.example/x", "title": "Item", "tags": ["recipes"]},
    )
    html = client.get("/api/export", params={"format": "html"}).text
    assert "NETSCAPE-Bookmark-file-1" in html
    assert "https://a.example/x" in html
    assert 'TAGS="recipes"' in html
    assert "<H3>recipes</H3>" in html  # tag surfaced as a folder for portability
