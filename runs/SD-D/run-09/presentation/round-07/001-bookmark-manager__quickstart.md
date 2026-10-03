# Quickstart & Validation: Bookmark Manager

**Feature**: 001-bookmark-manager | **Date**: 2026-09-18 | **Phase**: 1

How to build, run, and validate the feature end-to-end. Details of the API and
data live in [contracts/openapi.yaml](./contracts/openapi.yaml),
[contracts/search-grammar.md](./contracts/search-grammar.md), and
[data-model.md](./data-model.md).

## Prerequisites

- Node.js 24 + npm (image default).
- Chromium at `/opt/playwright-browsers` (shared). Playwright pinned to `1.61.0`.
- No external services required to run; Internet Archive preservation and live
  metadata/snapshot capture need outbound network and degrade gracefully without.

## Setup & build

```bash
cd /work
npm install                 # installs deps; preserves lockfile
npm run build               # builds the frontend (Vite) into static assets
```

Do the install and build **before** requesting review; `npm start` only serves the
prepared app (per runtime rules).

## Run

```bash
npm start                   # serves API + frontend on 0.0.0.0:4000
```

- Client review URL: `http://maker:4000/`
- VM capture URL: `http://127.0.0.1:4000/`
- Data persists in `data/` (SQLite DB + `data/snapshots/`).
- The initial UI marks `data-harness-ready="true"` once the list (or its empty
  state) has loaded.

When ready for review, `/work/.harness/app.json` should read:

```json
{"kind": "application", "port": 4000, "path": "/", "start_command": ["npm", "start"], "start_cwd": "/work"}
```

## Test

```bash
npm test                    # Vitest unit + API (Supertest) tests
npm run test:e2e            # Playwright end-to-end flows (Chromium)
```

## Validation scenarios (map to spec user stories)

Run these against a fresh `data/` to confirm the feature works end-to-end.

1. **Save with reviewed auto-details (US1, SC-001)**: Enter a reachable URL. Expect
   the collected title/description/favicon/preview to appear **for review before
   committing**; edit the title, then save — confirm the edited value is what
   persists, and the whole save completes within ~15s. Then enter an unreachable/
   slow URL and confirm it returns **fallback details** promptly so you can save
   and edit later. After saving, confirm the background snapshot never changes the
   title/description you entered.
2. **Re-save opens existing (US2, FR-006)**: Add the same URL again (also try a
   trailing-slash / scheme / host-case variant). Expect the existing bookmark's
   edit view, no duplicate.
3. **Browse & search (US3, SC-002/003)**: With several bookmarks, verify the list
   shows title + description + favicon + tags. Run `react hooks`, `"react hooks"`,
   `#tag`, `a OR b`, `(a OR b) #t`, and `invoice #work`; confirm results match
   [search-grammar.md](./contracts/search-grammar.md). Confirm a malformed query
   (`react OR`) returns a clear error, not junk results. Open a result → original
   page opens in a new tab.
4. **Edit & organize (US4)**: Edit address, title, description, and a Markdown
   note; confirm the note renders formatted on view. Type a tag and confirm
   existing-tag suggestions. Delete a bookmark (with confirm) and confirm it is
   gone everywhere.
5. **Read-later & archive (US5, SC-007)**: New bookmark appears in Unread; mark
   read; archive it and confirm it leaves the normal list & search; find it in
   Archived; un-archive and confirm it returns unchanged.
6. **Sort & bulk (US6, SC-008)**: Sort by title and by date. Select several, and
   "select all matching" a search; apply bulk add-tag and bulk archive; confirm
   all affected. Bulk delete requires confirmation.
7. **Import/export (US7, SC-004/005)**: Import a Netscape bookmarks HTML fixture;
   confirm titles, addresses, dates, and folder→tags preserved and duplicates
   skipped with an added-vs-skipped count. Export; confirm the file re-imports
   into a browser and round-trips titles/tags/dates.
8. **Snapshots (US8, SC-006)**: Save a normal page → snapshot stored as a
   self-contained single HTML file and openable standalone. Save a PDF URL →
   stored and opens as PDF. Trigger Internet Archive preservation → a web-archive
   link is stored (or a clear "unavailable" message if offline).
9. **Saved filters (US9)**: Save a filter = search + include tag + exclude tag;
   re-apply and confirm the exact set; edit/delete it and confirm bookmarks are
   untouched.
10. **Preferences (US10)**: Change default sort, items-per-page, and font size;
    reload and confirm they persist and apply.

## Fixtures

- A small Netscape bookmarks HTML file (with folders + `ADD_DATE`) for import
  tests, and a local static HTML page + a small PDF for metadata/snapshot tests,
  live under the test fixtures directory so network-dependent steps are
  deterministic in CI.
