# Quickstart & Validation Guide: Bookmark Manager

Validates the feature end-to-end. See [data-model.md](./data-model.md),
[contracts/rest-api.md](./contracts/rest-api.md), and
[contracts/search-grammar.md](./contracts/search-grammar.md) for details.

## Prerequisites

- Node.js 24, npm (in the shared image).
- Playwright pinned to 1.61.0; reuse shared browsers at `/opt/playwright-browsers`
  (do not download another revision).

## Setup

```bash
cd /work
npm install                 # installs deps; keep package-lock.json
npm run migrate             # creates data/bookmarks.db from src/db/migrations
```

## Run (review environment)

```bash
npm start                   # Express serves API + SPA on 0.0.0.0:4000
```

- App is reachable at `http://maker:4000/` (client) / `http://127.0.0.1:4000/`
  (VM capture). The SPA sets `data-harness-ready="true"` once the initial view
  and data have loaded.
- `/work/.harness/app.json` declares:
  `{"kind":"application","port":4000,"path":"/","start_command":["npm","start"],"start_cwd":"/work"}`.

## Automated tests

```bash
npm test                    # node --test: unit (search parser, url, markdown, import/export) + integration (api+db)
npm run test:e2e            # Playwright 1.61.0 UI flows per user story
```

## Manual validation scenarios (map to user stories)

1. **Save + metadata + adjust (US1, FR-003a/004)**: Enter a URL → title,
   description, favicon, preview are fetched and shown editable → adjust the
   title → save → row shows adjusted title, description, favicon. Save an
   unreachable URL → still saved with derived title + "metadata unavailable".
2. **Duplicate → edit (US2, FR-005)**: Save the same URL again → the existing
   bookmark opens for editing; no second entry appears.
3. **Edit fields + Markdown (US3, FR-006/008)**: Edit address/title/description/
   tags/note (Markdown) → reload → changes persist; note renders formatted.
4. **List, sort, open (US4)**: Rows show title/description/tags/favicon; switch
   sort to Title A–Z and confirm reorder; open a bookmark in a new tab.
5. **Advanced search (US5)**: Run each row of the search-grammar examples table
   and confirm results; confirm `"AND"` is literal and `report #news` requires
   both; confirm `"foo` reports an invalid query.
6. **Read-later (US6)**: Mark unread → appears in Unread view; mark read →
   leaves it.
7. **Tags + suggestions + filter (US7)**: Typing a tag suggests existing tags;
   include one tag and exclude another and confirm the filtered list.
8. **Bulk actions (US8)**: Select several rows, add a tag → all gain it; with a
   search active, "select all matching" then archive → every match (not just the
   page) leaves the normal list.
9. **Archive vs delete (US9)**: Archive → hidden from normal lists/searches,
   present in Archive view → restore returns it; permanent delete (confirm) →
   gone everywhere.
10. **Saved searches (US10)**: Save a query + include/exclude tags → revisit
    reproduces results → delete it (bookmarks unaffected).
11. **Preservation (US11)**: Preserve an HTML page → open the stored
    self-contained copy offline; preserve a PDF link → original PDF stored;
    request Internet Archive → snapshot link stored; force a failure → bookmark
    unaffected, user informed.
12. **Import/export (US12)**: Import a Netscape bookmark HTML file → titles,
    tags, dates preserved, duplicates skipped, unreadable entries reported;
    export → file re-imports without loss.
13. **Preferences (US13)**: Set default sort, items-per-page, text size → reload
    → still applied.

## Expected outcomes (success criteria)

- Save with auto-metadata < 15s (excluding unreachable pages) — SC-001.
- Locate one bookmark among ≥1,000 in < 5s; search/filter update < 1s — SC-002/004.
- All bookmarks/tags/notes/states/saved-searches persist across restart — SC-003.
- Boolean/phrase/tag searches match the defined logic in all acceptance
  cases — SC-005.
- One bulk operation covers ≥200 matches — SC-006.
- Import preserves 100% of titles/tags/dates for valid entries; export
  round-trips — SC-007.
