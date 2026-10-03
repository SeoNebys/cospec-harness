# Quickstart & Validation: Bookmark Manager

A run-and-validate guide proving the feature works end-to-end. Implementation details
live in [data-model.md](./data-model.md), [contracts/api.md](./contracts/api.md), and
`tasks.md`.

## Prerequisites

- Node.js 24 and npm (provided by the shared image).
- Dependencies installed: `npm install` (installs Express, better-sqlite3, and
  Playwright pinned to 1.61.0).

## Run the app

```bash
npm install
npm start
```

- Server listens on `0.0.0.0:4000` and serves the UI at `/`.
- Reviewers reach it at `http://maker:4000`; VM capture uses `http://127.0.0.1:4000`.
- The UI marks its ready element with `data-harness-ready="true"` once the initial
  list (or empty state) has loaded.

## Validation scenarios (map to spec acceptance criteria)

### Scenario A — Save a bookmark (User Story 1 / FR-001–004, FR-014)
1. Open the app; observe the empty state inviting a first bookmark.
2. Enter `example.com` (no scheme) with a blank title and save.
3. Expect: a new bookmark appears, address normalised to `https://example.com`, title
   auto-filled (page title or the address), dated today.
4. Enter `not a url` and save → expect a clear rejection, no bookmark created.

### Scenario B — Browse and open (User Story 2 / FR-006, FR-007, FR-013)
1. With bookmarks saved, reload the app → all appear newest-first with title + address.
2. Click a bookmark → its page opens in a new browser tab.
3. Empty database → empty state is shown, not a blank page.

### Scenario C — Edit and delete (User Story 3 / FR-008, FR-009)
1. Edit a bookmark's title and save → the list shows the new title; reload confirms it
   persisted.
2. Delete a bookmark → a confirmation is required; after confirming it disappears and
   does not return after reload.

### Scenario D — Search and tag filter (User Story 4 / FR-011, FR-012, FR-013)
1. Save several bookmarks with different titles and tags.
2. Type a search term → only matching bookmarks remain.
3. Select a tag filter → only bookmarks with that tag remain.
4. Apply a filter that matches nothing → a "no results" state appears and can be cleared.

### Scenario E — Duplicate & persistence (FR-010, FR-005, SC-003)
1. Save an address, then save the same address again → expect a duplicate warning; no
   silent duplicate is created.
2. Stop and restart the server → all bookmarks are still present and openable.

## Automated checks

```bash
npm test                 # node --test: url normalisation, dedupe, title fallback, API
npx playwright test      # end-to-end journeys A–E (Playwright 1.61.0)
```

## Success criteria coverage

- SC-001 save < 20s → Scenario A. SC-002 find among 200 < 10s → Scenario D (seeded).
- SC-003 persistence → Scenario E. SC-004 first-attempt save+reopen → Scenarios A+B.
- SC-005 invalid rejected → Scenario A step 4.
