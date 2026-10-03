# Quickstart & Validation: Bookmark Manager

A run/validation guide proving the feature works end-to-end. Implementation
details live in `tasks.md` (created by `/speckit-tasks`) and the code; this file
only shows how to run and verify.

## Prerequisites

- Node.js 24 + npm (project image).
- Playwright 1.61.0 with the shared Chromium at `/opt/playwright-browsers`
  (already installed). Do not download a second browser revision.
- Outbound internet is required only for metadata capture, offline copies, and
  Internet Archive preservation. Without it, those features report their
  degraded/unavailable status (by design) and saving still works.

## Setup & run

```bash
cd /work
npm install          # installs express, better-sqlite3, playwright@1.61.0, etc.
npm start            # node server/index.js → listens on 0.0.0.0:4000
```

- App: `http://maker:4000` (client) / `http://127.0.0.1:4000` (VM capture).
- The UI sets `data-harness-ready="true"` once the initial list (or empty state)
  and preferences have loaded.
- Harness manifest (`/work/.harness/app.json`):
  ```json
  {"kind": "application", "port": 4000, "path": "/", "start_command": ["npm", "start"], "start_cwd": "/work"}
  ```

## Automated tests

```bash
cd /work
npm test                     # node:test unit tests (search parser, netscape round-trip)
npx playwright test          # @playwright/test 1.61.0 e2e for primary flows
```

## Validation scenarios (map to spec acceptance criteria)

Run these in the UI (or via the referenced API in `contracts/rest-api.md`).

1. **Save with auto details, reviewed before confirm (US1, FR-002/003/004/005/006/029)**
   - Enter a valid URL → a review step shows the auto-collected title,
     description, favicon, and preview; edit the title/description, then confirm →
     the bookmark is created immediately with the reviewed values.
   - If retrieval fails or is slow, the review step shows fallback details (title
     from the URL) and you can still continue and confirm.
   - After confirm, the offline copy is attempted asynchronously (does not delay
     the save); if it fails the bookmark shows "offline copy unavailable".
   - Re-enter the same URL → the app opens the existing bookmark for editing (no
     duplicate). Submit an empty/garbage URL → rejected, nothing saved.

2. **Browse, sort, rich rows (US2, FR-008/010)**
   - Each row shows title, description, tags, favicon. Sort by title and by date
     added, ascending/descending.

3. **Advanced search (US2, FR-012–016)** — see `contracts/search-query-grammar.md`
   - Case-insensitive word match; `"exact phrase"`; `#tag`;
     `(#news OR #blog) AND climate NOT opinion`; and `"and"` matched as a literal
     word (quoted operator). No-match query shows the "no results" state.

4. **Read-later (US3, FR-021/022)**
   - New bookmark starts unread; unread view lists only unread; mark read removes
     it from the unread view.

5. **Edit & delete (US4, FR-017/020)**
   - Edit fields persist; delete removes the bookmark (with confirm/undo) and it
     stays gone after reload.

6. **Tags + suggestions + filter (US5, FR-018/019)**
   - Typing a tag suggests existing tags; add/remove tags; filter to one tag shows
     only matching bookmarks.

7. **Bulk actions (US6, FR-023/024)**
   - Select several, and separately "select all matching" the current search;
     add/remove tags, mark read/unread, archive, delete apply to the whole set
     (including off-screen matches).

8. **Archive (US7, FR-025/026)**
   - Archive hides from normal list/search; archive view shows only archived;
     restore returns it to the normal list. Archive is clearly distinct from
     delete.

9. **Formatted notes (US8, FR-027)**
   - Apply bold + a bulleted list in notes; view renders the formatting (not raw
     markup); persists after reload; malformed/hostile markup is sanitized.

10. **Saved filters (US9, FR-028)**
    - Save a query + included/excluded tags as a named filter; apply it and
      confirm the resulting list; edit/delete the filter; persists across reload.

11. **Preservation (US10, FR-029/030)**
    - A normal page yields a viewable offline copy; a PDF URL is stored/served as
      PDF; manual Internet Archive action records a snapshot link (or reports
      failed/pending when the service is unreachable — retryable).

12. **Import / export (US11, FR-031/032, SC-005)**
    - Import a browser bookmark HTML file → titles, tags, saved dates retained;
      duplicates not re-created. Export → a browser-openable HTML file that
      round-trips back with the same titles/tags/dates.

13. **Preferences (US12, FR-033)**
    - Set default sort, density, and text size; the list reflects each and the
      settings persist across reload/new session.

## Success-criteria checks

- SC-001: first save (with auto details) under 30s.
- SC-002: find a bookmark among 100+ under 10s via search/filter/saved filter.
- SC-003: 100% retention after `npm start` restart.
- SC-004: bulk action over 50 items under 15s.
- SC-005: import/export round-trip retains 100% of titles/tags/dates.
- SC-006: list/search/sort/bulk responsive (<~1s) with 500+ bookmarks.
