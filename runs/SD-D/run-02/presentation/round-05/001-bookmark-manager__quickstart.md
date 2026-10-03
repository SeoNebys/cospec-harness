# Quickstart & Validation: Bookmark Manager

**Feature**: 001-bookmark-manager | **Date**: 2026-09-16
A run/validation guide (not implementation code). It shows how to build, start,
and prove each user story once implementation exists.

## Prerequisites

- Node.js 24 + npm (runtime image).
- Playwright 1.61.0 with Chromium at `/opt/playwright-browsers` (preinstalled).
- No external accounts. Internet Archive tests require outbound access to
  archive.org; if unavailable, that check is reported as skipped, not passed.

## Install, build, run

```bash
npm install            # root install (server + web workspaces)
npm run build          # builds web/ (Vite) into web/dist
npm start              # starts the Node server on 0.0.0.0:4000
```

`npm start` runs the single foreground server (`server/src/index.js`) that serves
the built UI and the `/api` routes. The reviewer opens `http://maker:4000`.
Delivery marker `/work/.harness/app.json` (set in the implement phase):

```json
{"kind": "application", "port": 4000, "path": "/", "start_command": ["npm", "start"], "start_cwd": "/work"}
```

The main view sets `data-harness-ready="true"` once the initial list (or empty
state) has loaded.

## Automated tests

```bash
npm test               # node:test unit tests (search parser, url, netscape)
npm run test:e2e       # Playwright 1.61.0 end-to-end journeys
```

## Story validation scenarios

Each maps to a user story / acceptance scenarios in [spec.md](./spec.md); details
of shapes live in [contracts/](./contracts) and [data-model.md](./data-model.md).

1. **Save with auto-details (US1)** — Save a real URL; the bookmark appears and
   its title/description/favicon/preview fill in from `pending`→`complete`. Edit
   the title, description, tags, and note; reload and confirm they persist. Save
   the same URL again → the existing bookmark opens (no duplicate). Try an empty
   / non-http URL → rejected.
2. **Browse & open (US2)** — With several bookmarks, the normal list shows title,
   description, tags, and favicon; clicking opens the original page in a new tab;
   empty collection shows the empty state.
3. **Organize (US3)** — Add a Markdown note (renders formatted); add tags (see
   suggestions from existing tags); apply an existing tag name to a second
   bookmark and confirm one shared tag identity (no duplicate). Click a tag →
   list filters to it. Toggle read/unread; archive (leaves normal list + search,
   appears in archived view; unarchive restores). Permanently delete → gone
   everywhere and irrecoverable.
4. **Search (US4)** — Run: a mixed-case keyword across title/description/note/
   url; `#tag`; `#tag word` (both required); a quoted phrase; `a AND (b OR c)`;
   `NOT`; and a quoted `"AND"` (literal). Confirm archived items never appear;
   change sort and confirm reordering; an invalid expression shows a clear error.
5. **Bulk (US5)** — Select several bookmarks, apply a bulk tag/read/archive;
   then "apply to all matching" the current search and confirm off-screen items
   changed; bulk delete asks to confirm and reports the count.
6. **Saved searches (US6)** — Save a search that includes some tags and excludes
   others; reopen it and confirm query, included/excluded tags, view, and sort
   are restored; rename and delete persist.
7. **Snapshots & Internet Archive (US7)** — Snapshot a normal page → a
   self-contained HTML file reopens offline; snapshot a PDF URL → the stored
   snapshot is the PDF; request Internet Archive saving → the bookmark records
   the archived link (or, if archive.org is unreachable, a recoverable error is
   shown and the bookmark is intact).
8. **Import/export (US8)** — Import a browser-exported Netscape file; confirm
   address, title, tags, and original date added are preserved and duplicates
   skipped. Export; re-import into a browser and back into the app (round-trip
   intact). Import a malformed file → rejected, nothing imported.
9. **Display preferences (US9)** — Change default sort, items-per-page, and font
   size; confirm each takes effect and persists across reload.

## Success-criteria checks

- SC-001 save first bookmark <30s; SC-002 duplicate opens existing (100%);
  SC-003 no data loss across restart; SC-004 locate a bookmark <10s;
  SC-005 archived in 0% of normal results; SC-006 bulk on ≥100; SC-007 Netscape
  round-trip; SC-008 responsive at ≥500 bookmarks; SC-009 core-loop success;
  SC-010 delete vs archive distinction. Seed ~500 bookmarks (import fixture) for
  SC-006/008.
