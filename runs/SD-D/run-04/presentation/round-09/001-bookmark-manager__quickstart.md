# Quickstart & Validation Guide: Bookmark Manager

How to run the app locally and validate that each user story works end-to-end. This
is a run/validation guide — implementation details live in `tasks.md` and the code.

## Prerequisites

- Node.js 20 LTS and a package manager (npm).
- A modern browser.

## Setup & run

```bash
npm install
npm run dev          # starts the local backend (serves API + SPA) and Vite
# then open the printed http://localhost:<port> in your browser
```

The database file is created automatically on first run under a local app-data
directory; no separate database setup is required. Closing the terminal stops the
app; your bookmarks remain in the database file (FR-022, SC-004).

## Automated checks

```bash
npm test             # Vitest unit + integration (in-memory SQLite)
npm run test:e2e     # Playwright end-to-end flows (US1–US5)
```

## Manual validation scenarios (map to spec user stories)

### US1 — Save with rich preview (P1)
1. Paste a URL of a page that publishes Open Graph tags; save.
2. **Expect**: the card appears immediately; within a few seconds it fills in
   description, site icon, and preview image (FR-005, SC-006). Saving felt instant
   (SC-001).
3. Save a URL with no scheme (`example.com`) → it is normalized and saved (FR-002).
4. Save gibberish → rejected with a message, nothing saved (FR-002).
5. Edit the auto-description to your own text → your text persists (FR-006).

### US2 — Open, browse, find (P2)
1. Click a bookmark → its page opens in a new tab (FR-008).
2. Type a term, then a `"quoted phrase"` → list narrows; case doesn't matter
   (FR-009/FR-010).
3. Tag filter "*recipes* or *dinner*, but not *dessert*" → results match the worked
   example in `contracts/filter-model.md` (FR-011).
4. Clear the filter → full list returns (FR-011). A no-match filter → "no results"
   state (FR-024).

### US3 — Organize, edit, tidy (P3)
1. Edit a bookmark's **address**, title, notes, tags; save → persists (FR-013).
2. Type a tag → previously used tags are suggested (FR-012).
3. Notes with a heading, a bullet list, and a link render formatted (FR-018).
4. Change sort to oldest / by title (FR-014).
5. Select several bookmarks (and try "select all showing") → tag / archive / delete
   the batch; delete asks one confirmation (FR-019/FR-020).
6. Archive an item → it leaves the main list, appears in the archived view, and can
   be restored (FR-016). Delete → gone after confirm (FR-017).

### US4 — Read-later shortlist (P3)
1. Flag two items "read later"; open the read-later view → only those show (FR-015).
2. Clear one flag → it leaves that view but stays in the collection (FR-015).

### US5 — Saved searches (P3)
1. Build a text + tag filter; save it with a name (FR-021).
2. Clear everything, then apply the saved search → the filter is restored and live
   results show (FR-021).
3. Rename / remove the saved search → change persists across restart (FR-021/FR-022).

### US6 — Back up and move the collection (P2)
1. With several bookmarks saved, click **Export** → a single portable `.json` file is
   downloaded (open/human-readable, FR-026/FR-027). Locate it easily (SC-009).
2. Simulate a new machine: stop the app, remove/rename the local database file, restart
   (empty collection), then **Import** the file → every bookmark, tag, note, flag, and
   saved search is restored (FR-028, SC-008).
3. Import the same file again into the now-populated collection → no duplicates; a
   summary shows "0 added, N already present" (FR-029).
4. Import a random non-export file → clear error, collection unchanged (FR-030).

## Duplicate behaviour check (FR-023, SC-007)
- Save `https://example.com/`, then save `example.com` → **no second copy**; the app
  opens the existing bookmark for editing (research §6).
