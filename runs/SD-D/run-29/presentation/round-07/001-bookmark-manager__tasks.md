---
description: "Task list for Bookmark Manager implementation"
---

# Tasks: Bookmark Manager

**Input**: Design documents from `/specs/001-bookmark-manager/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Included as committed in plan.md's testing strategy — `node:test` unit
tests for the highest-risk logic (search parser, Netscape import/export
round-trip) and `@playwright/test` (pinned 1.61.0) e2e for the primary user
journeys. Test tasks appear within the story they cover.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: US1–US12 maps to the user stories in spec.md
- Exact file paths are included in each task

## Path Conventions

Single deployable web app (per plan.md): Node backend in `server/`, frontend in
`public/`, tests in `tests/`, runtime data in `data/` (gitignored). All paths are
repository-relative to `/work`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [ ] T001 Create `package.json` at repo root with `"type": "module"` and scripts `start` → `node server/index.js` and `test` → `node --test tests/unit`; create the directory tree `server/{routes,services}`, `public/`, `data/snapshots/`, `tests/{unit,e2e}` per plan.md Project Structure
- [ ] T002 Install and pin dependencies, preserving `package-lock.json`: `express`, `better-sqlite3`, `node-html-parser`, `dompurify`, `jsdom`; devDependencies `playwright@1.61.0` and `@playwright/test@1.61.0` (match the shared Chromium at `/opt/playwright-browsers`; do not download another browser revision)
- [ ] T003 [P] Create `.gitignore` excluding `node_modules/` and `data/` (bookmarks.db + snapshots are runtime artifacts)
- [ ] T004 [P] Create `/work/.harness/app.json` with `{"kind": "application", "port": 4000, "path": "/", "start_command": ["npm", "start"], "start_cwd": "/work"}`
- [ ] T005 [P] Create `playwright.config.js` pointing e2e tests at `http://127.0.0.1:4000`, using the shared Chromium (channel/executable from `/opt/playwright-browsers`), no browser download

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T006 Implement `server/db.js`: open/create `data/bookmarks.db` via better-sqlite3, run idempotent schema migration creating tables from data-model.md — `bookmarks`, `tags` (`UNIQUE(name COLLATE NOCASE)`), `bookmark_tags` (PK `(bookmark_id, tag_id)`, FKs ON DELETE CASCADE), `saved_filters`, `preferences` (single row id=1 with defaults `default_sort='date_added_desc'`, `density='comfortable'`, `text_size='medium'`) — plus indexes: `UNIQUE(bookmarks.normalized_url)`, `INDEX(bookmarks.is_archived, is_read)`, `INDEX(bookmarks.saved_date)`, `INDEX(bookmarks.title)`
- [ ] T007 [P] Implement `server/services/url.js`: `normalize(url)` (add `https://` scheme if missing, lowercase host, strip default ports, drop trailing slash on root, preserve path/query/fragment) and `deriveTitle(normalizedUrl)` fallback; reject empty/malformed → throws validation error (FR-004)
- [ ] T008 [P] Unit test `tests/unit/url.test.js` (node:test): scheme-less input, host casing, trailing slash, invalid input rejection, fallback title derivation
- [ ] T009 Implement `server/index.js`: Express app listening on `0.0.0.0:4000`, JSON body parsing, static serving of `public/`, mount `/api` router, centralized error handler returning `{ "error": "<message>" }` with appropriate 4xx/500 (external capture/IA failures never surface as 500 — they are status fields)
- [ ] T010 Implement `public/index.html` + `public/app.js` + `public/styles.css` shell: app layout with view switcher (All / Unread / Archived), a bookmark-list container, and a bootstrap that loads preferences + initial list, then sets `document.body.dataset.harnessReady = "true"` (or the root element `data-harness-ready="true"`) once initial UI + data are loaded (also for a valid empty state)

**Checkpoint**: Server boots, serves an empty-state UI marked ready, DB initialized

---

## Phase 3: User Story 1 - Save a bookmark with automatic details (Priority: P1) 🎯 MVP

**Goal**: Enter a URL → review auto-collected title/description/favicon/preview →
edit → confirm → bookmark saved immediately; offline copy attempted afterward
without delaying the save; duplicates open the existing bookmark.

**Independent Test**: Add a URL, confirm the review step shows auto-filled details
(or fallback), edit the title, confirm, reload → persists; re-add same URL → opens
existing; offline indicator resolves to available/unavailable.

### Implementation for User Story 1

- [ ] T011 [P] [US1] Implement `server/services/metadata.js`: fetch URL server-side (follow redirects, short timeout), parse with node-html-parser for `<title>`/`og:title`, meta description/`og:description`, favicon (`<link rel="icon">` variants + `/favicon.ico` fallback), preview image (`og:image`/`twitter:image`); return absolute URLs; on timeout/failure return fallback (derived title, empty description) with `fallback: true` (FR-002/003/005)
- [ ] T012 [P] [US1] Implement `server/services/capture.js`: detect content type; if PDF (`application/pdf` or `.pdf`) download bytes to `data/snapshots/<id>.pdf` (`offline_kind='pdf'`); else open in Playwright Chromium and capture single-file MHTML via CDP `Page.captureSnapshot` to `data/snapshots/<id>.mhtml` (`offline_kind='mhtml'`); set `offline_status` `available` or `unavailable`; run with timeout and reused browser context; never throw to caller (FR-029)
- [ ] T013 [US1] Implement `server/routes/bookmarks.js` `POST /api/bookmarks/preview`: validate+normalize URL (400 on invalid); if `normalized_url` exists return `200 { duplicate: true, bookmark }`; else call metadata service and return `200 { duplicate: false, url, normalized_url, title, description, favicon_url, preview_image_url, fallback }` (contracts/rest-api.md, FR-006)
- [ ] T014 [US1] Implement in `server/routes/bookmarks.js` `POST /api/bookmarks`: validate+normalize (400 on invalid); duplicate → `200 { duplicate: true, bookmark }`; else insert with reviewed title/description **plus the collected `favicon_url` and `preview_image_url` carried from the preview step** (so they persist and display after reload — FR-002/008), `saved_date=now`, `is_read=0`, `offline_status='pending'`, attach any tags, return `201` immediately, then kick off `capture.js` asynchronously to update offline status (FR-006/029)
- [ ] T015 [US1] Implement `GET /api/bookmarks/:id` and `GET /api/bookmarks/:id/snapshot` in `server/routes/bookmarks.js` (snapshot streams `application/pdf` or MHTML; `404` when `offline_status != available`)
- [ ] T016 [US1] Frontend in `public/app.js`: "Add bookmark" input → calls `/preview`; render an editable review form (title, description, favicon/preview thumbnail); on duplicate response open the existing bookmark for editing; on confirm call `POST /api/bookmarks` **carrying the collected `favicon_url` and `preview_image_url` from the preview response** alongside url/title/description/tags; show fallback notice when `fallback: true`
- [ ] T017 [US1] Frontend: render new bookmark into the list and show an offline-copy status indicator (pending → available / "offline copy unavailable"), polling or refreshing status after create
- [ ] T018 [US1] E2E test `tests/e2e/save.spec.js` (@playwright/test): enter URL → review/edit title → confirm → appears in list and persists after reload, **including the favicon and preview image still present after reload** (FR-002/008); re-enter same URL → opens existing (no duplicate); invalid URL rejected with nothing saved

**Checkpoint**: US1 fully functional — the MVP: save with reviewed auto-details + async offline copy

---

## Phase 4: User Story 2 - Browse, sort, and find (Priority: P1)

**Goal**: Rich list rows (title, description, tags, favicon); sort by date/title;
advanced search (case-insensitive; phrase; `#tag`; AND/OR/NOT/brackets; quoted
operator = literal).

**Independent Test**: Seed bookmarks; confirm rows show all four fields; sort both
keys/directions; run word/phrase/#tag/boolean/quoted-operator searches; empty
query and no-match states behave.

### Implementation for User Story 2

- [ ] T019 [P] [US2] Implement `server/services/search.js`: tokenizer + recursive-descent parser producing a boolean AST per contracts/search-query-grammar.md (PHRASE, TAG, WORD, AND/OR/NOT unquoted operators, parentheses, implicit AND; precedence NOT>AND>OR; quoted operator words literal); compile AST to a parameterized SQL `WHERE` (LIKE over title/description/notes/url; tag joins for `#tag`); graceful handling of malformed queries; empty query matches all
- [ ] T020 [P] [US2] Unit test `tests/unit/search.test.js` (node:test): each worked example in the grammar contract — bare word, implicit AND, `"exact phrase"`, `#tag`, `(#news OR #blog) AND climate NOT opinion`, `"and"` literal, malformed input no-crash
- [ ] T021 [US2] Implement `GET /api/bookmarks` in `server/routes/bookmarks.js`: params `q`, `tag`, `filterId`, `view` (all|unread|archived, default all excludes archived), `sort` (date_added_desc default | date_added_asc | title_asc | title_desc); return `{ items: [...with tag names + offline/IA status], total }` (contracts/rest-api.md, FR-008/010/012–016)
- [ ] T022 [US2] Frontend `public/app.js`: render list rows showing title, description, tags, and favicon (FR-008); wire the search box to `GET /api/bookmarks?q=`; render "no results" and empty states (FR-016)
- [ ] T023 [US2] Frontend: sort control (date added / title, asc/desc) driving the `sort` param and re-rendering (FR-010)
- [ ] T024 [US2] E2E test `tests/e2e/search-sort.spec.js`: rows show all four fields; sort toggles order; phrase, `#tag`, boolean, and quoted-operator searches return expected results; no-match shows the no-results state

**Checkpoint**: US1 + US2 form a usable product — save, browse, sort, and find

---

## Phase 5: User Story 3 - Read-later workflow (Priority: P2)

**Goal**: New bookmarks default unread; dedicated unread view; mark read/unread.

**Independent Test**: New bookmark starts unread; unread view shows only unread;
marking read removes it from that view.

- [ ] T025 [US3] Extend `PATCH /api/bookmarks/:id` in `server/routes/bookmarks.js` to toggle `is_read` (0/1); ensure `view=unread` filters `is_read=0` and non-archived (FR-021/022)
- [ ] T026 [US3] Frontend: Unread view in the view switcher; per-bookmark mark-read / mark-unread control; item leaves the unread view when marked read
- [ ] T027 [US3] E2E test `tests/e2e/read-later.spec.js`: new bookmark appears in Unread; mark read → leaves Unread, remains in All

**Checkpoint**: Read-later flow works end to end

---

## Phase 6: User Story 4 - Edit and delete (Priority: P2)

**Goal**: Edit title/description/address/notes/tags; delete with confirm/undo.

**Independent Test**: Edit fields persist after reload; delete removes and stays
gone; delete guarded.

- [ ] T028 [US4] Complete `PATCH /api/bookmarks/:id` to update `title`, `description`, `url` (re-normalize + re-check uniqueness), `tags`; and implement `DELETE /api/bookmarks/:id` (hard delete → 204) in `server/routes/bookmarks.js` (FR-017/020)
- [ ] T029 [US4] Frontend: bookmark detail/edit form (title, description, address, tags) with save; delete action with confirmation or undo affordance (FR-020)
- [ ] T030 [US4] E2E test `tests/e2e/edit-delete.spec.js`: edit persists after reload; delete (via confirm) removes permanently

**Checkpoint**: Full CRUD available

---

## Phase 7: User Story 5 - Organize with tags and suggestions (Priority: P2)

**Goal**: Add/remove tags with type-ahead suggestions of existing tags; filter by
a tag.

**Independent Test**: Typing suggests existing tags; add/remove persists; filter
by a tag shows only matching bookmarks.

- [ ] T031 [P] [US5] Implement `server/routes/tags.js`: `GET /api/tags` (id, name, count) and `GET /api/tags/suggest?q=<prefix>` (existing tags matching prefix); prune tags with zero bookmarks (FR-018)
- [ ] T032 [US5] Ensure tag add/remove upserts into `tags`/`bookmark_tags` (case-insensitive tag identity) via the create/patch handlers in `server/routes/bookmarks.js`
- [ ] T033 [US5] Frontend: tag editor with type-ahead suggestions from `/api/tags/suggest`; tag chips on rows (already shown by US2) clickable to filter via `?tag=`; tag filter UI (FR-018/019)
- [ ] T034 [US5] E2E test `tests/e2e/tags.spec.js`: suggestions appear while typing; add/remove tag persists; filtering by a tag narrows the list

**Checkpoint**: Tagging + filtering + suggestions work

---

## Phase 8: User Story 6 - Bulk actions on selections (Priority: P2)

**Goal**: Select several, or all matching the current search/filter; apply add/
remove tags, mark read/unread, archive, delete in one action.

**Independent Test**: Multi-select and "select all matching" each apply the action
to exactly the target set including off-screen matches; bulk delete guarded.

- [ ] T035 [US6] Implement `POST /api/bookmarks/bulk` in `server/routes/bookmarks.js`: `target` = `{ ids: [...] }` or `{ match: { q, tag, filterId, view } }` (resolve match by re-running the query server-side); `action` ∈ add_tags|remove_tags|mark_read|mark_unread|archive|restore|delete (tags required for add/remove); return `{ affected }` (FR-023/024)
- [ ] T036 [US6] Frontend: selection checkboxes per row, a "select all matching" control, and a bulk-action bar (add/remove tags, mark read/unread, archive, delete) with confirm/undo for bulk delete
- [ ] T037 [US6] E2E test `tests/e2e/bulk.spec.js`: multi-select tag + mark-read; "select all matching" a search then archive, verifying off-screen items are affected

**Checkpoint**: Bulk management works on selections and full result sets

---

## Phase 9: User Story 7 - Archive bookmarks (Priority: P2)

**Goal**: Reversible archive, hidden from normal list/search, with its own view;
distinct from delete.

**Independent Test**: Archive hides from All + normal search; Archived view shows
only archived; restore returns it; delete remains separate.

- [ ] T038 [US7] Extend `PATCH /api/bookmarks/:id` (or reuse bulk) to set/clear `is_archived`; ensure `GET /api/bookmarks` excludes archived unless `view=archived`, and search excludes archived by default (FR-025/026)
- [ ] T039 [US7] Frontend: archive/restore actions; Archived view in the switcher; visually distinguish archive from delete
- [ ] T040 [US7] E2E test `tests/e2e/archive.spec.js`: archive → gone from All + search, present in Archived; restore → back in All

**Checkpoint**: Archiving is reversible and isolated from normal views

---

## Phase 10: User Story 8 - Notes with simple formatting (Priority: P3)

**Goal**: Simple formatted notes (bold, italic, lists, links), rendered safely.

**Independent Test**: Apply bold + bullet list; view renders formatting (not raw
markup); persists; hostile markup sanitized.

- [ ] T041 [P] [US8] Implement `server/services/notes.js`: sanitize note HTML with DOMPurify+jsdom to allowlist `b/strong, i/em, ul/ol/li, a[href], p, br`; expose `toPlainText(html)` for search indexing (FR-027)
- [ ] T042 [US8] Wire `notes_html` through create/`PATCH` handlers (sanitize on write) and include notes plain-text in the search fields (`server/services/search.js`/route)
- [ ] T043 [US8] Frontend `public/notes-editor.js`: contenteditable editor with a small toolbar (bold, italic, bullet/numbered list, link); render sanitized notes HTML on the detail view (FR-027)
- [ ] T044 [US8] E2E test `tests/e2e/notes.spec.js`: format a note, save, reload → formatting rendered; a `<script>` in notes is stripped

**Checkpoint**: Rich notes stored, rendered, and safe

---

## Phase 11: User Story 9 - Saved filters (Priority: P3)

**Goal**: Save a query + included/excluded tags as a named, reusable filter;
apply/edit/delete.

**Independent Test**: Save a filter combining a query with one included and one
excluded tag; applying reproduces the exact list; persists across reload.

- [ ] T045 [P] [US9] Implement `server/routes/filters.js`: `GET/POST/PATCH/DELETE /api/filters` storing `name`, `query`, `include_tags` (JSON), `exclude_tags` (JSON), `created_date` (FR-028)
- [ ] T046 [US9] Extend `GET /api/bookmarks` `filterId` handling: evaluate `query` AND include-all `include_tags` AND none-of `exclude_tags` over non-archived bookmarks (combine with any `q`)
- [ ] T047 [US9] Frontend: save-current-search-as-filter UI (name + included/excluded tags), a saved-filters list to apply, and edit/delete controls
- [ ] T048 [US9] E2E test `tests/e2e/saved-filters.spec.js`: create, apply (verify inclusion/exclusion), edit, delete; persists after reload

**Checkpoint**: Saved filters reusable and persistent

---

## Phase 12: User Story 10 - Preserve an offline copy (Priority: P3)

**Goal**: Confirm automatic offline copy + PDF-as-PDF (capture from US1), add
viewing of the stored copy, and optional manual Internet Archive preservation.

**Independent Test**: A normal page yields a viewable offline copy; a PDF URL is
stored/served as PDF; manual Internet Archive action records a snapshot link (or
reports failed/pending when unreachable — retryable).

- [ ] T049 [P] [US10] Implement `server/services/archive.js`: POST to `https://web.archive.org/save/<url>`; set `ia_status` none→pending→saved(+`ia_snapshot_url`)|failed; timeout + graceful failure, retryable (FR-030)
- [ ] T050 [US10] Implement `POST /api/bookmarks/:id/preserve` in `server/routes/preservation.js` (mount under `/api`): trigger `archive.js`, return `202` with current IA status; never blocks saving (FR-030)
- [ ] T051 [US10] Verify PDF branch of `capture.js` (from T012) stores/serves PDFs as PDF via `GET /api/bookmarks/:id/snapshot`; add explicit content-type handling if missing (FR-029)
- [ ] T052 [US10] Frontend: "View offline copy" affordance (open snapshot), offline-status display, and a manual "Preserve to Internet Archive" button showing pending/saved(link)/failed(retry)
- [ ] T053 [US10] E2E test `tests/e2e/preservation.spec.js`: offline copy of a normal page is viewable; PDF URL served as PDF; Internet Archive action reflects status (tolerant of network unavailability — asserts pending/failed path is retryable)

**Checkpoint**: Offline copy viewable; PDFs preserved; Internet Archive optional/manual

---

## Phase 13: User Story 11 - Import and export (Priority: P3)

**Goal**: Import/export the Netscape browser bookmark HTML format retaining
titles, tags, and saved dates; imports de-duplicate.

**Independent Test**: Import a browser HTML file → titles/tags/dates retained, no
duplicates; export → browser-openable file that round-trips back unchanged.

- [ ] T054 [P] [US11] Implement `server/services/netscape.js`: `parse(html)` reading `<DT><A HREF ADD_DATE TAGS>` (TAGS comma-separated, ADD_DATE epoch seconds→ms) and `serialize(bookmarks)` emitting the same format with `ADD_DATE` + `TAGS` (FR-031/032)
- [ ] T055 [P] [US11] Unit test `tests/unit/netscape.test.js` (node:test): round-trip retains 100% of titles, tags, and saved dates (SC-005); malformed entries skipped, valid ones kept
- [ ] T056 [US11] Implement `server/routes/porting.js` (mount under `/api`): `POST /api/import` (parse, de-dup by normalized URL, return `{ imported, skipped, duplicates }`) and `GET /api/export` (`text/html`, `Content-Disposition: attachment`) (FR-031/032)
- [ ] T057 [US11] Frontend: import (file upload) with result summary, and export (download) controls
- [ ] T058 [US11] E2E test `tests/e2e/import-export.spec.js`: import a sample file → titles/tags/dates present, duplicates not recreated; export → re-import round-trips

**Checkpoint**: Migration/backup via standard browser format works

---

## Phase 14: User Story 12 - Personal display preferences (Priority: P3)

**Goal**: Default sort, display density, and text size; persisted across sessions.

**Independent Test**: Change each preference; list reflects it; persists across
reload/new session.

- [ ] T059 [P] [US12] Implement `server/routes/preferences.js`: `GET /api/preferences` and `PUT /api/preferences` validating enums `default_sort` (date_added_desc|date_added_asc|title_asc|title_desc), `density` (comfortable|compact), `text_size` (small|medium|large) (FR-033)
- [ ] T060 [US12] Frontend: preferences panel; apply default sort on load, density (row detail) and text-size classes to the list; persist via `PUT` (FR-033)
- [ ] T061 [US12] E2E test `tests/e2e/preferences.spec.js`: set sort/density/text-size → reflected in the list and persisted after reload

**Checkpoint**: All 12 user stories independently functional

---

## Phase 15: Polish & Cross-Cutting Concerns

- [ ] T062 [P] Seed/perf check: verify list, search, sort, and bulk feel responsive with 500+ bookmarks (SC-006) and a 50-item bulk action completes quickly (SC-004); add indexes/tuning if needed
- [ ] T063 [P] Accessibility & responsive pass on `public/styles.css` (keyboard, labels, long title/URL truncation with full value on demand — edge cases)
- [ ] T064 Verify graceful degradation when offline/external services unreachable: preview fallback, capture "unavailable", Internet Archive failed/retryable — none block saving
- [ ] T065 Run `quickstart.md` validation scenarios 1–13 and the success-criteria checks; fix any gaps
- [ ] T066 Final review pass: confirm `data-harness-ready` set only after real load, server binds `0.0.0.0:4000`, `npm start` boots cleanly from `/work`, lockfile preserved

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies
- **Foundational (Phase 2)**: depends on Setup — BLOCKS all user stories
- **User Stories (Phases 3–14)**: all depend on Foundational; then orderable by priority (P1 → P2 → P3) or in parallel where staffed
- **Polish (Phase 15)**: after the desired stories are complete

### Story Dependencies & Notes

- **US1 (P1)** and **US2 (P1)** are the MVP; US2's list rows are reused by later stories
- **US10 (P3)** builds on the capture service delivered in **US1** (offline copy on save); US10 adds viewing + PDF confirmation + Internet Archive
- **US8 (P3)** notes plain-text feeds **US2** search fields (integrate when both present)
- Most stories touch shared files (`server/routes/bookmarks.js`, `public/app.js`); tasks within those files are sequential, not [P]

### Parallel Opportunities

- Setup: T003, T004, T005 in parallel
- Foundational: T007 + T008 in parallel with each other (both independent of T006's data, but T006 must land before route work)
- Service modules in different files are [P]: e.g., T011 & T012 (US1); T019 & T020 (US2); T031 (US5); T041 (US8); T045 (US9); T049 (US10); T054 & T055 (US11); T059 (US12)
- Unit tests (T008, T020, T055) can be written alongside their services

---

## Implementation Strategy

### MVP First

1. Phase 1 (Setup) → Phase 2 (Foundational)
2. Phase 3 (US1) → **STOP & VALIDATE**: save with reviewed auto-details + async offline copy
3. Phase 4 (US2) → save + browse/sort/find = demoable MVP

### Incremental Delivery

Add P2 stories (US3 read-later, US4 edit/delete, US5 tags, US6 bulk, US7 archive),
then P3 stories (US8 notes, US9 saved filters, US10 preservation, US11 import/
export, US12 preferences), validating each independently before the Polish phase.

## Notes

- [P] = different files, no incomplete dependencies
- Tests included per plan.md testing strategy (unit for search + netscape; e2e per story)
- Runtime data under `data/` is gitignored; snapshots keyed by bookmark id
- Playwright pinned to 1.61.0 to match the shared Chromium; no extra browser download
- Commit after each task or logical group; stop at any checkpoint to validate a story
