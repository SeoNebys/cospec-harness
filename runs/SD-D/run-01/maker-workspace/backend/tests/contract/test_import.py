"""Contract tests for POST /api/import (User Story 5)."""

SAMPLE = """<!DOCTYPE NETSCAPE-Bookmark-file-1>
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
<DL><p>
    <DT><H3 ADD_DATE="1500000000">Cooking</H3>
    <DL><p>
        <DT><A HREF="https://recipes.example/pancakes" ADD_DATE="1500000123">Pancakes</A>
        <DT><H3>Desserts</H3>
        <DL><p>
            <DT><A HREF="https://recipes.example/cake" ADD_DATE="1500000200">Cake</A>
        </DL><p>
    </DL><p>
    <DT><A HREF="https://news.example/" ADD_DATE="1600000000">News</A>
</DL><p>
"""


def _upload(client, content: str, filename="bookmarks.html"):
    return client.post(
        "/api/import",
        files={"file": (filename, content, "text/html")},
    )


def test_import_returns_added_skipped_summary(client):
    resp = _upload(client, SAMPLE)
    assert resp.status_code == 200
    body = resp.json()
    assert body == {"added": 3, "skipped": 0}


def test_import_skips_existing(client):
    client.post("/api/bookmarks", json={"url": "https://news.example"})  # already saved
    resp = _upload(client, SAMPLE)
    body = resp.json()
    assert body["added"] == 2
    assert body["skipped"] == 1


def test_reimport_skips_all_duplicates(client):
    _upload(client, SAMPLE)
    resp = _upload(client, SAMPLE)
    assert resp.json() == {"added": 0, "skipped": 3}


def test_malformed_file_rejected(client):
    resp = _upload(client, "just some random text, not bookmarks", "notes.txt")
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "invalid_file"
    # Nothing imported.
    assert client.get("/api/bookmarks").json()["total"] == 0
