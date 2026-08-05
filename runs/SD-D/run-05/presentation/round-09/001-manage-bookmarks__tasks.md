---

description: "Task list for Manage Bookmarks"
---

# Tasks: Manage Bookmarks

**Input**: Design documents from `/specs/001-manage-bookmarks/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Included. The plan defines a Vitest + Playwright approach and quickstart.md
lists validation scenarios; targeted tests are generated per story (kept focused,
not exhaustive TDD).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1–US8)
- Exact file paths are included in each task

## Path Conventions

Single desktop project (Electron main/renderer split) at repository root:
`src/main/`, `src/renderer/`, `src/shared/`, `tests/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [X] T001 Create the project structure per plan.md (`src/main/`, `src/renderer/`, `src/shared/`, `tests/{unit,integration,e2e}/`)
- [X] T002 Initialize the Node/TypeScript project and add dependencies (Electron, React, Vite, better-sqlite3, @mozilla/readability, jsdom, DOMPurify, TipTap) in `package.json`
- [X] T003 [P] Configure TypeScript, linting, and formatting in `tsconfig.json`, `.eslintrc`, `.prettierrc`
- [X] T004 [P] Configure Vitest (unit/integration) and Playwright (e2e) in `vitest.config.ts` and `playwright.config.ts`
- [X] T005 Configure the Electron build/dev scripts (`npm run dev`, `npm run build`) and Vite renderer bundling in `package.json` and `vite.config.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T006 Define shared TypeScript types for Bookmark, SavedCopy, Tag, SavedSearch, Setting in `src/shared/types.ts` (from data-model.md)
- [X] T007 Implement the local SQLite connection opening a per-user data-directory database file in `src/main/db/connection.ts`
- [X] T008 Implement the database schema — tables for bookmarks, tags, bookmark_tags, saved_copies, saved_searches, settings, plus the FTS5 full-text index — in `src/main/db/schema.ts`
- [X] T009 [P] Implement the migrations/versioning framework in `src/main/db/migrations/`
- [X] T010 [P] Implement the local files storage helper (read/write saved-copy HTML and PDF files, favicon files) in `src/main/storage/files.ts`
- [X] T011 Implement the background work queue (serialized fetch/capture jobs that report progress, never block the UI) in `src/main/services/queue.ts` (Decision 8)
- [X] T012 Implement the IPC bridge skeleton exposing named core operations to the renderer in `src/main/ipc.ts` and the preload bridge
- [X] T013 Create the Electron app entry, main window lifecycle, and React renderer shell (root layout + navigation between views) in `src/main/index.ts` and `src/renderer/main.tsx`
- [X] T014 [P] Implement a reusable empty-state UI component in `src/renderer/components/EmptyState.tsx` (FR-033)

**Checkpoint**: Foundation ready — user story implementation can now begin

---

## Phase 3: User Story 1 - Save a bookmark with details filled in automatically (Priority: P1) 🎯 MVP

**Goal**: Paste an address, save it, and have title/description/favicon auto-filled; edits allowed; invalid addresses rejected; no duplicates.

**Independent Test**: Paste a valid URL, save, and confirm the bookmark appears and its title/description/favicon fill in on their own and persist after restart.

### Tests for User Story 1

- [X] T015 [P] [US1] Unit test for URL validation and one-per-address dedupe in `tests/unit/bookmarks.dedupe.test.ts` (FR-002, FR-017)
- [X] T016 [P] [US1] Integration test for metadata auto-fill (title/description/favicon) in `tests/integration/metadata.test.ts` (FR-003, FR-005)

### Implementation for User Story 1

- [X] T017 [US1] Implement the bookmarks service — create with URL validation, one-per-address dedupe (redirect to existing), edit title/description — in `src/main/services/bookmarks.ts` (FR-001, FR-002, FR-004, FR-017)
- [X] T018 [US1] Implement the metadata service (fetch title, description, favicon; store favicon file; fallback label) in `src/main/services/metadata.ts` (FR-003, FR-005)
- [X] T019 [US1] Wire `saveBookmark` / `updateBookmark` operations (enqueue background metadata via the queue) into `src/main/ipc.ts` per contracts/bookmark-operations.md (FR-006)
- [X] T020 [P] [US1] Build the Add/Edit Bookmark view (URL input, validation message, editable title/description, duplicate redirect) in `src/renderer/views/AddBookmark.tsx`
- [X] T021 [US1] Show pending/auto-filled details updating live as background capture completes in `src/renderer/views/AddBookmark.tsx`

**Checkpoint**: A user can save a bookmark and see details auto-fill — the app is minimally useful.

---

## Phase 4: User Story 2 - Browse and open saved bookmarks (Priority: P1)

**Goal**: See all saved bookmarks with title/description/favicon and open one in the default browser; clear empty state.

**Independent Test**: With several bookmarks saved, view the list and activate one; the correct page opens in the browser.

### Tests for User Story 2

- [X] T022 [P] [US2] Integration test for listing bookmarks (active view) in `tests/integration/list.test.ts` (FR-008)

### Implementation for User Story 2

- [X] T023 [US2] Implement `listBookmarks` (active view) in `src/main/services/bookmarks.ts` and expose via `src/main/ipc.ts` (FR-008)
- [X] T024 [US2] Implement `openOriginal` to open the URL in the default browser via `src/main/ipc.ts` (FR-012)
- [X] T025 [P] [US2] Build the Collection view listing bookmarks (title, description, favicon) with empty state in `src/renderer/views/Collection.tsx` (FR-008, FR-033)
- [X] T026 [P] [US2] Build the reusable BookmarkList/BookmarkCard components in `src/renderer/components/BookmarkList.tsx`
- [X] T027 [US2] Wire "open in browser" action into the Collection view in `src/renderer/views/Collection.tsx`

**Checkpoint**: Save + browse + open — this is the full MVP loop.

---

## Phase 5: User Story 3 - Keep a readable copy for when the page is gone (Priority: P2)

**Goal**: At save time, capture a readable article copy (or retain a PDF); view it offline; handle "no copy available".

**Independent Test**: Save an article, disable the network, open its saved copy and read it; save a PDF and confirm the PDF is retained and reopenable.

### Tests for User Story 3

- [X] T028 [P] [US3] Integration test for reader extraction + offline read-back in `tests/integration/capture.reader.test.ts` (FR-007)
- [X] T029 [P] [US3] Integration test for PDF detection + retention in `tests/integration/capture.pdf.test.ts` (FR-008)

### Implementation for User Story 3

- [X] T030 [US3] Implement the capture service — readable extraction (Readability) + DOMPurify sanitizing, PDF detection/retention, and the `unavailable` case — in `src/main/services/capture.ts` (FR-007, FR-008, FR-009)
- [X] T031 [US3] Enqueue capture as part of save/import and update SavedCopy status (pending→captured/unavailable) via `src/main/services/queue.ts` and `src/main/services/bookmarks.ts`
- [X] T032 [US3] Implement `getSavedCopy` (serve local file, never re-fetch) via `src/main/ipc.ts` per contracts/capture-operations.md (FR-007, offline)
- [X] T033 [P] [US3] Build the Saved-Copy Reader view (render sanitized article HTML; embedded PDF viewer; "no saved copy" state) in `src/renderer/views/Reader.tsx` (FR-009)
- [X] T034 [US3] Show per-bookmark saved-copy status (pending / available / unavailable) in `src/renderer/components/BookmarkList.tsx`

**Checkpoint**: Saved copies survive and read offline — the client's headline requirement.

---

## Phase 6: User Story 4 - Annotate, edit, set aside, and delete bookmarks (Priority: P2)

**Goal**: Formatted personal notes; edit title/address; archive/restore; permanent delete with confirmation.

**Independent Test**: Add a formatted note and confirm it reads back formatted; edit a title; archive then restore; delete (confirmed) and confirm it stays gone after restart.

### Tests for User Story 4

- [X] T035 [P] [US4] Unit test for note HTML sanitizing + plain-text projection in `tests/unit/notes.test.ts` (FR-014)
- [X] T036 [P] [US4] Integration test for archive/restore vs. permanent delete in `tests/integration/archive-delete.test.ts` (FR-015, FR-016)

### Implementation for User Story 4

- [X] T037 [US4] Extend the bookmarks service with note save (sanitize HTML, sync note_text), archive/restore, and confirmed permanent delete (cascade tag links + copy files) in `src/main/services/bookmarks.ts` (FR-014, FR-015, FR-016)
- [X] T038 [US4] Implement `listBookmarks` archived view + `setArchivedState`/`deleteBookmark` operations via `src/main/ipc.ts` (FR-016, FR-015)
- [X] T039 [P] [US4] Build the rich-text NoteEditor component (bold, lists, links) in `src/renderer/components/NoteEditor.tsx` (FR-014)
- [X] T040 [P] [US4] Build the Bookmark Detail/Edit view (edit title/address, note, delete with confirmation dialog) in `src/renderer/views/BookmarkDetail.tsx` (FR-013, FR-015)
- [X] T041 [P] [US4] Build the Archived view with restore action in `src/renderer/views/Archived.tsx` (FR-016, FR-033)

**Checkpoint**: The collection is fully maintainable per bookmark.

---

## Phase 7: User Story 5 - Find and organize bookmarks (Priority: P2)

**Goal**: Keyword search across all fields (case-insensitive), exact-phrase, tag-scoped search, tag suggestions, clickable tag filter, and named saved searches.

**Independent Test**: Search a word found only in a note (different case) and match it; quote a phrase; combine word+tag; see tag suggestions; save and reopen a search.

### Tests for User Story 5

- [ ] T042 [P] [US5] Unit test for query parsing (quoted phrase, tag scoping incl. "either of two") in `tests/unit/search.parse.test.ts` (FR-020, FR-021)
- [ ] T043 [P] [US5] Integration test for full-text search across fields + saved-search round-trip in `tests/integration/search.test.ts` (FR-018, FR-023)

### Implementation for User Story 5

- [ ] T044 [US5] Implement the tags service (assign/remove, create-on-use, prefix suggestions) in `src/main/services/tags.ts` (FR-019, FR-022)
- [ ] T045 [US5] Implement the search service (FTS keyword/phrase, case-insensitive, tag-scoped, filters, sort) in `src/main/services/search.ts` (FR-018, FR-020, FR-021)
- [ ] T046 [US5] Implement saved-search create/list/run/delete (criteria stored, re-evaluated on run) in `src/main/services/search.ts` and expose search/tag/saved-search operations via `src/main/ipc.ts` per contracts/search-operations.md (FR-023)
- [ ] T047 [P] [US5] Build the TagInput component with reuse suggestions in `src/renderer/components/TagInput.tsx` (FR-022)
- [ ] T048 [P] [US5] Build the Search view (search box, clickable tag filters, no-results state) in `src/renderer/views/Search.tsx` (FR-018, FR-019, FR-033)
- [ ] T049 [US5] Add saved-search save/list/reopen UI in `src/renderer/views/Search.tsx` (FR-023)

**Checkpoint**: Bookmarks are findable at scale.

---

## Phase 8: User Story 6 - Act on many bookmarks at once (Priority: P2)

**Goal**: Select several (or act on the whole current result set) to add a tag, mark read/unread, archive, or delete together; batch delete confirmed.

**Independent Test**: Select several and add a tag at once; act on a full search result to mark read; batch delete behind confirmation.

### Tests for User Story 6

- [ ] T050 [P] [US6] Integration test for batch actions over an explicit selection and over a query result set in `tests/integration/batch.test.ts` (FR-024, FR-025)

### Implementation for User Story 6

- [ ] T051 [US6] Implement the batch service (`applyBatch` over selection or query; addTag/setRead/archive/delete; confirmed delete) in `src/main/services/batch.ts` and expose via `src/main/ipc.ts` per contracts/import-export-operations.md (FR-024, FR-025, FR-026)
- [ ] T052 [P] [US6] Add multi-select and a BatchToolbar to the Collection/Search views in `src/renderer/components/BatchToolbar.tsx` (FR-024, FR-025)
- [ ] T053 [US6] Add "act on everything currently shown" and batch-delete confirmation in `src/renderer/components/BatchToolbar.tsx` (FR-025, FR-026)

**Checkpoint**: Large collections are maintainable in bulk.

---

## Phase 9: User Story 7 - Import existing bookmarks and export my collection (Priority: P2)

**Goal**: Import a standard browser bookmarks file (dedupe, background capture, progress + added/skipped summary); export a portable, re-importable file.

**Independent Test**: Import a 500+ entry browser export and see the summary while the app stays responsive; export and re-import.

### Tests for User Story 7

- [ ] T054 [P] [US7] Unit test for Netscape bookmarks HTML parsing in `tests/unit/import.parse.test.ts` (FR-027)
- [ ] T055 [P] [US7] Integration test for import→dedupe→export round-trip with summary in `tests/integration/import-export.test.ts` (FR-028, FR-029, FR-030)

### Implementation for User Story 7

- [ ] T056 [US7] Implement the import/export service (parse Netscape HTML, dedupe per one-per-address, enqueue background capture, stream progress + summary; export portable HTML) in `src/main/services/importExport.ts` (FR-027, FR-028, FR-029, FR-030)
- [ ] T057 [US7] Expose import/export operations via `src/main/ipc.ts` per contracts/import-export-operations.md
- [ ] T058 [P] [US7] Build the Import/Export view (file pick, live progress, added/skipped/failed summary, export button) in `src/renderer/views/ImportExport.tsx` (FR-029)

**Checkpoint**: Onboarding from existing browser bookmarks works; no lock-in.

---

## Phase 10: User Story 8 - Triage as "read later" and arrange the list (Priority: P3)

**Goal**: Mark read/unread, filter to unread only, and choose a remembered sort order.

**Independent Test**: Mark items read later, filter to unread; change sort order and confirm it reorders and is remembered next launch.

### Tests for User Story 8

- [ ] T059 [P] [US8] Integration test for unread filter and remembered sort setting in `tests/integration/triage-sort.test.ts` (FR-031, FR-032)

### Implementation for User Story 8

- [ ] T060 [US8] Implement `setReadState`, unread filtering, and sort-order Setting persistence in `src/main/services/bookmarks.ts` and `src/main/ipc.ts` (FR-031, FR-032)
- [ ] T061 [P] [US8] Add the unread filter and sort-order control (remembered across sessions) to the Collection view in `src/renderer/views/Collection.tsx` (FR-031, FR-032)

**Checkpoint**: All user stories independently functional.

---

## Phase 11: Polish & Cross-Cutting Concerns

**Purpose**: Improvements affecting multiple user stories

- [ ] T062 [P] Verify responsiveness targets with 1,000+ bookmarks (list/search/filters/batch) and tune indexes (SC-010, FR-035)
- [ ] T063 [P] Add friendly error handling for fetch/capture failures and malformed import entries across services (FR-005, FR-009, FR-025)
- [ ] T064 [P] Truncate long titles/descriptions/addresses gracefully in list/detail views (edge cases)
- [ ] T065 Package installers for macOS/Windows/Linux and confirm the data directory + saved-copies folder layout (plan.md)
- [ ] T066 Execute all quickstart.md validation scenarios end-to-end (Playwright where practical) in `tests/e2e/`
- [ ] T067 [P] Write a short user-facing README (what it does, where data is stored, how to back it up)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately.
- **Foundational (Phase 2)**: Depends on Setup — **BLOCKS all user stories**.
- **User Stories (Phases 3–10)**: All depend on Foundational. Then in priority order P1 → P2 → P3, or in parallel if staffed.
- **Polish (Phase 11)**: Depends on the desired user stories being complete.

### User Story Dependencies

- **US1 (P1)**: After Foundational. No dependency on other stories.
- **US2 (P1)**: After Foundational. Independent; pairs with US1 for the MVP loop.
- **US3 (P2)**: After Foundational. Uses the queue + save flow; extends capture. Independently testable.
- **US4 (P2)**: After Foundational. Extends bookmarks service; independent of US3/US5.
- **US5 (P2)**: After Foundational. Search/tags; independent (richer once US4 notes exist).
- **US6 (P2)**: After Foundational; most useful after US4/US5 exist but independently testable over the base list.
- **US7 (P2)**: After Foundational; reuses save + capture queue. Independent.
- **US8 (P3)**: After Foundational. Small extension to list/collection.

### Within Each User Story

- Tests first (should fail), then models/services, then IPC wiring, then UI.
- Services before the IPC operations that expose them; IPC before the UI that calls it.

### Parallel Opportunities

- Setup tasks marked [P] run in parallel.
- Foundational tasks marked [P] (T009, T010, T014) run in parallel after the DB/connection basics.
- Once Foundational completes, the P2 stories (US3–US7) can be built in parallel by different people.
- Within a story, [P] tasks (separate files — service vs. UI vs. tests) run in parallel.

---

## Parallel Example: User Story 1

```bash
# Tests for US1 together:
Task: "Unit test URL validation + dedupe in tests/unit/bookmarks.dedupe.test.ts"
Task: "Integration test metadata auto-fill in tests/integration/metadata.test.ts"

# Then service + UI in parallel (different files):
Task: "Implement bookmarks service in src/main/services/bookmarks.ts"
Task: "Build Add/Edit Bookmark view in src/renderer/views/AddBookmark.tsx"
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational (blocks everything).
3. Complete Phase 3 (US1) + Phase 4 (US2) — save, browse, open.
4. **STOP and VALIDATE**: run the US1/US2 quickstart checks.

### Incremental Delivery

1. Setup + Foundational → foundation ready.
2. US1 + US2 → the working MVP loop (save/browse/open).
3. US3 → saved copies (the headline feature).
4. US4 → notes/edit/archive/delete.
5. US5 → search, tags, saved searches.
6. US6 → batch actions.
7. US7 → import/export.
8. US8 → read-later & sorting.
9. Polish → performance, packaging, quickstart validation.

Each story adds value without breaking earlier stories.

---

## Notes

- [P] = different files, no dependencies.
- [Story] label maps each task to its user story for traceability.
- Every user story is independently completable and testable.
- Commit after each task or logical group; stop at any checkpoint to validate.
