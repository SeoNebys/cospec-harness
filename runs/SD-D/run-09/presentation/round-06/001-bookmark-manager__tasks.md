---

description: "Task list for Bookmark Manager implementation"
---

# Tasks: Bookmark Manager

**Input**: Design documents from `/specs/001-bookmark-manager/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Included. The plan (Decision 12) adopts a testing strategy and the
search grammar is a strict contract; test tasks target the high-value pure logic
and the API surface. Playwright is pinned to 1.61.0 to match the shared browser.

**Organization**: Grouped by user story (US1–US10) so each is independently
implementable and testable.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: US1..US10 for story-phase tasks
- File paths follow the single-project structure in plan.md (`src/server`, `src/web`, `tests`)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and build tooling

- [ ] T001 Create the project directory structure per plan.md (`src/server/{db,routes,services,lib}`, `src/server/services/search`, `src/web/{routes,components,api}`, `src/shared`, `tests/{unit,api,e2e,fixtures}`, `data/`) and add `.gitignore` excluding `data/`, `node_modules/`, `dist/`
- [ ] T002 Initialize the Node.js 24 ESM project in `package.json` with scripts `start` (node src/server/index.js), `build` (vite build), `test` (vitest run), `test:e2e` (playwright test); install runtime deps (express, better-sqlite3, cheerio, marked, dompurify, multer, react, react-dom) and dev deps (vite, @vitejs/plugin-react, vitest, supertest, @playwright/test@1.61.0, single-file-cli); preserve the lockfile
- [ ] T003 [P] Configure ESLint + Prettier for ESM/React in `.eslintrc.json` and `.prettierrc`
- [ ] T004 [P] Configure Vite (frontend root `src/web`, build output `dist/`) in `vite.config.js`, and Playwright in `playwright.config.js` pinned to 1.61.0 using the shared browsers path `/opt/playwright-browsers` (no second browser download)
- [ ] T005 [P] Write `/work/.harness/app.json` = `{"kind":"application","port":4000,"path":"/","start_command":["npm","start"],"start_cwd":"/work"}`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure required by every user story

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T006 Implement the SQLite connection (`better-sqlite3`, WAL + foreign_keys pragmas) opening `data/bookmarks.db` in `src/server/db/connection.js`
- [ ] T007 Implement schema migrations in `src/server/db/migrations.js` creating tables per data-model.md: `bookmarks` (id PK; url; normalizedUrl **UNIQUE**; title; description; note; faviconPath nullable; previewImagePath nullable; read boolean default false; archived boolean default false; snapshotType enum `html|pdf|none`; snapshotPath nullable; snapshotStatus enum `pending|available|unavailable`; webArchiveUrl nullable; metadataStatus enum `collected|fallback`; dateAdded; dateUpdated), `tags` (id PK; name UNIQUE case-insensitive), `bookmark_tags` (bookmarkId FK cascade, tagId FK, PK(bookmarkId,tagId)), `saved_filters` (id PK; name UNIQUE; query; includeTags; excludeTags; dateCreated), `display_preferences` (singleton: defaultSort, itemsPerPage 10–200 default 25, fontSize `small|medium|large` default medium)
- [ ] T008 [P] Define shared enums/constants (sort keys `dateAdded_desc|dateAdded_asc|title_asc|title_desc|dateUpdated_desc`, snapshotType/status, metadataStatus, fontSize, view names `all|unread|archived`) in `src/shared/constants.js`
- [ ] T009 [P] Implement the ID generator (ULID-style opaque string) in `src/server/lib/ids.js`
- [ ] T010 Implement the Express bootstrap in `src/server/index.js`: JSON body parsing, mount `/api` routers, serve built frontend from `dist/`, centralized error-handling middleware returning the `Error` schema, and `app.listen(4000, '0.0.0.0')`
- [ ] T011 [P] Implement URL normalization + validation in `src/server/services/urlNormalize.js` per Decision 9: add missing scheme (default `https://`), lower-case host, strip trailing slash on empty path, strip default port, keep path/query case-sensitive; expose `normalize(url)` and `isValidWebUrl(url)`; reject invalid addresses (FR-004)
- [ ] T012 [P] Implement the base bookmark repository (row↔object mapping incl. tags join, insert/get/update/delete primitives, tag upsert) in `src/server/services/bookmarks.js`
- [ ] T013 [P] Implement the in-process background job queue skeleton (enqueue, sequential worker, per-job error isolation) in `src/server/services/jobQueue.js`
- [ ] T014 Scaffold the React app shell in `src/web/main.jsx` with client-side routes (All, Unread, Archived, Edit, Filters, Preferences) and set `data-harness-ready="true"` only after the initial list/empty-state has loaded; add the API fetch client in `src/web/api/client.js`

**Checkpoint**: Foundation ready — user stories can begin.

---

## Phase 3: User Story 1 - Save a bookmark with automatic details (Priority: P1) 🎯 MVP

**Goal**: Enter a URL, review and edit auto-collected title/description/favicon/preview, then commit within 15s; fall back to derived details if the page can't be read promptly.

**Independent Test**: Add a reachable URL → review shows collected details → edit title → save → it appears with the edited title; add an unreachable URL → fallback details returned promptly and saved.

### Tests for User Story 1

- [ ] T015 [P] [US1] Unit tests for metadata parsing (title, `og:description`/meta description, `og:image`, favicon incl. `/favicon.ico` fallback, relative→absolute) against local HTML fixtures in `tests/unit/metadata.test.js`
- [ ] T016 [P] [US1] API tests for `POST /api/bookmarks/preview` (collected + fallback on timeout, invalid URL → 400) and `POST /api/bookmarks` (201 with reviewed values persisted) in `tests/api/bookmarks-create.test.js`

### Implementation for User Story 1

- [ ] T017 [P] [US1] Implement the pre-commit metadata service in `src/server/services/metadata.js`: bounded (~8s) fetch + Cheerio parse returning title/description/favicon/preview and `metadataStatus`; on timeout/error return `fallback` (host-derived title, empty description) per Decision 5 / FR-007
- [ ] T018 [US1] Implement `POST /api/bookmarks/preview` in `src/server/routes/bookmarks.js`: validate URL (400 if invalid), normalize, if normalizedUrl exists return `{existing: <Bookmark>}` (FR-006), else return collected/fallback details (persists nothing)
- [ ] T019 [US1] Implement `POST /api/bookmarks` (commit) in `src/server/routes/bookmarks.js`: persist reviewed url/title/description/note/tags with `dateAdded`/`dateUpdated`, applying title fallback to host/URL when empty (FR-007); return 201 (or 200 `existing` if normalizedUrl already present)
- [ ] T020 [P] [US1] Implement the Add-bookmark form in `src/web/components/AddBookmarkForm.jsx`: URL entry → preview call → editable title/description review → commit; show fallback state; route to the existing bookmark's edit view when preview returns `existing`
- [ ] T021 [US1] Wire the Add form into the app shell / All view in `src/web/routes/AllView.jsx`

**Checkpoint**: US1 fully functional — save with reviewed details + fallback.

---

## Phase 4: User Story 2 - Re-saving an existing address opens it for editing (Priority: P1)

**Goal**: Submitting an already-bookmarked address (incl. trivial variants) opens the existing bookmark for editing instead of duplicating.

**Independent Test**: Save a URL, submit the same URL and a trailing-slash/scheme/host-case variant → the existing bookmark's edit view opens, no duplicate row.

### Tests for User Story 2

- [ ] T022 [P] [US2] Unit tests for normalization equivalence (trailing slash, missing/added scheme, host letter-case, default port) in `tests/unit/urlNormalize.test.js`
- [ ] T023 [P] [US2] API test asserting duplicate submit returns the existing bookmark (no new row) for exact and variant URLs in `tests/api/bookmarks-dedup.test.js`

### Implementation for User Story 2

- [ ] T024 [US2] Ensure dedup resolution in both `preview` and commit paths uses `normalizedUrl` and returns the existing bookmark consistently in `src/server/routes/bookmarks.js` (FR-005/006)
- [ ] T025 [US2] Implement client handling that navigates to the existing bookmark's edit view on an `existing` response in `src/web/components/AddBookmarkForm.jsx`

**Checkpoint**: US2 works — no duplicates; re-save opens edit.

---

## Phase 5: User Story 3 - Browse, search, and open bookmarks (Priority: P2)

**Goal**: List rows show title/description/favicon/tags; search supports text, `#tag`, quoted phrases, AND/OR/NOT+parentheses (text+`#tag` ⇒ both match; quoted operators are literals); open originals in a new tab.

**Independent Test**: Run the worked examples from `contracts/search-grammar.md`; confirm results, malformed-query errors, and open-in-new-tab.

### Tests for User Story 3

- [ ] T026 [P] [US3] Unit tests for the search parser covering every row in `contracts/search-grammar.md` incl. implicit-AND (`invoice #work`), quoted operators as literals (`"this AND that"`), precedence, and the error cases (dangling operator, unbalanced quote/paren) in `tests/unit/search-parser.test.js`
- [ ] T027 [P] [US3] Unit tests for AST evaluation over sample bookmarks (text substring, phrase, `#tag` membership, boolean) in `tests/unit/search-evaluate.test.js`
- [ ] T028 [P] [US3] API tests for `GET /api/bookmarks` (view, q, sort, pagination, 400 on malformed q) in `tests/api/bookmarks-list.test.js`

### Implementation for User Story 3

- [ ] T029 [P] [US3] Implement the search tokenizer + boolean AST parser in `src/server/services/search/parser.js` per `contracts/search-grammar.md` (implicit AND; precedence `()` > NOT > AND > OR; quoted operators literal; throw a typed SyntaxError on malformed input)
- [ ] T030 [P] [US3] Implement AST evaluation in `src/server/services/search/evaluate.js`: case-insensitive substring/phrase over combined title+description+note+url, and `#tag` membership
- [ ] T031 [US3] Implement `GET /api/bookmarks` list in `src/server/routes/bookmarks.js` + `src/server/services/bookmarks.js`: candidate selection by view (normal excludes archived), apply parsed search + tag include/exclude, sorting (FR-018), pagination; malformed q → 400 (FR-016)
- [ ] T032 [P] [US3] Implement the bookmark list view + row component (favicon, title, description, tags, add-date) with search box, empty states, and open-in-new-tab in `src/web/routes/AllView.jsx` and `src/web/components/BookmarkRow.jsx`

**Checkpoint**: US3 works — browse, advanced search, open.

---

## Phase 6: User Story 4 - Organize and edit bookmarks (Priority: P2)

**Goal**: Edit address/title/description/note/tags with existing-tag suggestions; notes stored as Markdown and rendered (sanitized) on view; delete with confirmation.

**Independent Test**: Edit all fields incl. address; note renders formatted; tag suggestions appear; delete (confirmed) removes everywhere.

### Tests for User Story 4

- [ ] T033 [P] [US4] API tests for `PATCH /api/bookmarks/{id}` (fields incl. url change; url collision → 400), `DELETE /api/bookmarks/{id}`, and `GET /api/tags?prefix=` suggestions in `tests/api/bookmarks-edit.test.js`
- [ ] T034 [P] [US4] Unit test that Markdown rendering sanitizes/escapes untrusted content (no script execution) in `tests/unit/markdown.test.js`

### Implementation for User Story 4

- [ ] T035 [US4] Implement `PATCH /api/bookmarks/{id}` in `src/server/routes/bookmarks.js`: update url (re-normalize + validate; reject collision with another bookmark), title, description, note, tags; bump `dateUpdated` (FR-008)
- [ ] T036 [US4] Implement `DELETE /api/bookmarks/{id}` in `src/server/routes/bookmarks.js`: hard-delete row + tag links + snapshot file (FR-011)
- [ ] T037 [P] [US4] Implement `GET /api/tags` with prefix suggestions ranked by prefix then usage count in `src/server/routes/tags.js` (FR-009)
- [ ] T038 [P] [US4] Implement the sanitized Markdown renderer (`marked` + DOMPurify) in `src/web/components/MarkdownView.jsx` (FR-010)
- [ ] T039 [P] [US4] Implement the tag type-ahead input in `src/web/components/TagInput.jsx` using `GET /api/tags`
- [ ] T040 [US4] Implement the Edit-bookmark view (all fields, tag input, note preview, delete-with-confirm) in `src/web/routes/EditView.jsx`

**Checkpoint**: US4 works — full edit/organize/delete.

---

## Phase 7: User Story 5 - Read-later and archive workflows (Priority: P2)

**Goal**: New bookmarks default unread; Unread view; archive is reversible, separate from delete; archived items excluded from normal list/search and have their own searchable view.

**Independent Test**: New → in Unread; mark read; archive → leaves normal list/search; appears in Archived; un-archive → returns unchanged.

### Tests for User Story 5

- [ ] T041 [P] [US5] API tests: mark read/unread and archive/unarchive via PATCH; normal + unread views exclude archived; archived view includes only archived and is searchable in `tests/api/views-archive.test.js`

### Implementation for User Story 5

- [ ] T042 [US5] Extend list/view queries in `src/server/services/bookmarks.js` for `unread` (archived=false AND read=false) and `archived` (archived=true) views, excluding archived from normal views (FR-021/023)
- [ ] T043 [US5] Ensure `PATCH /api/bookmarks/{id}` handles `read` and `archived` toggles as reversible, non-destructive updates in `src/server/routes/bookmarks.js` (FR-022)
- [ ] T044 [P] [US5] Implement the Unread and Archived views + read/archive/unarchive row actions in `src/web/routes/UnreadView.jsx` and `src/web/routes/ArchivedView.jsx`

**Checkpoint**: US5 works — read-later + reversible archive.

---

## Phase 8: User Story 6 - Sort and act on many bookmarks at once (Priority: P3)

**Goal**: Sort by multiple criteria; select individual items or all-matching-current-view; bulk add/remove tag, mark read/unread, archive, delete (delete needs confirmation).

**Independent Test**: Sort by title and date; select several and select-all-matching; bulk tag + bulk archive apply to all; bulk delete requires confirmation.

### Tests for User Story 6

- [ ] T045 [P] [US6] API tests for `POST /api/bookmarks/bulk` with explicit `ids` and with `match` (select-all-matching), each action, and `confirmDelete` required for delete in `tests/api/bookmarks-bulk.test.js`

### Implementation for User Story 6

- [ ] T046 [US6] Implement `POST /api/bookmarks/bulk` in `src/server/routes/bookmarks.js`: resolve target set from `ids` or `match` (view+q+tags), apply action (addTag/removeTag/markRead/markUnread/archive/unarchive/delete), require `confirmDelete` for delete, return `{affected}` (FR-024/025)
- [ ] T047 [P] [US6] Implement multi-select + "select all matching" + bulk-action bar (with delete confirmation) in `src/web/components/BulkActionBar.jsx` and wire into the list views
- [ ] T048 [P] [US6] Add the sort-order control to the list views in `src/web/components/SortControl.jsx` (uses the existing `sort` list param)

**Checkpoint**: US6 works — sorting + bulk actions.

---

## Phase 9: User Story 7 - Import and export browser bookmarks (Priority: P3)

**Goal**: Import a Netscape bookmarks HTML file preserving titles/addresses/dates and folders→tags, skipping duplicates with an added-vs-skipped count; export the same format (tags as folders, dates preserved).

**Independent Test**: Import a fixture → titles/dates/tags preserved, duplicates skipped with counts; export → re-imports and round-trips.

### Tests for User Story 7

- [ ] T049 [P] [US7] Unit tests for Netscape parse (folders→tags, `ADD_DATE`→date, nested folders) and serialize, plus a parse→serialize→parse round-trip, using `tests/fixtures/bookmarks.html` in `tests/unit/netscape.test.js`
- [ ] T050 [P] [US7] API tests for `POST /api/import` (added/skipped counts, dedup) and `GET /api/export` (valid Netscape output) in `tests/api/import-export.test.js`

### Implementation for User Story 7

- [ ] T051 [P] [US7] Implement Netscape import parser + export serializer in `src/server/services/netscape.js` (Cheerio; folders↔tags; epoch `ADD_DATE`↔date) per Decision 8
- [ ] T052 [US7] Implement `POST /api/import` (Multer upload → parse → insert non-duplicate normalizedUrls → `{added, skipped}`) and `GET /api/export` (Netscape HTML download) in `src/server/routes/importExport.js` (FR-026/027/028)
- [ ] T053 [P] [US7] Implement the Import/Export UI (file upload + result summary, export download button) in `src/web/routes/ImportExportView.jsx`

**Checkpoint**: US7 works — Netscape import/export.

---

## Phase 10: User Story 8 - Local snapshots and web archival (Priority: P3)

**Goal**: On commit, background-capture a self-contained single HTML snapshot (PDFs downloaded as PDFs), tracked via status, never overwriting the person's title/description; serve snapshots; optional Internet Archive preservation storing a link.

**Independent Test**: Save a page → single-file HTML snapshot openable standalone; save a PDF URL → stored/opens as PDF; trigger Internet Archive → link stored (or clear unavailable); confirm background capture never changes an edited title/description.

### Tests for User Story 8

- [ ] T054 [P] [US8] Unit tests: content-type routing (html vs pdf), and the **no-overwrite rule** — snapshot completion writes only snapshot fields (and favicon/preview if empty), never title/description — in `tests/unit/snapshot.test.js`
- [ ] T055 [P] [US8] API test for `POST /api/bookmarks/{id}/web-archive` with the Internet Archive stubbed (success stores link; unreachable → 502, bookmark unchanged) in `tests/api/web-archive.test.js`

### Implementation for User Story 8

- [ ] T056 [P] [US8] Implement the snapshot service in `src/server/services/snapshot.js`: detect content-type; PDF → download to `data/snapshots/<id>.pdf`; else SingleFile (`single-file-cli` + shared Chromium) → `data/snapshots/<id>.html`; set `snapshotType/snapshotStatus/snapshotPath`; on failure set `unavailable`; **update only snapshot fields (+favicon/preview if empty), never title/description** (Decision 11)
- [ ] T057 [US8] Register the snapshot job on the queue and enqueue it from the commit endpoint (T019) after create in `src/server/services/jobQueue.js` and `src/server/routes/bookmarks.js`
- [ ] T058 [US8] Implement `GET /api/bookmarks/{id}/snapshot` serving stored HTML/PDF (404 when pending/unavailable) in `src/server/routes/bookmarks.js`
- [ ] T059 [P] [US8] Implement the Internet Archive service (Save Page Now → resolve archived URL; unreachable handled) in `src/server/services/webArchive.js` and `POST /api/bookmarks/{id}/web-archive` route (FR-030)
- [ ] T060 [P] [US8] Add snapshot open link, snapshot-status indicator, and "Preserve in Internet Archive" action to the Edit view in `src/web/routes/EditView.jsx`

**Checkpoint**: US8 works — snapshots + web archival, edits protected.

---

## Phase 11: User Story 9 - Saved filters (Priority: P3)

**Goal**: Save a named filter (search + included/excluded tags), re-apply/edit/delete; applying never affects bookmarks.

**Independent Test**: Create filter (keyword + include tag + exclude tag) → re-apply matches exactly; edit/delete leaves bookmarks untouched.

### Tests for User Story 9

- [ ] T061 [P] [US9] API tests for filters CRUD and that applying a filter yields `query AND include-tags AND NOT exclude-tags` in `tests/api/filters.test.js`

### Implementation for User Story 9

- [ ] T062 [US9] Implement saved-filters CRUD in `src/server/routes/filters.js` and persistence in `src/server/services/bookmarks.js` (or a `filters` service), and apply include/exclude tags as an outer AND/AND-NOT around the parsed query (FR-032)
- [ ] T063 [P] [US9] Implement the saved-filters UI (create from current search+tags, list, apply, edit, delete) in `src/web/routes/FiltersView.jsx`

**Checkpoint**: US9 works — saved filters.

---

## Phase 12: User Story 10 - Display preferences (Priority: P3)

**Goal**: Persist and apply default sort, items-per-page (10–200), and font size across reloads.

**Independent Test**: Change each preference, reload → still applied.

### Tests for User Story 10

- [ ] T064 [P] [US10] API tests for `GET/PUT /api/preferences` incl. out-of-range `itemsPerPage` → 400 in `tests/api/preferences.test.js`

### Implementation for User Story 10

- [ ] T065 [US10] Implement `GET/PUT /api/preferences` (singleton row, bounds: itemsPerPage 10–200, enums for sort/fontSize) in `src/server/routes/preferences.js` (FR-033)
- [ ] T066 [P] [US10] Implement the Preferences UI and apply defaultSort, items-per-page pagination, and font-size scaling app-wide in `src/web/routes/PreferencesView.jsx`

**Checkpoint**: US10 works — display preferences persist.

---

## Phase 13: Polish & Cross-Cutting Concerns

**Purpose**: Integration validation, hardening, and delivery readiness

- [ ] T067 [P] Add test fixtures: `tests/fixtures/bookmarks.html` (folders + ADD_DATE), a sample page HTML, and a small PDF for metadata/snapshot tests
- [ ] T068 [P] Add a Playwright E2E flow (save → review → search → edit → archive → import/export) in `tests/e2e/bookmark-flow.spec.js`
- [ ] T069 Performance check: seed ~1,000 bookmarks and assert search/sort < 1s (SC-003) in `tests/api/performance.test.js`
- [ ] T070 [P] Security hardening: sanitize rendered notes (verify DOMPurify config), serve snapshots as inert/downloaded content, validate/limit upload size on import
- [ ] T071 [P] Write `README.md` with build/run/test instructions mirroring `quickstart.md`
- [ ] T072 Run `npm install && npm run build`, start the server, and validate all 10 `quickstart.md` scenarios against `http://127.0.0.1:4000`; confirm `data-harness-ready` appears and `.harness/app.json` is correct

---

## Dependencies & Execution Order

### Phase dependencies

- **Setup (P1)** → no dependencies.
- **Foundational (P2)** → depends on Setup; **blocks all user stories**.
- **User Stories (P3–P12)** → all depend on Foundational.
  - US2 builds on US1's create/preview paths.
  - US5, US6, US9 build on US3's list/search.
  - US8 wires into US1's commit endpoint (snapshot enqueue) — keep US1 functional without it.
  - Otherwise stories are independently testable.
- **Polish (P13)** → after the desired stories are complete.

### Recommended order

Setup → Foundational → US1 → US2 → US3 → US4 → US5 → US6 → US7 → US8 → US9 → US10 → Polish.

### Parallel opportunities

- Setup: T003, T004, T005 in parallel.
- Foundational: T008, T009, T011, T012, T013 in parallel after T006/T007; T014 in parallel (frontend).
- Within a story, `[P]` tasks (different files) run together — e.g. US3: T026/T027/T028 (tests) then T029/T030/T032 (parser, evaluate, UI) in parallel before T031 wires the endpoint.

---

## Parallel Example: User Story 3

```bash
# Tests first (parallel):
Task: "Search parser unit tests in tests/unit/search-parser.test.js"
Task: "Search evaluate unit tests in tests/unit/search-evaluate.test.js"
Task: "List API tests in tests/api/bookmarks-list.test.js"

# Then implementation (parser/evaluate/UI parallel; endpoint after):
Task: "Parser in src/server/services/search/parser.js"
Task: "Evaluate in src/server/services/search/evaluate.js"
Task: "List UI in src/web/routes/AllView.jsx + components/BookmarkRow.jsx"
```

---

## Implementation Strategy

### MVP (US1 only)

1. Phase 1 Setup → 2. Phase 2 Foundational → 3. Phase 3 US1 → **STOP & validate** save-with-review + fallback → demo.

### Incremental delivery

Add US2 (dedup) → US3 (browse/search) → US4 (edit) → US5 (read-later/archive) → US6 (sort/bulk) → US7 (import/export) → US8 (snapshots/archive) → US9 (filters) → US10 (preferences), validating each independently.

---

## Notes

- `[P]` = different files, no incomplete dependencies.
- Tests target high-value pure logic (search grammar, URL normalization, Netscape format, snapshot no-overwrite) and the API surface; network steps are stubbed against fixtures.
- Keep Playwright pinned to 1.61.0; reuse `/opt/playwright-browsers`.
- Commit after each task or logical group; stop at any checkpoint to validate a story.
