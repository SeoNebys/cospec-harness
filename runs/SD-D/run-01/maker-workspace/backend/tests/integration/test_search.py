"""Integration tests: search, tag filter, and sort ordering (User Story 4)."""


def test_note_search_is_case_insensitive(client):
    a = client.post("/api/bookmarks", json={"url": "https://a.example"}).json()
    client.post("/api/bookmarks", json={"url": "https://b.example"})
    client.patch(f"/api/bookmarks/{a['id']}", json={"noteHtml": "<p>Delicious Pancake recipe</p>"})

    # A word that appears only in A's note, searched in a different case.
    results = client.get("/api/bookmarks", params={"q": "PANCAKE"}).json()
    assert results["total"] == 1
    assert results["items"][0]["url"] == "https://a.example"


def test_tag_filter_returns_only_matching(client):
    a = client.post("/api/bookmarks", json={"url": "https://a.example"}).json()
    b = client.post("/api/bookmarks", json={"url": "https://b.example"}).json()
    client.patch(f"/api/bookmarks/{a['id']}", json={"tags": ["work"]})
    client.patch(f"/api/bookmarks/{b['id']}", json={"tags": ["home"]})

    results = client.get("/api/bookmarks", params={"tag": "WORK"}).json()  # case-insensitive
    assert [i["url"] for i in results["items"]] == ["https://a.example"]


def test_sort_by_title_alphabetical(client):
    z = client.post("/api/bookmarks", json={"url": "https://z.example"}).json()
    a = client.post("/api/bookmarks", json={"url": "https://a.example"}).json()
    client.patch(f"/api/bookmarks/{z['id']}", json={"title": "Zebra"})
    client.patch(f"/api/bookmarks/{a['id']}", json={"title": "Apple"})

    titles = [i["title"] for i in client.get("/api/bookmarks", params={"sort": "title"}).json()["items"]]
    assert titles == ["Apple", "Zebra"]


def test_search_no_results(client):
    client.post("/api/bookmarks", json={"url": "https://a.example"})
    results = client.get("/api/bookmarks", params={"q": "nonexistentword"}).json()
    assert results == {"items": [], "total": 0}


def test_exact_phrase_search(client):
    a = client.post("/api/bookmarks", json={"url": "https://a.example"}).json()
    b = client.post("/api/bookmarks", json={"url": "https://b.example"}).json()
    # Both contain the words "chicken" and "soup", but only A has them as a phrase.
    client.patch(f"/api/bookmarks/{a['id']}", json={"noteHtml": "<p>chicken soup for dinner</p>"})
    client.patch(f"/api/bookmarks/{b['id']}", json={"noteHtml": "<p>soup with diced chicken</p>"})

    # Unquoted: all-words match → both.
    both = client.get("/api/bookmarks", params={"q": "chicken soup"}).json()
    assert both["total"] == 2

    # Quoted phrase: only the one where the words are adjacent → A.
    phrase = client.get("/api/bookmarks", params={"q": '"chicken soup"'}).json()
    assert [i["url"] for i in phrase["items"]] == ["https://a.example"]
