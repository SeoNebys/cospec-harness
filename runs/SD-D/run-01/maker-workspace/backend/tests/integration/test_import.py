"""Integration tests: import preserves folders→tags and original dates (User Story 5)."""

from tests.contract.test_import import SAMPLE, _upload


def test_folders_become_tags_including_nested(client):
    _upload(client, SAMPLE)
    items = {b["title"]: b for b in client.get("/api/bookmarks").json()["items"]}

    # Top-level folder → one tag.
    assert set(items["Pancakes"]["tags"]) == {"Cooking"}
    # Nested folder → each level becomes a tag.
    assert set(items["Cake"]["tags"]) == {"Cooking", "Desserts"}
    # Loose (no folder) → no tags.
    assert items["News"]["tags"] == []


def test_original_dates_preserved(client):
    _upload(client, SAMPLE)
    items = {b["title"]: b for b in client.get("/api/bookmarks").json()["items"]}
    # ADD_DATE 1500000123 → 2017, not the import date.
    assert items["Pancakes"]["dateSaved"].startswith("2017")


def test_imported_bookmarks_are_searchable(client):
    _upload(client, SAMPLE)
    # Filter by an imported folder-tag.
    results = client.get("/api/bookmarks", params={"tag": "desserts"}).json()
    assert [b["title"] for b in results["items"]] == ["Cake"]

    # Search by title word.
    found = client.get("/api/bookmarks", params={"q": "pancakes"}).json()
    assert found["total"] == 1
