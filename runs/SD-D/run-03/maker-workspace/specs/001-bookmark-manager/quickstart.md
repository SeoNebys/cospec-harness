# Quickstart & Validation: Bookmark Manager

How to run the app locally and validate that the acceptance scenarios hold. This
is a run/validation guide — implementation lives in tasks.md.

## Prerequisites

- Python 3.11+, Node 20+
- No accounts, no network service — everything runs on localhost.

## Run locally

```bash
# backend (from repo root)
cd backend && python -m venv .venv && . .venv/bin/activate && pip install -r requirements.txt
# frontend build (served by the backend)
cd ../frontend && npm install && npm run build
# start (backend serves API + built UI on localhost)
cd ../backend && uvicorn src.app:app --port 8765
# open http://localhost:8765
```

## Validation scenarios (map to spec acceptance criteria)

Automated by Playwright (`e2e/`) and pytest; can also be walked by hand.

1. **Save (US1)**: Paste a URL → it appears with title, icon, description. Paste
   a malformed value → rejected with a clear message, nothing added.
2. **Fallback title (US1-2)**: Save a URL whose title can't be fetched → saved,
   address shown as title; save is not blocked by the fetch.
3. **Re-save (US1-4, FR-011)**: Save a URL already saved → the existing bookmark
   opens for editing; still one entry.
4. **Browse & open (US2)**: List shows saved items; activating one opens the
   correct page. Empty collection shows the friendly empty state.
5. **Search (US3-1,2)**: Keyword narrows by title/url/description/notes/tags,
   case-insensitive; `"exact phrase"` matches only exact.
6. **Multi-tag filter (US3-3,4,10,11)**: One tag filters; add a keyword →
   search-within-tag; include two tags → any-of; exclude a tag → those removed.
7. **Sort (US3-5)**: Toggle newest-first ↔ alphabetical by title.
8. **Edit + tag suggestions + rich notes (US3-6,8,9)**: Editing persists; typing
   a tag suggests existing tags; a note with bold/list/link renders laid out.
9. **Delete (US3-7)**: Delete asks for confirmation, then removes permanently.
10. **Import (US4-1..4)**: Import a browser bookmark file → items appear;
    **folders become tags**; **original dates preserved**; addresses already
    saved are **not duplicated**.
11. **Export (US4-5, FR-015)**: Export `html` → opens in a browser (tags as
    folders); export `json` → re-import into the app with **no loss of tags**
    (SC-008).
12. **Triage (US5)**: Mark unread → appears in unread pile; mark read → leaves
    it. Archive → leaves main list, found in archive, restore brings it back.
13. **Bulk incl. select-all-matching (US6)**: Hand-select several → apply a tag
    to all. Filter to a tag showing many matches → "select everything matching"
    → archive/delete the whole set in one action (delete confirmed once).
14. **Saved search (US7, if kept)**: Save "unread + tag cooking" under a name;
    clear filters; reopen the saved search → same results.

## Expected performance (from Success Criteria)

- Search/filter over ~1,000 bookmarks feels instant (< 200 ms).
- Import of ~1,000 bookmarks completes in a few seconds; all searchable.
- A bulk action over a 600-item filtered set is one operation.
