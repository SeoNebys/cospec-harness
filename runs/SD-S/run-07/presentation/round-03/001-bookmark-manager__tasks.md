---

description: "Task list for Bookmark Manager implementation"
---

# Tasks: Bookmark Manager

**Input**: Design documents from `/specs/001-bookmark-manager/`

**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/api.md, quickstart.md

**Tests**: Included — the approved plan specifies `node:test` (unit/API) and Playwright 1.61.0 (E2E) validation of the primary journeys.

**Organization**: Tasks are grouped by user story so each story can be implemented and tested independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1–US4)

## Path Conventions

Single Node.js web application at repository root: `src/`, `public/`, `tests/`, `data/` (per plan.md Structure Decision).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [ ] T001 Create project directory structure per plan.md: `src/`, `src/models/`, `src/services/`, `src/routes/`, `public/`, `tests/unit/`, `tests/api/`, `tests/e2e/`, `data/` at repository root
- [ ] T002 Create `package.json` with `"type": "module"`, dependencies `express`, `better-sqlite3`, `node-html-parser`, devDependency `@playwright/test` pinned to `1.61.0`, and scripts `start` (`node src/server.js`), `test` (`node --test tests/unit tests/api`), `test:e2e` (`playwright test`)
- [ ] T003 Install dependencies with `npm install`, preserving the generated lockfile
- [ ] T004 [P] Create `playwright.config.js` targeting Chromium, `testDir: tests/e2e`, `baseURL http://127.0.0.1:4000`, and a webServer entry running `npm start`
- [ ] T005 [P] Add `.gitignore` excluding `node_modules/` and `data/*.db`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T006 Implement SQLite connection and schema initialization in `src/db.js`: open/create `data/bookmarks.db`, enable `PRAGMA foreign_keys = ON`, and create tables `bookmarks` (id, url TEXT NOT NULL, url_normalized TEXT NOT NULL UNIQUE, title TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL), `tags` (id, name TEXT NOT NULL UNIQUE COLLATE NOCASE), `bookmark_tags` (bookmark_id, tag_id, composite PK, FKs ON DELETE CASCADE), and index `idx_bookmarks_created_at` on `bookmarks(created_at DESC)` per data-model.md
- [ ] T007 Create Express app skeleton in `src/server.js`: JSON body parsing, serve static files from `public/`, mount `/api` router, listen on `0.0.0.0:4000`, and initialize the DB on startup
- [ ] T008 [P] Create empty `/api` router module in `src/routes/bookmarks.js` and wire it into `src/server.js`
- [ ] T009 [P] Add centralized JSON error handling in `src/server.js` that returns `{ "error": "message" }` with appropriate 4xx status codes

**Checkpoint**: Server boots, DB schema exists, `/api` mounts — user stories can begin

---

## Phase 3: User Story 1 - Save a bookmark (Priority: P1) 🎯 MVP

**Goal**: A user can save a bookmark by entering a web address; it is validated, a title is derived (fallback to the address), and it appears in the collection.

**Independent Test**: Enter a valid address, save, and confirm it appears with a title and address; empty/malformed addresses are rejected with a clear message.

### Tests for User Story 1

- [ ] T010 [P] [US1] Unit tests for address validation (reject empty; reject non-http/https; accept well-formed) and URL normalization (trim, lowercase scheme/host, strip trailing slash) in `tests/unit/validation.test.js`
- [ ] T011 [P] [US1] Unit test for title fallback (unreachable/no-title → address used as title) in `tests/unit/titleFetcher.test.js`
- [ ] T012 [P] [US1] API test for `POST /api/bookmarks`: 201 with created bookmark on valid input; 400 `{ "error": "A valid web address is required." }` on empty/malformed url in `tests/api/create.test.js`

### Implementation for User Story 1

- [ ] T013 [US1] Implement URL validation (well-formed http/https, non-empty per FR-001/FR-002) and `url_normalized` normalization helper in `src/models/bookmark.js`
- [ ] T014 [P] [US1] Implement `src/services/titleFetcher.js`: fetch target page with a short timeout, extract `<title>` via node-html-parser, fall back to the address on any failure (FR-003)
- [ ] T015 [US1] Implement `createBookmark({url, title, tags})` in `src/models/bookmark.js`: validate url, normalize, set `created_at`/`updated_at` (ISO-8601), derive title when omitted, insert row (depends on T013, T014)
- [ ] T016 [US1] Implement `POST /api/bookmarks` handler in `src/routes/bookmarks.js` returning 201 with the created Bookmark (id, url, title, tags, createdAt, updatedAt) per contracts/api.md
- [ ] T017 [US1] Build minimal frontend in `public/index.html`, `public/app.js`, `public/styles.css`: a save form (address + optional title) that POSTs and renders the resulting bookmark, showing validation errors returned by the API

**Checkpoint**: A bookmark can be saved and is visible; US1 is independently testable

---

## Phase 4: User Story 2 - Browse and find saved bookmarks (Priority: P1)

**Goal**: The user sees all bookmarks newest-first, can search by keyword, open a bookmark in a new tab, and sees clear empty / no-results states.

**Independent Test**: With several bookmarks saved, all appear newest-first; a keyword narrows the list; a non-matching keyword shows "no results"; activating a bookmark opens it in a new tab.

### Tests for User Story 2

- [ ] T018 [P] [US2] API test for `GET /api/bookmarks`: returns bookmarks newest-first; `?q=` filters case-insensitively on title/url; empty array when no match in `tests/api/list.test.js`

### Implementation for User Story 2

- [ ] T019 [US2] Implement `listBookmarks({ q })` in `src/models/bookmark.js`: return all bookmarks ordered by `created_at` DESC (FR-006), with case-insensitive substring match against title OR url when `q` is provided (FR-007), each including its tags
- [ ] T020 [US2] Implement `GET /api/bookmarks` handler with optional `q` query param in `src/routes/bookmarks.js` per contracts/api.md
- [ ] T021 [US2] Extend `public/app.js` + `public/index.html` to load and render the list newest-first on page load, with a search box that re-queries by keyword
- [ ] T022 [US2] Render each bookmark's link to open in a new browser tab (FR-008), and implement empty-state and no-results messaging (FR-013) in `public/app.js`/`public/index.html`
- [ ] T023 [US2] Set `data-harness-ready="true"` on the main app element only after the initial list (including a valid empty state) has loaded, in `public/app.js`

**Checkpoint**: Bookmarks can be saved, browsed, searched, and opened

---

## Phase 5: User Story 3 - Edit and delete bookmarks (Priority: P2)

**Goal**: The user can edit a bookmark's title and delete bookmarks with a confirmation step.

**Independent Test**: Edit a title and confirm it persists after reload; delete a bookmark and confirm the confirmation is required and it is gone after reload.

### Tests for User Story 3

- [ ] T024 [P] [US3] API tests for `PATCH /api/bookmarks/:id` (updates title, 404 unknown id) and `DELETE /api/bookmarks/:id` (204, 404 unknown id) in `tests/api/edit-delete.test.js`

### Implementation for User Story 3

- [ ] T025 [US3] Implement `updateBookmark(id, {title, tags})` (update title, refresh `updated_at`) and `deleteBookmark(id)` in `src/models/bookmark.js` (FR-009, FR-010)
- [ ] T026 [US3] Implement `PATCH /api/bookmarks/:id` and `DELETE /api/bookmarks/:id` handlers (404 on unknown id) in `src/routes/bookmarks.js` per contracts/api.md
- [ ] T027 [US3] Add edit (inline title editing) and delete controls to the list UI in `public/app.js`/`public/index.html`, with a confirmation prompt before deletion (FR-010)

**Checkpoint**: Full create/read/update/delete lifecycle works

---

## Phase 6: User Story 4 - Organize bookmarks with tags (Priority: P3)

**Goal**: The user assigns one or more tags to a bookmark and filters the list to a chosen tag.

**Independent Test**: Add tags to a bookmark, filter by a tag, and confirm only bookmarks carrying it are shown.

### Tests for User Story 4

- [ ] T028 [P] [US4] API tests for tag assignment on create/update, `GET /api/bookmarks?tag=` filtering, and `GET /api/tags` in `tests/api/tags.test.js`

### Implementation for User Story 4

- [ ] T029 [US4] Implement tag persistence in `src/models/bookmark.js`: upsert tags by name (trimmed, non-empty, case-insensitive unique), link via `bookmark_tags` on create/update, and support filtering `listBookmarks({ tag })` to bookmarks carrying that tag (FR-012)
- [ ] T030 [US4] Implement `GET /api/tags` handler and `?tag=` filter support on `GET /api/bookmarks` in `src/routes/bookmarks.js` per contracts/api.md
- [ ] T031 [US4] Add tag input on the save/edit form and a tag filter control to the list UI in `public/app.js`/`public/index.html`, showing each bookmark's tags and the no-results state when a filter matches nothing (FR-013)

**Checkpoint**: All four user stories are independently functional

---

## Phase 7: Cross-Cutting — Duplicate detection & Polish

**Purpose**: Requirements and quality concerns that span stories

- [ ] T032 Implement duplicate detection in `createBookmark` (`src/models/bookmark.js`) and `POST /api/bookmarks` (`src/routes/bookmarks.js`): a save whose `url_normalized` already exists returns 409 `{ "error": "This address is already bookmarked.", "existingId": <id> }` and creates no second entry (FR-011); surface the warning in `public/app.js`
- [ ] T033 [P] [US1] Playwright E2E in `tests/e2e/save-and-browse.spec.js`: save a bookmark and verify it appears newest-first, then search for it
- [ ] T034 [P] [US3] Playwright E2E in `tests/e2e/edit-delete.spec.js`: edit a title (persists after reload) and delete with confirmation
- [ ] T035 [P] [US4] Playwright E2E in `tests/e2e/tags.spec.js`: add a tag and filter by it
- [ ] T036 Write `/work/.harness/app.json` = `{"kind": "application", "port": 4000, "path": "/", "start_command": ["npm", "start"], "start_cwd": "/work"}`
- [ ] T037 Run `npm test` and `npm run test:e2e`; execute quickstart.md manual scenarios (including persistence across restart, SC-004) and fix any failures

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories
- **User Stories (Phase 3–6)**: All depend on Foundational; US1 → US2 build the shared list UI, so US2 depends on US1's frontend scaffold. US3 and US4 depend on the list existing (US2)
- **Cross-Cutting/Polish (Phase 7)**: Depends on the relevant stories being complete

### User Story Dependencies

- **US1 (P1)**: After Foundational — no story dependencies (MVP)
- **US2 (P1)**: After US1 (reuses the save/list frontend scaffold and Bookmark model)
- **US3 (P2)**: After US2 (edits/deletes items shown in the list)
- **US4 (P3)**: After US2 (tags shown/filtered in the list)

### Within Each User Story

- Tests written first and expected to fail before implementation
- Models before services/routes; routes before UI wiring

### Parallel Opportunities

- Setup: T004, T005 in parallel
- Foundational: T008, T009 in parallel (after T007)
- US1 tests T010, T011, T012 in parallel; T014 parallel with T013
- E2E specs T033, T034, T035 in parallel (after their stories are implemented)

---

## Parallel Example: User Story 1

```bash
# Tests together:
Task: "Unit tests for validation/normalization in tests/unit/validation.test.js"
Task: "Unit test for title fallback in tests/unit/titleFetcher.test.js"
Task: "API test for POST /api/bookmarks in tests/api/create.test.js"
```

---

## Implementation Strategy

### MVP First

1. Phase 1 Setup → 2. Phase 2 Foundational → 3. Phase 3 US1 (Save) → 4. Phase 4 US2 (Browse/Find)
5. **STOP and VALIDATE**: saving + finding is a usable bookmark manager — demo the MVP

### Incremental Delivery

Add US3 (edit/delete) → validate → add US4 (tags) → validate → Phase 7 duplicate detection, E2E, harness config, and full quickstart validation.

---

## Notes

- [P] = different files, no dependencies
- Tests belong to the story they validate; verify they fail before implementing
- Local SQLite file under `data/` persists across restarts (FR-005 / SC-004)
- Do not start a duplicate server before requesting review; stop any running server first if startup args/code changed
