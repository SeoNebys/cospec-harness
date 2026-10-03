# Phase 1 Quickstart & Validation: Bookmark Manager

Validates the feature end-to-end against [spec.md](./spec.md). See
[data-model.md](./data-model.md) and [contracts/api.md](./contracts/api.md) for
details; this guide covers setup, run, and the scenarios that prove the flows.

## Prerequisites

- Node.js 24 and npm (provided by the shared image).
- Playwright 1.61.0 with the shared Chromium at `/opt/playwright-browsers`.

## Setup & run

```bash
npm install                 # installs Express, better-sqlite3, playwright@1.61.0
npm start                   # starts server on 0.0.0.0:4000 (creates data/ on first run)
```

Open `http://maker:4000` (review) — the VM capture uses `http://127.0.0.1:4000`.
The initial UI marks its ready element `data-harness-ready="true"` once the view
and its data have loaded (including a valid empty state).

## Automated checks

```bash
node --test                 # unit + integration (URL normalization, model, API)
npx playwright test         # end-to-end browser flows
```

## Validation scenarios (map to acceptance criteria)

1. **Save (US1)**: submit a valid URL → appears in the main list and persists
   after reload. Submitting without a URL is rejected. Saving an address that
   already exists opens that existing bookmark for editing (no duplicate).
2. **Browse & open (US2)**: bookmarks list with title + address; activating one
   opens the original page in a new tab; empty collection shows the empty state.
3. **Edit & delete (US3)**: edit title/address/description/tags and persist;
   changing an address to an existing one is prevented and routes to that
   bookmark; delete removes it after confirmation and it does not reappear.
4. **Read-later (US4)**: new bookmark is unread; the unread view lists only
   unread items; marking read removes it from that view; state survives reload.
5. **Archive & restore (US5)**: archiving removes a bookmark from the main and
   unread views without deleting; the archive view lists only archived items;
   restore returns it to the main list; permanent delete from archive works.
6. **Search & tags (US6)**: keyword search narrows to matching title/address/
   description/tags; tag filter narrows to a selected tag; no matches shows the
   "no results" state.

## Success criteria checks

- Save-to-visible under 20s (SC-001); search over 1,000 seeded bookmarks under
  1s (SC-003); read/archive toggle reflected under 1s (SC-006).
- No data loss across restarts: create bookmarks, restart `npm start`, confirm
  all present with correct read/archive state (SC-004, SC-007).
