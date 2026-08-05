---

description: "Task list for Bookmark Manager implementation"
---

# Tasks: Bookmark Manager

**Input**: Design documents from `/specs/001-bookmark-manager/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api.md, quickstart.md

**Tests**: Included — the approved plan (research Decision 7) commits to server
unit/integration tests and one end-to-end journey test.

**Organization**: Tasks are grouped by user story so each can be implemented and
tested independently. Story priorities from spec.md: US1 (P1), US2 (P1),
US3 (P2), US4 (P2).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: US1–US4; setup/foundational/polish carry no story label
- Paths follow the single-project layout in plan.md (`src/server`, `src/web`, `tests/`)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [X] T001 Create the project structure from plan.md (`src/server/`, `src/server/routes/`, `src/server/services/`, `src/web/components/`, `tests/unit/`, `tests/integration/`, `tests/e2e/`)
- [X] T002 Initialize the Node.js + TypeScript project at repo root (`package.json`, `tsconfig.json`) with server deps (HTTP server, SQLite, HTML parser) and UI deps (Vite + React)
- [X] T003 [P] Configure linting/formatting and a `tsconfig` for both `src/server` and `src/web` in repo-root config files
- [X] T004 [P] Configure test runners: Vitest for `tests/unit` + `tests/integration`, Playwright for `tests/e2e`, with npm scripts (`dev`, `start`, `test`, `test:e2e`)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story. No story is testable without storage, the schema, and a running server shell.

- [X] T005 Implement SQLite connection and schema/migrations in `src/server/db.ts` for `bookmarks`, `tags`, `bookmark_tags` per data-model.md (indexes for search on title/url; UNIQUE on `url_normalized` for active rows; case-insensitive UNIQUE tag `name`)
- [X] T006 Implement the local server entry in `src/server/index.ts`: start HTTP server, mount `/api` router, serve built UI assets, create the DB file on first run
- [X] T007 [P] Implement the shared JSON error helper (`{ error, message }` + status) used by all routes, in `src/server/services/errors.ts` per contracts/api.md
- [X] T008 [P] Scaffold the SPA shell (`src/web/main.tsx`) and typed API client (`src/web/api.ts`) covering the endpoints in contracts/api.md
- [X] T009 [P] Implement URL validation + normalization (trim, lower-case scheme/host; reject non-http/https) in `src/server/services/url.ts` (FR-002, FR-014)

**Checkpoint**: Server boots, serves an empty UI shell, DB file is created.

---

## Phase 3: User Story 1 — Save a bookmark (Priority: P1) 🎯 MVP

**Goal**: A user pastes an address and gets a saved, auto-titled bookmark; invalid addresses are rejected.

**Independent Test**: Enter a web address, save, and confirm the bookmark appears in the list with a recognizable title and its address; entering an invalid address is rejected with an explanation.

### Tests for User Story 1

- [X] T010 [P] [US1] Unit tests for title retrieval + fallback in `tests/unit/title.test.ts` (derives `<title>`; falls back to url when unreachable/empty) (FR-003)
- [X] T011 [P] [US1] Integration test for `POST /api/bookmarks` in `tests/integration/bookmarks-create.test.ts`: valid save → 201; invalid url → 400 (FR-001, FR-002, FR-004)

### Implementation for User Story 1

- [X] T012 [P] [US1] Implement page-title retrieval with graceful fallback in `src/server/services/title.ts` (FR-003, unreachable-page edge case)
- [X] T013 [US1] Implement bookmark create + `created_at` in `src/server/services/bookmarks.ts` (validate via url.ts, derive title via title.ts) (FR-001, FR-002, FR-003, FR-004)
- [X] T014 [US1] Implement `POST /api/bookmarks` and basic `GET /api/bookmarks` (list active, created_desc) in `src/server/routes/bookmarks.ts` per contracts/api.md (FR-005, FR-006)
- [X] T015 [US1] Build the "add bookmark" form + validation error display in `src/web/components/` wired through `src/web/api.ts` (FR-002, FR-015)
- [X] T016 [US1] Build the bookmark list view (title, address, save date) with the empty-state guide in `src/web/components/` (FR-006, FR-015)

**Checkpoint**: US1 independently testable — save works, list shows saved bookmarks, invalid input rejected. This is the MVP.

---

## Phase 4: User Story 2 — Browse and find (Priority: P1)

**Goal**: Quickly locate a bookmark by scanning, searching by keyword, and opening it.

**Independent Test**: With several bookmarks, type a keyword and confirm the list narrows to matches; open one and confirm it navigates to the saved address; a no-match search shows clear guidance.

### Tests for User Story 2

- [X] T017 [P] [US2] Integration test for `GET /api/bookmarks?q=` in `tests/integration/bookmarks-search.test.ts`: matches title/url/tags; empty result is valid (FR-007, FR-015)
- [X] T018 [P] [US2] E2E test in `tests/e2e/save-find-open.spec.ts` for the primary journey save → search → open (FR-008, SC-002)

### Implementation for User Story 2

- [X] T019 [US2] Add keyword search (title, url, tag names; active only; indexed for SC-003) to `src/server/services/bookmarks.ts` and the `q` param in `src/server/routes/bookmarks.ts` (FR-007)
- [X] T020 [US2] Add `GET /api/bookmarks/{id}` detail (full untruncated fields) in `src/server/routes/bookmarks.ts` (long-title/url edge case)
- [X] T021 [US2] Build the search bar with live filtering and the "no matches" message in `src/web/components/` (FR-007, FR-015)
- [X] T022 [US2] Make list items open the saved address in the browser and show truncated long titles/addresses in `src/web/components/` (FR-008, long-value edge case)

**Checkpoint**: US1 + US2 form a fully usable bookmark tool — save, find, open.

---

## Phase 5: User Story 3 — Organize with tags (Priority: P2)

**Goal**: Group related bookmarks with tags and filter by tag.

**Independent Test**: Assign tags to a bookmark, filter by a tag and see only tagged bookmarks; rename/remove a tag and see it reflected everywhere.

### Tests for User Story 3

- [X] T023 [P] [US3] Integration test for tag rename/remove propagation in `tests/integration/tags.test.ts` (rename updates all bookmarks; remove detaches from all) (FR-009)
- [X] T024 [P] [US3] Integration test for `GET /api/bookmarks?tag=` and `GET /api/tags` counts in `tests/integration/tag-filter.test.ts` (FR-010)

### Implementation for User Story 3

- [X] T025 [US3] Implement tag assign on create/edit, plus rename (case-insensitive merge) and remove with propagation, in `src/server/services/tags.ts` (FR-009)
- [X] T026 [US3] Add tag filtering to bookmark queries in `src/server/services/bookmarks.ts` and the `tag` param in `src/server/routes/bookmarks.ts` (FR-010)
- [X] T027 [US3] Implement `GET /api/tags`, `PATCH /api/tags/{id}`, `DELETE /api/tags/{id}` in `src/server/routes/tags.ts` per contracts/api.md (FR-009, FR-010)
- [X] T028 [US3] Build tag editing on a bookmark and a tag-filter control (with counts) in `src/web/components/` (FR-009, FR-010)

**Checkpoint**: Bookmarks can be organized and filtered by tag.

---

## Phase 6: User Story 4 — Edit and delete with undo (Priority: P2)

**Goal**: Correct bookmark details and remove bookmarks, with confirmation and undo.

**Independent Test**: Edit a bookmark's title/address/tags and confirm persistence; delete with confirmation, then undo to restore.

### Tests for User Story 4

- [X] T029 [P] [US4] Integration test for `PATCH /api/bookmarks/{id}` in `tests/integration/bookmarks-edit.test.ts`: edits persist; changed url re-validates and re-checks duplicates (FR-011)
- [X] T030 [P] [US4] Integration test for soft-delete + undo in `tests/integration/bookmarks-delete-undo.test.ts`: deleted excluded from lists; undo restores with tags (FR-012, FR-013)

### Implementation for User Story 4

- [X] T031 [US4] Implement edit (update fields + `updated_at`, re-validate url/dupes) and soft-delete + undo/restore in `src/server/services/bookmarks.ts` (FR-011, FR-012, FR-013)
- [X] T032 [US4] Implement `PATCH /api/bookmarks/{id}`, `DELETE /api/bookmarks/{id}` (returns undo token), and `POST /api/bookmarks/{id}/undo` in `src/server/routes/bookmarks.ts` (FR-011, FR-012, FR-013)
- [X] T033 [US4] Build the edit form, delete confirmation step, and undo toast in `src/web/components/` (FR-011, FR-012, FR-013)

**Checkpoint**: Full CRUD with safe deletion. All four user stories complete.

---

## Phase 7: Cross-cutting — Duplicate detection

**Purpose**: Duplicate-address behavior spans create and edit (FR-014, SC-006); implement once both save paths exist.

- [ ] T034 Add duplicate detection to create/edit in `src/server/services/bookmarks.ts` (match `url_normalized` among active; return 409 with existing bookmark) per contracts/api.md (FR-014, SC-006)
- [ ] T035 Build the duplicate warning + "open existing" prompt in `src/web/components/` (FR-014)
- [ ] T036 [P] Integration test for duplicate handling in `tests/integration/duplicate.test.ts`: saving an existing address returns 409 with the existing bookmark; no duplicate created (FR-014, SC-006)

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Validation against success criteria and final quality pass

- [ ] T037 [P] Verify persistence across restart (stop/start app; data intact) per quickstart V6 (FR-005, SC-005)
- [ ] T038 [P] Seed ~5,000 bookmarks and confirm search/filter return within ~1s (SC-003); add indexes if needed in `src/server/db.ts`
- [ ] T039 [P] Preserve and search special-character/non-Latin titles and tags (edge case); cover in `tests/unit`
- [ ] T040 Walk through all quickstart.md scenarios (V1–V6) and confirm expected outcomes
- [ ] T041 [P] Write run instructions in `README.md` (install, run one command, open localhost, where the DB file lives for backup)

---

## Dependencies & Execution Order

- **Setup (Phase 1)** → blocks everything.
- **Foundational (Phase 2)** → blocks all user stories. T005/T006 first; T007–T009 depend on the project existing.
- **User stories**: US1 (P1) is the MVP and should come first. US2 depends only on US1's create/list. US3 and US4 depend on Foundational + US1; they are independent of each other and of US2, so they can proceed in parallel once US1 is done.
- **Phase 7 (duplicate)** depends on both create (US1) and edit (US4) paths existing.
- **Polish (Phase 8)** depends on all targeted stories being complete.

## Parallel Opportunities

- Setup: T003, T004 in parallel after T002.
- Foundational: T007, T008, T009 in parallel after T005/T006.
- Within each story, tasks marked [P] (distinct files, e.g. the test tasks) run in parallel before the shared implementation files.
- Across stories: once US1 lands, US3 and US4 teams can work concurrently (different service methods, different UI components).

## Implementation Strategy

- **MVP first**: Complete Phase 1 → Phase 2 → Phase 3 (US1). This alone is a usable product: save and list bookmarks with validation and auto-titling.
- **Incremental delivery**: Add US2 (find/open) to reach a genuinely useful tool, then US3 (tags) and US4 (edit/delete+undo), then duplicate handling, then polish.
- Each checkpoint is independently demonstrable to the client.

## Task Summary

- **Total tasks**: 41
- **By story**: US1 = 7 (T010–T016), US2 = 6 (T017–T022), US3 = 6 (T023–T028), US4 = 5 (T029–T033); Setup = 4, Foundational = 5, Duplicate = 3, Polish = 5.
- **MVP scope**: Phases 1–3 (through US1).
