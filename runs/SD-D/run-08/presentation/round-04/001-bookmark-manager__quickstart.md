# Quickstart & Validation Guide: Bookmark Manager

How to run the app and validate that the feature works end-to-end. Implementation
details live in `tasks.md` (Phase 2) and the code; this guide is for running and
verifying.

## Prerequisites

- Node.js 24 and npm (provided by the runtime image).
- Chromium via Playwright browsers at `/opt/playwright-browsers` (shared). Do not
  download a second browser revision; `playwright` / `@playwright/test` are pinned to
  `1.61.0`.

## Setup & run

```bash
npm install          # root: installs backend + frontend workspaces, preserves lockfile
npm run build        # builds the frontend to static assets
npm start            # starts Express serving API + SPA on 0.0.0.0:4000
```

The app is reachable in the review environment at `http://maker:4000` (VM capture
uses `http://127.0.0.1:4000`). The initial UI marks `data-harness-ready="true"` once
the list (or a valid empty state) has loaded.

Runtime data (SQLite DB + snapshots) is created under `data/` on first run.

`/work/.harness/app.json`:

```json
{"kind": "application", "port": 4000, "path": "/", "start_command": ["npm", "start"], "start_cwd": "/work"}
```

## Automated tests

```bash
npm run test:unit    # vitest: search parser, URL normalization, import/export mapping
npm run test:e2e     # Playwright Test (1.61.0): user-story scenarios
```

## Validation scenarios (map to user stories)

Each scenario proves one approved story; see `spec.md` for full acceptance criteria.

1. **Save + auto-enrichment (US1, P1)**: Save a valid URL → bookmark appears; title,
   description, favicon, preview populate; snapshot moves `pending → ready`. Edit
   title/description/address/tags/note → changes persist.
2. **Duplicate on save (US2, P1)**: Save the same URL again (and a trailing-slash /
   host-case variant) → no duplicate; taken to the existing bookmark to edit.
3. **Browse, sort, open (US3, P1)**: List shows title, description, address, favicon,
   tags, preview; change sort → reorders; open → new tab.
4. **Search (US4, P1)**: Verify `word`, `#tag`, `"phrase"`, `word #tag` (implicit
   AND), `word OR #tag`, mixed-case `and/or/not`, quoted operator-as-text, and a
   grouped boolean query; malformed query → clear error; no matches → no-results
   state; archived excluded.
5. **Read-later (US5, P2)**: New bookmark is NOT unread; mark "read later" → appears
   in unread view; mark read → leaves it; toggle back.
6. **Tags + suggestions (US6, P2)**: Add/remove tags; typing suggests existing tags;
   selecting a suggestion reuses the tag.
7. **Markdown notes (US7, P2)**: Add a Markdown note → renders formatted and safely.
8. **Bulk & view-wide (US8, P2)**: Select several → add tags / remove tags / mark
   read-unread / archive / delete (with confirm); act on all results in the current
   filtered view.
9. **Archive vs delete (US9, P2)**: Archive → leaves list & search, shows in archive
   view; restore → returns; delete → gone permanently.
10. **Saved views (US10, P3)**: Save query + include/exclude tags as a named view;
    reopen reproduces results; rename/delete.
11. **Import/export (US11, P3)**: Import a Netscape bookmark HTML file → titles, tags,
    original dates preserved, no duplicates; export → same format preserving them.
12. **Snapshots + Internet Archive (US12, P3)**: Snapshot captured and viewable; a PDF
    URL stored as PDF; Internet Archive option records a reference; snapshot/archive
    failure is surfaced, not silent, and does not block saving.
13. **Preferences (US13, P3)**: Change default sort, items shown, font size → persist
    across reload.

## Notes for review

- The Internet Archive step depends on external network; in an offline review it
  fails gracefully and the rest of the app is unaffected (FR-041).
- For COSPEC-style visual review, post-action screenshots are saved under
  `prototypes/` and named in the review guidance.
