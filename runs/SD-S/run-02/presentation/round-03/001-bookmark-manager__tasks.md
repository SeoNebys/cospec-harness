---

description: "Task list for Bookmark Manager implementation"
---

# Tasks: Bookmark Manager

**Input**: Design documents from `/specs/001-bookmark-manager/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api.md, quickstart.md

**Tests**: Included — the plan defines a testing strategy (Vitest, Supertest, Playwright).

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1–US4)

## Path Conventions

Web app layout per plan.md: `backend/src/`, `backend/tests/`, `frontend/src/`, `frontend/tests/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [ ] T001 Create the `backend/` and `frontend/` directory trees per plan.md (models, db, services, routes; components, pages, api)
- [ ] T002 Initialize backend TypeScript + Node 20 project in `backend/` with Fastify, better-sqlite3, zod, node-html-parser, and scripts (`dev`, `build`, `test`) in `backend/package.json`
- [ ] T003 Initialize frontend TypeScript + Vite + React 18 project in `frontend/` with scripts (`dev`, `build`, `test`, `e2e`) in `frontend/package.json`, and configure the dev proxy of `/api` to the backend in `frontend/vite.config.ts`
- [ ] T004 [P] Configure linting/formatting (ESLint + Prettier) and `tsconfig.json` for both `backend/` and `frontend/`
- [ ] T005 [P] Configure test runners: Vitest + Supertest in `backend/`, Vitest + Playwright in `frontend/`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T006 Implement SQLite connection + schema bootstrap (bookmarks table with id, url, normalizedUrl, title, description, tags, createdAt, updatedAt, deletedAt) and indexes on normalizedUrl and createdAt in `backend/src/db/index.ts`
- [ ] T007 [P] Define shared Bookmark/Tag types and zod schemas in `backend/src/models/bookmark.ts` per data-model.md
- [ ] T008 [P] Implement URL validation + normalization utility (http/https only, lower-case scheme+host, trim trailing slash) in `backend/src/services/url.ts` per research R5
- [ ] T009 Implement Fastify server bootstrap, `/api` route registration, JSON error handler emitting `{error, message}`, and config (port, DB path) in `backend/src/server.ts`
- [ ] T010 [P] Implement the typed frontend API client covering all endpoints in `contracts/api.md` in `frontend/src/api/client.ts`
- [ ] T011 [P] Create the base app shell/layout and routing in `frontend/src/pages/App.tsx` and `frontend/src/main.tsx`

**Checkpoint**: Foundation ready — user stories can now begin

---

## Phase 3: User Story 1 - Save a bookmark (Priority: P1) 🎯 MVP

**Goal**: A user can save a bookmark by URL; the title auto-fills when omitted; invalid input is rejected.

**Independent Test**: Enter a URL with no title → it is saved with a derived title; enter an invalid URL → rejected with a clear message.

### Tests for User Story 1

- [ ] T012 [P] [US1] Contract test for `POST /api/bookmarks` (201 create, 400 invalid_url) in `backend/tests/contract/bookmarks.post.test.ts`
- [ ] T013 [P] [US1] Unit test for URL validation/normalization in `backend/tests/unit/url.test.ts`
- [ ] T014 [P] [US1] Unit test for title parsing (`<title>` → `og:title` → url fallback) in `backend/tests/unit/title.test.ts`

### Implementation for User Story 1

- [ ] T015 [P] [US1] Implement best-effort title-fetch service (timeout, capped size, parse `<title>`/`og:title`, url fallback) in `backend/src/services/title.ts` per research R4
- [ ] T016 [US1] Implement bookmark create in the bookmark service (validate+normalize url, derive title when absent, tag normalization, persist) in `backend/src/services/bookmarks.ts`
- [ ] T017 [US1] Implement `POST /api/bookmarks` route wiring validation and 201/400 responses in `backend/src/routes/bookmarks.ts`
- [ ] T018 [P] [US1] Build the save form component (URL, optional title/description/tags, error display) in `frontend/src/components/BookmarkForm.tsx`
- [ ] T019 [US1] Wire the save form to the API client with success + validation-error handling in `frontend/src/pages/App.tsx`

**Checkpoint**: A bookmark can be saved (with auto-title) and invalid input rejected.

---

## Phase 4: User Story 2 - Browse and open saved bookmarks (Priority: P1) 🎯 MVP

**Goal**: The user sees all saved bookmarks and can reopen the original page; empty state when none exist.

**Independent Test**: With bookmarks saved, reload → all listed with title+address; click one → original page opens; with none → empty state.

### Tests for User Story 2

- [ ] T020 [P] [US2] Contract test for `GET /api/bookmarks` (items+total, empty case) in `backend/tests/contract/bookmarks.get.test.ts`
- [ ] T021 [P] [US2] E2E test for save→reload→list→open journey in `frontend/tests/e2e/browse.spec.ts`

### Implementation for User Story 2

- [ ] T022 [US2] Implement bookmark list query (active only, `sort=recent` default, `limit`/`offset`) in `backend/src/services/bookmarks.ts`
- [ ] T023 [US2] Implement `GET /api/bookmarks` and `GET /api/bookmarks/:id` routes in `backend/src/routes/bookmarks.ts`
- [ ] T024 [P] [US2] Build the bookmark list component (title, address as opening link, truncation of long values) in `frontend/src/components/BookmarkList.tsx`
- [ ] T025 [P] [US2] Build the empty-state component in `frontend/src/components/EmptyState.tsx`
- [ ] T026 [US2] Wire list + empty state into `frontend/src/pages/App.tsx`, loading from the API on mount

**Checkpoint**: MVP complete — bookmarks can be saved, listed, and reopened.

---

## Phase 5: User Story 3 - Organize and find bookmarks (Priority: P2)

**Goal**: The user tags bookmarks and finds them via text search and tag filtering.

**Independent Test**: With many bookmarks, search by term → only matches; select a tag → only tagged bookmarks.

### Tests for User Story 3

- [ ] T027 [P] [US3] Contract test for `GET /api/bookmarks?q=&tag=` filtering and `GET /api/tags` in `backend/tests/contract/search.test.ts`
- [ ] T028 [P] [US3] Integration test for search + tag-filter combined (AND) in `backend/tests/integration/search.test.ts`

### Implementation for User Story 3

- [ ] T029 [US3] Extend list query with case-insensitive `q` over title/url/tags and repeatable `tag` filter (AND) in `backend/src/services/bookmarks.ts`
- [ ] T030 [US3] Implement tag aggregation (name + active count) service and `GET /api/tags` route in `backend/src/services/bookmarks.ts` and `backend/src/routes/tags.ts`
- [ ] T031 [P] [US3] Build the search bar component in `frontend/src/components/SearchBar.tsx`
- [ ] T032 [P] [US3] Build the tag filter component (from `GET /api/tags`) in `frontend/src/components/TagFilter.tsx`
- [ ] T033 [US3] Wire search + tag filter into `frontend/src/pages/App.tsx`, driving the list query

**Checkpoint**: Bookmarks are searchable and filterable by tag.

---

## Phase 6: User Story 4 - Edit and delete bookmarks (Priority: P2)

**Goal**: The user edits title/url/tags, deletes with confirmation, and can undo a recent deletion.

**Independent Test**: Edit a bookmark → changes persist; delete → confirm → removed; undo → restored.

### Tests for User Story 4

- [ ] T034 [P] [US4] Contract test for `PUT /api/bookmarks/:id` (200/400/404/409) in `backend/tests/contract/bookmarks.put.test.ts`
- [ ] T035 [P] [US4] Contract test for `DELETE /api/bookmarks/:id` + `POST /api/bookmarks/:id/restore` (undo window, 410 after purge) in `backend/tests/contract/delete-restore.test.ts`

### Implementation for User Story 4

- [ ] T036 [US4] Implement update (validate/normalize on url change, dedupe check, refresh updatedAt) in `backend/src/services/bookmarks.ts`
- [ ] T037 [US4] Implement soft-delete + restore with an undo window and purge-after-elapse in `backend/src/services/bookmarks.ts`
- [ ] T038 [US4] Implement `PUT`, `DELETE`, and `POST /:id/restore` routes in `backend/src/routes/bookmarks.ts`
- [ ] T039 [P] [US4] Add edit mode to `frontend/src/components/BookmarkForm.tsx` (prefill, save changes)
- [ ] T040 [P] [US4] Build delete confirmation + undo toast in `frontend/src/components/UndoToast.tsx`
- [ ] T041 [US4] Wire edit, delete-with-confirm, and undo into `frontend/src/pages/App.tsx`

**Checkpoint**: Full CRUD with confirmation and undo.

---

## Phase 7: Cross-Cutting - Duplicate detection

**Purpose**: The duplicate-address behavior spans create (US1) and edit (US4).

- [ ] T042 [US1] Implement duplicate detection by `normalizedUrl` returning 409 with the existing record on create/update in `backend/src/services/bookmarks.ts` and routes
- [ ] T043 [US1] Add the duplicate-warning UI (offer "open existing" or "update") in `frontend/src/pages/App.tsx`
- [ ] T044 [P] Contract test for the 409 duplicate flow in `backend/tests/contract/duplicate.test.ts`

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Improvements across stories

- [ ] T045 [P] Add list responsiveness handling for large collections (pagination or lightweight virtualization) in `frontend/src/components/BookmarkList.tsx`
- [ ] T046 [P] Seed script to insert 2,000+ bookmarks for SC-005 spot check in `backend/scripts/seed.ts`
- [ ] T047 [P] Update `README.md` from quickstart.md (setup/run/test)
- [ ] T048 Run `specs/001-bookmark-manager/quickstart.md` validation scenarios end-to-end
- [ ] T049 [P] Add unit tests for dedupe/normalization edge cases in `backend/tests/unit/dedupe.test.ts`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories
- **User Stories (Phase 3–6)**: Depend on Foundational; then proceed in priority order or in parallel
- **Duplicate detection (Phase 7)**: Depends on US1 create and US4 update existing
- **Polish (Phase 8)**: Depends on the desired user stories being complete

### User Story Dependencies

- **US1 (P1)**: After Foundational — no dependency on other stories
- **US2 (P1)**: After Foundational — independently testable (uses seeded/saved data)
- **US3 (P2)**: After Foundational — extends the list query; independently testable
- **US4 (P2)**: After Foundational — independently testable

### Within Each User Story

- Tests written first and expected to fail → models → services → routes → UI wiring

### Parallel Opportunities

- Setup: T004, T005 in parallel
- Foundational: T007, T008, T010, T011 in parallel
- Within each story, all [P] tasks (distinct files) can run together
- With capacity, US1–US4 can be built in parallel after Phase 2

---

## Parallel Example: User Story 1

```bash
# Tests together:
Task: "Contract test POST /api/bookmarks in backend/tests/contract/bookmarks.post.test.ts"
Task: "Unit test URL validation in backend/tests/unit/url.test.ts"
Task: "Unit test title parsing in backend/tests/unit/title.test.ts"

# Then parallel implementation across files:
Task: "Title-fetch service in backend/src/services/title.ts"
Task: "Save form component in frontend/src/components/BookmarkForm.tsx"
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2)

1. Phase 1: Setup
2. Phase 2: Foundational (blocks all stories)
3. Phase 3 + Phase 4: Save + Browse/Open → this is the MVP
4. **STOP and VALIDATE**: save, reload, list, reopen
5. Demo if ready

### Incremental Delivery

1. Setup + Foundational → foundation ready
2. US1 + US2 → MVP (save, list, open)
3. US3 → search + tags
4. US4 → edit, delete, undo
5. Phase 7 duplicate detection + Phase 8 polish

---

## Notes

- [P] = different files, no incomplete dependencies
- Each user story is independently completable and testable
- Verify tests fail before implementing
- Commit after each task or logical group
