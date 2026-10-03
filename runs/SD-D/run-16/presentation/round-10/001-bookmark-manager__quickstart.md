# Quickstart & Validation: Bookmark Manager

**Feature**: 001-bookmark-manager
**Date**: 2026-09-24

This guide explains how to run the app and validate the feature end-to-end. It
references [contracts/api.md](./contracts/api.md) and [data-model.md](./data-model.md)
rather than duplicating them. Implementation details live in `tasks.md` and the code.

## Prerequisites

- Node.js 24 and npm (provided by the image).
- Shared Chromium at `/opt/playwright-browsers` (used for preservation and e2e).
- Network access for metadata capture, offline preservation, and Internet Archive
  (these degrade gracefully when unavailable — FR-037).

## Setup & run

```bash
npm install            # installs deps; preserves lockfile
npm start              # starts server on 0.0.0.0:4000 (npm start === node src/server/index.js)
```

The client is reachable at `http://maker:4000/` in the review environment
(`http://127.0.0.1:4000/` for VM capture). The SPA sets `data-harness-ready="true"`
once its initial UI and data have loaded (empty state counts as ready).

The runtime descriptor is `.harness/app.json`:

```json
{"kind": "application", "port": 4000, "path": "/", "start_command": ["npm", "start"], "start_cwd": "/work"}
```

## Test commands

```bash
npm test               # node:test unit + supertest integration
npm run test:e2e       # playwright@1.61.0 smoke checks (shared Chromium)
```

## Validation scenarios (map to spec acceptance)

Each scenario proves one or more user stories. IDs reference spec.md.

1. **Save with details (US1 / FR-001–004)**: POST a valid address → a bookmark appears
   with captured title, description, icon, preview image; edit title/description and
   confirm they persist after reload. Submit empty/invalid address → clear rejection.

2. **Browse & search (US2 / FR-006–011)**: With several bookmarks, load the list (rows
   show title, description, tags, icon). Run queries exercising: a quoted phrase; a
   `#tag`; two space-separated terms (AND); `budget #work` (text AND tag);
   `a OR b`, `NOT c`, and parentheses; and a quoted operator `"AND"` treated as literal
   text. Confirm results match and archived items never appear. Open a bookmark → new
   tab. Empty query result → "no matching bookmarks".

3. **Tags & suggestions (US3 / FR-012–014)**: Add tags (typing shows existing-tag
   suggestions); filter by a tag; remove a tag and confirm it leaves the bookmark and
   drops from suggestions when unused.

4. **Edit, dedup, delete (US4 / FR-015–017)**: Edit fields and confirm persistence;
   POST an already-saved address → response indicates the existing bookmark for editing
   (no duplicate); delete with confirmation → gone after reload.

5. **Read later (US5 / FR-018–020)**: Toggle unread/read; open the unread view (only
   unread listed); mark read → leaves the unread view; new bookmark defaults to unread.

6. **Archive & restore (US6 / FR-021–023)**: Archive a bookmark → gone from normal
   list/search, present in Archived view; restore → returns; confirm archive and delete
   are distinct.

7. **Bulk actions (US7 / FR-024–026)**: Select several bookmarks and, separately,
   "select all matching" a search; bulk add/remove a tag; bulk change read/archive
   status; bulk delete with confirmation. Confirm all targeted items updated (SC-005:
   100+ items in one operation).

8. **Sort & preferences (US8 / FR-027–028)**: Change sort (newest/oldest/title/updated)
   and confirm reorder; set default sort, items shown, and text size; confirm they
   persist across reload.

9. **Saved searches (US9 / FR-029–030)**: Create a saved search with query + included
   and excluded tags; run it (correct results); edit and delete it.

10. **Import & export (US10 / FR-031–033)**: Export → a Netscape bookmark file. Import a
    bookmark file → new addresses added with title, tags, and original date-added
    preserved; existing addresses skipped; added/skipped counts reported. Malformed file
    → clear error, no corruption.

11. **Preserve pages (US11 / FR-034–037)**: Preserve a web page → one self-contained
    HTML file viewable later without the live page; preserve a PDF address → original
    PDF stored; trigger Internet Archive → snapshot link stored. Simulate an unreachable
    target → clear failure, bookmark intact.

12. **Markdown notes (US12 / FR-038)**: Save a note in Markdown; view the bookmark →
    note renders as formatted text (headings, emphasis, lists, links, quotes, code).

## Success-criteria checks

- **SC-002/SC-003**: With 500+ seeded bookmarks, a search/filter/sort returns within
  1s and the target bookmark is found in under 10s.
- **SC-004**: Restart the server; all bookmarks, tags, states, and preferences remain.
- **SC-006**: Take an offline copy, then make the live page unreachable; the preserved
  copy still opens and reads correctly.
