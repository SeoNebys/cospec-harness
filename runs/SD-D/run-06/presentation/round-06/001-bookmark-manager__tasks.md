---

description: "Task list for Bookmark Manager implementation"
---

# Tasks: Bookmark Manager

**Input**: Design documents from `/specs/001-bookmark-manager/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api.md, quickstart.md

**Tests**: Targeted tests are included for the highest-risk pure logic (search
parser, URL normalization, import/export) and one end-to-end smoke, per the
testing strategy in plan.md. Full TDD was not requested, so most UI/wiring tasks
have no separate test task.

**Organization**: Tasks are grouped by user story (spec.md priorities). US1 and
US2 are both P1 and together form the MVP.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1–US11)

## Path Conventions

Single web-application project (Express backend + static client). Server under
`src/server/`, client under `src/web/`, tests under `tests/`, runtime data under
`data/` (gitignored). Paths follow plan.md.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and structure.

- [X] T001 Create the directory structure per plan.md: `src/server/{db,routes,services/search,lib}`, `src/web/`, `tests/{unit,integration,e2e}`, and a gitignored `data/` in the repo root.
- [X] T002 Initialize the npm project in `package.json` (ES modules, Node 24) with dependencies `express`, `better-sqlite3`, `cheerio`, `markdown-it`, `sanitize-html`, and dev dependencies `playwright@1.61.0` and `@playwright/test@1.61.0` (pinned to match the installed Chromium); add `"start": "node src/server/index.js"`, `"test": "node --test"`, and `"test:e2e": "playwright test"` scripts.
- [X] T003 [P] Add `.gitignore` (ignoring `node_modules/` and `data/`) and configure basic linting/formatting config at repo root.
- [X] T004 [P] Add a Playwright config `playwright.config.js` that reuses the shared Chromium at `/opt/playwright-browsers` and does not download a second browser revision.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure required by every user story.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T005 Implement the SQLite connection in `src/server/db/connection.js` using `better-sqlite3`, opening `data/bookmarks.db` and setting pragmas (WAL, foreign_keys ON).
- [X] T006 Implement schema creation in `src/server/db/migrations.js` for all entities in data-model.md: `bookmark` (with `normalized_url` **UNIQUE**; `metadata_status`/`preserved_status`/`archive_org_status` enums; `preserved_kind` enum `html`/`pdf`; `is_read`/`is_archived` default false; `date_added`/`date_modified` required), `tag` (`name` **UNIQUE case-insensitive**), `bookmark_tags` (composite PK, FKs ON DELETE CASCADE), `saved_view` (`included_tags`/`excluded_tags` as JSON arrays), and singleton `display_preferences` (`default_sort` enum `newest`/`oldest`/`title`/`recently_modified`, `items_per_view` integer, `text_size` enum `small`/`medium`/`large`). Create the indexes listed in data-model.md.
- [X] T007 Seed the singleton `display_preferences` row (id=1) with defaults (`default_sort='newest'`, `items_per_view=25`, `text_size='medium'`) in `src/server/db/migrations.js`.
- [X] T008 Implement `normalizeUrl` in `src/server/services/normalizeUrl.js`: lowercase scheme and host, default a missing scheme to `https://`, remove a redundant trailing slash on a path-less URL, preserve path/query/fragment case, and reject empty/malformed URLs (FR-002).
- [X] T009 [P] Add unit tests for `normalizeUrl` in `tests/unit/normalizeUrl.test.js` covering missing scheme, trailing slash, host-case, and malformed input.
- [X] T010 Implement `duplicates.js` in `src/server/services/` exposing a lookup of an existing bookmark by `normalized_url` (shared by US1/US2 save and edit) (FR-007).
- [X] T011 Implement the Express app in `src/server/app.js`: JSON body parsing, static hosting of `src/web/`, centralized error handler emitting `{ error: { code, message } }`, and a `GET /healthz` route returning `{ status: "ok" }`.
- [X] T012 Implement the server entry `src/server/index.js` that runs migrations and listens on `0.0.0.0:4000`.
- [X] T013 Create the client shell `src/web/index.html` + `src/web/styles.css` + `src/web/app.js` with an empty app container; set `data-harness-ready="true"` only after the initial UI and first bookmark-list load complete.
- [X] T014 Write `/work/.harness/app.json` as `{"kind":"application","port":4000,"path":"/","start_command":["npm","start"],"start_cwd":"/work"}`.

**Checkpoint**: Foundation ready — server boots, DB schema exists, shared URL/duplicate services available.

---

## Phase 3: User Story 1 - Save a bookmark with automatic metadata (Priority: P1) 🎯 MVP

**Goal**: Save a bookmark by address; auto-collect title/description/icon/preview asynchronously; edit address/title/description; list shows title, description, icon; activating opens the original page.

**Independent Test**: Add a URL, confirm it appears with populated metadata, edit the title, reload — the entry and edit persist.

- [X] T015 [US1] Implement the bookmark repository in `src/server/db/bookmarks.repo.js` (create, getById, list with pagination/sort, update fields) reading/writing the `bookmark` table.
- [X] T016 [US1] Implement `POST /api/bookmarks` in `src/server/routes/bookmarks.js`: validate/normalize the URL (400 on invalid, FR-002), create the row with `date_added`/`date_modified` and `metadata_status='pending'`, return **201** `{ bookmark }`; kick off async metadata capture (T018). Falls back to a readable title from the host when none supplied (FR-003/FR-005).
- [X] T017 [US1] Implement `GET /api/bookmarks` (list, `view=all`, `sort`, `page`, `pageSize`) and `GET /api/bookmarks/:id` in `src/server/routes/bookmarks.js`, excluding archived items from `view=all` (FR-018 baseline).
- [X] T018 [US1] Implement the metadata service in `src/server/services/metadata.js` using Playwright + shared Chromium to extract `<title>`, description/`og:description`, favicon/`apple-touch-icon`, and `og:image`/`twitter:image`; run asynchronously, set `metadata_status='ready'`/`'failed'` without blocking or failing the save (FR-003/FR-005, SC-001).
- [X] T019 [US1] Implement `PATCH /api/bookmarks/:id` in `src/server/routes/bookmarks.js` allowing edits to `url`, `title`, `description` (tags/notes wired in US3/US8); on `url` change re-run normalize + duplicate check and update `date_modified` (FR-004).
- [X] T020 [P] [US1] Build the "add bookmark" form and list rendering in `src/web/app.js`: submit a URL, show each row with title, description, site icon, and preview; activating a row opens the original page in a new tab (FR-033); show a friendly empty state (FR-034).
- [X] T021 [P] [US1] Add inline edit UI in `src/web/app.js` for a bookmark's address, title, and description, persisting via `PATCH`.
- [X] T022 [US1] Add an integration test in `tests/integration/bookmarks.create.test.js` (against a temp DB) for create → list → get → edit-title persistence.

**Checkpoint**: US1 works — save, auto-metadata, edit, list display, open original.

---

## Phase 4: User Story 2 - Saving an existing address routes to the existing bookmark (Priority: P1) 🎯 MVP

**Goal**: Repeat saves (and address edits) never create a copy or silently overwrite; the user is routed to the existing bookmark to edit.

**Independent Test**: Save a URL twice; exactly one entry exists unchanged, and the second save returns the existing bookmark.

- [X] T023 [US2] Extend `POST /api/bookmarks` in `src/server/routes/bookmarks.js` so a normalized-URL match returns **200** `{ bookmark, duplicate: true }` with the existing bookmark and no new row / no field changes (FR-007, SC-003).
- [X] T024 [US2] Extend `PATCH /api/bookmarks/:id` so editing `url` into another bookmark's normalized address returns **409** `{ error, existingId }` instead of merging/overwriting (FR-004/FR-007).
- [X] T025 [P] [US2] In `src/web/app.js`, when a save responds `duplicate: true` (or a 409 on edit), navigate/focus the existing bookmark in an editable state and inform the user it already exists.
- [X] T026 [US2] Add an integration test in `tests/integration/bookmarks.duplicate.test.js` asserting no duplicate row, no silent field change, and trivial-variant matching (scheme, trailing slash, host case).

**Checkpoint**: MVP complete — US1 + US2 deliver save, metadata, edit, and duplicate-safe behavior.

---

## Phase 5: User Story 3 - Organize with tags (Priority: P2)

**Goal**: Assign tags, get suggestions while typing, filter by a tag.

**Independent Test**: Tag several bookmarks (accepting a suggestion), filter by one tag, see only matching bookmarks.

- [X] T027 [P] [US3] Implement a tags repository in `src/server/db/tags.repo.js`: upsert-by-name (case-insensitive merge), list with counts, attach/detach tags to a bookmark via `bookmark_tags` (FR-031 merge rule).
- [X] T028 [US3] Implement `GET /api/tags` and `GET /api/tags/suggest?q=` in `src/server/routes/tags.js` (FR-009/FR-010 source).
- [X] T029 [US3] Extend create/`PATCH` in `src/server/routes/bookmarks.js` to accept a `tags` array, upserting and syncing `bookmark_tags`; include `tags` in the bookmark response object (FR-008).
- [X] T030 [US3] Extend `GET /api/bookmarks` with a `tag` filter param (FR-010).
- [X] T031 [P] [US3] Add a tag input with type-ahead suggestions and a tag filter control in `src/web/app.js`/`src/web/search.js`; render tags on each list row (FR-033).

**Checkpoint**: Tags can be assigned, suggested, filtered, and displayed.

---

## Phase 6: User Story 4 - Powerful search (Priority: P2)

**Goal**: Case-insensitive search across address/title/description/notes/tags with phrases, `#tag`, AND/OR/NOT, grouping, implicit-AND, and quoted-operators-as-literal-text.

**Independent Test**: Run queries mixing a phrase, `#tag`, and boolean/grouping; confirm results match the logical set; `foo #news` behaves as implicit AND; `"NOT ready"` is literal; malformed query returns 400.

- [X] T032 [P] [US4] Implement the tokenizer in `src/server/services/search/tokenize.js`: quoted phrases, `#tag` tokens, parentheses, and `AND`/`OR`/`NOT` operators — treating `AND`/`OR`/`NOT` inside quotes as literal text (FR-013b).
- [X] T033 [US4] Implement the parser in `src/server/services/search/parse.js` producing a boolean AST with precedence `NOT > AND > OR`, grouping via parentheses, and **implicit AND** between adjacent terms with no operator (FR-013/FR-013a); report malformed queries as errors (FR-014).
- [X] T034 [US4] Implement `toSql.js` in `src/server/services/search/` translating the AST to a parameterized SQLite `WHERE` (case-insensitive text match across address/title/description/notes/tags; `#tag` via `bookmark_tags` join), always excluding archived items (FR-011/FR-012/FR-018).
- [X] T035 [US4] Implement `GET /api/search?q=&sort=&page=&pageSize=` in `src/server/routes/search.js` returning `{ items, total }` or **400** on malformed query (FR-014).
- [X] T036 [P] [US4] Add unit tests in `tests/unit/search.test.js` covering case-insensitivity, exact phrase, `#tag`, AND/OR/NOT, grouping precedence, implicit-AND (`foo #news`), quoted-operator-as-literal (`"NOT ready"`), and malformed-query errors.
- [X] T037 [P] [US4] Wire the search box in `src/web/search.js` to `/api/search` with result rendering and a clear no-match state (FR-034).

**Checkpoint**: Full search semantics work end-to-end.

---

## Phase 7: User Story 5 - Read-later workflow (Priority: P2)

**Goal**: Mark read/unread; dedicated unread view.

**Independent Test**: Mark items unread → appear in unread view; mark read → leave it.

- [X] T038 [US5] Implement `POST /api/bookmarks/:id/read` (body `{ isRead }`) in `src/server/routes/bookmarks.js`, persisting `is_read` (FR-015).
- [X] T039 [US5] Extend `GET /api/bookmarks` `view=unread` to return `is_archived=false AND is_read=false` (FR-016).
- [X] T040 [P] [US5] Add an unread view and a per-row read/unread toggle in `src/web/app.js`.

**Checkpoint**: Read-later workflow functions.

---

## Phase 8: User Story 6 - Archive instead of delete (Priority: P2)

**Goal**: Reversible archive hidden from normal browse/search with its own view; permanent delete requires confirmation.

**Independent Test**: Archive → gone from normal browse + search, present in archive view; restore → returns; delete requires confirmation.

- [X] T041 [US6] Implement `POST /api/bookmarks/:id/archive` (body `{ archived }`) in `src/server/routes/bookmarks.js`, toggling `is_archived` for archive/restore (FR-017/FR-019).
- [X] T042 [US6] Add `view=archive` to `GET /api/bookmarks` returning only `is_archived=true`, and confirm normal browse + `GET /api/search` exclude archived items (FR-018).
- [X] T043 [US6] Implement `DELETE /api/bookmarks/:id?confirm=true` in `src/server/routes/bookmarks.js` (400 without confirm), cascading `bookmark_tags` removal (FR-020).
- [X] T044 [P] [US6] Add an archive view, per-row archive/restore actions, and a confirm dialog for permanent delete in `src/web/app.js`.

**Checkpoint**: Archiving, restoring, and confirmed deletion all work; archived items hidden from normal views/search.

---

## Phase 9: User Story 7 - Sort, bulk actions, and saved views (Priority: P2)

**Goal**: Choose sort order; multi-select (incl. select-all-matching) and bulk add-tags/remove-tags/read/unread/archive/delete; save search+tag combinations as named views.

**Independent Test**: Change sort; select all results of a search and bulk-add and bulk-remove a tag; save a search+tag view and reopen it.

- [X] T045 [US7] Ensure `GET /api/bookmarks` and `GET /api/search` honor `sort` values `newest`/`oldest`/`title`/`recently_modified` (FR-021).
- [X] T046 [US7] Implement `POST /api/bookmarks/bulk` in `src/server/routes/bookmarks.js` accepting a selection (`ids[]` or `matchQuery`/`matchView`/`matchTag`) and an action (`addTags`/`removeTags`/`markRead`/`markUnread`/`archive`/`delete`, `delete` requiring `confirm:true`), returning `{ affected }` (FR-022/FR-023).
- [X] T047 [P] [US7] Implement saved-views repository in `src/server/db/views.repo.js` (create/list/delete; store `included_tags`/`excluded_tags` as JSON arrays) (FR-024).
- [X] T048 [US7] Implement `src/server/routes/views.js`: `GET/POST /api/views`, `DELETE /api/views/:id`, and `GET /api/views/:id/results` resolving search text + included/excluded tags to `{ items, total }` (FR-024).
- [X] T049 [P] [US7] Add sort controls, multi-select with "select all matching", a bulk-action menu, and saved-views UI (save current search+tag filter, list, reopen) in `src/web/search.js`/`src/web/app.js`.

**Checkpoint**: Large-collection management (sort, bulk, saved views) works.

---

## Phase 10: User Story 8 - Rich notes (Priority: P3)

**Goal**: Formatted notes authored in Markdown, rendered safely when viewed; notes are searchable.

**Independent Test**: Add a formatted note, reopen, and see the formatting rendered.

- [X] T050 [P] [US8] Implement `src/server/lib/notes.js` rendering `notes_markdown` via `markdown-it` and sanitizing with `sanitize-html` (conservative allowlist); expose `notesHtml` (FR-025).
- [X] T051 [US8] Extend create/`PATCH` and the bookmark response in `src/server/routes/bookmarks.js` to accept `notesMarkdown` and return rendered `notesHtml`; ensure notes text is included in search matching (FR-011/FR-025).
- [X] T052 [P] [US8] Add a note editor and rendered-note display in `src/web/app.js`.

**Checkpoint**: Rich notes persist and render.

---

## Phase 11: User Story 9 - Preserve a local copy (Priority: P3)

**Goal**: Self-contained HTML for ordinary pages, original PDF for PDF links; optional Internet Archive; all async and non-blocking.

**Independent Test**: A page yields an openable self-contained `.html`; a PDF link yields the original `.pdf`; Internet Archive records a reference or reports failure without blocking save.

- [X] T053 [US9] Implement `src/server/services/preserve.js`: content-type sniff; for a PDF stream original bytes to `data/preserved/<id>.pdf` (`preserved_kind='pdf'`); for a page render in Chromium and write a single self-contained HTML (inlined CSS/images/fonts) to `data/preserved/<id>.html` (`preserved_kind='html'`); set `preserved_status` and never block/fail the save (FR-026/FR-027/FR-029).
- [X] T054 [US9] Implement `src/server/services/archiveOrg.js` submitting the URL to the Internet Archive "Save Page Now" asynchronously, recording `archive_org_url`/`archive_org_status`, surfacing failures without blocking (FR-028/FR-029).
- [X] T055 [US9] Implement `src/server/routes/preservation.js`: `POST /api/bookmarks/:id/preserve/local` (202), `GET /api/bookmarks/:id/preserve/local/file` (serve `.html`/`.pdf`, 404 if not ready), `POST /api/bookmarks/:id/preserve/archive-org` (202). Trigger local preservation automatically on create.
- [X] T056 [P] [US9] Add preservation status/actions per bookmark in `src/web/app.js`: open local copy, request Internet Archive, and show failure states honestly.

**Checkpoint**: Local + optional Internet Archive preservation work without blocking saves.

---

## Phase 12: User Story 10 - Import and export browser bookmarks (Priority: P3)

**Goal**: Import a standard Netscape bookmark file (preserve titles, tags, original dates; reconcile duplicates; merge same-named tags); export a valid re-importable file.

**Independent Test**: Import preserving titles/tags/dates with no duplicate creation; export and re-import.

- [X] T057 [P] [US10] Implement `src/server/services/bookmarksImport.js` parsing Netscape HTML with `cheerio` (`HREF`, link-text title, `TAGS`, `ADD_DATE`→original date), reconciling existing normalized addresses via `duplicates.js` and merging same-named tags (FR-030/FR-031).
- [X] T058 [P] [US10] Implement `src/server/services/bookmarksExport.js` emitting Netscape HTML with `HREF`/title/`TAGS`/`ADD_DATE` (FR-032).
- [X] T059 [US10] Implement `src/server/routes/importexport.js`: `POST /api/import` (multipart upload) returning `{ imported, reconciled, skipped }`, and `GET /api/export` returning the HTML attachment.
- [X] T060 [P] [US10] Add unit tests in `tests/unit/importexport.test.js` asserting title/tag/date preservation, no duplicate creation, and round-trip export→import.
- [X] T061 [P] [US10] Add import (file picker) and export (download) UI in `src/web/app.js`.

**Checkpoint**: Import/export interoperate with standard browser bookmark files.

---

## Phase 13: User Story 11 - Personal display preferences (Priority: P3)

**Goal**: Set default sort, items-per-view, and text size; apply and persist across sessions.

**Independent Test**: Change preferences, reload, confirm they apply.

- [X] T062 [US11] Implement `src/server/routes/preferences.js`: `GET /api/preferences` and `PUT /api/preferences` (`default_sort`, `items_per_view`, `text_size`) against the singleton row (FR-035).
- [X] T063 [P] [US11] Add a preferences screen in `src/web/app.js` and apply `default_sort` (list default), `items_per_view` (page size), and `text_size` (root CSS class in `src/web/styles.css`) on load (FR-035).

**Checkpoint**: Preferences drive list behavior and text size across sessions.

---

## Phase 14: Polish & Cross-Cutting Concerns

**Purpose**: Cross-story validation and hardening.

- [X] T064 [P] Add an end-to-end smoke in `tests/e2e/smoke.spec.js` (@playwright/test 1.61.0, shared Chromium): save → auto-metadata → tag → search → archive, and assert `data-harness-ready="true"`.
- [X] T065 Seed ~1,000 bookmarks in a throwaway DB and verify browse/sort/filter/search respond under 1s (SC-004); add indexes if needed.
- [X] T066 [P] Write `README.md` with setup/run/test instructions mirroring quickstart.md.
- [X] T067 Run the quickstart.md validation scenarios (all 11) and confirm the app boots via `npm start` on `0.0.0.0:4000` with the harness marker set.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies.
- **Foundational (Phase 2)**: Depends on Setup; **blocks all user stories**.
- **User Stories (Phases 3–13)**: All depend on Foundational. US1 then US2 form the MVP; US3–US11 can follow in priority order or in parallel once foundation is done.
- **Polish (Phase 14)**: Depends on the desired user stories being complete.

### User Story Dependencies

- **US1 (P1)**: After Foundational. No dependency on other stories.
- **US2 (P1)**: Builds on US1's save/edit endpoints (extends duplicate behavior).
- **US3 (P2)**: After Foundational; extends bookmark create/edit + list.
- **US4 (P2)**: After Foundational; search benefits from US3 tags but `#tag` degrades gracefully if run first.
- **US5, US6 (P2)**: After Foundational; independent toggles/views.
- **US7 (P2)**: Uses search (US4), tags (US3), read (US5), archive (US6) for bulk/saved-views but is testable on whatever exists.
- **US8 (P3)**: Extends bookmark create/edit + search.
- **US9 (P3)**: Independent; async services.
- **US10 (P3)**: Uses `duplicates.js` + tags.
- **US11 (P3)**: Independent; influences list defaults.

### Within Each User Story

- Repositories/models before services; services before endpoints; endpoints before client UI.

### Parallel Opportunities

- Setup: T003, T004 in parallel.
- Foundational: T009 parallel with other foundation work once T008 exists.
- Within stories, tasks marked [P] touch different files and can run together (e.g. T020/T021; T032/T036/T037; T057/T058/T060/T061).
- After Foundational, different stories can be built in parallel by different developers.

---

## Implementation Strategy

### MVP First (US1 + US2)

1. Phase 1 Setup → 2. Phase 2 Foundational → 3. Phase 3 (US1) → 4. Phase 4 (US2).
5. **STOP and VALIDATE**: save, auto-metadata, edit, and duplicate-safe routing.

### Incremental Delivery

Add US3 → US4 → US5 → US6 → US7 (completes the "manage a growing collection"
core), then US8 → US9 → US10 → US11, validating each independently, then Polish.

---

## Notes

- [P] = different files, no incomplete-task dependencies.
- Each user story is independently testable at its checkpoint.
- All external work (metadata, preservation, Internet Archive, import fetches) is
  async/non-blocking and must never fail a save (FR-005/FR-029).
- Commit after each task or logical group.
