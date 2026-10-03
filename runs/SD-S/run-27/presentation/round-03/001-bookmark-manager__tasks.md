---
description: "Task list for Bookmark Manager implementation"
---

# Tasks: Bookmark Manager

**Input**: Design documents from `/specs/001-bookmark-manager/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api.md

**Tests**: Included per the plan (node --test for API/data layer; one Playwright e2e of the primary flow).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1–US4)

## Path Conventions

Single web-application project: `src/`, `public/`, `tests/`, `data/` at repo root (`/work`).

---

## Phase 1: Setup (Shared Infrastructure)

- [X] T001 Create project structure per plan: `src/`, `src/routes/`, `src/lib/`, `public/`, `tests/unit/`, `tests/integration/`, `tests/e2e/`, `data/` at repo root
- [X] T002 Initialize npm project in `package.json` with `"type": "module"`, `start` script (`node src/server.js`), and `test` script (`node --test`); add dependencies express and better-sqlite3, and devDependencies `@playwright/test@1.61.0` and `playwright@1.61.0`
- [X] T003 [P] Add `.gitignore` at repo root ignoring `node_modules/` and `data/*.db`
- [X] T004 Run `npm install` to produce `node_modules` and lockfile

---

## Phase 2: Foundational (Blocking Prerequisites)

**⚠️ CRITICAL**: Must complete before any user story.

- [X] T005 Implement SQLite connection and schema init in `src/db.js`: create `bookmarks` (id INTEGER PK, address TEXT NOT NULL, title TEXT nullable, note TEXT nullable, created_at/updated_at DATETIME NOT NULL), `tags` (id INTEGER PK, name TEXT NOT NULL with UNIQUE index on name COLLATE NOCASE), and `bookmark_tags` (bookmark_id FK cascade delete, tag_id FK); add indexes on `bookmark_tags(tag_id)`, `bookmark_tags(bookmark_id)`, and `bookmarks(address)`; open/create `data/bookmarks.db`
- [X] T006 [P] Implement address validation and input normalization in `src/lib/validation.js`: parse with WHATWG `URL`, require an http/https absolute URL, attempt `https://` prefix when scheme missing, reject otherwise; trim `title`/`note` (empty → null); normalize/dedupe tag names (trim, non-empty, case-insensitive)
- [X] T007 Create Express app skeleton in `src/server.js`: JSON body parsing, serve static `public/`, mount `/api` router, error handler returning `{ "error": string }` with proper status codes, and listen on `0.0.0.0:4000`

**Checkpoint**: Foundation ready — user stories can begin.

---

## Phase 3: User Story 1 - Save a bookmark (Priority: P1) 🎯 MVP

**Goal**: Save a bookmark (address required; optional title, note, tags) and persist it.

**Independent Test**: POST a bookmark with only an address → it is stored and retrievable after restart; POST with no address → rejected with a clear message.

### Tests for User Story 1

- [X] T008 [P] [US1] Unit test for validation rules in `tests/unit/validation.test.js` (valid/invalid addresses, scheme prefixing, title/note trimming, tag normalization)
- [X] T009 [P] [US1] Integration test for create in `tests/integration/create.test.js`: POST /api/bookmarks with address-only returns 201; missing address returns 400 with `error`

### Implementation for User Story 1

- [X] T010 [US1] Implement `createBookmark` and `getBookmarkById` in `src/repository.js`: insert bookmark, upsert tags, populate `bookmark_tags`, set created_at/updated_at; return assembled Bookmark with `tags` array and ISO dates (depends on T005, T006)
- [X] T011 [US1] Implement duplicate detection in `src/repository.js`: look up existing bookmark by normalized address, return its id as `duplicateOf` without blocking the insert (FR-011)
- [X] T012 [US1] Implement `POST /api/bookmarks` and `GET /api/bookmarks/:id` in `src/routes/bookmarks.js` per contracts/api.md: 201 with `{ bookmark, duplicateOf }`, 400 on invalid address, 404 on missing id
- [X] T013 [US1] Add the Add-bookmark form UI in `public/index.html`, `public/styles.css`, `public/app.js`: fields for address/title/note/tags, submit via fetch, show validation error and non-blocking duplicate warning; set `data-harness-ready="true"` on the loaded UI

**Checkpoint**: User Story 1 fully functional and independently testable (MVP).

---

## Phase 4: User Story 2 - Browse and find bookmarks (Priority: P1)

**Goal**: List, keyword-search, and tag-filter bookmarks, with clear empty states.

**Independent Test**: With several bookmarks saved, GET /api/bookmarks?q=… narrows results; ?tag=… filters; no matches returns an empty list rendered as a "no results" state.

### Tests for User Story 2

- [X] T014 [P] [US2] Integration test for list/search/filter in `tests/integration/list.test.js`: seed bookmarks, assert `q` matches title/address/note/tag, `tag` filters, and empty query returns all ordered by created_at desc

### Implementation for User Story 2

- [X] T015 [US2] Implement `listBookmarks({ q, tag })` and `listTags()` in `src/repository.js`: case-insensitive keyword match across title/address/note/tag name, tag filter via join, tags list limited to tags with ≥1 bookmark, order by created_at desc (depends on T005)
- [X] T016 [US2] Implement `GET /api/bookmarks` (with `q`/`tag` query params) and `GET /api/tags` in `src/routes/bookmarks.js` per contracts/api.md
- [X] T017 [US2] Add list view, search box, and tag-filter UI in `public/index.html`/`styles.css`/`app.js`: render bookmarks (title or address fallback, tags), live search, tag filter chips, empty-collection and no-results states (FR-012)

**Checkpoint**: Users can save and find bookmarks.

---

## Phase 5: User Story 3 - Organize, edit, and remove bookmarks (Priority: P2)

**Goal**: Edit title/note/tags and delete bookmarks with confirmation.

**Independent Test**: PUT updates a bookmark's fields and persists; DELETE removes it (UI confirms first) and it no longer appears in searches.

### Tests for User Story 3

- [X] T018 [P] [US3] Integration test for edit/delete in `tests/integration/edit-delete.test.js`: PUT updates title/note/tags (and re-validates address), DELETE returns 204 and removes the bookmark and its join rows; 404 on missing id

### Implementation for User Story 3

- [X] T019 [US3] Implement `updateBookmark` and `deleteBookmark` in `src/repository.js`: replace title/note/tags (re-validate address if provided), bump updated_at, cascade-delete join rows, prune orphaned tags (depends on T005, T006)
- [X] T020 [US3] Implement `PUT /api/bookmarks/:id` and `DELETE /api/bookmarks/:id` in `src/routes/bookmarks.js` per contracts/api.md (200/400/404, 204 on delete)
- [X] T021 [US3] Add edit form and delete-with-confirmation UI in `public/index.html`/`styles.css`/`app.js` (FR-008, FR-009)

**Checkpoint**: Collection is maintainable.

---

## Phase 6: User Story 4 - Open a saved bookmark (Priority: P2)

**Goal**: Activating a bookmark opens its original page in a new tab.

**Independent Test**: Clicking a bookmark opens its `address` in a new browser tab.

### Implementation for User Story 4

- [X] T022 [US4] Make each bookmark's title/address a link opening `address` in a new tab (`target="_blank"`, `rel="noopener"`) in `public/app.js`/`index.html` (FR-010)

**Checkpoint**: All user stories functional.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T023 [P] [US1] Add Playwright e2e test in `tests/e2e/primary-flow.spec.js`: start server, add a bookmark, verify it appears, search for it, confirm the link opens the address
- [X] T024 Write `/work/.harness/app.json` = `{"kind":"application","port":4000,"path":"/","start_command":["npm","start"],"start_cwd":"/work"}`
- [X] T025 [P] Run `npm test` and the Playwright e2e; fix failures
- [X] T026 Run through `quickstart.md` manual validation scenarios and confirm each success criterion (SC-001…SC-005)

---

## Dependencies & Execution Order

- **Setup (Phase 1)**: no dependencies.
- **Foundational (Phase 2)**: after Setup; blocks all user stories.
- **User stories (Phases 3–6)**: after Foundational. US1 and US2 are both P1 (build US1 then US2). US3, US4 depend only on Foundational but reuse US1/US2 UI.
- **Polish (Phase 7)**: after desired stories complete.

### Within each story

Tests (where present) → repository functions → routes → UI.

### Parallel Opportunities

- T003 alongside T002-adjacent setup; T006 parallel with other Phase 2 work.
- Test tasks marked [P] (T008, T009, T014, T018, T023) touch separate files and can run in parallel.

---

## Implementation Strategy

### MVP First

1. Phase 1 Setup → 2. Phase 2 Foundational → 3. Phase 3 (US1) → validate → 4. Phase 4 (US2) for a genuinely useful capture+retrieve app.

### Incremental Delivery

US1 (save) → US2 (find) → US3 (edit/delete) → US4 (open), each independently testable, then Polish.

---

## Notes

- [P] = different files, no dependencies.
- Single writer (one local user); better-sqlite3 synchronous calls keep transactions simple.
- Commit after each task or logical group.
