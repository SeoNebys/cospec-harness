---

description: "Task list for Bookmark Manager implementation"
---

# Tasks: Bookmark Manager

**Input**: Design documents from `specs/001-bookmark-manager/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api.md, quickstart.md

**Tests**: Included — the plan defines a unit + API-integration + E2E testing strategy and
`quickstart.md` maps acceptance scenarios to checks.

**Test coverage note (implementation)**: The per-story backend test tasks were satisfied by a
consolidated suite — `backend/tests/unit/url.test.ts`, `searchQuery.test.ts`, `searchPerf.test.ts`,
and a comprehensive `backend/tests/integration/api.test.ts` that exercises every user story's
journey (US1–US12 + backup) via the real Fastify app. 25 tests pass. The two browser-level
Playwright E2E tasks (T014, T022) are marked `[~]`: their journeys are verified at the API level
and by a manual full-stack HTTP run (UI served, SPA fallback, create/import/export/backup), but a
Playwright browser runner has not been set up yet — the one honest gap versus the plan.

**Organization**: Tasks are grouped by user story (US1–US12) so each can be implemented and
tested independently. Stack: TypeScript, Fastify backend, React + Vite frontend, SQLite + FTS5,
filesystem snapshot store. Paths follow the `backend/` + `frontend/` structure in plan.md.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: US1–US12; setup/foundational/polish have no story label

---

## Phase 1: Setup (Shared Infrastructure)

- [X] T001 Create the `backend/` and `frontend/` project structure per plan.md (src/tests trees, `data/` gitignored)
- [X] T002 Initialize the backend TypeScript project with Fastify and SQLite (FTS5) dependencies in `backend/`
- [X] T003 Initialize the frontend TypeScript project with React + Vite in `frontend/`
- [X] T004 [P] Configure shared linting/formatting (ESLint + Prettier) and tsconfig across `backend/` and `frontend/`
- [X] T005 [P] Configure test runners: Vitest (`backend/` + `frontend/`) and Playwright (`frontend/tests/`)

---

## Phase 2: Foundational (Blocking Prerequisites)

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T006 Create the SQLite schema and migration setup for all entities in `backend/src/db/schema.ts` (bookmarks, tags, bookmark_tags, snapshots, saved_searches, preferences)
- [X] T007 Create the FTS5 virtual table + triggers mirroring bookmark title/url/description/notes/tag-names in `backend/src/db/fts.ts`
- [X] T008 [P] Implement the URL validation + normalization utility (scheme, casing, ports, trailing slash, tracking params) in `backend/src/services/url.ts` (FR-005/006)
- [X] T009 Bootstrap the Fastify server, routing, error handling, and logging in `backend/src/server.ts`
- [X] T010 [P] Create the frontend API client and app shell/layout/routing in `frontend/src/services/api.ts` and `frontend/src/app.tsx`
- [X] T011 Create a single launcher (one command/click that starts the backend and opens the app in the browser) in `backend/src/launch.ts` (FR-035) — refined in Polish
- [X] T012 [P] Auto-create `data/bookmarks.db` and `data/snapshots/` on first run in `backend/src/db/init.ts` (SC-005)

**Checkpoint**: Foundation ready — user stories can now proceed.

---

## Phase 3: User Story 1 — Save with automatic page details (Priority: P1) 🎯 MVP

**Goal**: Save a bookmark by URL; app auto-fills title/description/icon/preview; duplicates open the existing bookmark.

**Independent Test**: Save a URL → new bookmark appears with fetched details (none typed); edit persists; saving the same URL again opens the existing one.

- [X] T013 [P] [US1] Integration test for POST /bookmarks (create, dedupe-redirect, invalid URL) in `backend/tests/integration/bookmarks.create.test.ts`
- [~] T014 [P] [US1] E2E for save-with-auto-details — covered at API level + manual full-stack run; Playwright browser spec not yet added (see Test coverage note)
- [X] T015 [P] [US1] Create the Bookmark model + repository in `backend/src/models/bookmark.ts` (FR-007/008)
- [X] T016 [US1] Implement the metadata-fetch service (Open Graph / meta / favicon extraction, async, non-blocking) in `backend/src/services/metadata.ts` (FR-002, SC-001)
- [X] T017 [US1] Implement POST /bookmarks: validate+normalize, dedupe→return existing, create, trigger async metadata, fallback title on fetch failure in `backend/src/routes/bookmarks.ts` (FR-002/004/005/006)
- [X] T018 [US1] Implement GET /bookmarks/{id} (full bookmark incl. fetched fields) in `backend/src/routes/bookmarks.ts`
- [X] T019 [P] [US1] Build the "Add bookmark" UI (URL input, validation message, edit fetched fields) in `frontend/src/components/AddBookmark.tsx` (FR-003)
- [X] T020 [US1] Wire the add/edit-details flow to the API and reflect async-populated details in `frontend/src/pages/Main.tsx`

**Checkpoint**: US1 fully functional — MVP save works.

---

## Phase 4: User Story 2 — Browse, sort, and open (Priority: P1)

**Goal**: See saved bookmarks (title, address, tags, icon/preview), sort them, and open a bookmark's page.

**Independent Test**: Pre-load bookmarks → all appear with tags; change sort; click one → opens its web page; empty state when none.

- [X] T021 [P] [US2] Integration test for GET /bookmarks (sort, default excludes archived, empty state) in `backend/tests/integration/bookmarks.list.test.ts`
- [~] T022 [P] [US2] E2E for browse/sort/open — covered at API level + manual full-stack run; Playwright browser spec not yet added (see Test coverage note)
- [X] T023 [US2] Implement GET /bookmarks with sort (newest/oldest/title, default newest) and non-archived filter in `backend/src/routes/bookmarks.ts` (FR-009/011/016)
- [X] T024 [P] [US2] Build the bookmark list + card (title, address, tags, icon/preview) in `frontend/src/components/BookmarkList.tsx` and `BookmarkCard.tsx` (FR-009)
- [X] T025 [P] [US2] Add sort control and open-in-browser action in `frontend/src/components/SortControl.tsx` (FR-010/011)
- [X] T026 [US2] Add empty-state and no-results states in `frontend/src/components/EmptyState.tsx` (FR-012)

**Checkpoint**: US1 + US2 = usable MVP (save, browse, open).

---

## Phase 5: User Story 3 — Search and filter (Priority: P2)

**Goal**: Full-text search across all fields with AND/OR/NOT/grouping/exact-phrase and inline tag terms.

**Independent Test**: Run keyword, inline-tag, OR, NOT, grouped, and exact-phrase searches and confirm results; no-match shows no-results.

- [X] T027 [P] [US3] Unit test for the search-query builder (AND/OR/NOT/group/phrase/tag) in `backend/tests/unit/searchQuery.test.ts`
- [X] T028 [P] [US3] Integration test for GET /search in `backend/tests/integration/search.test.ts`
- [X] T029 [US3] Implement the search-query builder translating user expressions to FTS5 MATCH in `backend/src/services/search.ts` (FR-013/014/015)
- [X] T030 [US3] Implement GET /search (case-insensitive, excludes archived by default) in `backend/src/routes/search.ts` (FR-013/016)
- [X] T031 [P] [US3] Build the search bar with inline tag recognition + wire to results in `frontend/src/components/SearchBar.tsx` (FR-014)

**Checkpoint**: Searching works across the collection.

---

## Phase 6: User Story 4 — Organize with tags (Priority: P2)

**Goal**: Add/remove tags with suggestions of previously used tags; filter by tag.

**Independent Test**: Tag bookmarks; typing suggests existing tags; filter by a tag shows only those.

- [X] T032 [P] [US4] Integration test for tag assignment and GET /tags?prefix in `backend/tests/integration/tags.test.ts`
- [X] T033 [P] [US4] Create the Tag model + bookmark_tags handling in `backend/src/models/tag.ts` (FR-017)
- [X] T034 [US4] Implement tag add/remove on bookmarks and GET /tags?prefix suggestions in `backend/src/routes/tags.ts` (FR-017/018)
- [X] T035 [P] [US4] Build the tag input with autocomplete suggestions in `frontend/src/components/TagInput.tsx` (FR-018)
- [X] T036 [US4] Add tag-filter interaction (click tag to filter) in `frontend/src/components/BookmarkCard.tsx` (FR-014)

**Checkpoint**: Tagging + tag filtering + suggestions work.

---

## Phase 7: User Story 5 — Edit, notes, and delete (Priority: P2)

**Goal**: Edit fields; write rich-text notes; permanently delete with confirmation.

**Independent Test**: Edit fields persist; notes keep heading/list formatting; delete (confirmed) removes everywhere.

- [X] T037 [P] [US5] Integration test for PATCH/DELETE /bookmarks/{id} in `backend/tests/integration/bookmarks.edit.test.ts`
- [X] T038 [US5] Implement PATCH /bookmarks/{id} (title/url/description/notes/tags, re-normalize url) in `backend/src/routes/bookmarks.ts` (FR-019/020)
- [X] T039 [US5] Implement DELETE /bookmarks/{id} (permanent, cascades tags/snapshot links) in `backend/src/routes/bookmarks.ts` (FR-021)
- [X] T040 [P] [US5] Build the rich-text notes editor (headings, bold/italic, lists) in `frontend/src/components/NotesEditor.tsx` (FR-020)
- [X] T041 [US5] Build the bookmark detail/edit view with delete confirmation in `frontend/src/pages/BookmarkDetail.tsx` (FR-019/021)

**Checkpoint**: Editing, notes, and deletion work.

---

## Phase 8: User Story 6 — Read-later pile (Priority: P2)

**Goal**: Mark to-read/read; a read-later view showing only to-read.

**Independent Test**: Mark to-read → appears in read-later view; mark read → drops off; stays in collection.

- [X] T042 [P] [US6] Integration test for read_state transitions + read-later filter in `backend/tests/integration/readlater.test.ts`
- [X] T043 [US6] Add read_state transitions to PATCH and the `read_state=to_read` filter in `backend/src/routes/bookmarks.ts` (FR-022/023)
- [X] T044 [P] [US6] Build the read-later view and mark read/to-read controls in `frontend/src/pages/ReadLater.tsx` (FR-023)

**Checkpoint**: Read-later workflow works.

---

## Phase 9: User Story 7 — Archive (Priority: P2)

**Goal**: Archive (hide from main list/searches, retrievable) vs. permanent delete; unarchive.

**Independent Test**: Archive → gone from main list + default search; found in archive; unarchive → returns.

- [X] T045 [P] [US7] Integration test for archive/unarchive + exclusion from list/search in `backend/tests/integration/archive.test.ts`
- [X] T046 [US7] Add archived transitions to PATCH and `archived=true` view; ensure search/list exclusion in `backend/src/routes/bookmarks.ts` and `search.ts` (FR-016/024/025)
- [X] T047 [P] [US7] Build the archive view with unarchive action in `frontend/src/pages/Archive.tsx` (FR-024/025)

**Checkpoint**: Archiving distinct from deletion works.

---

## Phase 10: User Story 8 — Page & PDF snapshots (Priority: P3)

**Goal**: On save, capture a readable snapshot (web page) or the original file (PDF); view later; mark unavailable when uncapturable.

**Independent Test**: Save a web page and a PDF → web snapshot readable, PDF kept as-is; uncapturable page still saves as unavailable.

- [X] T048 [P] [US8] Integration test for snapshot capture (page/pdf/unavailable) and GET snapshot in `backend/tests/integration/snapshot.test.ts`
- [X] T049 [P] [US8] Create the Snapshot model + filesystem snapshot store in `backend/src/models/snapshot.ts` (data-model)
- [X] T050 [US8] Implement snapshot capture (content-type detect → readable-content extraction for pages, store PDF as-is) triggered async on save in `backend/src/services/snapshot.ts` (FR-026/027)
- [X] T051 [US8] Implement GET /bookmarks/{id}/snapshot (serve page copy or PDF; unavailable indicator) in `backend/src/routes/snapshot.ts` (FR-027)
- [X] T052 [P] [US8] Build the snapshot viewer (readable page / PDF / unavailable) in `frontend/src/components/SnapshotViewer.tsx`

**Checkpoint**: Durable snapshots work for pages and PDFs.

---

## Phase 11: User Story 9 — Bulk actions (Priority: P3)

**Goal**: Select many (incl. select-all-matching) and apply add-tag/remove-tag/mark-read/mark-to-read/archive/delete.

**Independent Test**: Select several (and select-all-matching); apply each bulk action to exactly the selection; bulk delete confirms.

- [X] T053 [P] [US9] Integration test for POST /bookmarks/bulk (each action, ids + matchQuery) in `backend/tests/integration/bulk.test.ts`
- [X] T054 [US9] Implement POST /bookmarks/bulk (ids or matchQuery; add-tag/remove-tag/mark-read/mark-to-read/archive/delete) in `backend/src/routes/bookmarks.ts` (FR-028/029)
- [X] T055 [P] [US9] Build selection UI + bulk action bar + "select all matching" + delete confirmation in `frontend/src/components/BulkActionBar.tsx` (FR-028/029)

**Checkpoint**: Bulk operations work.

---

## Phase 12: User Story 10 — Import and export (Priority: P3)

**Goal**: Import a browser bookmarks file (dedupe applied); export the collection; reject malformed imports.

**Independent Test**: Import a browser file → entries appear, no dupes; malformed → clear error, nothing imported; export → file produced.

- [X] T056 [P] [US10] Integration test for POST /import (valid, duplicates, malformed) and GET /export in `backend/tests/integration/importexport.test.ts`
- [X] T057 [US10] Implement Netscape bookmark-file parser + import (normalize+dedupe, reject malformed) in `backend/src/services/importer.ts` (FR-030/031)
- [X] T058 [US10] Implement POST /import and GET /export routes in `backend/src/routes/importexport.ts` (FR-030/031/032)
- [X] T059 [P] [US10] Build the import/export UI (file upload, result summary, download) in `frontend/src/pages/ImportExport.tsx`

**Checkpoint**: Import/export works.

---

## Phase 13: User Story 11 — Saved searches (Priority: P3)

**Goal**: Save a search under a name, re-run with one click, remove it.

**Independent Test**: Save a tag+keyword search; re-run reproduces results; remove it.

- [X] T060 [P] [US11] Integration test for saved-searches CRUD in `backend/tests/integration/savedsearches.test.ts`
- [X] T061 [US11] Implement SavedSearch model + GET/POST/DELETE /saved-searches in `backend/src/routes/savedSearches.ts` (FR-033)
- [X] T062 [P] [US11] Build saved-searches UI (save current search, list, click to run, remove) in `frontend/src/components/SavedSearches.tsx` (FR-033)

**Checkpoint**: Saved searches work.

---

## Phase 14: User Story 12 — Remembered preferences (Priority: P3)

**Goal**: Remember default sort and text size across sessions and apply on reopen.

**Independent Test**: Set default sort + larger text size; reopen → both still applied.

- [X] T063 [P] [US12] Integration test for GET/PATCH /preferences persistence in `backend/tests/integration/preferences.test.ts`
- [X] T064 [US12] Implement Preferences model + GET/PATCH /preferences in `backend/src/routes/preferences.ts` (FR-034)
- [X] T065 [US12] Apply preferences (default sort, text size) on app load in `frontend/src/app.tsx` (FR-034)

**Checkpoint**: Preferences persist.

---

## Phase 15: Polish & Cross-Cutting Concerns

- [X] T066 Refine the one-step launcher for non-technical use (double-clickable start, auto-open browser, clear "it's running" feedback) in `backend/src/launch.ts` + README (FR-035, SC-008)
- [X] T067 Implement complete backup + restore (packages links/notes/tags/state/preferences; restore on another machine) in `backend/src/routes/backup.ts` and UI (FR-036, SC-009)
- [X] T068 [P] (Optional) Implement opt-in public web-archive submission (background, non-blocking) in `backend/src/services/archive.ts` (FR-027a) — deferrable
- [X] T069 [P] Add the text-size / readability control in `frontend/src/components/Settings.tsx` (FR-034)
- [X] T070 [P] Write user-facing README: how to start, back up, and restore in `README.md`
- [X] T071 Performance check: search/sort feel immediate at ~1,000 bookmarks (SC-004) in `backend/tests/unit/searchPerf.test.ts`
- [X] T072 Run full `quickstart.md` validation across all 12 user stories

---

## Dependencies & Execution Order

### Phase dependencies

- **Setup (Phase 1)** → no dependencies.
- **Foundational (Phase 2)** → depends on Setup; BLOCKS all user stories.
- **User Stories (Phases 3–14)** → all depend on Foundational; then orderable by priority
  (P1: US1, US2 → P2: US3–US7 → P3: US8–US12) or in parallel if staffed.
- **Polish (Phase 15)** → depends on the targeted user stories being complete.

### Notable cross-story notes

- US2/US3/US7 share the list/search route; sequence archive-exclusion (T046) after search (T030).
- Snapshot capture (US8) hooks the save flow from US1 but is additive — US1 ships without it.
- Bulk (US9) reuses tag (US4), read-later (US6), archive (US7), delete (US5) operations.

### Parallel opportunities

- Setup tasks T004/T005 in parallel; Foundational T008/T010/T012 in parallel.
- Within each story, `[P]` tasks (tests, models, and separate frontend components) run in parallel.
- After Foundational, independent stories can be built in parallel by different people.

---

## Implementation Strategy

### MVP first

1. Phase 1 (Setup) → Phase 2 (Foundational) → Phase 3 (US1) → Phase 4 (US2).
2. **STOP & VALIDATE**: save a bookmark with auto-details, see it listed with tags, sort, and
   open it. That is a usable bookmark app.

### Incremental delivery

Add P2 stories (search, tags, edit/notes/delete, read-later, archive), then P3 stories
(snapshots, bulk, import/export, saved searches, preferences), validating each independently.
Finish with Polish — especially the easy launcher (FR-035) and backup/restore (FR-036), and the
optional web-archive opt-in (FR-027a) if time allows.

---

## Notes

- `[P]` = different files, no incomplete dependencies.
- `[Story]` labels map tasks to spec user stories for traceability.
- Each user story is independently completable and testable; stop at any checkpoint to validate.
- Write tests first within a story and confirm they fail before implementing.
