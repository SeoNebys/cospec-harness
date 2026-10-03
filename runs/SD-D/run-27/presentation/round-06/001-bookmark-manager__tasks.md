---

description: "Task list for Bookmark Manager implementation"
---

# Tasks: Bookmark Manager

**Input**: Design documents from `/specs/001-bookmark-manager/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api.md, quickstart.md

**Tests**: Included — the plan and quickstart explicitly require unit, contract, and e2e tests.

**Organization**: Tasks are grouped by user story (US1–US12) for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: User story the task serves (US1–US12); Setup/Foundational/Polish carry no story label
- File paths follow the structure in plan.md (`server/`, `client/`, `tests/` at repo root)

---

## Phase 1: Setup (Shared Infrastructure)

- [ ] T001 Create project structure per plan.md (`server/`, `client/`, `data/`, `tests/{unit,contract,e2e}/`) at repo root `/work`
- [ ] T002 Initialize root `package.json` with scripts `start` (node server/index.js), `build` (vite build client), `test` (node --test), `test:e2e` (playwright test); add `.gitignore` for `node_modules/` and `data/`
- [ ] T003 Install server dependencies in `/work/package.json`: express, better-sqlite3, playwright@1.61.0, node-html-parser, markdown-it, sanitize-html; keep lockfile intact and reuse `/opt/playwright-browsers`
- [ ] T004 [P] Initialize React+Vite client in `client/` (client `package.json`, `vite.config.js` building to `client/dist`, `index.html`, `src/main.jsx`, `src/App.jsx`) with @playwright/test@1.61.0 as dev dep
- [ ] T005 [P] Configure linting/formatting (eslint + prettier configs) at repo root

---

## Phase 2: Foundational (Blocking Prerequisites)

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T006 Create SQLite schema in `server/db/schema.sql` for all entities in data-model.md: `bookmarks` (with `url` required, `url_key` required + UNIQUE, `title`, `description`, `note`, `icon_url`, `preview_image_url`, `created_at` required, `updated_at` required, `read_later` 0/1, `is_read` 0/1, `is_archived` 0/1, `metadata_status` in `ok|partial|failed`), `tags` (with UNIQUE index on `lower(name)`), `bookmark_tags` (PK `(bookmark_id, tag_id)`, FKs cascade), `saved_searches`, `preserved_copies` (`kind` in `html|pdf`), `preferences` (singleton id=1: `default_sort` in `date_added|title|last_updated`, `items_per_page`, `text_size` in `small|medium|large`)
- [ ] T007 Create FTS5 virtual table `bookmark_fts(title, description, note, url)` plus insert/update/delete sync triggers in `server/db/schema.sql`
- [ ] T008 Implement DB connection + migration bootstrap in `server/db/db.js` (open `data/app.db`, apply schema on first run, seed preferences singleton with defaults)
- [ ] T009 Create Express app + server entry in `server/index.js`: JSON middleware, mount `/api` router, serve `client/dist` static assets and SPA fallback, listen on `0.0.0.0:4000`; centralized error handler emitting `{error:{code,message}}`
- [ ] T010 [P] Implement URL normalizer in `server/lib/urlNormalize.js`: validate http/https well-formedness; compute `url_key` by lower-casing host and dropping default port (80/443) ONLY — preserve path, query, fragment, trailing slash (per research §7, FR-007)
- [ ] T011 [P] Implement note sanitize/render in `server/notes/render.js` using markdown-it + sanitize-html allow-list (bold, italic, headings, lists, links, code), neutralizing unsafe markup (FR-009)
- [ ] T012 [P] Create client API fetch wrappers in `client/src/api.js` and base app shell/layout + router in `client/src/App.jsx`, including the `data-harness-ready="true"` marker set after initial view + data load
- [ ] T013 [P] Unit test URL normalizer in `tests/unit/urlNormalize.test.js` (safe-equivalence only: host case + default port collapse; trailing slash / query / utm params stay distinct; malformed rejected)
- [ ] T014 [P] Unit test note render/sanitize in `tests/unit/notesRender.test.js` (formatting rendered; script/unsafe markup stripped)

**Checkpoint**: Foundation ready — server boots, DB persists, dedup key + note rendering available.

---

## Phase 3: User Story 1 - Save a link with automatic metadata (Priority: P1) 🎯 MVP

**Goal**: Save a bookmark by URL with auto-fetched title/description/icon/preview; title & description editable; graceful fallback on fetch failure.

**Independent Test**: POST a valid URL → bookmark created with fetched metadata shown; edit title/description persists; unreachable URL still creates with `metadata_status: failed` + retry.

- [ ] T015 [P] [US1] Contract test POST /api/bookmarks (create + edited fields) in `tests/contract/bookmarks.create.test.js`
- [ ] T016 [P] [US1] Implement Playwright metadata fetcher in `server/lib/metadata.js` (OG/meta title, description, preview image; favicon resolution; fallback + `metadata_status`; reuse pinned browser)
- [ ] T017 [US1] Implement bookmark create service + POST /api/bookmarks in `server/api/bookmarks.js` (validate url→400; derive title from url when missing per FR-004; set timestamps; set `metadata_status`)
- [ ] T018 [US1] Implement POST /api/bookmarks/:id/retry-metadata in `server/api/bookmarks.js` (FR-005)
- [ ] T019 [US1] Implement GET /api/bookmarks/:id detail (with tags, preserved copies, rendered note HTML) in `server/api/bookmarks.js`
- [ ] T020 [P] [US1] Build add-bookmark form + BookmarkCard + DetailView (editable title/description) in `client/src/components/` and `client/src/views/`
- [ ] T021 [US1] Wire ListView to show newest-first and render each item (title, description, icon, preview) in `client/src/views/ListView.jsx`

**Checkpoint**: A user can save links with metadata and edit them — MVP usable.

---

## Phase 4: User Story 2 - No duplicates; open existing on re-save (Priority: P1)

**Goal**: Re-saving an existing address returns the existing bookmark for editing; never creates a copy.

**Independent Test**: POST same URL twice → second returns existing (`duplicate:true`), no new row; safe-equivalent variants collapse, trailing-slash/query variants stay distinct.

- [ ] T022 [P] [US2] Contract test duplicate handling in `tests/contract/bookmarks.dedup.test.js` (POST twice; safe-equivalent collapse; distinct variants; PATCH url collision → 409)
- [ ] T023 [US2] Enforce dedup in POST /api/bookmarks in `server/api/bookmarks.js`: on existing `url_key` return 200 `{bookmark, duplicate:true}` with no insert; offer metadata update (FR-006)
- [ ] T024 [US2] On duplicate resolution, surface option to update stored metadata vs keep existing (US2 scenario 3) in `server/api/bookmarks.js` + DetailView
- [ ] T025 [US2] Client: on duplicate response, navigate to existing bookmark in editable state in `client/src/views/`

**Checkpoint**: No duplicates possible via save.

---

## Phase 5: User Story 3 - Editable fields, formatted note, tag suggestions (Priority: P1)

**Goal**: Editable address, title, tags, description, note (formatted); unique tags; existing-tag suggestions while typing.

**Independent Test**: PATCH all fields incl. note markdown → persists and renders formatted; editing url to an existing one is prevented; typing tag shows suggestions; duplicate tag name reuses existing tag.

- [ ] T026 [P] [US3] Contract test PATCH /api/bookmarks/:id + GET /api/tags in `tests/contract/bookmarks.edit.tags.test.js` (field edits; url collision 409; tag suggestions; case-insensitive tag reuse)
- [ ] T027 [P] [US3] Unit test tag uniqueness (case-insensitive reuse, no second tag) in `tests/unit/tags.test.js`
- [ ] T028 [US3] Implement tag service in `server/api/tags.js`: get-or-create by name reusing case-insensitive match (FR-010a); GET /api/tags?prefix for suggestions (FR-010)
- [ ] T029 [US3] Implement PATCH /api/bookmarks/:id in `server/api/bookmarks.js` (edit url/title/description/note/tags; re-compute url_key; collision→409; update updated_at)
- [ ] T030 [P] [US3] Implement TagInput autocomplete component in `client/src/components/TagInput.jsx`
- [ ] T031 [US3] DetailView: edit all fields incl. note editor; render note HTML on display in `client/src/views/DetailView.jsx`

**Checkpoint**: Full bookmark data model editable with unique tags and safe formatted notes.

---

## Phase 6: User Story 4 - Advanced search (Priority: P2)

**Goal**: Case-insensitive search across title/description/note/address with `#tag`, quoted phrases, AND/OR/NOT, parentheses, quoted-literal operators; clear errors on malformed queries.

**Independent Test**: Run boolean/phrase/#tag queries and confirm correct results; `"AND"` matches literally; unbalanced parens → 400.

- [ ] T032 [P] [US4] Unit test query parser in `tests/unit/queryParser.test.js` (precedence NOT>AND>OR; parentheses; quoted phrases; `#tag`; quoted-literal operators; malformed → error)
- [ ] T033 [P] [US4] Contract test GET /api/search / GET /api/bookmarks?q in `tests/contract/search.test.js`
- [ ] T034 [US4] Implement tokenizer + recursive-descent parser → expression tree in `server/lib/queryParser.js` (operators only when unquoted; implicit AND for adjacent terms; FR-012/FR-013)
- [ ] T035 [US4] Compile expression tree to SQL over FTS5 leaves + tag-membership subqueries in `server/api/search.js`; malformed → 400 `bad_query`
- [ ] T036 [US4] Wire `q`, `include_tags`, `exclude_tags` into GET /api/bookmarks list in `server/api/bookmarks.js`
- [ ] T037 [P] [US4] Implement SearchBar with live results + empty state in `client/src/components/SearchBar.jsx`

**Checkpoint**: Powerful retrieval works across the collection.

---

## Phase 7: User Story 5 - Read-later list (Priority: P2)

**Goal**: Mark read-later, view separate list, mark read/unread (read state independent of read-later).

**Independent Test**: Mark read-later→appears in list; mark read→leaves list; mark unread→returns.

- [ ] T038 [P] [US5] Contract test read-later/read flags in `tests/contract/readlater.test.js`
- [ ] T039 [US5] Implement read_later + is_read toggles via PATCH in `server/api/bookmarks.js` (independent flags, FR-015/FR-016) and `view=read_later` in GET list
- [ ] T040 [P] [US5] Implement ReadLater view + controls + empty state in `client/src/views/ReadLater.jsx`

**Checkpoint**: Read-later workflow functional.

---

## Phase 8: User Story 6 - Archive without deleting (Priority: P2)

**Goal**: Archive (hide from main), browse archive, restore (retain prior read-later/read state), permanent delete with confirmation.

**Independent Test**: Archive→leaves main, in archive; restore→returns with states; delete→confirmed permanent removal; search works within archive.

- [ ] T041 [P] [US6] Contract test archive/restore/delete in `tests/contract/archive.test.js`
- [ ] T042 [US6] Implement is_archived toggle + `view=archive` filtering + DELETE /api/bookmarks/:id in `server/api/bookmarks.js` (restore retains read_later/is_read, FR-018)
- [ ] T043 [P] [US6] Implement Archive view with search/filter + delete confirmation in `client/src/views/Archive.jsx`

**Checkpoint**: Archive lifecycle complete.

---

## Phase 9: User Story 7 - Bulk actions (Priority: P2)

**Goal**: Select items or all-matching; bulk add/remove tags, archive/unarchive, mark read/unread, delete (single confirm; report affected count).

**Independent Test**: Select ids and select-all-matching; apply tag+archive; confirm affected count and only-matching changed; bulk delete single confirm.

- [ ] T044 [P] [US7] Contract test POST /api/bookmarks/bulk (ids + selection modes, each action) in `tests/contract/bulk.test.js`
- [ ] T045 [US7] Implement POST /api/bookmarks/bulk in `server/api/bookmarks.js`: `ids[]` or `selection{view,q,include_tags,exclude_tags}`; actions add_tags/remove_tags/archive/unarchive/mark_read/mark_unread/delete in a single transaction; return `{affected}` (FR-020–FR-022)
- [ ] T046 [P] [US7] Implement multi-select + BulkBar + "select all matching" + single delete confirmation in `client/src/components/BulkBar.jsx` and ListView

**Checkpoint**: Bulk operations work across pages.

---

## Phase 10: User Story 8 - Sort & list presentation (Priority: P2)

**Goal**: Sort by date added/title/last updated; each item shows title, description, tags, icon.

**Independent Test**: Change sort→reorders; each item displays required fields.

- [ ] T047 [P] [US8] Contract test sort options in GET /api/bookmarks in `tests/contract/sort.test.js`
- [ ] T048 [US8] Implement `sort=date_added|title|last_updated` + pagination (`page`,`page_size`) in `server/api/bookmarks.js` (FR-023/FR-024)
- [ ] T049 [P] [US8] Implement sort control + ensure BookmarkCard shows title/description/tags/icon in `client/src/components/`

**Checkpoint**: List presentation and sorting complete.

---

## Phase 11: User Story 9 - Saved searches (Priority: P3)

**Goal**: Save named query + include/exclude tags; reuse, rename, delete.

**Independent Test**: Save→appears; select→applies same results; rename/delete persists.

- [ ] T050 [P] [US9] Contract test saved-searches CRUD in `tests/contract/savedSearches.test.js`
- [ ] T051 [US9] Implement saved-searches CRUD in `server/api/savedSearches.js` (name, query, include_tags, exclude_tags; validate query parseable) (FR-025)
- [ ] T052 [P] [US9] Implement SavedSearches view (save/apply/rename/delete) in `client/src/views/SavedSearches.jsx`

**Checkpoint**: Saved searches reusable.

---

## Phase 12: User Story 10 - Import / export (Priority: P2)

**Goal**: Import Netscape bookmark HTML preserving title, tags (incl. folders→tags), ADD_DATE; export same format; report added/skipped/failed.

**Independent Test**: Import file → title/tags/date preserved, duplicates skipped, summary accurate; export → valid re-importable file.

- [ ] T053 [P] [US10] Unit test Netscape parse/serialize in `tests/unit/netscape.test.js` (title, TAGS attr + folder→tag, ADD_DATE preserved; malformed entries reported)
- [ ] T054 [P] [US10] Contract test POST /api/import + GET /api/export in `tests/contract/importExport.test.js`
- [ ] T055 [US10] Implement Netscape parser/serializer in `server/lib/netscape.js` (FR-026/FR-027)
- [ ] T056 [US10] Implement POST /api/import (multipart) routing entries through dedup, returning `{added, skipped_duplicates, failed}` and GET /api/export download in `server/api/importExport.js` (FR-028)
- [ ] T057 [P] [US10] Implement ImportExport view (upload + download + summary) in `client/src/views/ImportExport.jsx`

**Checkpoint**: Standard bookmark interchange works.

---

## Phase 13: User Story 11 - Page preservation (Priority: P3)

**Goal**: Preserve self-contained HTML for web pages, PDFs as PDFs; optional Internet Archive snapshot; graceful failure.

**Independent Test**: Preserve web page→reopen self-contained HTML offline; preserve PDF→`.pdf` stored; request Archive→snapshot ref (or graceful failure offline).

- [ ] T058 [P] [US11] Contract test preserve + serve preserved file in `tests/contract/preservation.test.js`
- [ ] T059 [US11] Implement capture in `server/lib/capture.js`: detect PDF by Content-Type→save `.pdf`; else Playwright single self-contained HTML with inlined resources (not readable-extract) (FR-029/FR-030)
- [ ] T060 [P] [US11] Implement Internet Archive submission in `server/lib/archiveOrg.js` (Save Page Now; store snapshot url/status; graceful failure FR-032)
- [ ] T061 [US11] Implement POST /api/bookmarks/:id/preserve + GET /api/bookmarks/:id/preserved/:copyId (serve file) in `server/api/preservation.js`; store PreservedCopy rows under `data/preserved/`
- [ ] T062 [P] [US11] Implement preservation controls + reopen links in `client/src/views/DetailView.jsx`

**Checkpoint**: Pages preserved locally and optionally via Internet Archive.

---

## Phase 14: User Story 12 - Display preferences (Priority: P3)

**Goal**: Set default sort, items-per-page, text size; persist across sessions.

**Independent Test**: Change each pref→applies immediately; reload→still applied.

- [ ] T063 [P] [US12] Contract test GET/PUT /api/preferences in `tests/contract/preferences.test.js`
- [ ] T064 [US12] Implement GET/PUT /api/preferences in `server/api/preferences.js` (constrain to allowed value sets; persist; FR-033)
- [ ] T065 [P] [US12] Implement Preferences view + apply default sort/page size/text size app-wide in `client/src/views/Preferences.jsx`

**Checkpoint**: Preferences persist and shape the UI.

---

## Phase 15: Polish & Cross-Cutting Concerns

- [ ] T066 [P] Implement empty states across first-run, read-later, archive, no-result search/filter (FR-035) in `client/src/components/EmptyState.jsx`
- [ ] T067 [P] Add "open destination in new tab" affordance on bookmarks (FR-036) in `client/src/components/BookmarkCard.jsx`
- [ ] T068 [P] Add e2e smoke flows (save, search, bulk, import) in `tests/e2e/` using @playwright/test@1.61.0
- [ ] T069 Performance pass: verify indexes on `url_key` and tag joins; validate <1s search / <10s bulk targets (SC-003/SC-005) in `server/db/schema.sql` and services
- [ ] T070 Write `.harness/app.json` = `{"kind":"application","port":4000,"path":"/","start_command":["npm","start"],"start_cwd":"/work"}`; run `npm install && npm run build`; confirm `npm start` serves on `0.0.0.0:4000` with readiness marker
- [ ] T071 Execute quickstart.md validation scenarios end-to-end and the persistence check (SC-007)

---

## Dependencies & Execution Order

- **Setup (Phase 1)** → **Foundational (Phase 2)** blocks all stories.
- **US1 (P1)** is the MVP; **US2, US3 (P1)** build directly on the bookmark model and should follow US1.
- **US4–US10 (P2)** depend only on Foundational + the bookmark/tag model (US1/US3); can proceed in parallel by different developers.
- **US9, US11, US12 (P3)** last.
- **Polish (Phase 15)** after desired stories complete; T070/T071 are the delivery/validation gate.

### Within each story
Tests (marked [P]) first → models/lib → services/endpoints → client views.

### Parallel opportunities
- Setup: T004, T005 parallel.
- Foundational: T010, T011, T012, T013, T014 parallel after schema/db (T006–T009).
- Across stories once Foundational done: US-level [P] tests and independent lib/client files.

---

## Implementation Strategy

**MVP**: Phases 1–3 (Setup + Foundational + US1) → save links with metadata. Validate, then add US2/US3 to complete the P1 core (dedup + full editable model). Layer P2 retrieval/organization (US4–US8, US10), then P3 (US9, US11, US12). Finish with Polish + delivery (T070/T071).
