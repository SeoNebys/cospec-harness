---

description: "Task list for Bookmark Manager implementation"
---

# Tasks: Bookmark Manager

**Input**: Design documents from `/specs/001-bookmark-manager/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ (api.md, search-grammar.md), quickstart.md

**Tests**: Included. The approved plan/research call for `vitest` unit tests (search parser, URL normalization, import/export mapping) and Playwright Test (1.61.0) end-to-end scenarios per user story.

**Organization**: Tasks are grouped by user story (priority order P1 → P2 → P3) so each story is an independently testable increment.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: User story the task belongs to (US1–US13); omitted for Setup/Foundational/Polish
- Exact file paths are included in each task

## Path Conventions

Web app: `backend/src/`, `frontend/src/`, tests under `backend/tests/`. Runtime data under `data/` (created at runtime). Paths follow the Project Structure in `plan.md`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and toolchain.

- [X] T001 Create the repository structure per plan.md (`backend/src/{db,models,services,search,url,api}`, `frontend/src/{pages,components,services}`, `backend/tests/{unit,e2e}`, `data/`) with placeholder `.gitkeep` files
- [X] T002 Create root `package.json` defining npm workspaces (`backend`, `frontend`) and scripts: `build` (builds frontend), `start` (runs `node backend/src/server.js` on `0.0.0.0:4000`), `test:unit` (vitest), `test:e2e` (Playwright); add `.gitignore` ignoring `node_modules/` and `data/`
- [X] T003 [P] Initialize `backend/package.json` with dependencies `express`, `better-sqlite3`, `playwright@1.61.0`, `marked`, `sanitize-html`, `cheerio`, `zod`, and devDeps `vitest`, `@playwright/test@1.61.0`
- [X] T004 [P] Initialize `frontend/package.json` and `frontend/vite.config.js` with `react`, `react-dom`, `vite`, a client router, building to `frontend/dist`; create `frontend/index.html` and `frontend/src/main.jsx` app shell
- [X] T005 [P] Configure linting/formatting (ESLint + Prettier) at repo root and add a `playwright.config.js` pointing at the shared browsers in `/opt/playwright-browsers` (no browser download; pinned 1.61.0)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure required before ANY user story. ⚠️ No user-story work begins until this phase is complete.

- [X] T006 Author `backend/src/db/schema.sql` with all tables from data-model.md — `bookmarks`, `tags` (name unique case-insensitive), `bookmark_tags` (PK `(bookmark_id, tag_id)`, FKs ON DELETE CASCADE), `saved_views`, `preferences` (singleton id=1) — including bookmark columns `url, url_key (unique), title, description, note_md, favicon_path, preview_path, snapshot_path, snapshot_kind (html|pdf|null), snapshot_status (pending|ready|failed), archive_org_url, archive_org_status (none|pending|ready|failed), is_unread (default 0), is_archived (default 0), created_at, updated_at`
- [X] T007 Add the FTS5 virtual table `bookmarks_fts(title, description, note, url)` plus insert/update/delete triggers keeping it in sync with `bookmarks`, in `backend/src/db/schema.sql`
- [X] T008 Implement `backend/src/db/index.js`: open/create the SQLite database under `data/app.db`, run `schema.sql` idempotently on boot, seed the singleton `preferences` row (`default_sort='created_desc'`, `items_per_page=25`, `font_size='medium'`), export the connection
- [X] T009 Implement `backend/src/server.js`: Express app listening on `0.0.0.0:4000`, JSON body parsing, HTTP-session cookie support that works in the review environment, mount `/api` router, serve `frontend/dist` for non-`/api` routes, and serve stored files at `/snapshots/:id/...` from `data/snapshots/`
- [X] T010 [P] Implement `backend/src/api/errors.js` — the standard error shape `{ "error": { "code, message } }` and an Express error-handling middleware; define codes `invalid_url, duplicate, invalid_query, not_found, validation_error`
- [X] T011 [P] Implement `backend/src/url/normalize.js` — canonicalize a URL to a `url_key` (lowercase scheme+host, strip default port, remove trailing slash) while returning the original for storage; reject non-http/https as invalid (used by US1/US2/US11)
- [X] T012 [P] Implement `backend/src/models/bookmarks.js` base data access (create, getById, getByUrlKey, update fields, delete, list with filters/sort/pagination) against the DB; map DB rows to the API response shape in contracts/api.md
- [X] T013 [P] Implement `backend/src/models/tags.js` base data access (get-or-create by name case-insensitive, list with prefix + counts, attach/detach to a bookmark)
- [X] T014 [P] Implement `frontend/src/services/api.js` typed client wrapping the endpoints in contracts/api.md, plus a shared app layout/navigation shell (List, Unread, Archive, Saved Views, Import/Export, Preferences) in `frontend/src/pages/Layout.jsx`
- [X] T015 [P] Add the `data-harness-ready="true"` marker logic in `frontend/src/pages/Layout.jsx`, set only after the initial list (or valid empty state) has loaded, per runtime conventions
- [X] T016 Create `/work/.harness/app.json` = `{"kind":"application","port":4000,"path":"/","start_command":["npm","start"],"start_cwd":"/work"}`

**Checkpoint**: Foundation ready — DB, server, base models, and frontend shell exist. User stories can now proceed.

---

## Phase 3: User Story 1 - Save a link with automatic details (Priority: P1) 🎯 MVP

**Goal**: Save a URL; auto-collect title/description/favicon/preview; edit address, title, description, tags, note (edits override auto values); invalid URLs rejected; fallback title when details missing.

**Independent Test**: Add a valid URL → entry appears with auto-collected details; edit each field and confirm persistence; submit an invalid URL and confirm rejection.

### Tests for User Story 1

- [X] T017 [P] [US1] Unit tests for URL validation/normalization in `backend/tests/unit/normalize.test.js` (valid/invalid schemes, trailing slash, host case)
- [X] T018 [P] [US1] E2E test in `backend/tests/e2e/us1-save-enrich.spec.js` covering save + auto-enrichment, editing all five fields, fallback title, and invalid-URL rejection (spec acceptance scenarios 1–5)

### Implementation for User Story 1

- [X] T019 [US1] Implement `backend/src/services/enrichment.js` — fetch page, extract title/description via OG/Twitter/HTML meta with a `cheerio` fast path and Playwright fallback for JS pages; download favicon and preview image into `data/snapshots/<id>/`; return collected fields with graceful per-field fallback (FR-003, FR-005)
- [X] T020 [US1] Implement `POST /api/bookmarks` in `backend/src/api/bookmarks.js` using `zod` validation: validate URL (FR-002 → `invalid_url`), create the bookmark with `is_unread=0`, derive fallback title from URL when needed, kick off background enrichment, return `201` with the bookmark (snapshot handled in US12)
- [X] T021 [US1] Implement `GET /api/bookmarks/:id` and `PATCH /api/bookmarks/:id` in `backend/src/api/bookmarks.js` — edit `url` (re-validate + duplicate check per US2), `title`, `description`, `tags`, `note`; edited title/description override auto values; update `updated_at` (FR-004)
- [X] T022 [P] [US1] Build `frontend/src/components/BookmarkForm.jsx` (save + edit) with fields for address, title, description, tags, note, and inline validation-error display
- [X] T023 [P] [US1] Build `frontend/src/pages/BookmarkDetail.jsx` showing a bookmark with its auto-collected details and an edit action wired to `PATCH`
- [X] T024 [US1] Wire background enrichment status into the bookmark response and refresh the detail view when enrichment completes (favicon/preview/title/description appear)

**Checkpoint**: US1 works independently — saving with enrichment and full-field editing.

---

## Phase 4: User Story 2 - Save an address that already exists (Priority: P1)

**Goal**: Saving an existing address (including trivial variants) never duplicates; the user is taken to the existing bookmark to edit.

**Independent Test**: Save a URL, then save it again and a trailing-slash/host-case variant → no duplicate; routed to the existing bookmark.

### Tests for User Story 2

- [X] T025 [P] [US2] E2E test in `backend/tests/e2e/us2-duplicate.spec.js` — duplicate save and trivial-variant save both route to the existing bookmark with no new row (spec scenarios 1–2)

### Implementation for User Story 2

- [X] T026 [US2] In `POST /api/bookmarks` (`backend/src/api/bookmarks.js`), compute `url_key` via `normalize.js`, look up existing by key, and on collision return `409 duplicate` with `existingId` instead of inserting (FR-006, FR-007)
- [X] T027 [US2] Apply the same duplicate check when `PATCH` changes the address (FR-004/FR-006)
- [X] T028 [US2] In `frontend/src/components/BookmarkForm.jsx`, handle `409 duplicate` by navigating to `BookmarkDetail` for `existingId` in editable state and informing the user

**Checkpoint**: US1 + US2 both work — no duplicates ever created.

---

## Phase 5: User Story 3 - Browse, sort, and open bookmarks (Priority: P1)

**Goal**: List active bookmarks with title, description, address, favicon, tags, and preview; sort; open in a new tab; empty state.

**Independent Test**: Seed bookmarks, change sort → reorders; open → new tab; empty list → empty state.

### Tests for User Story 3

- [X] T029 [P] [US3] E2E test in `backend/tests/e2e/us3-browse-sort-open.spec.js` — list fields shown, sort reorders, open in new tab, empty state (spec scenarios 1–4)

### Implementation for User Story 3

- [X] T030 [US3] Implement `GET /api/bookmarks` list in `backend/src/api/bookmarks.js` supporting `sort` (`created_desc|created_asc|title_asc|title_desc`), `page`/`pageSize` (defaulting to preferences), returning `{items,total}` and excluding archived rows (FR-010, FR-011, FR-019)
- [X] T031 [P] [US3] Build `frontend/src/components/BookmarkCard.jsx` showing title, description, address, favicon, tags, and preview image where available (FR-010)
- [X] T032 [P] [US3] Build `frontend/src/pages/BookmarkList.jsx` rendering the list with a sort control and an empty-state message; open action opens `url` in a new browser tab (FR-012, FR-013)

**Checkpoint**: US1–US3 = working MVP (save, enrich, no-duplicate, browse, sort, open).

---

## Phase 6: User Story 4 - Search with keywords and operators (Priority: P1)

**Goal**: Boolean search across title/description/note/address, case-insensitive, `#tag`, quoted phrases, AND/OR/NOT (any case), parentheses, implicit AND; quoted operator-as-text; malformed → error; no results state; archived excluded.

**Independent Test**: Run every query form from contracts/search-grammar.md and confirm result sets; malformed query → error; no matches → no-results.

### Tests for User Story 4

- [X] T033 [P] [US4] Unit tests in `backend/tests/unit/search-parser.test.js` covering words, `#tag`, quoted phrase, implicit AND (`word #tag`), explicit `OR`, mixed-case `and/or/not`, quoted-operator-as-text, precedence/parentheses, and malformed queries (unbalanced quotes/parens, missing operand) (FR-014–FR-018, FR-017a/b/c)
- [X] T034 [P] [US4] E2E test in `backend/tests/e2e/us4-search.spec.js` for representative queries, malformed-query error, no-results state, and archived exclusion

### Implementation for User Story 4

- [X] T035 [P] [US4] Implement `backend/src/search/tokenizer.js` per contracts/search-grammar.md — quotes captured verbatim (unbalanced → error), `#tag` terms, parentheses, `and/or/not` recognized case-insensitively (literal inside quotes)
- [X] T036 [US4] Implement `backend/src/search/parser.js` — recursive-descent parser building a boolean AST with precedence NOT > AND (incl. implicit AND injection) > OR; raise `invalid_query` on unbalanced parens/missing operands (depends on T035)
- [X] T037 [US4] Implement `backend/src/services/search.js` — compile the AST to a parameterized SQL query combining FTS5 matches (text/phrase) and tag EXISTS/NOT-EXISTS conditions, filtering `is_archived=0`, applying sort + pagination (depends on T036)
- [X] T038 [US4] Wire `q` into `GET /api/bookmarks` (`backend/src/api/bookmarks.js`) returning `400 invalid_query` on parser errors (FR-018)
- [X] T039 [P] [US4] Build `frontend/src/components/SearchBar.jsx` and integrate into `BookmarkList.jsx`, showing a clear error for malformed queries and a no-results state (FR-013)

**Checkpoint**: All P1 stories complete — full MVP with advanced search.

---

## Phase 7: User Story 5 - Read-later workflow (Priority: P2)

**Goal**: New bookmarks are NOT auto-unread; deliberately mark "read later"; dedicated unread view; toggle read/unread.

**Independent Test**: New bookmark not unread; mark "read later" → appears in unread view; mark read → leaves; toggle back.

### Tests for User Story 5

- [X] T040 [P] [US5] E2E test in `backend/tests/e2e/us5-read-later.spec.js` covering default-not-unread, mark read later, unread view contents, and toggling (spec scenarios 1–5)

### Implementation for User Story 5

- [X] T041 [US5] Implement `POST /api/bookmarks/:id/read-state` in `backend/src/api/bookmarks.js` setting `is_unread` from `{unread}` (FR-024); confirm create leaves `is_unread=0` (FR-023)
- [X] T042 [US5] Add `unread=true` filter to `GET /api/bookmarks` list query (FR-025)
- [X] T043 [P] [US5] Build `frontend/src/pages/UnreadView.jsx` and add a read/unread toggle to `BookmarkCard.jsx`/`BookmarkDetail.jsx`

**Checkpoint**: US5 works alongside P1 stories.

---

## Phase 8: User Story 6 - Organize with tags and tag suggestions (Priority: P2)

**Goal**: Add/remove tags; suggest existing tags while typing; selecting a suggestion reuses the tag; filter by include/exclude tags.

**Independent Test**: Tag bookmarks; type a tag → suggestions; apply suggestion reuses tag; filter by tag.

### Tests for User Story 6

- [X] T044 [P] [US6] E2E test in `backend/tests/e2e/us6-tags.spec.js` covering add/remove, type-ahead suggestions, suggestion reuse, and include/exclude filtering (spec scenarios 1–3; FR-022)

### Implementation for User Story 6

- [X] T045 [US6] Implement `GET /api/tags?prefix=` in `backend/src/api/tags.js` returning `[{id,name,count}]` for suggestions (FR-021)
- [X] T046 [US6] Add `includeTags`/`excludeTags` filtering to `GET /api/bookmarks` list query (FR-022)
- [X] T047 [P] [US6] Build `frontend/src/components/TagInput.jsx` with type-ahead suggestions (reusing existing tags) and integrate into `BookmarkForm.jsx`
- [X] T048 [P] [US6] Add include/exclude tag filter controls to `frontend/src/pages/BookmarkList.jsx` with a clear-filter action

**Checkpoint**: US6 works; tags fully usable.

---

## Phase 9: User Story 7 - Personal notes with Markdown (Priority: P2)

**Goal**: Add/edit/clear a Markdown note; render formatted and safely.

**Independent Test**: Add a Markdown note → renders formatted and sanitized; edit/clear persists.

### Tests for User Story 7

- [X] T049 [P] [US7] E2E test in `backend/tests/e2e/us7-notes.spec.js` — note persists, renders formatting, and is sanitized (no script execution) (spec scenarios 1–3; FR-009)

### Implementation for User Story 7

- [X] T050 [US7] Implement `backend/src/services/markdown.js` rendering `note_md` with `marked` then sanitizing output with `sanitize-html` (allowlist); expose rendered HTML on the bookmark response (FR-008, FR-009)
- [X] T051 [P] [US7] Build `frontend/src/components/MarkdownNote.jsx` (editor + sanitized rendered view) and integrate into `BookmarkDetail.jsx`

**Checkpoint**: US7 works; notes safe and formatted.

---

## Phase 10: User Story 8 - Bulk and view-wide actions (Priority: P2)

**Goal**: Select multiple → add tags / remove tags / mark read-unread / archive / delete; apply the same actions to all results in the current filtered view; confirm before bulk delete.

**Independent Test**: Bulk action affects exactly the selection; view-wide action affects the whole filtered set; bulk delete requires confirmation.

### Tests for User Story 8

- [X] T052 [P] [US8] E2E test in `backend/tests/e2e/us8-bulk.spec.js` covering selection-based and filter-based (view-wide) actions, add vs remove tags, and delete confirmation (spec scenarios 1, 1a, 2, 3)

### Implementation for User Story 8

- [X] T053 [US8] Implement `POST /api/bookmarks/bulk` in `backend/src/api/bookmarks.js` accepting `target` (`ids` or `filter`) and `action` (`addTags|removeTags|markRead|markUnread|archive|delete`) with `tags` for add/remove; resolve `filter` via the same list query; return `{affected}` (FR-026, FR-026a, FR-027)
- [X] T054 [P] [US8] Build `frontend/src/components/BulkActionBar.jsx` (multi-select + "select all in view") and a `ConfirmDialog.jsx`; wire delete through confirmation (FR-028)

**Checkpoint**: US8 works; bulk management usable.

---

## Phase 11: User Story 9 - Archive separately from delete (Priority: P2)

**Goal**: Archive removes from normal list/search but keeps the item in an archive view; restore returns it; delete is permanent and separate.

**Independent Test**: Archive → gone from list/search, present in archive view; restore → returns; delete → gone entirely.

### Tests for User Story 9

- [X] T055 [P] [US9] E2E test in `backend/tests/e2e/us9-archive.spec.js` covering archive exclusion, archive view, restore, and permanent delete — including that a single-bookmark delete requires confirmation and does not delete when cancelled (spec scenarios 1–5; FR-032)

### Implementation for User Story 9

- [X] T056 [US9] Implement `POST /api/bookmarks/:id/archive` and `/restore` (toggle `is_archived`) and confirm `DELETE /api/bookmarks/:id` hard-deletes with cascade + snapshot file cleanup, in `backend/src/api/bookmarks.js` (FR-029, FR-031, FR-032)
- [X] T057 [US9] Implement `GET /api/bookmarks/archived` list query (FR-030)
- [X] T058 [P] [US9] Build `frontend/src/pages/ArchiveView.jsx` with restore actions and add archive/delete actions to `BookmarkCard.jsx`/`BookmarkDetail.jsx`; every single-bookmark delete MUST route through `ConfirmDialog.jsx` (reused from T054) so it only deletes after explicit confirmation (FR-032)

**Checkpoint**: US9 works; archive vs delete distinct.

---

## Phase 12: User Story 10 - Saved reusable views (Priority: P3)

**Goal**: Save a named view = query + included/excluded tags (+ optional sort); reopen reproduces results; rename/delete.

**Independent Test**: Save a view, reopen → same filtered results; rename/delete persists.

### Tests for User Story 10

- [X] T059 [P] [US10] E2E test in `backend/tests/e2e/us10-saved-views.spec.js` covering create, reopen reproduces results, rename, delete (spec scenarios 1–3)

### Implementation for User Story 10

- [X] T060 [US10] Implement `backend/src/models/views.js` and CRUD endpoints `GET/POST /api/views`, `PATCH/DELETE /api/views/:id` in `backend/src/api/views.js` storing `name, query, include_tags, exclude_tags, sort` (FR-033, FR-034)
- [X] T061 [P] [US10] Build `frontend/src/pages/SavedViews.jsx` and a "save current view" action in `BookmarkList.jsx`; opening a view calls the list with its parameters

**Checkpoint**: US10 works; saved views usable.

---

## Phase 13: User Story 11 - Import and export browser bookmarks (Priority: P3)

**Goal**: Import a Netscape bookmark HTML file preserving titles, tags (folders→tags), and original dates, skipping duplicates; export the same format preserving them.

**Independent Test**: Import a sample file → titles/tags/dates preserved, no duplicates; export → same preserved.

### Tests for User Story 11

- [X] T062 [P] [US11] Unit tests in `backend/tests/unit/import-export.test.js` for parsing folders→tags and `ADD_DATE`→created_at, duplicate skipping by url_key, and round-trip export (FR-035–FR-037)
- [X] T063 [P] [US11] E2E test in `backend/tests/e2e/us11-import-export.spec.js` covering upload import and export download

### Implementation for User Story 11

- [X] T064 [US11] Implement `backend/src/services/importExport.js` — parse Netscape HTML with `cheerio` mapping folders/tags to tags and `ADD_DATE` to `created_at`, skip existing by `url_key`; generate export HTML preserving titles/tags/dates (FR-035–FR-037)
- [X] T065 [US11] Implement `POST /api/import` (multipart) and `GET /api/export` (attachment) in `backend/src/api/importExport.js` returning `{imported,skipped}` for import (FR-036)
- [X] T066 [P] [US11] Build `frontend/src/pages/ImportExport.jsx` with file upload and export download

**Checkpoint**: US11 works; portability in and out.

---

## Phase 14: User Story 12 - Local snapshots and Internet Archive (Priority: P3)

**Goal**: On save, capture a self-contained single-HTML snapshot usable offline (PDF sources kept as original PDF); optional Internet Archive save; snapshot/archive outcomes (success or failure) always visibly surfaced; failures never block saving.

**Independent Test**: HTML snapshot renders offline with network blocked; PDF URL stored as original PDF; Internet Archive records a reference on success; failures shown as a visible `failed` state and don't block saving.

### Tests for User Story 12

- [X] T067 [P] [US12] E2E test in `backend/tests/e2e/us12-snapshots.spec.js` — HTML snapshot renders with the network/original site blocked (self-contained), PDF stored as PDF, Internet Archive outcome surfaced, and a forced failure shows a visible `failed` state without blocking save (spec scenarios 1–5; FR-038–FR-041)

### Implementation for User Story 12

- [X] T068 [US12] Implement `backend/src/services/snapshot.js` — for HTML, render with Playwright then serialize to ONE self-contained `.html` (CSS inlined, images/fonts as `data:` URIs, scripts neutralized, no requests to the origin); for PDF content-type, store the original PDF byte-for-byte; write files to `data/snapshots/<id>/`; set `snapshot_kind` and `snapshot_status` `pending→ready|failed` (FR-038, FR-039)
- [X] T069 [US12] Trigger background snapshot capture from `POST /api/bookmarks` and update `snapshot_status`; on failure record `failed` without blocking the save (FR-041); serve snapshots via `/snapshots/:id/...`
- [X] T070 [US12] Implement `backend/src/services/archiveOrg.js` and `POST /api/bookmarks/:id/archive-org` — submit to Internet Archive Save Page Now out-of-band, set `archive_org_status` `none→pending→ready|failed`, store `archive_org_url` on success; catch all errors as `failed` without affecting the save (FR-040, FR-041)
- [X] T071 [P] [US12] In `frontend/src/components/BookmarkCard.jsx`/`BookmarkDetail.jsx`, show snapshot and Internet Archive status including a visible `failed` state (never silent), a link to view the local snapshot/PDF, and an "Save to Internet Archive" action (FR-041)

**Checkpoint**: US12 works; genuinely self-contained snapshots and visible outcomes.

---

## Phase 15: User Story 13 - Display preferences (Priority: P3)

**Goal**: Set default sort, items shown per page, and font size; persist and apply across sessions.

**Independent Test**: Change each preference, reload → still applied.

### Tests for User Story 13

- [X] T072 [P] [US13] E2E test in `backend/tests/e2e/us13-preferences.spec.js` — change default sort, items-per-page, font size; reload; confirm applied (spec scenarios 1–3)

### Implementation for User Story 13

- [X] T073 [US13] Implement `backend/src/models/preferences.js` and `GET /api/preferences`, `PUT /api/preferences` in `backend/src/api/preferences.js` for `default_sort, items_per_page, font_size` (FR-042, FR-043)
- [X] T074 [US13] Apply preferences as defaults in `GET /api/bookmarks` (sort + pageSize) when not overridden
- [X] T075 [P] [US13] Build `frontend/src/pages/Preferences.jsx` and apply font-size + default sort/page-size across the app, persisting via the API

**Checkpoint**: All 13 user stories complete.

---

## Phase 16: Polish & Cross-Cutting Concerns

**Purpose**: Cross-story quality, performance, and validation.

- [X] T076 [P] Add a seed/fixture script `backend/tests/fixtures/seed.js` to generate ~5,000 bookmarks for performance validation (SC-003/SC-004)
- [X] T077 Verify search/filter returns within 1s at 5,000 bookmarks; add indexes as needed in `backend/src/db/schema.sql` (SC-004)
- [X] T078 [P] Audit safe rendering of all user/web-derived content (titles, descriptions, notes, tags, fetched metadata) across components (FR-009, FR-015)
- [X] T079 [P] Ensure long titles/addresses/notes are stored in full and truncated in display without breaking layout (edge cases)
- [X] T080 Run `quickstart.md` validation scenarios 1–13 end-to-end; capture any COSPEC review screenshots under `prototypes/`
- [X] T081 Confirm `npm install && npm run build && npm start` serves on `0.0.0.0:4000`, the readiness marker appears, and update README/run notes
- [X] T082 [P] Persistence-across-restart test in `backend/tests/e2e/restart-persistence.spec.js` — seed data, fully stop the app process, start it again, and assert bookmarks, tags, notes, read state, archive state, saved views, snapshots (files + status), and preferences all survive the actual restart, not just a page reload (SC-007; FR-043)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies.
- **Foundational (Phase 2)**: depends on Setup; BLOCKS all user stories.
- **User Stories (Phases 3–15)**: all depend on Foundational. In priority order P1 (US1→US4) → P2 (US5→US9) → P3 (US10→US13). Within P1, US2/US3/US4 build on US1's bookmark endpoints.
- **Polish (Phase 16)**: after the desired user stories are complete.

### User Story Dependencies

- **US1 (P1)**: foundational only.
- **US2 (P1)**: extends US1's create/edit (duplicate handling).
- **US3 (P1)**: needs saved bookmarks (US1); independent list/sort/open.
- **US4 (P1)**: needs the list endpoint (US3) and tags for `#tag`; parser/executor are self-contained.
- **US5–US9 (P2)**, **US10–US13 (P3)**: each depends only on foundational + the shared bookmark/list endpoints; otherwise independently testable.

### Within Each User Story

- Tests first (write, expect fail) → models → services → endpoints → UI.
- Commit after each task or logical group; stop at any checkpoint to validate the story independently.

### Parallel Opportunities

- Setup: T003, T004, T005 in parallel.
- Foundational: T010–T015 (marked [P]) in parallel after T006–T009.
- Within a story, `[P]` tasks touch different files (e.g. backend service vs frontend component) and can run in parallel.
- After Foundational, P2/P3 stories can be staffed in parallel since they are independent.

---

## Implementation Strategy

### MVP first

1. Phase 1 Setup → Phase 2 Foundational.
2. Phases 3–6 (US1–US4, all P1): save+enrich, no-duplicate, browse/sort/open, advanced search.
3. **MVP CHECKPOINT**: validate the P1 slice as a working MVP and demo — then continue through P2 and P3 (do not stop permanently at the MVP).

### Incremental delivery

- Add P2 (US5–US9): read-later, tags+suggestions, notes, bulk actions, archive.
- Add P3 (US10–US13): saved views, import/export, snapshots+Internet Archive, preferences.
- Each story is an independently testable increment; run its checkpoint before moving on.

---

## Notes

- `[P]` = different files, no incomplete dependencies.
- `[Story]` labels map tasks to spec user stories for traceability.
- Playwright pinned to `1.61.0`; use shared browsers at `/opt/playwright-browsers` (no second download).
- Enrichment, snapshot, and Internet Archive run in the background; saving is never blocked and every outcome is visibly surfaced.
