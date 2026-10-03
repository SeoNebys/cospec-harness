# Quickstart & Validation Guide: Bookmark Manager

This guide proves the feature works end-to-end. It references
[data-model.md](./data-model.md) and [contracts/api.md](./contracts/api.md)
rather than repeating details. Implementation code lives in the source tree and
`tasks.md`, not here.

## Prerequisites

- Node.js 24 and npm (provided by the shared image).
- Chromium via Playwright 1.61.0 (shared binaries at `/opt/playwright-browsers`).
- No external DB — SQLite file is created on first run under `data/`.

## Setup & run

```bash
npm install          # installs pinned deps (playwright/@playwright/test 1.61.0)
npm start            # starts the server on 0.0.0.0:4000
```

- App URL for the client review container: `http://maker:4000/`.
- The VM capture uses `http://127.0.0.1:4000/`.
- The page marks `data-harness-ready="true"` once the initial list (or empty
  state) has loaded.

Runtime declaration written to `/work/.harness/app.json`:

```json
{"kind": "application", "port": 4000, "path": "/", "start_command": ["npm", "start"], "start_cwd": "/work"}
```

## Automated tests

```bash
npm test             # node:test unit + integration
npm run test:e2e     # Playwright end-to-end flows
```

## Validation scenarios (map to spec acceptance criteria)

1. **Save with metadata (US1, FR-002/003)**: `POST /api/bookmarks` with a URL →
   201 with auto-collected title/description/icon/preview; edit title,
   description, and address via `PATCH` and confirm overrides persist.
2. **Duplicate opens existing (US2, FR-007/008/041)**: save the same URL (and a
   host-case/trailing-slash/default-port variant) again → 409 returning the
   existing bookmark; a fragment/query-different URL → new bookmark. Save a URL
   matching an archived bookmark → 409 with `archived:true` restore hint.
3. **Browse & tag-click filter (US3, FR-014/014a/015)**: `GET /api/bookmarks`
   lists title/description/tags/icon; `?tag=` filters instantly; opening a
   bookmark reaches the original page in a new tab.
4. **Notes & tag suggestions (US4/US5, FR-009-013)**: add a formatted note and
   confirm it round-trips sanitized; `GET /api/tags/suggest?q=` returns existing
   matches; selecting one reuses the tag (no near-duplicate).
5. **Search (US6, FR-017-020)**: run case-insensitive keyword, `"exact phrase"`,
   `#tag`, and `(#a OR #b) AND word NOT #c`; verify `"rock and roll"` treats AND
   as a literal word; malformed query → 400; archived items excluded.
6. **Read status & unread view (US7, FR-021/022)**: new bookmarks default unread;
   `?view=unread` shows only unread, non-archived items.
7. **Archive round-trip (US8, FR-023/024)**: archive → absent from default list,
   search, unread; present under `?view=archive`; restore → reappears with tags/
   note/read status intact.
8. **Bulk actions (US9, FR-025-027)**: select by ids and by "all matching"
   (`selector` with `q`); apply tag/read/archive; delete requires `confirm:true`
   and reports `affected`.
9. **Sorting & preferences (US10/US14, FR-028/039/040)**: switch `sort`; set
   `default_sort`, `items_per_page`, `text_size` via `PUT /api/preferences` and
   confirm they persist and paginate.
10. **Saved views (US11, FR-029/030)**: create a view from query + included/
    excluded tags; reopen via `/api/views/:id/results`; rename/delete.
11. **Preservation (US12, FR-031-034)**: `preserve {mode:"local"}` on a page →
    self-contained HTML served back; on a PDF URL → stored PDF; `archive_org`
    stores a snapshot reference; unreachable page/service → 502, bookmark
    unchanged.
12. **Import/export (US13, FR-035-037)**: import a Netscape `bookmarks.html`
    (titles/tags/dates retained); duplicates merge keeping existing fields and
    adding only missing tags; `GET /api/export` reproduces a valid file.

## Success-criteria checks

- SC-005/SC-006: restart the server; data intact; re-saving never duplicates.
- SC-002/SC-003: search over a seeded 1,000–5,000 bookmark set returns quickly.
- SC-009: confirm zero archived items leak into any non-archive view.
