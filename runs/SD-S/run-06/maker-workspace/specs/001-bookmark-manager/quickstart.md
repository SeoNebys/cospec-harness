# Quickstart / Validation Guide: Bookmark Manager

Validates the feature end-to-end against [spec.md](./spec.md), using the
[API contract](./contracts/api.md) and [data model](./data-model.md).

## Prerequisites

- Node.js 24 (provided by the shared image)
- Dependencies installed (see setup)

## Setup

```bash
cd /work
npm install          # installs express, better-sqlite3, node-html-parser, playwright@1.61.0
npm start            # starts the server on 0.0.0.0:4000
```

The SQLite file `data/bookmarks.db` is created automatically on first run.
Open `http://maker:4000` (review environment) to use the app.

## Automated tests

```bash
npm test             # node --test: API contract + unit (normalization, metadata)
npx playwright test  # end-to-end save→tag→filter→edit→delete flow
```

## Manual validation scenarios

Each maps to a user story / acceptance scenario in the spec.

1. **Save with auto-collected details (US1)**: Add a valid address → a bookmark
   appears; title/description/icon populate best-effort. Save returns immediately
   (SC-001).
2. **Fallback on failed collection (US1/FR-004)**: Add an unreachable but
   well-formed address → bookmark still saves with an address-derived title, empty
   description/icon.
3. **Reject invalid address (FR-002)**: Submit empty/malformed input → clear
   error, typed value preserved.
4. **Browse & open (US2)**: With several saved, list shows newest first; clicking
   opens the page in a new tab; the bookmark remains.
5. **Empty state (FR-008)**: With no bookmarks, a clear empty state invites adding
   one.
6. **Tags (US3)**: Add multiple tags including a reused one → no duplicate tag;
   tags persist after reload; filter by a tag shows only its bookmarks; clearing
   restores all.
7. **Search, case-insensitive (US4)**: Type a term in any case → matches title/
   description/address/tags; "NEWS" matches "news"; no-match state shown; clearing
   restores all.
8. **Edit (US5)**: Edit address, title, and description → changes persist after
   reload; editing to an invalid address is rejected and keeps the old value.
9. **Delete (US5)**: Delete with confirmation → gone after reload; cancelling
   leaves it unchanged.
10. **Re-save existing address (US6/SC-006)**: Save an already-saved address
    (varying case or trailing slash) → the app opens the existing bookmark for
    update; no duplicate is created.

## Expected outcomes

- All saved bookmarks, details, and tags survive a server restart (SC-002).
- List renders without visible delay for 500+ bookmarks (SC-004).
- Re-saving a known address never creates a duplicate (SC-006).
