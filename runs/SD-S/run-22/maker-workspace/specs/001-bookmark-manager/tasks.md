---

description: "Task list for Bookmark Manager implementation"
---

# Tasks: Bookmark Manager

**Input**: Design documents from `/specs/001-bookmark-manager/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api.md, quickstart.md

**Tests**: Included — the approved plan and quickstart.md specify automated unit, API, and e2e tests.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1–US4)

## Path Conventions

Single web-application project at repository root: `src/`, `public/`, `tests/`, `data/` per plan.md.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [X] T001 Create the project directory structure per plan.md (`src/`, `src/db/`, `src/models/`, `src/services/`, `src/routes/`, `public/`, `tests/unit/`, `tests/api/`, `tests/e2e/`, `data/`)
- [X] T002 Create `package.json` at repo root: type `module`, scripts `start` (`node src/server.js`) and `test` (`node --test tests/unit tests/api`); dependencies `express`, `better-sqlite3`; devDependency `@playwright/test` pinned to `1.61.0`
- [X] T003 Run `npm install` and add `.gitignore` at repo root excluding `node_modules/` and `data/*.db`
- [X] T004 [P] Add `playwright.config.js` at repo root pinned to Chromium, `baseURL http://127.0.0.1:4000`, using the shared browsers path

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T005 Create `src/db/schema.sql` defining tables: `bookmarks` (`id` INTEGER PK, `url` TEXT NOT NULL, `title` TEXT NOT NULL, `note` TEXT NULL, `created_at` TEXT NOT NULL, `updated_at` TEXT NOT NULL), `tags` (`id` INTEGER PK, `name` TEXT NOT NULL UNIQUE), `bookmark_tags` (`bookmark_id` FK, `tag_id` FK, UNIQUE(`bookmark_id`,`tag_id`)); indexes on `bookmarks.created_at`, `tags.name` (unique), and both `bookmark_tags` FKs (per data-model.md)
- [X] T006 Implement `src/db/index.js`: open SQLite at `data/bookmarks.db` (path overridable via env for tests), apply `schema.sql` idempotently on startup, export the connection
- [X] T007 [P] Implement `src/services/url.js`: normalize a raw address (assume `https://` when scheme missing), validate it forms a valid http/https URL, and derive a fallback title from host/path; export `normalizeUrl`, `isValidUrl`, `fallbackTitle` (per research.md, data-model.md)
- [X] T008 Create `src/app.js`: build and export the Express app — JSON body parsing, static serving of `public/`, mount point for `/api` routes, and a JSON error handler emitting `{ "error": { "code", "message" } }` (per contracts/api.md)
- [X] T009 Create `src/server.js`: import the app from `src/app.js` and listen on `0.0.0.0:4000`

**Checkpoint**: Foundation ready — server boots, DB migrates, URL utilities available

---

## Phase 3: User Story 1 - Save a bookmark (Priority: P1) 🎯 MVP

**Goal**: A user saves a valid address (title optional/auto-derived); invalid addresses are rejected; duplicates warn but save.

**Independent Test**: POST a valid address → 201 with derived title; POST invalid/empty address → 400; POST an existing address → 201 with `duplicate_url` warning.

### Tests for User Story 1

- [X] T010 [P] [US1] Unit tests in `tests/unit/url.test.js` for `normalizeUrl`/`isValidUrl`/`fallbackTitle` (scheme assumed, invalid rejected, host/path fallback)
- [X] T011 [P] [US1] API tests in `tests/api/create.test.js` (temp DB): create with valid url, create with empty title → derived, invalid/empty url → 400 `invalid_url`, duplicate url → 201 with `warnings: ["duplicate_url"]`

### Implementation for User Story 1

- [X] T012 [US1] Implement create/duplicate-check data access in `src/models/bookmark.js`: `create({url, title, note})`, `findByUrl(url)`, tag upsert + link helpers (writes `created_at`/`updated_at` as ISO-8601 UTC)
- [X] T013 [US1] Implement `src/services/bookmarks.js` `createBookmark(input)`: normalize+validate url (reject → `invalid_url`), derive title when empty (best-effort page `<title>` fetch, time-bounded; fall back to url — FR-003), attach tags, detect duplicate url and return non-blocking `duplicate_url` warning (FR-012)
- [X] T014 [US1] Implement `POST /api/bookmarks` in `src/routes/bookmarks.js` returning 201 `{ bookmark, warnings? }` or 400 error per contracts/api.md; wire router into `src/app.js`

**Checkpoint**: Bookmarks can be saved via the API and persist in SQLite

---

## Phase 4: User Story 2 - Browse and find saved bookmarks (Priority: P1)

**Goal**: List all bookmarks newest-first; search by keyword across title/address/tags; friendly empty state.

**Independent Test**: GET list returns saved bookmarks newest-first; GET with `?q=` returns only matches; a non-matching `?q=` returns an empty array.

### Tests for User Story 2

- [X] T015 [P] [US2] API tests in `tests/api/list.test.js` (temp DB): list ordering newest-first, `?q=` matches title/url/tag, non-matching `?q=` → `{ bookmarks: [] }`

### Implementation for User Story 2

- [X] T016 [US2] Extend `src/models/bookmark.js` with `list({ q, tag })`: order by `created_at` DESC, keyword match on title/url/tag name, include each bookmark's tags (per data-model.md queries)
- [X] T017 [US2] Add `listBookmarks({ q, tag })` to `src/services/bookmarks.js`
- [X] T018 [US2] Implement `GET /api/bookmarks` in `src/routes/bookmarks.js` honoring `q` and `tag` query params, returning `{ bookmarks }` (empty array when none — FR-011)
- [X] T019 [US2] Build the front end in `public/index.html`, `public/app.js`, `public/styles.css`: save form (US1) + list rendering newest-first + search box; friendly empty and validation-error messages; each item links to open its original page (FR-009); set `data-harness-ready="true"` on a visible root once the list/empty state has loaded

**Checkpoint**: A user can save, list, and search bookmarks end-to-end in the browser (MVP complete)

---

## Phase 5: User Story 3 - Edit and delete bookmarks (Priority: P2)

**Goal**: Edit title/note/tags; delete with explicit confirmation.

**Independent Test**: PUT updates title/tags and persists after reload; DELETE removes a bookmark; UI requires confirmation before deleting.

### Tests for User Story 3

- [X] T020 [P] [US3] API tests in `tests/api/update-delete.test.js` (temp DB): PUT updates title/note/tags and bumps `updated_at`, empty title → 400 `invalid_title`, PUT/GET/DELETE unknown id → 404 `not_found`, DELETE existing → 204 then absent from list

### Implementation for User Story 3

- [X] T021 [US3] Extend `src/models/bookmark.js` with `getById(id)`, `update(id, {title, note, tags})` (replaces tag set, bumps `updated_at`), and `remove(id)`
- [X] T022 [US3] Add `getBookmark`, `updateBookmark` (reject empty title → `invalid_title`), and `deleteBookmark` to `src/services/bookmarks.js`
- [X] T023 [US3] Implement `GET /api/bookmarks/{id}`, `PUT /api/bookmarks/{id}`, `DELETE /api/bookmarks/{id}` in `src/routes/bookmarks.js` per contracts/api.md (url is not editable — FR-007)
- [X] T024 [US3] Add edit and delete UI in `public/app.js`/`public/index.html`: inline/modal edit for title/note/tags, and a delete action with an explicit confirmation step (FR-008)

**Checkpoint**: Full CRUD available and independently testable

---

## Phase 6: User Story 4 - Organize bookmarks with tags (Priority: P3)

**Goal**: Assign tags and filter the collection by a tag.

**Independent Test**: Assign a tag to two bookmarks, filter by that tag → only those two returned.

### Tests for User Story 4

- [X] T025 [P] [US4] API tests in `tests/api/tag-filter.test.js` (temp DB): `?tag=` returns only bookmarks carrying that tag

### Implementation for User Story 4

- [X] T026 [US4] Verify/extend `list({ tag })` filtering in `src/models/bookmark.js` to select bookmarks carrying the given tag (FR-010)
- [X] T027 [US4] Add tag display and a tag-filter control in `public/app.js`/`public/index.html` (click a tag or choose from a tag list to filter; clearing returns to full list)

**Checkpoint**: All user stories independently functional

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: End-to-end verification and delivery readiness

- [X] T028 [P] [US1][US2][US3][US4] Playwright e2e specs in `tests/e2e/` covering save, search, tag-filter, edit, and delete-with-confirmation flows (pinned 1.61.0)
- [X] T029 Create `/work/.harness/app.json` = `{"kind":"application","port":4000,"path":"/","start_command":["npm","start"],"start_cwd":"/work"}`
- [X] T030 Run `npm test`, `npx playwright test`, and the manual scenarios in quickstart.md (including restart persistence, SC-003); fix any failures

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories
- **User Stories (Phases 3–6)**: All depend on Foundational
  - US1 (P1) → US2 (P1) recommended first (US2's UI builds on US1's save form)
  - US3, US4 depend only on Foundational; may follow in priority order
- **Polish (Phase 7)**: Depends on the desired user stories being complete

### User Story Dependencies

- **US1 (P1)**: After Foundational — no dependency on other stories
- **US2 (P1)**: After Foundational — shares the front-end shell with US1 (T019 renders the US1 save form); implement after US1
- **US3 (P2)**: After Foundational — independently testable via API; UI reuses the list from US2
- **US4 (P3)**: After Foundational — independently testable; UI reuses the list from US2

### Within Each User Story

- Tests written first and expected to fail → models → services → routes → UI

### Parallel Opportunities

- T004 parallel with other setup; T007 parallel within Foundational
- Test-authoring tasks marked [P] (T010, T011, T015, T020, T025) can be written in parallel
- With multiple developers, US3 and US4 API work can proceed in parallel once Foundational is done (distinct concerns), integrating into the shared UI

---

## Implementation Strategy

### MVP First

1. Phase 1 Setup → 2. Phase 2 Foundational → 3. Phase 3 US1 → 4. Phase 4 US2 → **STOP & VALIDATE**: save + browse/search working in the browser = usable MVP.

### Incremental Delivery

Add US3 (edit/delete) → validate → add US4 (tags) → validate → Phase 7 polish and full quickstart validation.

---

## Notes

- [P] = different files, no incomplete dependencies
- Tests use a temporary DB path via env override so they never touch `data/bookmarks.db`
- Commit after each task or logical group
- Stop at any checkpoint to validate a story independently
