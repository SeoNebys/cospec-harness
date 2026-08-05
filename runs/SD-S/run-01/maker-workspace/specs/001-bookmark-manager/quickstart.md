# Quickstart & Validation: Bookmark Manager

A validation/run guide for the local bookmark manager. Implementation details
live in `tasks.md` and the implementation phase, not here.

## Prerequisites

- Node.js 20+ and npm installed.
- A modern desktop web browser.

## Setup

```sh
npm install
```

## Run (development)

```sh
npm run dev
```

Then open the printed local URL (e.g. `http://localhost:5173`) in your browser.
The app runs entirely in the browser; there is no server or account. Data is
stored locally in the browser (IndexedDB) on your machine.

## Build (static bundle)

```sh
npm run build      # produces a static bundle in dist/
npm run preview    # serves the built bundle locally to verify
```

## Automated tests

```sh
npm test           # unit + component tests (Vitest / React Testing Library)
npm run test:e2e   # Playwright smoke flow: save → find → open
```

## Manual validation scenarios

Each maps to a user story / success criterion in the spec.

1. **Save a bookmark (US1, SC-001)**: Open the app, enter a web address, save.
   The bookmark appears in the list. Reload the page — it is still there.
2. **Reject bad input (FR-003)**: Try to save with an empty or malformed address.
   The app refuses and explains an address is required/invalid.
3. **Browse & open (US2)**: With bookmarks saved, click one — the original page
   opens in the browser. Open the app with nothing saved — a friendly empty
   state invites adding the first bookmark.
4. **Edit & delete (US3)**: Edit a bookmark's title and save — the change
   persists across reload. Delete a bookmark — you are asked to confirm, then it
   disappears and does not return after reload.
5. **Organize & find (US4, SC-002)**: Add tags to several bookmarks. Filter by a
   tag — only matching bookmarks show. Search by keyword — matches on title,
   address, or tags appear. Search for something absent — a clear "no results"
   state shows.
6. **Duplicate warning (FR-013)**: Save an address that is already bookmarked —
   the app warns about the duplicate but still lets you save.
7. **Persistence (SC-003)**: Save several bookmarks, close the browser, reopen
   the app — all bookmarks are still present.

## Expected outcomes

- No network requests are required for any of the above (fully offline).
- All data remains on the local device; nothing is uploaded and no login is
  required.
