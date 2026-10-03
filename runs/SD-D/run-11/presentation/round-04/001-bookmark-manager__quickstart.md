# Phase 1 Quickstart & Validation Guide: Bookmark Manager

This guide proves the feature works end-to-end. It references
[data-model.md](./data-model.md) and [contracts/api.md](./contracts/api.md)
rather than duplicating them. Implementation lives in `tasks.md` / the
implement phase.

## Prerequisites

- Node.js 24 and npm (provided by the image).
- Playwright 1.61.0 with Chromium at `/opt/playwright-browsers` (provided).
- No external database or service needed. Internet access is only required for
  live metadata fetch, page preservation, and Internet Archive submission;
  those degrade gracefully when unavailable.

## Setup & run

```bash
cd /work
npm install            # installs pinned deps; preserves package-lock.json
npm start              # starts the server on 0.0.0.0:4000 (foreground)
```

- Client review URL: `http://maker:4000` ; VM capture: `http://127.0.0.1:4000`.
- The main UI marks itself `data-harness-ready="true"` once the initial list
  (or empty state) has loaded.
- Runtime manifest `.harness/app.json` declares
  `{"kind":"application","port":4000,"path":"/","start_command":["npm","start"],"start_cwd":"/work"}`.

## Automated tests

```bash
cd /work
npm test               # node:test unit suites + Playwright smoke test
```

Unit suites concentrate on the exacting logic: search grammar, address
normalisation, Netscape import/export, and metadata parsing.

## Validation scenarios (map to spec user stories)

1. **Save with metadata (US1, FR-002/003/004)**: In the UI, paste a URL; confirm
   title/description/icon/preview populate; edit the title; save; reload and
   confirm it persists. Try an invalid URL and confirm rejection.
2. **No duplicates (US2, FR-006)**: Save a URL, then submit the same URL (and a
   trailing-slash / different-host-case variant); confirm no second entry and the
   existing bookmark opens for editing.
3. **Browse / sort / open (US3, FR-010/011/012)**: Confirm rows show title,
   description, tags, icon; change sort; select a bookmark and confirm the
   original page opens.
4. **Search (US4, FR-013/014/015)**: Verify case-insensitive matching; `#travel`;
   `#travel japan` (implicit AND — both must match); `"rock and roll"` (AND is
   literal text here); `#travel AND (japan OR korea) NOT flight`; a no-match
   query; and a malformed query (clear message, no crash).
5. **Rich edit + notes + tag suggestions (US5, FR-007/008/009)**: Edit address,
   tags (with suggestions), and a formatted note; confirm formatting renders and
   all fields persist; edit a URL to a colliding one and confirm duplicate is
   prevented.
6. **Read-later (US6, FR-016)**: Save without "read later" → ordinary bookmark
   (not in unread view). Save with "read later" → appears in unread. Mark an
   ordinary one unread → appears; mark read → leaves unread view.
7. **Archive & delete (US7, FR-017/018)**: Archive a bookmark → gone from main
   list and search, present in archive view, restorable. Delete → requires
   confirm, then gone after reload.
8. **Bulk actions (US8, FR-019/020)**: Select several with differing tags;
   bulk-add and bulk-remove specific tags → confirm other tags untouched. Apply a
   bulk archive to "all matching" a search → confirm every match updated; confirm
   partial-failure reporting.
9. **Saved searches (US9, FR-021)**: Save a query with included/excluded tags;
   reapply; rename; delete.
10. **Import/export (US10, FR-022/023)**: Export → Netscape HTML file with titles,
    TAGS, ADD_DATE. Import that file into an empty collection → titles/tags/dates
    preserved; duplicates skipped; invalid file imports nothing with a clear
    message.
11. **Preservation + Internet Archive (US11, FR-024/025/026)**: Preserve a web
    page → single self-contained HTML openable from the app offline; preserve a
    PDF URL → stored/opened as PDF; request Internet Archive save → reference
    recorded, or a graceful failure message with the bookmark intact.
12. **Preferences (US12, FR-027)**: Change default sort, items per view, text
    size; reload and confirm they are remembered and applied.

## Expected outcomes

- All 12 scenarios behave as their acceptance scenarios specify.
- Data persists across restart (SC-003); re-saving never duplicates (SC-004);
  export→import preserves titles/tags/dates (SC-005); a preserved copy opens
  with no origin access (SC-006).
