# Quickstart & Validation: Bookmark Manager

How to run the app and validate it against the spec. Implementation details live in
`tasks.md` (created by `/speckit-tasks`) and the code; this is a run/validation guide.

## Prerequisites
- Shared runtime image: Node.js 24, npm, Playwright 1.61.0 + Chromium at
  `/opt/playwright-browsers`.
- No external services required to run (Internet Archive preservation is optional and
  degrades gracefully when unavailable).

## Setup & run
```bash
cd /work
npm install                 # installs pinned deps; preserves package-lock.json
npm run build               # esbuild bundles the client into public/
npm start                   # starts the server on 0.0.0.0:4000
```
- App is reachable at `http://maker:4000` (client review) and `http://127.0.0.1:4000`
  (VM capture). The database and saved copies are created under `data/` on first run.
- The root UI element is marked `data-harness-ready="true"` once the initial view and data
  have loaded (including the empty state for a fresh collection).

## Runtime descriptor
`/work/.harness/app.json`:
```json
{"kind": "application", "port": 4000, "path": "/", "start_command": ["npm", "start"], "start_cwd": "/work"}
```

## Automated tests
```bash
npm test                    # node:test unit + integration
npm run test:e2e            # Playwright 1.61.0 e2e against a running server (external fetches stubbed)
```

## Validation scenarios (traceable to user stories)

Each maps to a spec user story (US) and its acceptance scenarios; external network calls are
stubbed with local fixtures so results are deterministic.

1. **US1 — Save with auto page info**: POST a URL served by a local fixture with OpenGraph
   tags → bookmark is created with title/description/icon/preview populated; edit the title →
   persists after reload. POST the same URL again → routed to the existing bookmark for
   editing (409 + existingId). POST an unreachable URL → still saved with a URL-derived title.
   POST an invalid address → rejected with a clear message.
2. **US2 — Browse & open**: seed several bookmarks → list shows title, description, tags, and
   icon; empty collection shows the empty state; long text is truncated but recoverable.
3. **US3 — Tags**: add a tag with type-ahead suggesting an existing tag; filter by a tag →
   only tagged bookmarks shown.
4. **US4 — Notes/edit/delete**: add a Markdown note (bold/italics/list/link) → rendered and
   searchable; edit title → persists; delete with confirmation → gone after reload.
5. **US5 — Search**: verify `recipes`, `#work`, `invoice #work` (both conditions), quoted
   phrase, literal `"AND"`, and `(a OR b) c NOT #x`; a no-match query shows "no results".
   (See contracts/search-query.md examples.)
6. **US6 — Read-later**: new bookmark appears in unread view; mark read → leaves unread;
   mark unread → returns.
7. **US7 — Archive**: archive → hidden from list and search, visible in archive view;
   restore → returns; confirm archiving is reversible and delete is not.
8. **US8 — Bulk**: select several → add tag / remove tag / mark read/unread / archive /
   delete apply to all; "select everything matching current view" applies to the whole
   filtered set; bulk delete asks for confirmation.
9. **US9 — Saved searches**: save `keyword` + included/excluded tags → rerun returns the
   matching set; delete removes it.
10. **US10 — Sorting & preferences**: sort by title reorders; set default sort, page size,
    text size → persist across reload.
11. **US11 — Saved copies**: snapshot a fixture page → self-contained HTML stored and
    reopenable offline; snapshot a PDF fixture → the PDF file is stored; request Internet
    Archive → archived URL recorded on success, or a clear failure with the bookmark intact
    when the service is stubbed as unavailable.
12. **US12 — Import/export**: export → Netscape HTML with HREF/title/ADD_DATE/TAGS; import a
    fixture file → bookmarks added with title/tags/original date preserved, folders mapped to
    tags, existing addresses skipped. Export→import round-trip preserves all and adds no
    duplicates (SC-008).

## Success-criteria checks
- **SC-001** save < 15 s; **SC-002** find among ≥100 < 10 s; **SC-004** no data loss across
  restart (stop/start server, data persists); **SC-005** search feels instant at ~1,000
  bookmarks (seed and measure); **SC-006** bulk action on ≥50 in one call; **SC-007**
  archive→restore preserves tags/notes/copies; **SC-008** import/export round-trip integrity.
