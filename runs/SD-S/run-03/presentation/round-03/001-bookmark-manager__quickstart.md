# Quickstart & Validation: Bookmark Manager

**Feature**: 001-bookmark-manager | **Date**: 2026-09-16

How to run the app and validate that the feature works end-to-end. See
[plan.md](./plan.md), [data-model.md](./data-model.md), and
[contracts/api.md](./contracts/api.md) for details.

## Prerequisites

- Node.js 24 and npm (provided by the environment).
- No external services required (persistence is a local SQLite file).

## Setup & run

```bash
cd /work
npm install          # installs Express, better-sqlite3, Playwright 1.61.0 (dev)
npm start            # starts the server on 0.0.0.0:4000 (foreground)
```

Review URL (client): `http://maker:4000/`. VM capture: `http://127.0.0.1:4000/`.

The app also declares itself to the harness via `/work/.harness/app.json`
(`kind: application`, port 4000, start command `["npm","start"]`). The root UI
sets `data-harness-ready="true"` once the initial list/empty state has loaded.

## Automated tests

```bash
npm test             # node:test unit tests (URL validation/normalization, title extraction)
npm run test:e2e     # Playwright 1.61.0 end-to-end flows
```

## Manual validation scenarios

Each maps to acceptance scenarios / success criteria in the spec.

1. **Save a bookmark (US1, SC-001)**: From the empty state, add
   `https://example.com` with no title → it appears in the list with a derived
   title and the address. Reload → still present (SC-002).
2. **Reject a bad address (edge case, SC-004)**: Try to save `not a url` → clear
   error, nothing added.
3. **Duplicate warning (FR-009)**: Save `https://example.com` again → "already
   bookmarked" warning, no second entry.
4. **Browse & open (US2)**: With several saved, click a title → original page
   opens in a new tab. With none saved, the empty state invites a first add.
5. **Edit & delete (US3)**: Edit a title → change persists after reload. Delete a
   bookmark → confirmation prompt, then it is gone and stays gone after reload.
6. **Tags & search (US4, SC-003)**: Tag two bookmarks `tech`; filter by `tech` →
   only those two show. Search a keyword → matching bookmarks show; a
   non-matching query shows a clear no-results state.

## Expected outcomes

- Saved bookmarks survive reloads/restarts (100%, SC-002).
- Malformed addresses never reach the saved list (SC-004).
- A specific bookmark among ~100 is found in seconds via search/tag (SC-003).
