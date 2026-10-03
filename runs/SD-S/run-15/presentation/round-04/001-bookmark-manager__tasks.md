---

description: "Task list for Bookmark Manager implementation"
---

# Tasks: Bookmark Manager

**Input**: Design documents from `/specs/001-bookmark-manager/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api.md, quickstart.md

**Tests**: Included. The plan and quickstart call for `node --test` (unit/API) and
Playwright 1.61.0 end-to-end validation of the core journeys.

**Organization**: Tasks are grouped by user story so each can be implemented and
tested independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story the task belongs to (US1–US6)

## Path Conventions

Single Node.js web app. Server + API + static UI under `src/`; tests under `tests/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [ ] T001 Create project structure per plan.md: `src/{db,models,services,api,web}/`, `tests/{unit,integration,e2e}/`, `data/` in repo root
- [ ] T002 Initialize `package.json` at repo root with ES modules (`"type": "module"`), `"start": "node src/server.js"`, and dependencies express@^5, better-sqlite3, and devDependency playwright@1.61.0 (pinned to match image browsers)
- [ ] T003 Install dependencies and add `.gitignore` (ignore `node_modules/`, `data/`) in repo root
- [ ] T004 [P] Add `playwright.config.js` in repo root pointing tests to `tests/e2e/`, using system Chromium at `/opt/playwright-browsers`, baseURL `http://127.0.0.1:4000`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T005 Create `src/db/schema.sql`: `bookmarks` (id, address TEXT NOT NULL UNIQUE, title TEXT NOT NULL, description TEXT, is_read INTEGER NOT NULL DEFAULT 0, is_archived INTEGER NOT NULL DEFAULT 0, created_at TEXT, updated_at TEXT), `tags` (id, name TEXT NOT NULL UNIQUE), `bookmark_tags` (bookmark_id, tag_id, UNIQUE(bookmark_id, tag_id), FK cascade delete) per data-model.md
- [ ] T006 Implement `src/db/connection.js`: open/create SQLite file at `data/bookmarks.db`, apply `schema.sql` on first run (idempotent)
- [ ] T007 [P] Implement `src/services/url.js`: normalize address (add `https://` when scheme missing), accept only http/https, reject invalid input; export a normalize+validate function (FR-002)
- [ ] T008 Implement `src/server.js`: build Express app, JSON middleware, mount `/api` routes, serve `src/web/` statics at `/`, error handler returning `{ "error": ... }`, and listen on `0.0.0.0:4000`
- [ ] T009 [P] Create `src/api/routes.js` Express router skeleton mounted at `/api` (endpoints filled in per story)

**Checkpoint**: Server boots, DB initializes, URL validation available

---

## Phase 3: User Story 1 - Save a bookmark (Priority: P1) 🎯 MVP

**Goal**: A user saves a URL (optional title/description/tags) and it persists.

**Independent Test**: Add a valid URL → it appears in the list and survives reload; empty URL is rejected; saving an existing address opens that bookmark for editing.

### Tests for User Story 1

- [ ] T010 [P] [US1] Integration test in `tests/integration/create.test.js`: POST valid address → 201; missing address → 400; duplicate address → 409 with `existingId`; new bookmark defaults `isRead=false`, `isArchived=false` (FR-001/002/010/014/016)
- [ ] T011 [P] [US1] Unit test in `tests/unit/url.test.js`: `example.com` → `https://example.com`; invalid/non-http rejected (FR-002)

### Implementation for User Story 1

- [ ] T012 [US1] Implement `src/services/title.js`: derive fallback title from address; best-effort page `<title>` fetch with short timeout, silent fallback (FR-011)
- [ ] T013 [US1] Implement `src/models/bookmarks.js` `create()`: validate/normalize address via url.js, enforce unique address (return existing id on conflict), derive title if absent, upsert tags + join rows, default unread/active, set timestamps (FR-001/010/011/014/016)
- [ ] T014 [US1] Implement `POST /api/bookmarks` in `src/api/routes.js`: 201 on create; 400 invalid address; 409 `{error, existingId, existingArchived}` on duplicate (contracts/api.md)
- [ ] T015 [P] [US1] Create `src/web/index.html` shell (nav for views, add form container) and `src/web/styles.css` desktop-first responsive layout
- [ ] T016 [US1] Implement add-bookmark form in `src/web/app.js`: submit to POST; on 409 open the existing bookmark for editing; validate URL presence client-side; mark `data-harness-ready="true"` after initial load
- [ ] T017 [US1] Write `/work/.harness/app.json`: `{"kind":"application","port":4000,"path":"/","start_command":["npm","start"],"start_cwd":"/work"}`

**Checkpoint**: Saving works end-to-end and persists across restart (MVP)

---

## Phase 4: User Story 2 - Browse and open saved bookmarks (Priority: P1)

**Goal**: See saved bookmarks in a list and open them in a new tab.

**Independent Test**: Open app with bookmarks → each shows title/address and opens in new tab; empty collection shows the empty state.

### Tests for User Story 2

- [ ] T018 [P] [US2] Integration test in `tests/integration/list.test.js`: GET `/api/bookmarks?view=active` returns active bookmarks, newest first (FR-004/013)

### Implementation for User Story 2

- [ ] T019 [US2] Implement `src/models/bookmarks.js` `list({view,q,tag})`: active view = `is_archived=0`, ordered by `created_at DESC` (FR-004/013)
- [ ] T020 [US2] Implement `GET /api/bookmarks` and `GET /api/bookmarks/:id` in `src/api/routes.js` (contracts/api.md)
- [ ] T021 [US2] Render main list in `src/web/app.js`: title + address + tags; open original page in new tab (`target="_blank"`, rel noopener); friendly empty state (FR-004/005/012)

**Checkpoint**: US1 + US2 give a usable save/browse/open loop

---

## Phase 5: User Story 3 - Edit and delete bookmarks (Priority: P2)

**Goal**: Edit a bookmark's address/title/description/tags, and delete with confirmation.

**Independent Test**: Edit fields (incl. address) and persist; changing address to an existing one is prevented and routes to that bookmark; delete removes it after confirmation and it does not reappear.

### Tests for User Story 3

- [ ] T022 [P] [US3] Integration test in `tests/integration/edit-delete.test.js`: PATCH updates fields; PATCH address to existing → 409 `existingId`; DELETE → 204 then GET → 404 (FR-006/007/010)

### Implementation for User Story 3

- [ ] T023 [US3] Implement `src/models/bookmarks.js` `update(id, fields)` (re-validate changed address, enforce uniqueness, sync tags, bump updated_at) and `remove(id)` (FR-006/007/010)
- [ ] T024 [US3] Implement `PATCH /api/bookmarks/:id` and `DELETE /api/bookmarks/:id` in `src/api/routes.js` (contracts/api.md)
- [ ] T025 [US3] Add edit form (incl. address field) and delete-with-confirmation in `src/web/app.js`; on 409 route to the conflicting bookmark (FR-006/007/010)

**Checkpoint**: Full CRUD works; collection stays accurate

---

## Phase 6: User Story 4 - Read-later / unread tracking (Priority: P2)

**Goal**: Track unread/read and provide a dedicated unread view.

**Independent Test**: New bookmark is unread; unread view lists only unread; mark read removes it from that view; state survives reload.

### Tests for User Story 4

- [ ] T026 [P] [US4] Integration test in `tests/integration/read-later.test.js`: `view=unread` returns only `is_archived=0 AND is_read=0`; PATCH `isRead` toggles and persists (FR-014/015)

### Implementation for User Story 4

- [ ] T027 [US4] Extend `list()` in `src/models/bookmarks.js` with `unread` view (`is_archived=0 AND is_read=0`) (FR-015)
- [ ] T028 [US4] Add unread (read-later) view + read/unread toggle control in `src/web/app.js` using PATCH `isRead` (FR-014/015)

**Checkpoint**: Read-later flow works alongside prior stories

---

## Phase 7: User Story 5 - Archive and restore bookmarks (Priority: P2)

**Goal**: Archive/restore bookmarks with a dedicated archive view; permanent delete from archive.

**Independent Test**: Archive removes from main + unread views without deleting; archive view lists only archived; restore returns to main; delete from archive removes permanently.

### Tests for User Story 5

- [ ] T029 [P] [US5] Integration test in `tests/integration/archive.test.js`: PATCH `isArchived=true` removes from active/unread and appears in `view=archive`; restore returns to active; DELETE from archive → 204 (FR-016/017/018, SC-007)

### Implementation for User Story 5

- [ ] T030 [US5] Extend `list()` in `src/models/bookmarks.js` with `archive` view (`is_archived=1`) (FR-017)
- [ ] T031 [US5] Add archive view + archive/restore controls and permanent-delete-with-confirmation in `src/web/app.js` using PATCH `isArchived` and DELETE (FR-016/017/018)

**Checkpoint**: Archive/restore works; archived items excluded from main/unread

---

## Phase 8: User Story 6 - Find bookmarks by search and tags (Priority: P3)

**Goal**: Keyword search and tag filtering, scoped to the active view.

**Independent Test**: Keyword narrows to matching title/address/description/tags; tag filter narrows to a tag; no matches shows "no results".

### Tests for User Story 6

- [ ] T032 [P] [US6] Integration test in `tests/integration/search.test.js`: `q` matches title/address/description/tag; `tag` filters by tag; empty result set returns `[]` (FR-008/009/012)

### Implementation for User Story 6

- [ ] T033 [US6] Extend `list()` with `q` (case-insensitive match on title/address/description/tag) and `tag` filter, scoped to current view; implement `GET /api/tags` (FR-008/009)
- [ ] T034 [US6] Add search box + tag filter UI and "no results" state in `src/web/app.js`, wired to `q`/`tag` query params (FR-008/009/012)

**Checkpoint**: All six user stories independently functional

---

## Phase 9: Polish & Cross-Cutting Concerns

- [ ] T035 [P] Add Playwright E2E in `tests/e2e/flows.spec.js` covering the six quickstart journeys (save, browse/open, edit, read-later, archive, search)
- [ ] T036 [P] Add a seed/perf check confirming search over 1,000 bookmarks returns under 1s (SC-003) in `tests/integration/perf.test.js`
- [ ] T037 Run `quickstart.md` validation end-to-end; verify data survives an `npm start` restart (SC-004/007) and fix any gaps
- [ ] T038 [P] Add a short `README.md` with run/test instructions

---

## Dependencies & Execution Order

- **Setup (Phase 1)**: no dependencies
- **Foundational (Phase 2)**: depends on Setup; BLOCKS all user stories
- **User Stories (Phases 3–8)**: depend on Foundational. US1 first (MVP). US2–US6 each extend `src/models/bookmarks.js` `list()`/routes and `src/web/app.js`, so they share those files — sequence them (P2 group US3→US4→US5, then P3 US6) rather than editing the same files in parallel.
- **Polish (Phase 9)**: after desired stories complete

### Within each story

- Tests written first and expected to fail → models → API → UI
- Commit after each task or logical group

### Parallel Opportunities

- Setup: T004 [P]
- Foundational: T007, T009 [P]
- Per-story test tasks marked [P] can be written together before that story's implementation
- Polish: T035, T036, T038 [P]

---

## Implementation Strategy

### MVP First

1. Phase 1 Setup → 2. Phase 2 Foundational → 3. Phase 3 (US1 Save) + Phase 4 (US2 Browse) → **STOP & VALIDATE** a working save/browse/open loop, then request review.

### Incremental Delivery

Add US3 (edit/delete) → US4 (read-later) → US5 (archive) → US6 (search/tags), validating each independently before the next.

---

## Notes

- [P] = different files, no dependencies
- [Story] label maps each task to a user story for traceability
- Verify tests fail before implementing
- Because US2–US6 all touch `src/models/bookmarks.js` and `src/web/app.js`, treat those stories as sequential edits to shared files
