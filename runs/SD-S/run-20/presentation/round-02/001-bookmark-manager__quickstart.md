# Quickstart & Validation: Bookmark Manager

**Feature**: 001-bookmark-manager | **Date**: 2026-09-24

How to run the app and validate that each user story works end to end. See
`contracts/api.md` for the API and `data-model.md` for entity rules; this guide
does not restate them.

## Prerequisites

- Node.js 24 and npm (provided by the runtime image).
- Playwright 1.61.0 with Chromium (provided; do not download another browser
  revision).

## Setup & run

```bash
cd /work
npm install          # installs pinned dependencies (preserves lockfile)
npm start            # starts the server in the foreground on 0.0.0.0:4000
```

- Review URL (client): `http://maker:4000/`
- VM capture URL: `http://127.0.0.1:4000/`
- The app marks its root element `data-harness-ready="true"` only after the
  initial UI and current bookmarks have loaded (including the empty state).

## Automated validation

```bash
cd /work
npm test             # node:test API/unit suite
npm run test:e2e     # Playwright (@playwright/test 1.61.0) UI journeys
```

## Manual validation by user story

### Story 1 — Save a bookmark (P1)

1. Open `http://maker:4000/`; the empty state is shown.
2. Enter `example.com` (no scheme) with a title, save.
3. Expect: it appears at the top of the list, normalized to `https://example.com`.
4. Save an entry with a blank title → stored with the URL as its title.
5. Save `not a url` → rejected inline; no bookmark added.

### Story 2 — Browse & open (P1)

1. With bookmarks saved, reload the page → all are listed, newest first.
2. Click a bookmark → its target opens in a new browser tab.
3. Delete all bookmarks → the friendly empty state returns.

### Story 3 — Edit & delete (P2)

1. Edit a bookmark's title, save, reload → new title persists.
2. Delete a bookmark, confirm → it disappears and stays gone after reload.
3. Start a delete, cancel → the bookmark is unchanged.

### Story 4 — Organize & find (P3)

1. Add different tags to two bookmarks.
2. Select a tag filter → only matching bookmarks show; clear it → all return.
3. Type part of a title in search → list narrows; unmatched term → "no matching
   bookmarks" message with a way to clear.
4. Combine a tag filter and a search term → results satisfy both (AND).

## Expected outcomes (traceability)

- Story 1 → FR-001, FR-002, FR-003, SC-001.
- Story 2 → FR-005, FR-006, FR-012, SC-002, SC-004.
- Story 3 → FR-007, FR-008.
- Story 4 → FR-009, FR-010, FR-011, FR-012, SC-003.
