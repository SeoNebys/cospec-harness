# Quickstart & Validation Guide: Bookmark Manager

This guide proves the feature works end-to-end on the user's own machine. It
references [contracts/api.md](contracts/api.md) and [data-model.md](data-model.md)
rather than restating them. Exact commands are finalized during implementation.

## Prerequisites

- Node.js (LTS) installed locally.
- No accounts, network services, or hosting — the app runs entirely on this
  machine and stores data in a local SQLite file.

## Setup & run (single command intent)

1. Install dependencies (`npm install`).
2. Start the app (`npm run dev` or `npm start`).
3. Open the printed `http://localhost:<port>` in a browser.

The first launch creates the local database file and shows the empty-state guide
(FR-015).

## Validation scenarios (map to Success Criteria)

### V1 — Save a bookmark (User Story 1 · SC-001)

1. Paste a valid address, leave the title blank, save.
2. **Expect**: the bookmark appears in the list with an auto-derived title and its
   address, within seconds. Total time under 15s (SC-001).
3. Paste an invalid address (e.g. `not a url`), save.
4. **Expect**: rejected with a clear explanation of a valid address (FR-002).

### V2 — Browse & find (User Story 2 · SC-002, SC-003)

1. With several bookmarks saved, type a keyword into search.
2. **Expect**: the list narrows to bookmarks matching title, address, or tags;
   results appear within ~1s (SC-003).
3. Search for something that matches nothing.
4. **Expect**: a clear "no matches" message, not a blank screen (FR-015).
5. Open a bookmark.
6. **Expect**: the browser navigates to the saved address (FR-008).

### V3 — Organize with tags (User Story 3)

1. Add tags to a bookmark; filter the list by one tag.
2. **Expect**: only bookmarks carrying that tag are shown (FR-010).
3. Rename a tag applied to several bookmarks.
4. **Expect**: the new name shows on all of them (FR-009).

### V4 — Edit & delete with undo (User Story 4 · SC-006)

1. Edit a bookmark's title and tags; reload.
2. **Expect**: the changes persist (FR-011, SC-005).
3. Delete a bookmark; confirm; then choose undo.
4. **Expect**: confirmation was required (FR-012) and undo restores it (FR-013).

### V5 — Duplicate handling (SC-006)

1. Save an address that already exists.
2. **Expect**: a warning and an offer to open the existing bookmark; no duplicate
   is created (FR-014).

### V6 — Persistence (SC-005)

1. Stop and restart the app; reopen in the browser.
2. **Expect**: all saved bookmarks and tags are still present (FR-005).

## Automated checks (intent)

- Server unit/integration tests (Vitest): url validation, title fallback,
  duplicate detection, tag rename/remove propagation, soft-delete + undo,
  persistence.
- End-to-end test (Playwright): the V1→V2 primary journey (save → find → open).
