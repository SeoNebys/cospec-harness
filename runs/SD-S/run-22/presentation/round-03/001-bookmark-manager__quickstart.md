# Quickstart & Validation: Bookmark Manager

A run/validation guide proving the feature works end to end. Implementation details
live in `tasks.md` and the code; this file describes how to run and verify.

## Prerequisites

- Node.js 24 and npm (provided by the shared image).
- Playwright 1.61.0 with Chromium (browser binaries preinstalled at
  `/opt/playwright-browsers`).

## Setup

```bash
cd /work
npm install          # installs Express, better-sqlite3, playwright@1.61.0 (pinned)
```

The SQLite database at `data/bookmarks.db` is created and migrated automatically on
first server start.

## Run

```bash
npm start            # starts the server on 0.0.0.0:4000
```

Reviewed at `http://maker:4000/` (harness capture uses `http://127.0.0.1:4000`).
The page sets `data-harness-ready="true"` once the list (or empty state) is loaded.

The runtime descriptor `/work/.harness/app.json` declares:

```json
{"kind": "application", "port": 4000, "path": "/", "start_command": ["npm", "start"], "start_cwd": "/work"}
```

## Automated tests

```bash
npm test             # runs node:test unit + API tests
npx playwright test  # runs end-to-end browser flows (pinned 1.61.0)
```

## Manual validation scenarios (map to acceptance scenarios)

Each scenario references the API contract ([contracts/api.md](./contracts/api.md))
and data model ([data-model.md](./data-model.md)).

1. **Save a bookmark (US1)**: On an empty list, enter a valid address and save →
   the bookmark appears with a title and its address. Save an entry with no title →
   a readable title is derived. Submit an empty/invalid address → rejected with a
   clear message, no bookmark created.
2. **Browse & find (US2)**: With several bookmarks saved, open the app → all shown,
   newest first. Search a keyword → only matching bookmarks (title/address/tags)
   shown. Search something with no matches → empty-results state, not an error.
3. **Edit & delete (US3)**: Edit a bookmark's title/tags and save → updated values
   persist after reload. Delete a bookmark → confirmation prompt appears; after
   confirming, it disappears and stays gone after reload.
4. **Tags (US4)**: Assign a tag to two bookmarks, filter by that tag → only those
   two shown.
5. **Persistence (SC-003)**: Restart the server (`npm start` again) → previously
   saved bookmarks are still present.
6. **Duplicate warning (FR-012)**: Save an address that already exists → save
   succeeds and a duplicate warning is shown.

## Expected outcomes

- All manual scenarios behave as described; automated unit, API, and e2e tests
  pass. Bookmarks persist across restarts. Search/filter return within ~1 second
  with 1,000+ bookmarks (SC-005).
