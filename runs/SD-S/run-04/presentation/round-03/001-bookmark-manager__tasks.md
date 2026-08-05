---
description: "Task list for Bookmark Manager implementation"
---

# Tasks: Bookmark Manager

**Input**: Design documents from `/specs/001-bookmark-manager/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api.md, quickstart.md

**Tests**: Included — the plan and quickstart specify Vitest (unit/integration) and Playwright (e2e) coverage of the user scenarios.

**Organization**: Tasks are grouped by user story so each story can be implemented, tested, and delivered independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story the task belongs to (US1–US4)
- Paths follow the web-app structure from plan.md (`backend/`, `frontend/`)

## Path Conventions

- Backend: `backend/src/`, `backend/tests/`
- Frontend: `frontend/src/`, `frontend/tests/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [ ] T001 Create the `backend/` and `frontend/` directory trees per plan.md (models, services, api, db; components, pages, services)
- [ ] T002 Initialize the backend TypeScript + Node 22 project in `backend/` with Fastify, better-sqlite3, and Cheerio dependencies
- [ ] T003 Initialize the frontend TypeScript + React + Vite project in `frontend/`
- [ ] T004 [P] Configure linting/formatting (ESLint + Prettier) and shared tsconfig across `backend/` and `frontend/`
- [ ] T005 [P] Configure test runners: Vitest in both projects and Playwright in `frontend/` (config + npm scripts)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T006 Create the SQLite connection and DB bootstrap in `backend/src/db/connection.ts` (creates the DB file on first run)
- [ ] T007 Define the schema and migrations in `backend/src/db/schema.ts`: `bookmarks`, `tags`, `bookmark_tags` join, and the FTS5 index over title/url/note per data-model.md
- [ ] T008 [P] Create the `Bookmark` and `Tag` type definitions / row mappers in `backend/src/models/`
- [ ] T009 [P] Implement the shared error format `{ error: { code, message } }` and error-handling plugin in `backend/src/api/errors.ts` (contracts/api.md)
- [ ] T010 Scaffold the Fastify server, `/api` route registration, and startup in `backend/src/server.ts`
- [ ] T011 [P] Create the frontend API client wrapper in `frontend/src/services/apiClient.ts` (base URL, JSON, error surfacing)
- [ ] T012 [P] Create the app shell/layout and routing in `frontend/src/main.tsx` and a base page container

**Checkpoint**: Foundation ready — user story implementation can now begin

---

## Phase 3: User Story 1 - Save a bookmark with automatic details (Priority: P1) 🎯 MVP

**Goal**: A user pastes a link; the app auto-fetches title + preview and saves the bookmark without blocking on the fetch. The title is editable and duplicates are warned.

**Independent Test**: Paste a reachable URL → title/preview populate automatically → save → bookmark appears. Unreachable/invalid URLs fall back gracefully or are rejected, and saving is never blocked (quickstart V1).

### Tests for User Story 1 ⚠️

- [ ] T013 [P] [US1] Unit tests for URL validation and normalization/duplicate detection in `backend/tests/unit/url.test.ts`
- [ ] T014 [P] [US1] Unit tests for metadata parsing (OG → Twitter → HTML fallback, empty/failed cases) in `backend/tests/unit/metadata.test.ts`
- [ ] T015 [P] [US1] Integration test for `POST /api/bookmarks` covering create, 400 invalid, 409 duplicate, and pending fetch_status in `backend/tests/integration/create-bookmark.test.ts`
- [ ] T016 [P] [US1] Playwright e2e for capture flow (auto-fill, edit title, fallback on unreachable, non-blocking save) in `frontend/tests/e2e/capture.spec.ts`

### Implementation for User Story 1

- [ ] T017 [P] [US1] Implement URL validation and normalization in `backend/src/services/url.ts` (FR-002, FR-012, research §5)
- [ ] T018 [P] [US1] Implement the metadata fetcher (bounded timeout, size cap, OG/Twitter/HTML extraction via Cheerio) in `backend/src/services/metadataFetcher.ts` (FR-014, FR-016, research §2)
- [ ] T019 [US1] Implement `bookmarkService.create` with immediate persist + async enrichment updating title/preview/fetch_status in `backend/src/services/bookmarkService.ts` (FR-001, FR-004, FR-013, FR-016, FR-017)
- [ ] T020 [US1] Implement duplicate detection (normalized-url match → 409 payload) in `bookmarkService` (FR-012)
- [ ] T021 [US1] Implement `POST /api/bookmarks` and `GET /api/bookmarks/:id` routes in `backend/src/api/bookmarks.ts` (contracts/api.md)
- [ ] T022 [P] [US1] Build the Add Bookmark form with live auto-fetch preview and editable title in `frontend/src/components/AddBookmarkForm.tsx` (FR-014, FR-015)
- [ ] T023 [P] [US1] Build the bookmark card with fetching/failed states and address fallback label in `frontend/src/components/BookmarkCard.tsx` (FR-003, FR-016)
- [ ] T024 [US1] Wire the add flow end-to-end (submit, duplicate-warning prompt, post-save enrichment refresh) in `frontend/src/pages/Collection.tsx`

**Checkpoint**: User Story 1 is fully functional — the app can capture links with automatic details. This is the MVP.

---

## Phase 4: User Story 2 - Browse and find saved bookmarks (Priority: P2)

**Goal**: List saved bookmarks newest-first and find them via full-text search, with clear empty/no-results states.

**Independent Test**: Populate bookmarks → list is newest-first → search a known term returns only matches → a non-matching search shows "no results"; empty collection shows the empty state (quickstart V2).

### Tests for User Story 2 ⚠️

- [ ] T025 [P] [US2] Integration test for `GET /api/bookmarks?q=` search (match, no-match, ordering) in `backend/tests/integration/search.test.ts`
- [ ] T026 [P] [US2] Playwright e2e for list ordering, search, no-results, and empty state in `frontend/tests/e2e/browse.spec.ts`

### Implementation for User Story 2

- [ ] T027 [US2] Implement search + newest-first listing over the FTS index in `backend/src/services/search.ts` (FR-005, FR-006, SC-003)
- [ ] T028 [US2] Implement `GET /api/bookmarks` (list + `q` search) in `backend/src/api/bookmarks.ts` (FR-005, FR-006, FR-007)
- [ ] T029 [P] [US2] Build the search bar component in `frontend/src/components/SearchBar.tsx` (FR-006)
- [ ] T030 [P] [US2] Build the empty-state and no-results views in `frontend/src/components/EmptyState.tsx` (FR-007)
- [ ] T031 [US2] Render the newest-first list wired to search in `frontend/src/pages/Collection.tsx` (FR-005)

**Checkpoint**: Users can browse and search their collection; US1 + US2 both work independently.

---

## Phase 5: User Story 3 - Organize bookmarks with tags (Priority: P3)

**Goal**: Assign/remove tags on bookmarks and filter the collection by a tag.

**Independent Test**: Tag several bookmarks → filter by that tag shows only those → remove a tag from one bookmark and confirm it drops from that filter without affecting others (quickstart V3).

### Tests for User Story 3 ⚠️

- [ ] T032 [P] [US3] Integration test for tag assignment via create/edit and `GET /api/bookmarks?tag=` filtering in `backend/tests/integration/tags.test.ts`
- [ ] T033 [P] [US3] Playwright e2e for adding/removing tags and filtering by tag in `frontend/tests/e2e/tags.spec.ts`

### Implementation for User Story 3

- [ ] T034 [US3] Implement `tagService` (normalize, find-or-create, attach/detach, list) in `backend/src/services/tagService.ts` (FR-008, research §6)
- [ ] T035 [US3] Extend create/edit to accept a `tags` array and add tag filtering to `GET /api/bookmarks?tag=` in `backend/src/api/bookmarks.ts` (FR-008, FR-009)
- [ ] T036 [US3] Implement `GET /api/tags` route in `backend/src/api/tags.ts` (contracts/api.md)
- [ ] T037 [P] [US3] Build the tag editor (add/remove, existing-tag picker) in `frontend/src/components/TagEditor.tsx` (FR-008)
- [ ] T038 [P] [US3] Build the tag filter control in `frontend/src/components/TagFilter.tsx` (FR-009)
- [ ] T039 [US3] Wire tag display and filtering into the collection view in `frontend/src/pages/Collection.tsx`

**Checkpoint**: Tagging and tag-filtering work; US1–US3 all independently functional.

---

## Phase 6: User Story 4 - Edit and delete bookmarks (Priority: P3)

**Goal**: Edit a bookmark's title/note/tags with persistence, and delete a bookmark behind an explicit confirmation.

**Independent Test**: Edit a title/note → reload → change persists. Delete → confirmation appears → confirm → bookmark removed (quickstart V4).

### Tests for User Story 4 ⚠️

- [ ] T040 [P] [US4] Integration test for `PATCH /api/bookmarks/:id` (title precedence, note, tags) and `DELETE /api/bookmarks/:id` in `backend/tests/integration/edit-delete.test.ts`
- [ ] T041 [P] [US4] Playwright e2e for editing persistence and confirmed deletion in `frontend/tests/e2e/edit-delete.spec.ts`

### Implementation for User Story 4

- [ ] T042 [US4] Implement `bookmarkService.update` (user title precedence) and `bookmarkService.delete` in `backend/src/services/bookmarkService.ts` (FR-010, FR-011, FR-015)
- [ ] T043 [US4] Implement `PATCH` and `DELETE /api/bookmarks/:id` routes in `backend/src/api/bookmarks.ts` (FR-010, FR-011)
- [ ] T044 [P] [US4] Build the bookmark detail/edit view in `frontend/src/pages/BookmarkDetail.tsx` (FR-010)
- [ ] T045 [P] [US4] Build the delete confirmation dialog in `frontend/src/components/ConfirmDialog.tsx` (FR-011)
- [ ] T046 [US4] Wire edit + confirmed delete into the collection/detail flow in `frontend/src/pages/Collection.tsx`

**Checkpoint**: Full CRUD complete; all four stories independently functional.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Improvements spanning multiple user stories

- [ ] T047 [P] Add graceful handling for long titles/notes (truncate in list with full-text on detail) across `frontend/src/components/` (edge cases)
- [ ] T048 [P] Add backend unit tests for the search-ordering and tag-normalization edge cases in `backend/tests/unit/`
- [ ] T049 Verify performance targets: search < 1s at 1,000 bookmarks and save < 5s regardless of fetch (SC-003, SC-007)
- [ ] T050 [P] Write a top-level `README.md` with setup/run instructions mirroring quickstart.md
- [ ] T051 Run the full quickstart.md validation (V1–V5) and fix any gaps

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories
- **User Stories (Phase 3–6)**: All depend on Foundational; then proceed in priority order P1 → P2 → P3 → P3, or in parallel if staffed
- **Polish (Phase 7)**: Depends on the desired user stories being complete

### User Story Dependencies

- **US1 (P1)**: Depends only on Foundational — the MVP
- **US2 (P2)**: Depends on Foundational; independently testable (uses bookmarks created by US1 or seeded)
- **US3 (P3)**: Depends on Foundational; independently testable
- **US4 (P3)**: Depends on Foundational; independently testable
- Note: US2/US3/US4 all touch `frontend/src/pages/Collection.tsx` — sequence those specific wiring tasks (T031, T039, T046) to avoid conflicts if run in parallel.

### Within Each User Story

- Tests written first and failing before implementation
- Models → services → endpoints → frontend wiring
- Story complete before moving to next priority

### Parallel Opportunities

- Setup: T004, T005 in parallel
- Foundational: T008, T009, T011, T012 in parallel after T006/T007
- Within US1: tests T013–T016 in parallel; then T017/T018 in parallel; frontend T022/T023 in parallel
- Across stories: once Foundational is done, US1–US4 can be staffed in parallel (mind the shared Collection.tsx note)

---

## Parallel Example: User Story 1

```bash
# Tests together:
Task: "Unit tests for URL validation in backend/tests/unit/url.test.ts"
Task: "Unit tests for metadata parsing in backend/tests/unit/metadata.test.ts"
Task: "Integration test for POST /api/bookmarks in backend/tests/integration/create-bookmark.test.ts"
Task: "Playwright e2e for capture flow in frontend/tests/e2e/capture.spec.ts"

# Then core services together:
Task: "Implement URL validation/normalization in backend/src/services/url.ts"
Task: "Implement metadata fetcher in backend/src/services/metadataFetcher.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: capture a link, confirm auto-fetch and non-blocking save
5. Demo the MVP

### Incremental Delivery

1. Setup + Foundational → foundation ready
2. US1 → validate → demo (MVP: effortless capture)
3. US2 → validate → demo (browse & search)
4. US3 → validate → demo (tags)
5. US4 → validate → demo (edit & delete)

---

## Notes

- [P] = different files, no dependencies
- [Story] label maps each task to its user story for traceability
- Write tests first and confirm they fail before implementing
- Commit after each task or logical group
- Watch the shared `frontend/src/pages/Collection.tsx` across US2–US4
