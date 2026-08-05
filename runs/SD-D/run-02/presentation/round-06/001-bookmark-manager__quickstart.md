# Quickstart & Validation: Bookmark Manager

How to run the app locally and validate that the feature works end-to-end. Implementation
details live in `tasks.md` / the implementation phase; this is a run-and-verify guide.

## Prerequisites

- Node.js 20 LTS
- A modern desktop browser

## Setup & run

```text
# from repo root
(backend)  install deps, then start the local service   → serves the API + snapshot store
(frontend) install deps, then start the dev server       → opens the app in the browser
```

On first run the app creates `data/bookmarks.db` and the `data/snapshots/` store automatically.

## Validation scenarios (map to spec acceptance criteria)

1. **Save with auto-details (US1)**: Save a normal article URL. Expect a new bookmark whose
   title, description, icon, and preview were filled in without typing; edit the title and
   confirm it persists. Save the same URL again → the existing bookmark opens for editing, no
   duplicate.
2. **Browse, sort, open (US2)**: With several bookmarks, confirm the list shows title, address,
   and tags; switch sort (newest/oldest/title); click one and confirm it opens the web page.
3. **Search (US3)**: Search a keyword (case-insensitive across title/url/description/notes/tags);
   type a tag inline; try OR across tags, a NOT exclusion, a grouped expression, and a quoted
   exact phrase; confirm a no-match search shows the no-results state.
4. **Tags (US4)**: Add tags; begin typing a tag and confirm existing tags are suggested; filter
   by a tag.
5. **Edit / notes / delete (US5)**: Edit fields; write notes with a heading and a list and
   confirm formatting persists; delete a bookmark (with confirmation) and confirm it's gone.
6. **Read-later (US6)**: Mark to-read, open the read-later view, mark read, confirm it drops off.
7. **Archive (US7)**: Archive a bookmark → gone from main list and default search; find it in the
   archive; unarchive → it returns. Confirm archive never deletes.
8. **Snapshot (US8)**: Save a web page and a PDF link. Confirm the web page snapshot is readable
   and the PDF snapshot is the original file. (Optional) enable the archive opt-in and confirm
   saving still succeeds if submission fails.
9. **Bulk actions (US9)**: Select several (and "select all matching" a search); add/remove a tag,
   mark read/to-read, archive, and delete (with confirmation) across the selection.
10. **Import / export (US10)**: Import a browser bookmarks HTML file → entries appear, no
    duplicates for ones already saved; import a malformed file → clear error, nothing imported;
    export → a bookmark file is produced.
11. **Saved searches (US11)**: Save a tag+keyword search under a name; re-run it with one click;
    remove it.
12. **Preferences (US12)**: Set default sort and a larger text size; reopen the app; confirm both
    are still applied.

## Success-criteria checks

- Save a bookmark end-to-end in under 15s without typing details (SC-001).
- Locate a bookmark within a 500+ collection in under 10s via search/tag/sort (SC-002).
- Search/sort feel immediate (<1s) at ~1,000 bookmarks (SC-004).
- Close and reopen: every saved and archived bookmark is still present (SC-005).
- Import a 500-entry file with no duplicates created (SC-006).
- Open a saved snapshot while the original URL is unreachable and still read it (SC-007).
