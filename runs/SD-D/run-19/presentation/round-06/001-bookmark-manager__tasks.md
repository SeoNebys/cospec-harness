---
description: "Task list for Bookmark Manager implementation"
---

# Tasks: Bookmark Manager

**Input**: Design documents from `/specs/001-bookmark-manager/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Included — plan.md defines a testing strategy (`node --test` for unit/integration; Playwright 1.61.0 e2e per user story).

**Organization**: Tasks are grouped by user story (US1–US13) in priority order so each story is an independently testable increment.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: The user story a task belongs to

## Path Conventions

Single web-application project (per plan.md): `src/` (Express API + backend modules), `public/` (build-free SPA), `tests/`, `data/` (runtime).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and structure.

- [X] T001 Create project directory structure per plan.md: `src/{db/migrations,models,services/search,api,lib}`, `public/{css,js/views,js/components}`, `tests/{unit,integration,e2e}`, `data/preserved/`.
- [X] T002 Initialize Node.js project in `/work/package.json` (ES modules `"type":"module"`) with dependencies express, better-sqlite3, markdown-it, sanitize-html, node-html-parser, and devDependencies `@playwright/test` pinned to `1.61.0`; add scripts `start`, `migrate`, `test` (`node --test`), `test:e2e`. Preserve `package-lock.json`.
- [X] T003 [P] Add `.gitignore` for `data/` and `node_modules/`, and configure Playwright in `playwright.config.js` to reuse shared browsers at `/opt/playwright-browsers` (no second browser download) with baseURL `http://127.0.0.1:4000`.
- [X] T004 [P] Write `/work/.harness/app.json` with `{"kind":"application","port":4000,"path":"/","start_command":["npm","start"],"start_cwd":"/work"}`.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST exist before any user story. **⚠️ No user story work begins until this phase is complete.**

- [X] T005 Create SQLite connection + migration runner in `src/db/index.js` (better-sqlite3 at `data/bookmarks.db`, foreign keys ON) and a migrate entrypoint invoked by `npm run migrate`.
- [X] T006 Author initial schema migration in `src/db/migrations/001_init.sql` per data-model.md: tables `bookmark`, `tag` (name UNIQUE COLLATE NOCASE), `bookmark_tags` (PK(bookmark_id,tag_id), FKs ON DELETE CASCADE), `saved_search`, `preferences` (singleton CHECK(id=1)); indexes UNIQUE(bookmark.url_key), UNIQUE(tag.name COLLATE NOCASE), INDEX(is_archived,is_read), INDEX(date_added), INDEX(title COLLATE NOCASE). Include all Bookmark fields (url, url_key, title NOT NULL, description, note_md, favicon_url, preview_image_url, is_read default 0, is_archived default 0, metadata_unavailable default 0, preserved_html_path, preserved_pdf_path, archive_org_url, date_added NOT NULL, date_modified NOT NULL).
- [X] T007 Seed the singleton `preferences` row on migrate with defaults `default_sort='date_added_desc'`, `items_per_page=25`, `text_size='medium'` (allowed values: default_sort ∈ {date_added_desc,date_added_asc,title_asc,title_desc}; text_size ∈ {small,medium,large}).
- [X] T008 [P] Implement URL validation & normalisation in `src/lib/url.js`: reject non-http(s)/malformed URLs; produce canonical `url_key` (lowercase scheme/host, strip default ports and trailing slash, keep query) for duplicate detection.
- [X] T009 [P] Implement Markdown render helper in `src/lib/markdown.js` using markdown-it + sanitize-html allowlist (returns sanitised HTML from Markdown source).
- [X] T010 Bootstrap Express app in `src/server.js`: JSON body parsing, static serving of `public/`, `/api` router mount, centralised error handler returning `{error:{code,message}}`, listen on `0.0.0.0:4000`. Mount points are added by later story tasks.
- [X] T011 [P] Create frontend app shell in `public/index.html` + `public/js/app.js` + `public/css/styles.css`: view router scaffold and a place to set `data-harness-ready="true"` after initial load; `public/js/api.js` fetch wrappers. (Views/components filled per story.)

**Checkpoint**: Foundation ready — user stories can begin.

---

## Phase 3: User Story 1 - Save a bookmark with automatic metadata (Priority: P1) 🎯 MVP

**Goal**: Save a URL; auto-fetch title/description/favicon/preview; let the user adjust title/description before the first save; fail soft when metadata is unavailable.

**Independent Test**: Add a bookmark by URL → collected title/description are shown editable → adjust and save → row shows adjusted title, description, favicon, and persists after reload; an unreachable URL still saves with a derived title and "metadata unavailable".

### Tests for User Story 1

- [X] T012 [P] [US1] Unit tests for `src/lib/url.js` (valid/invalid URLs, canonical url_key equality) in `tests/unit/url.test.js`.
- [X] T013 [P] [US1] Integration test for POST `/api/bookmarks/preview` and POST `/api/bookmarks` (create, derived-title fallback, metadata_unavailable flag) in `tests/integration/bookmarks-create.test.js`.
- [X] T014 [P] [US1] Playwright e2e: save a bookmark, adjust title before save, verify row + persistence, in `tests/e2e/us1-save.spec.js`.

### Implementation for User Story 1

- [X] T015 [P] [US1] Implement metadata service in `src/services/metadata.js`: load URL in Chromium (Playwright), extract title, description (meta/OG), favicon, preview (og:image/twitter:image); time-bounded; on failure return derived title + `metadataUnavailable:true` (FR-003/004).
- [X] T016 [US1] Implement bookmark create/read in `src/models/bookmark.js`: insert with url_key, derived-title fallback (title NOT NULL), date_added/date_modified; get-by-id; get-by-url_key for duplicate lookup.
- [X] T017 [US1] Implement `POST /api/bookmarks/preview` in `src/api/bookmarks.js`: validate URL (400 on invalid), fetch metadata, return collected fields + `existing` when url_key already saved (FR-003a/005-preview).
- [X] T018 [US1] Implement `POST /api/bookmarks` and `GET /api/bookmarks/:id` in `src/api/bookmarks.js`: create with adjusted title/description; return 200 `{existing}` if url_key already exists (FR-005); mount router in `src/server.js`.
- [X] T019 [P] [US1] Frontend save flow in `public/js/views/edit.js` + `public/js/components/searchbar.js` (add-URL entry): call preview, show editable title/description, submit create, show unavailable-metadata indicator.
- [X] T020 [US1] Frontend bookmark row component in `public/js/components/bookmarkRow.js` showing title, description, favicon; render into the main list view `public/js/views/list.js` and set `data-harness-ready` after initial list load.

**Checkpoint**: US1 fully functional — save with metadata is a usable MVP.

---

## Phase 4: User Story 2 - Save-or-edit on duplicate address (Priority: P1)

**Goal**: Saving an already-saved URL opens the existing bookmark for editing instead of duplicating.

**Independent Test**: Save a URL, save it again → existing bookmark opens in edit view; no second entry.

### Tests for User Story 2

- [X] T021 [P] [US2] Integration test: second create/preview of same url_key returns `existing` and creates no duplicate, in `tests/integration/bookmarks-duplicate.test.js`.
- [X] T022 [P] [US2] Playwright e2e: duplicate save routes to edit view, in `tests/e2e/us2-duplicate.spec.js`.

### Implementation for User Story 2

- [X] T023 [US2] Frontend: on `existing` response from preview/create, navigate to the edit view for that id (`public/js/app.js` routing + `public/js/views/edit.js`).

**Checkpoint**: US1+US2 work; duplicates never created.

---

## Phase 5: User Story 3 - Edit a bookmark's fields (Priority: P1)

**Goal**: Edit address, title, description, tags, and Markdown note; conflicts on address are warned, not duplicated; note renders formatted.

**Independent Test**: Edit all fields incl. note (Markdown) and tags → reload → changes persist; note renders; editing address to an existing one warns.

### Tests for User Story 3

- [X] T024 [P] [US3] Unit tests for `src/lib/markdown.js` (Markdown → sanitised HTML; script stripped) in `tests/unit/markdown.test.js`.
- [X] T025 [P] [US3] Integration test for `PATCH /api/bookmarks/:id` incl. 409 on url_key conflict (FR-007) in `tests/integration/bookmarks-edit.test.js`.
- [X] T026 [P] [US3] Playwright e2e: edit fields + note, verify persistence and rendered note, in `tests/e2e/us3-edit.spec.js`.

### Implementation for User Story 3

- [X] T027 [US3] Extend `src/models/bookmark.js` with update (address/title/description/note_md/tags), setting date_modified and returning noteHtml; reject url_key collision with another id.
- [X] T028 [US3] Implement `PATCH /api/bookmarks/:id` and `DELETE /api/bookmarks/:id` in `src/api/bookmarks.js` (400 invalid URL, 409 conflict, 204 delete removing preserved files).
- [X] T029 [US3] Frontend edit view `public/js/views/edit.js`: full field editing incl. Markdown note textarea + rendered preview, tag editing hook, conflict warning display.

**Checkpoint**: Full save/duplicate/edit lifecycle (all P1) complete.

---

## Phase 6: User Story 4 - Browse, sort and open (Priority: P2)

**Goal**: List shows title/description/tags/favicon; sortable by date added and title (both directions); open in new tab.

**Independent Test**: Rows show all four fields; change sort to Title A–Z reorders; opening loads correct address.

### Tests for User Story 4

- [X] T030 [P] [US4] Integration test for `GET /api/bookmarks` sort options and shape in `tests/integration/bookmarks-list.test.js`.
- [X] T031 [P] [US4] Playwright e2e: sorting + open-in-new-tab + row fields, in `tests/e2e/us4-list.spec.js`.

### Implementation for User Story 4

- [X] T032 [US4] Implement list query in `src/models/bookmark.js`: scope predicate (is_archived=0), sort ∈ {date_added_desc,date_added_asc,title_asc(COLLATE NOCASE),title_desc}, paging (page/pageSize), returning items+total; include tags per row.
- [X] T033 [US4] Implement `GET /api/bookmarks` in `src/api/bookmarks.js` wiring query params (q/includeTags/excludeTags/scope/sort/page/pageSize — search/tag params consumed in US5/US7).
- [X] T034 [US4] Frontend list view `public/js/views/list.js`: render rows with title/description/tags/favicon, sort control, open-in-new-tab; empty state.

**Checkpoint**: Browsing/sorting/opening usable.

---

## Phase 7: User Story 5 - Advanced search (Priority: P2)

**Goal**: Case-insensitive substring search over title/description/note/address; `#tag` ANDed with text; quoted phrases; AND/OR/NOT/parentheses; quoted operators literal; invalid queries reported.

**Independent Test**: Run search-grammar example table; confirm `"AND"` literal, `report #news` both-match, `"foo` reports invalid.

### Tests for User Story 5

- [X] T035 [P] [US5] Unit tests for tokenizer/parser in `tests/unit/search-parser.test.js` covering every row of contracts/search-grammar.md worked-examples (incl. errors: unbalanced-quote, unbalanced-paren, dangling operator).
- [X] T036 [P] [US5] Integration test for `GET /api/bookmarks?q=...` semantics + 400 on invalid query in `tests/integration/search.test.js`.
- [X] T037 [P] [US5] Playwright e2e: representative queries return expected sets, in `tests/e2e/us5-search.spec.js`.

### Implementation for User Story 5

- [X] T038 [P] [US5] Implement tokenizer in `src/services/search/tokenizer.js` (phrases, `#tag`, unquoted operators AND/OR/NOT, parentheses, words; quoted operator → literal).
- [X] T039 [US5] Implement recursive-descent parser → AST in `src/services/search/parser.js` (precedence NOT>AND>OR, implicit AND adjacency; throw typed errors for unbalanced/dangling).
- [X] T040 [US5] Implement AST→parameterised SQL compiler in `src/services/search/compile.js` (word/phrase → LIKE over title/description/note_md/url with `%`/`_`/`\` escaped, ESCAPE '\', COLLATE NOCASE; tag term → EXISTS join; AND/OR/NOT/grouping).
- [X] T041 [US5] Integrate compiled WHERE into list query (`src/models/bookmark.js`) and return 400 with clear message on parse error (`src/api/bookmarks.js`, FR-017).
- [X] T042 [US5] Frontend search bar `public/js/components/searchbar.js`: submit query, show invalid-query message, no-match empty state.

**Checkpoint**: Advanced search works with all boolean/tag/phrase rules.

---

## Phase 8: User Story 6 - Read-later and read/unread (Priority: P2)

**Goal**: Mark read-later/unread and read; a separate Unread view.

**Independent Test**: Mark unread → appears in Unread view; mark read → leaves it.

### Tests for User Story 6

- [X] T043 [P] [US6] Integration test for read/unread PATCH and `scope=unread` listing in `tests/integration/read-state.test.js`.
- [X] T044 [P] [US6] Playwright e2e: read-later flow + Unread view empty state, in `tests/e2e/us6-readlater.spec.js`.

### Implementation for User Story 6

- [X] T045 [US6] Add read/unread transitions to `src/models/bookmark.js` and honour `scope=unread` (is_archived=0 AND is_read=0) in the list query.
- [X] T046 [US6] Frontend Unread view `public/js/views/unread.js` + read/unread toggle on the row component; empty state.

**Checkpoint**: Read-later workflow usable.

---

## Phase 9: User Story 7 - Tagging with suggestions and filtering (Priority: P2)

**Goal**: Assign tags; suggest already-used tags while typing; include/exclude tag filters.

**Independent Test**: Typing a tag suggests existing tags; include one tag and exclude another filters correctly.

### Tests for User Story 7

- [X] T047 [P] [US7] Integration test for `GET /api/tags?prefix=` suggestions and include/exclude filtering in `tests/integration/tags.test.js`.
- [X] T048 [P] [US7] Playwright e2e: tag suggestion + include/exclude filter, in `tests/e2e/us7-tags.spec.js`.

### Implementation for User Story 7

- [X] T049 [P] [US7] Implement tag model in `src/models/tag.js`: upsert tags (case-insensitive), attach/detach to bookmarks, list with counts, prefix suggestions.
- [X] T050 [US7] Implement `GET /api/tags` (with `prefix`) in `src/api/tags.js`; mount router; apply includeTags/excludeTags in the list query (`src/models/bookmark.js`).
- [X] T051 [US7] Frontend tag input with suggestions `public/js/components/tagInput.js` and include/exclude tag filter UI in the list view.

**Checkpoint**: Tagging, suggestions, and filtering usable.

---

## Phase 10: User Story 8 - Bulk actions on selections (Priority: P2)

**Goal**: Select several, or all matching the complete current view (search + tag filters + scope), then add/remove tags, mark read/unread, archive, delete (delete confirmed).

**Independent Test**: Select several → add tag applies to all; with search active, "select all matching" → archive removes every match (not just the page).

### Tests for User Story 8

- [X] T052 [P] [US8] Integration test for `POST /api/bookmarks/bulk` with `ids` and with `matchAll` (respecting q/includeTags/excludeTags/scope) for each action in `tests/integration/bulk.test.js`.
- [X] T053 [P] [US8] Playwright e2e: multi-select add-tag + select-all-matching archive, in `tests/e2e/us8-bulk.spec.js`.

### Implementation for User Story 8

- [X] T054 [US8] Implement bulk resolver+executor in `src/models/bookmark.js`: resolve selection from explicit ids OR the full current-view result set (reuse list scope+search+tag filters, no paging); apply addTags/removeTags/markRead/markUnread/archive/restore/delete; return affected count.
- [X] T055 [US8] Implement `POST /api/bookmarks/bulk` in `src/api/bookmarks.js` (delete requires a confirmed flag, FR-025).
- [X] T056 [US8] Frontend selection UI `public/js/components/bulkBar.js`: row checkboxes, "select all matching current view", action buttons with delete confirmation.

**Checkpoint**: Bulk maintenance over selections and whole views works.

---

## Phase 11: User Story 9 - Archive, separate from deletion (Priority: P2)

**Goal**: Archive hides from normal lists/searches, shows in Archive view, is restorable; permanent delete is distinct and confirmed.

**Independent Test**: Archive → gone from normal lists/searches, present in Archive view → restore returns it; delete → gone everywhere.

### Tests for User Story 9

- [X] T057 [P] [US9] Integration test: archived excluded from normal/search/unread lists, included only in `scope=archive`; restore; permanent delete removes preserved files, in `tests/integration/archive.test.js`.
- [X] T058 [P] [US9] Playwright e2e: archive→archive view→restore, and permanent delete, in `tests/e2e/us9-archive.spec.js`.

### Implementation for User Story 9

- [X] T059 [US9] Add archive/restore transitions to `src/models/bookmark.js` and `scope=archive` (is_archived=1) to the list query; ensure all normal/search/unread queries keep is_archived=0.
- [X] T060 [US9] Frontend Archive view `public/js/views/archive.js` with restore and permanent-delete (confirmed) actions.

**Checkpoint**: Reversible archive vs irreversible delete complete.

---

## Phase 12: User Story 10 - Saved searches (Priority: P3)

**Goal**: Save named query + include/exclude tags; revisit reproduces results; delete without affecting bookmarks.

**Independent Test**: Save a query with include/exclude tags → revisit reproduces set → delete it (bookmarks unaffected).

### Tests for User Story 10

- [X] T061 [P] [US10] Integration test for saved-search CRUD + reproduction in `tests/integration/saved-searches.test.js`.
- [X] T062 [P] [US10] Playwright e2e: create/revisit/delete saved search, in `tests/e2e/us10-saved.spec.js`.

### Implementation for User Story 10

- [X] T063 [P] [US10] Implement saved-search model in `src/models/savedSearch.js` (name, query_text, include_tags/exclude_tags as JSON arrays, date_added).
- [X] T064 [US10] Implement `GET/POST/DELETE /api/saved-searches` in `src/api/savedSearches.js`; mount router.
- [X] T065 [US10] Frontend saved-searches view `public/js/views/savedSearches.js`: save current query+tag filters, list, revisit (re-applies query+filters), delete.

**Checkpoint**: Saved searches usable.

---

## Phase 13: User Story 11 - Preserved copy of the page (Priority: P3)

**Goal**: Preserve web pages as a single self-contained local HTML; store original PDF for PDF links; optional Internet Archive snapshot; all fail-soft.

**Independent Test**: Preserve HTML → open offline copy; preserve PDF link → original PDF stored; request Internet Archive → snapshot link stored; force failure → bookmark unaffected.

### Tests for User Story 11

- [X] T066 [P] [US11] Integration test for `/preserve` (HTML file produced; PDF passthrough by content-type) and `/archive-org`, plus fail-soft (bookmark unchanged, error returned), in `tests/integration/preservation.test.js`.
- [X] T067 [P] [US11] Playwright e2e: preserve a local test page and open the stored copy, in `tests/e2e/us11-preserve.spec.js`.

### Implementation for User Story 11

- [X] T068 [P] [US11] Implement preservation service in `src/services/preservation.js`: render page in Chromium and serialise to self-contained HTML (inline CSS/images/fonts as data URIs) + sanitise → `data/preserved/<id>.html`; if content-type/extension is PDF, download original PDF → `data/preserved/<id>.pdf`; Internet Archive Save-Page-Now submit returning snapshot URL; all errors non-fatal.
- [X] T069 [US11] Implement `POST /api/bookmarks/:id/preserve`, `POST /api/bookmarks/:id/archive-org`, `GET /api/bookmarks/:id/preserved` in `src/api/preservation.js` (update bookmark paths/url; 502 fail-soft leaving bookmark unaffected); mount router.
- [X] T070 [US11] Frontend: preserve / archive.org actions on the edit view and a link to open the preserved copy (`public/js/views/edit.js`).

**Checkpoint**: Page preservation usable.

---

## Phase 14: User Story 12 - Import and export (Priority: P3)

**Goal**: Import Netscape bookmark HTML preserving titles/tags/dates, no duplicates, reporting unreadable entries; export to the same format.

**Independent Test**: Import a Netscape file → titles/tags/dates preserved, duplicates skipped, bad entries reported; export re-imports without loss.

### Tests for User Story 12

- [X] T071 [P] [US12] Unit tests for importer/exporter in `tests/unit/import-export.test.js` (parse HREF/ADD_DATE/TAGS; round-trip; malformed entry reported).
- [X] T072 [P] [US12] Integration test for `POST /api/import` (dedupe/report) and `GET /api/export` in `tests/integration/import-export.test.js`.
- [X] T073 [P] [US12] Playwright e2e: import a fixture file then export, in `tests/e2e/us12-import-export.spec.js`.

### Implementation for User Story 12

- [X] T074 [P] [US12] Implement importer in `src/services/importer.js` (node-html-parser over `<DT><A>`; read href/title/ADD_DATE/TAGS; skip existing url_key; collect failures).
- [X] T075 [P] [US12] Implement exporter in `src/services/exporter.js` (emit Netscape HTML incl. titles, ADD_DATE, TAGS).
- [X] T076 [US12] Implement `POST /api/import` (multipart) and `GET /api/export` in `src/api/importExport.js`; mount router.
- [X] T077 [US12] Frontend import/export controls in `public/js/views/preferences.js` (file upload + result summary; export download).

**Checkpoint**: Migration in/out works.

---

## Phase 15: User Story 13 - Display preferences (Priority: P3)

**Goal**: Set and persist default sort, items-per-page, text size.

**Independent Test**: Set preferences → reload → still applied.

### Tests for User Story 13

- [X] T078 [P] [US13] Integration test for `GET/PUT /api/preferences` (validation of allowed values) in `tests/integration/preferences.test.js`.
- [X] T079 [P] [US13] Playwright e2e: change preferences, reload, verify applied, in `tests/e2e/us13-preferences.spec.js`.

### Implementation for User Story 13

- [X] T080 [P] [US13] Implement preferences model in `src/models/preferences.js` (read/update singleton; validate default_sort/text_size enums, items_per_page positive integer).
- [X] T081 [US13] Implement `GET/PUT /api/preferences` in `src/api/preferences.js`; mount router.
- [X] T082 [US13] Frontend preferences view `public/js/views/preferences.js`: controls apply defaults (sort, page size) and text size (CSS hook), persisted and applied on load.

**Checkpoint**: All 13 stories independently functional.

---

## Phase 16: Polish & Cross-Cutting Concerns

- [X] T083 [P] Add long-title/description/address truncation styling (full value preserved) across row/edit views in `public/css/styles.css` (edge cases).
- [X] T084 [P] Verify responsiveness/clarity of all views and consistent empty states.
- [X] T085 Run the full quickstart.md manual validation and the automated suites (`npm test`, `npm run test:e2e`); fix any gaps.
- [X] T086 Confirm review-environment readiness: server binds `0.0.0.0:4000`, `data-harness-ready` set post-load, `.harness/app.json` accurate, Playwright still pinned to 1.61.0 with no extra browser download.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies.
- **Foundational (Phase 2)**: depends on Setup — **blocks all user stories**.
- **User Stories (Phases 3–15)**: depend on Foundational. P1 stories (US1–US3) should land first as the MVP; later stories build on shared list/query code but each is independently testable.
- **Polish (Phase 16)**: after desired stories complete.

### User Story Dependencies

- **US1 (P1)**: foundation only.
- **US2 (P1)**: builds on US1 create/preview (duplicate routing).
- **US3 (P1)**: builds on US1 (edit lifecycle); enables tag editing consumed by US7.
- **US4 (P2)**: foundation + US1 (list of created bookmarks).
- **US5 (P2)**: extends US4 list query with the search pipeline.
- **US6 (P2)**: extends list query with read scope.
- **US7 (P2)**: tags; integrates with US3 edit and US4 list filters.
- **US8 (P2)**: reuses US4/US5/US7 view resolution for "select all matching".
- **US9 (P2)**: archive scope across all list/search queries.
- **US10 (P3)**: reuses US5 search + US7 tags.
- **US11, US12, US13 (P3)**: largely independent add-ons.

### Within Each User Story

- Tests written first and expected to fail → models → services → endpoints → frontend.

### Parallel Opportunities

- Setup: T003, T004 in parallel.
- Foundational: T008, T009, T011 in parallel (after T005–T007 schema).
- Within a story, `[P]` tasks (distinct files, e.g. the test tasks, and independent models/services) run in parallel.
- After Foundational, P1 stories can be staffed in parallel with care around shared `src/api/bookmarks.js` and `src/models/bookmark.js` (sequential where they touch the same file).

---

## Implementation Strategy

### MVP First

1. Phase 1 Setup → 2. Phase 2 Foundational → 3. Phase 3 US1 → **validate US1 independently** (save with metadata). This is a demoable MVP.

### Incremental Delivery

Add US2, US3 (completes P1 lifecycle), then P2 stories (US4–US9) for browse/search/read-later/tags/bulk/archive, then P3 stories (US10–US13). Each story is validated independently before moving on. Finish with Phase 16 polish + quickstart validation.
