# Quickstart & Validation: Bookmark Manager

A run-and-validate guide proving the feature works end-to-end. Implementation
details live in `tasks.md`; entity/field definitions in
[data-model.md](./data-model.md); endpoints in [contracts/api.md](./contracts/api.md).

## Prerequisites

- Node.js 24 + npm (shared image).
- Shared Chromium at `/opt/playwright-browsers`; `playwright`/`@playwright/test`
  pinned to `1.61.0` (do not download another browser revision).
- Data directory `data/` is created on first run (SQLite DB + `preserved/`).

## Setup & run

```bash
npm install          # installs express, better-sqlite3, playwright@1.61.0, cheerio, markdown-it, sanitize-html
npm start            # node src/server/index.js — listens on 0.0.0.0:4000
```

The client is reachable at `http://maker:4000` (VM capture uses
`http://127.0.0.1:4000`). The app writes `/work/.harness/app.json`
(`kind: application`, port `4000`) and marks its shell `data-harness-ready="true"`
once the initial UI and bookmark list have loaded.

## Tests

```bash
npm test             # node:test — unit (search parser, normalizeUrl, notes, import/export) + integration (API on a temp DB)
npm run test:e2e     # @playwright/test — smoke of the primary flows
```

## Validation scenarios (map to spec acceptance criteria)

1. **Save + auto-metadata (US1)**: POST a URL → list shows the new bookmark;
   within a moment its title/description/icon/preview populate; editing the title
   persists across reload.
2. **Duplicate routing (US2, SC-003)**: POST the same URL again → response marks
   `duplicate: true` and returns the existing bookmark; the list still has exactly
   one entry, unchanged.
3. **Tags + suggestions + filter (US3)**: add tags to bookmarks; typing suggests
   existing tags; filtering by a tag narrows the list.
4. **Search semantics (US4)**: verify case-insensitive match; `"exact phrase"`;
   `#tag`; `AND`/`OR`/`NOT`; grouping; `foo #news` behaves as implicit AND;
   `"NOT ready"` matches the literal words, not an operator; malformed query → 400.
5. **Read-later (US5)**: mark unread → appears in unread view; mark read → leaves it.
6. **Archive (US6)**: archive → gone from normal browse + search, present in
   archive view; restore → returns; permanent delete requires confirmation.
7. **Sort / bulk / saved views (US7)**: change sort order; select-all-matching and
   bulk add a tag / remove a tag / mark read / archive; save a search+tag
   combination as a named view and reopen it.
8. **Rich notes (US8)**: save a formatted note; view renders the formatting.
9. **Preservation (US9)**: a normal page yields an openable self-contained `.html`
   copy; a PDF link yields the original `.pdf`; requesting Internet Archive records
   a reference (or reports failure without blocking save).
10. **Import/export (US10)**: import a Netscape bookmark file preserving titles,
    tags, original dates, reconciling existing addresses; export produces a valid
    re-importable file.
11. **Preferences (US11)**: set default sort, items-per-view, text size; reload
    and confirm they apply.

## Expected outcomes

- Saving returns immediately; metadata/preservation/Internet Archive complete
  asynchronously and never block or fail the save (FR-005/FR-029).
- No duplicate is ever created for a repeated address (SC-003).
- Archived items appear in 0% of normal/search results and 100% of the archive
  view (SC-007).
- Browsing/sort/filter/search stay under 1s with 1,000+ bookmarks (SC-004).
- Note: the Internet Archive is an external service and may be unavailable in the
  offline review environment; such failures are reported honestly, not hidden.
