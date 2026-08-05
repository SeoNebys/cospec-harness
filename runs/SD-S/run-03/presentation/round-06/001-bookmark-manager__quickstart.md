# Quickstart & Validation Guide: Bookmark Manager

How to run the app locally and validate that it satisfies the spec. This is a
run/validation guide — implementation lives in `tasks.md` and the code.

## Prerequisites

- Node.js 20 LTS or newer installed.
- A modern desktop web browser.

## Setup

```bash
npm install          # install dependencies
npm run dev          # start the local server (serves API + frontend)
```

Then open the printed local URL (e.g. `http://localhost:3000`) in a browser.
The SQLite database file is created automatically on first run under `data/`.

## Running tests

```bash
npm test             # run Vitest unit + integration suites once
```

Integration tests use Supertest against the API and mirror the spec's acceptance
scenarios. See [contracts/api.md](./contracts/api.md) and
[data-model.md](./data-model.md) for the behaviours under test.

## Manual validation scenarios

Each maps to a user story / acceptance scenario in [spec.md](./spec.md).

### Story 1 — Save a bookmark (P1)
1. From the empty state, add `https://example.com` with no title.
   - Expect: a new item appears with an auto-fetched title (or the URL as label if the title can't be fetched).
2. Click the item.
   - Expect: the page opens in the browser.
3. Try to save `not a url`.
   - Expect: a clear rejection message; nothing is added.
4. Save `https://example.com` again.
   - Expect: a duplicate warning; no silent second copy (confirm to keep it if desired).

### Story 2 — Browse & search (P2)
1. Save several bookmarks, then type a term present in one title/note/tag.
   - Expect: only matching items remain visible.
2. Search for something that matches nothing.
   - Expect: an empty-result message (not an error).
3. Clear the search box.
   - Expect: the full list returns.

### Story 3 — Tags & notes (P3)
1. Add tags `reading` and `reference` and a note to a bookmark.
   - Expect: tags and note show with the bookmark.
2. Filter by tag `reading`.
   - Expect: only bookmarks with that tag are shown; unrelated ones hidden.

### Story 4 — Edit & delete (P3)
1. Edit a bookmark's title and save; reload the page.
   - Expect: the new title persists (validates FR-005 persistence too).
2. Delete a bookmark and confirm.
   - Expect: it disappears from the list. Cancelling the confirmation leaves it in place.

## Success-criteria checks

- **SC-004 (persistence)**: after step 1 of Story 4, stop the server, restart, reload — all bookmarks and edits are still present and openable.
- **SC-002 / SC-003 (scale)**: with ~1,000 bookmarks loaded, search and tag filtering return within ~1 second.
