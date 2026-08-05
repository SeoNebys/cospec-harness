---
description: "Task list for Bookmark Manager implementation"
---

# Tasks: Bookmark Manager

**Input**: Design documents from `/specs/001-bookmark-manager/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api.md

**Tests**: Included — plan.md commits to a test-first ordering (tests written and failing
before implementation) for each user story.

**Organization**: Tasks are grouped by user story so each story is independently
implementable and testable. Path conventions follow plan.md (web app: `backend/src/`,
`frontend/src/`).

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [ ] T001 Create repository structure (`backend/`, `frontend/`, `packaging/`) per plan.md
- [ ] T002 Initialize backend Python project with dependencies (FastAPI, uvicorn, SQLModel/SQLAlchemy, httpx, selectolax/beautifulsoup4, bleach, pytest) in `backend/pyproject.toml`
- [ ] T003 [P] Initialize frontend React + Vite + TypeScript project with Tiptap and Vitest/Playwright in `frontend/`
- [ ] T004 [P] Configure backend linting/formatting (ruff + black) in `backend/`
- [ ] T005 [P] Configure frontend linting/formatting (eslint + prettier) in `frontend/`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T006 Configure SQLite engine, session, and local DB file path resolution in `backend/src/db/engine.py`
- [ ] T007 Create Bookmark, Tag, and bookmark_tag models per data-model.md in `backend/src/models/bookmark.py` and `backend/src/models/tag.py`
- [ ] T008 Create FTS5 virtual table over (title + url + note_text + tags) with sync triggers in `backend/src/db/fts.py` (depends on T006, T007)
- [ ] T009 [P] Implement URL normalization utility (research §8) in `backend/src/services/url_utils.py`
- [ ] T010 [P] Implement rich-text sanitizer (allowlist: links/bold/bullets) + plain-text extraction for notes in `backend/src/services/sanitize.py`
- [ ] T011 Create FastAPI app with router registration, static-file serving, and standard error-shape handler (per contracts/api.md) in `backend/src/api/main.py` (depends on T006)
- [ ] T012 [P] Create frontend API client wrapper in `frontend/src/services/api.ts`
- [ ] T013 [P] Create app shell / main page layout and empty-state scaffold in `frontend/src/pages/App.tsx`

**Checkpoint**: Foundation ready — user story implementation can now begin

---

## Phase 3: User Story 1 - Save a bookmark (Priority: P1) 🎯 MVP

**Goal**: Save a URL; app captures title/favicon/description best-effort, prevents
duplicates (opens existing for edit), rejects invalid addresses.

**Independent Test**: Enter a URL and save; it appears with title + favicon. Re-saving the
same URL opens the existing bookmark; invalid text is rejected.

### Tests for User Story 1

- [ ] T014 [P] [US1] Contract test for `POST /api/bookmarks` (create, duplicate→edit 200, invalid URL 422) in `backend/tests/contract/test_bookmarks_create.py`
- [ ] T015 [P] [US1] Integration test for save flow including metadata fallback on unreachable page in `backend/tests/integration/test_save.py`

### Implementation for User Story 1

- [ ] T016 [US1] Implement metadata fetch service (title, favicon bytes, description; time-boxed ~5s, best-effort) in `backend/src/services/metadata.py`
- [ ] T017 [US1] Implement bookmark create service (validate URL, normalize, dedupe→existing, persist, enrich) in `backend/src/services/bookmarks.py` (depends on T007, T009, T016)
- [ ] T018 [US1] Implement `POST /api/bookmarks` and `GET /api/bookmarks/{id}/favicon` in `backend/src/api/bookmarks.py` (depends on T017)
- [ ] T019 [P] [US1] Build add-bookmark UI (URL input, submit, duplicate→open edit) in `frontend/src/components/AddBookmark.tsx`
- [ ] T020 [US1] Wire add flow to API and surface validation/error messages in `frontend/src/pages/App.tsx`

**Checkpoint**: Saving works end-to-end and is independently testable.

---

## Phase 4: User Story 2 - Browse and open saved bookmarks (Priority: P1) 🎯 MVP

**Goal**: See all saved bookmarks (persisted across restarts) and open any in the browser;
clear empty state when none exist.

**Independent Test**: With bookmarks saved, reload and see them all; click one to open its
page; delete all to see the empty state.

### Tests for User Story 2

- [ ] T021 [P] [US2] Contract test for `GET /api/bookmarks` (list shape) in `backend/tests/contract/test_bookmarks_list.py`
- [ ] T022 [P] [US2] Integration test that list persists across process restart in `backend/tests/integration/test_list.py`

### Implementation for User Story 2

- [ ] T023 [US2] Implement list service (all bookmarks, default recent order) in `backend/src/services/bookmarks.py`
- [ ] T024 [US2] Implement `GET /api/bookmarks` in `backend/src/api/bookmarks.py` (depends on T023)
- [ ] T025 [P] [US2] Build BookmarkList + BookmarkCard (title, favicon, address, open-in-browser link) in `frontend/src/components/BookmarkList.tsx` and `BookmarkCard.tsx`
- [ ] T026 [US2] Render empty-state (FR-013) in the list in `frontend/src/pages/App.tsx`
- [ ] T027 [US2] Wire list view to API on load in `frontend/src/pages/App.tsx`

**Checkpoint**: MVP complete — save + browse/open work together and persist.

---

## Phase 5: User Story 3 - Edit and delete bookmarks (Priority: P2)

**Goal**: Edit title/address/note (with basic formatting) and delete with confirmation.

**Independent Test**: Edit a title and confirm it persists; write a formatted note and see
it rendered; delete a bookmark (confirm removes, cancel keeps).

### Tests for User Story 3

- [ ] T028 [P] [US3] Contract test for `PATCH` and `DELETE /api/bookmarks/{id}` in `backend/tests/contract/test_bookmarks_edit.py`
- [ ] T029 [P] [US3] Integration test that edits persist and delete removes in `backend/tests/integration/test_edit_delete.py`

### Implementation for User Story 3

- [ ] T030 [US3] Implement update + delete service (re-validate URL, re-check dedupe, sanitize note) in `backend/src/services/bookmarks.py` (depends on T010)
- [ ] T031 [US3] Implement `PATCH` and `DELETE /api/bookmarks/{id}` in `backend/src/api/bookmarks.py` (depends on T030)
- [ ] T032 [P] [US3] Build edit dialog (title/address/note) in `frontend/src/components/EditDialog.tsx`
- [ ] T033 [P] [US3] Build formatted note editor (Tiptap: link/bold/bullets, rendered formatted) in `frontend/src/components/NoteEditor.tsx`
- [ ] T034 [US3] Build delete action with confirmation step and wire edit/delete to API in `frontend/src/pages/App.tsx`

**Checkpoint**: Bookmarks can be managed (edit/delete/notes) independently.

---

## Phase 6: User Story 4 - Organize with tags and search (Priority: P2)

**Goal**: Tag bookmarks (with suggestions from existing tags), filter by tag, search
(title/url/note/tags, case-insensitive), and sort by newest or alphabetical.

**Independent Test**: Tag bookmarks, filter by a tag, search a word found only in a note
using different case, toggle sort — results match expectations; no-results state shows.

### Tests for User Story 4

- [ ] T035 [P] [US4] Contract test for `GET /api/bookmarks` (`q`/`tag`/`sort`), `GET /api/tags`, `GET /api/tags/suggest` in `backend/tests/contract/test_search_tags.py`
- [ ] T036 [P] [US4] Integration test for case-insensitive note search, tag filter, and sort ordering in `backend/tests/integration/test_search.py`

### Implementation for User Story 4

- [ ] T037 [US4] Extend list service with FTS search (`q`), tag filter, and sort (recent/title) in `backend/src/services/bookmarks.py` (depends on T008)
- [ ] T038 [US4] Implement tag service (attach/detach on bookmark, list-with-counts, suggest-by-prefix) in `backend/src/services/tags.py`
- [ ] T039 [US4] Implement `GET /api/tags` and `GET /api/tags/suggest`, and extend bookmark endpoints with `q`/`tag`/`sort` in `backend/src/api/bookmarks.py` and `backend/src/api/tags.py` (depends on T037, T038)
- [ ] T040 [P] [US4] Build TagInput with existing-tag suggestions in `frontend/src/components/TagInput.tsx`
- [ ] T041 [P] [US4] Build SearchBar, SortControl, and tag-filter UI in `frontend/src/components/SearchBar.tsx` and `SortControl.tsx`
- [ ] T042 [US4] Wire search/filter/sort and no-results state to API in `frontend/src/pages/App.tsx`

**Checkpoint**: A large collection is organizable and searchable.

---

## Phase 7: User Story 5 - Import existing browser bookmarks (Priority: P3)

**Goal**: Import a Netscape bookmark export; folders→tags, original dates preserved,
duplicates skipped, added-vs-skipped summary; malformed file rejected.

**Independent Test**: Import a `bookmarks.html` with folders; bookmarks appear with folder
tags and original dates; summary reports added/skipped; a bad file is rejected.

### Tests for User Story 5

- [ ] T043 [P] [US5] Contract test for `POST /api/import` (summary; invalid file→422) in `backend/tests/contract/test_import.py`
- [ ] T044 [P] [US5] Integration test that import maps folders→tags and preserves ADD_DATE in `backend/tests/integration/test_import.py`

### Implementation for User Story 5

- [ ] T045 [US5] Implement Netscape bookmark parser (folder hierarchy, ADD_DATE) in `backend/src/services/netscape.py`
- [ ] T046 [US5] Implement import service (parse, folders→tags, dates, skip duplicates, build summary) in `backend/src/services/import_service.py` (depends on T045, T017, T038)
- [ ] T047 [US5] Implement `POST /api/import` (multipart upload, reject malformed) in `backend/src/api/import_export.py` (depends on T046)
- [ ] T048 [P] [US5] Build import UI (file picker + added/skipped summary) in `frontend/src/components/ImportExport.tsx`

**Checkpoint**: Existing browser bookmarks can be brought in with structure intact.

---

## Phase 8: User Story 6 - Export bookmarks to a file (Priority: P3)

**Goal**: Export the whole collection to a standard, re-openable Netscape bookmark file;
valid empty file when none; round-trips back via import.

**Independent Test**: Export, then re-import the file here (all present, no duplicates) and
into a browser (recognized). Export with zero bookmarks yields a valid empty file.

### Tests for User Story 6

- [ ] T049 [P] [US6] Contract test for `GET /api/export` (valid file; empty collection) in `backend/tests/contract/test_export.py`
- [ ] T050 [P] [US6] Integration test that an export round-trips back through import in `backend/tests/integration/test_export.py`

### Implementation for User Story 6

- [ ] T051 [US6] Implement Netscape export writer in `backend/src/services/netscape.py`
- [ ] T052 [US6] Implement `GET /api/export` (attachment download) in `backend/src/api/import_export.py` (depends on T051)
- [ ] T053 [US6] Add export button/download to the import/export UI in `frontend/src/components/ImportExport.tsx`

**Checkpoint**: Full portability — bookmarks can leave the app in a standard format.

---

## Phase 9: Packaging & One-Click Launch (FR-019, SC-009)

**Purpose**: Deliver the non-technical, single-action startup the client requires.

- [ ] T054 Implement launcher that starts one process serving API + static UI, picks a free local port, and opens the default browser in `backend/src/launcher.py`
- [ ] T055 Configure frontend production build to emit into `backend/src/static/` in `frontend/vite.config.ts`
- [ ] T056 Create PyInstaller packaging config bundling Python + backend + built static assets into one executable in `packaging/`
- [ ] T057 Produce a desktop shortcut/icon per OS and document the one-time install in `packaging/build.md`
- [ ] T058 Validate SC-009: one action opens a ready-to-use app in under 10s with no typed commands or configuration

**Checkpoint**: "Click the icon → the app is there."

---

## Phase 10: Polish & Cross-Cutting Concerns

- [ ] T059 [P] Handle very long titles/addresses (truncate with full value accessible) in `frontend/src/components/BookmarkCard.tsx`
- [ ] T060 [P] Performance validation: list/search < 1s at 5,000 bookmarks (SC-004); add indexes if needed in `backend/src/db/`
- [ ] T061 [P] Ensure consistent error handling and logging across services in `backend/src/services/`
- [ ] T062 [P] Unit tests for URL normalization, note sanitizer, and Netscape parser in `backend/tests/unit/`
- [ ] T063 Run full quickstart.md validation across all user stories
- [ ] T064 [P] Write user install + usage docs in `docs/`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately.
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories.
- **User Stories (Phases 3–8)**: All depend on Foundational; then can proceed in priority
  order or in parallel by different developers.
- **Packaging (Phase 9)**: Depends on at least the MVP stories building and a production
  frontend build (T055 pairs with T003/T013).
- **Polish (Phase 10)**: Depends on the desired user stories being complete.

### User Story Dependencies

- **US1 (P1)**: After Foundational. No dependency on other stories.
- **US2 (P1)**: After Foundational. Reads bookmarks created by US1 in practice but is
  independently testable by seeding data.
- **US3 (P2)**: After Foundational. Independent; edits/deletes any bookmark.
- **US4 (P2)**: After Foundational. Uses FTS (T008) and tags; independent of US3.
- **US5 (P3)**: After Foundational. Reuses create/tag services (T017, T038) but testable alone.
- **US6 (P3)**: After Foundational. Shares the Netscape module with US5; independently testable.

### Within Each User Story

- Tests written and failing before implementation.
- Models → services → endpoints → UI wiring.

### Parallel Opportunities

- Setup: T003/T004/T005 in parallel.
- Foundational: T009/T010/T012/T013 in parallel (after their prerequisites).
- Within a story, tasks marked [P] (distinct files) run in parallel; the two P1 stories
  can be built concurrently once Foundational is done.

---

## Parallel Example: User Story 1

```bash
# Tests first (parallel):
Task: "Contract test for POST /api/bookmarks in backend/tests/contract/test_bookmarks_create.py"
Task: "Integration test for save flow in backend/tests/integration/test_save.py"

# Then parallelizable implementation across files:
Task: "Build add-bookmark UI in frontend/src/components/AddBookmark.tsx"   # [P], independent of backend service files
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2 — both P1)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational (blocks all stories).
3. Complete Phase 3 (US1 Save) and Phase 4 (US2 Browse/Open).
4. **STOP and VALIDATE**: Save a bookmark, reload, and open it — a usable product.
5. (Optionally) run Phase 9 packaging so the MVP launches with one click.

### Incremental Delivery

1. Setup + Foundational → foundation ready.
2. US1 + US2 → **MVP** (save + browse/open).
3. US3 → editing/deleting/notes.
4. US4 → tags + search + sort.
5. US5 → import; US6 → export (portability).
6. Phase 9 packaging + Phase 10 polish.

### Notes

- [P] = different files, no dependencies. [Story] label maps each task to its user story.
- Commit after each task or logical group; stop at any checkpoint to validate a story.
- Avoid cross-story dependencies that break independent testability.
