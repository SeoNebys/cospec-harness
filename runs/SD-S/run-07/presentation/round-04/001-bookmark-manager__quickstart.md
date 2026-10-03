# Quickstart & Validation: Bookmark Manager

How to run the app and validate that the primary user journeys work end-to-end.
Implementation details live in `tasks.md`; this is a run/validation guide.

## Prerequisites

- Node.js 24 and npm (provided by the shared image).
- Playwright 1.61.0 with shared Chromium binaries (for E2E validation).

## Setup

```bash
npm install      # installs pinned dependencies from package.json
```

The local SQLite database file is created automatically on first run under
`data/bookmarks.db`.

## Run

```bash
npm start        # starts the server on 0.0.0.0:4000
```

- Application review URL: `http://maker:4000`
- VM capture URL: `http://127.0.0.1:4000`

The main app element sets `data-harness-ready="true"` once the initial list (or a
valid empty state) has loaded.

## Automated tests

```bash
npm test         # unit + API tests (node:test)
npm run test:e2e # Playwright end-to-end journeys (Chromium)
```

## Manual validation scenarios (map to spec)

1. **Save a bookmark (US1 / FR-001–003)**: Open the app, enter a valid address,
   save. Expect it to appear in the list with a title (page title, or the address
   as fallback). Submitting an empty or malformed address shows a clear error.
2. **Browse & find (US2 / FR-006–008)**: Save several bookmarks; confirm newest
   appears first. Type a keyword and confirm the list narrows to matches; a
   non-matching keyword shows the "no results" state. Activating a bookmark opens
   the page in a new tab.
3. **Edit & delete (US3 / FR-009–010)**: Edit a bookmark's title and confirm it
   persists after reload. Delete a bookmark; confirm the confirmation step is
   required and, once confirmed, it is gone after reload.
4. **Tags (US4 / FR-012)**: Add tags to a bookmark; filter by a tag and confirm
   only bookmarks carrying it are shown.
5. **Duplicate (FR-011)**: Save an address that already exists; expect a duplicate
   warning and no second entry.
6. **Persistence (FR-005 / SC-004)**: Restart the server (`npm start` again) and
   confirm all bookmarks are still present.
7. **Empty state (FR-013)**: With an empty database, confirm the friendly empty
   state invites saving the first bookmark.

## Expected outcomes

- All manual scenarios above pass.
- `npm test` and `npm run test:e2e` pass.
- Bookmark list is interactive within ~2 seconds for up to 500 bookmarks (SC-005).
