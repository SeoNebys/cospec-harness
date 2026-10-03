---

description: "Task list for Bookmark Manager implementation"
---

# Tasks: Bookmark Manager

**Input**: Design documents from `/specs/001-bookmark-manager/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api.md, quickstart.md

**Tests**: Included — plan.md specifies Node's built-in test runner (unit/integration) and Playwright 1.61.0 (end-to-end).

**Organization**: Tasks are grouped by user story so each can be implemented and tested independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1–US4)

## Path Conventions

Single-project web app (per plan.md): `src/`, `public/`, `tests/`, `data/` at repository root.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [ ] T001 Create project directory structure per plan.md (`src/`, `src/routes/`, `src/lib/`, `public/`, `tests/unit/`, `tests/integration/`, `tests/e2e/`, `data/`) at repository root
- [ ] T002 Initialize npm project in `package.json` with ES modules (`"type": "module"`), dependencies `express` and `better-sqlite3`, devDependency `@playwright/test` pinned to `1.61.0`, and scripts `"start": "node src/server.js"` and `"test": "node --test"`
- [ ] T003 [P] Add `.gitignore` at repository root ignoring `node_modules/` and `data/*.db`
- [ ] T004 [P] Add `README.md` at repository root with run instructions from quickstart.md (`npm install`, `npm start`, reachable at `http://maker:4000/`)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T005 Implement SQLite connection and schema initialization in `src/db.js`: open/create `data/bookmarks.db`, enable foreign keys, and create tables per data-model.md — `bookmarks` (`id` INTEGER PK, `url` TEXT NOT NULL, `title` TEXT, `notes` TEXT, `created_at` TEXT NOT NULL), `tags` (`id` INTEGER PK, `name` TEXT NOT NULL UNIQUE), `bookmark_tags` (`bookmark_id` INTEGER FK→bookmarks(id) ON DELETE CASCADE, `tag_id` INTEGER FK→tags(id) ON DELETE CASCADE, composite PK (`bookmark_id`,`tag_id`))
- [ ] T006 [P] Implement URL validation and normalization in `src/lib/url.js`: `normalizeUrl(input)` prepends `https://` when scheme is missing and returns a valid `http`/`https` URL string; throws/returns invalid for anything not parseable as an http/https URL (FR-003, scheme-less edge case)
- [ ] T007 Create Express app and static+API wiring in `src/server.js`: serve `public/` as static files, mount `/api` routes, add JSON body parsing, a JSON 404/500 error handler returning `{ "error": "..." }`, and listen on `0.0.0.0:4000`
- [ ] T008 [P] Unit tests for URL helper in `tests/unit/url.test.js`: valid urls, scheme-less normalization to `https://`, and rejection of invalid input (run with `node --test`)

**Checkpoint**: Foundation ready — server boots, DB schema exists, URL helper validated

---

## Phase 3: User Story 1 - Save a bookmark (Priority: P1) 🎯 MVP

**Goal**: A user can save a bookmark (url + optional title/notes), it persists, and invalid urls are rejected.

**Independent Test**: Add a bookmark via the UI; confirm it appears in the list with normalized url and persists after a reload/restart; invalid input is rejected with a clear message.

### Tests for User Story 1

- [ ] T009 [P] [US1] Integration test in `tests/integration/api.test.js` for `POST /api/bookmarks`: creates a bookmark against a temp SQLite db, normalizes `example.com`→`https://example.com`, stores optional title/notes, returns `201` with `duplicate:false`, and returns `400` `{error}` for invalid url (contracts/api.md)

### Implementation for User Story 1

- [ ] T010 [US1] Implement bookmark creation in repository `src/repository.js`: `createBookmark({url,title,notes,tags})` inserts a bookmark with `created_at` ISO 8601, links tags (creating tags by unique name, rejecting empty/whitespace names), and reports whether an existing bookmark shares the same normalized url (FR-001,002,011; data-model.md)
- [ ] T011 [US1] Implement `POST /api/bookmarks` handler in `src/routes/bookmarks.js`: validate/normalize url via `src/lib/url.js` (400 on invalid, FR-003), call repository create, return `201 { bookmark, duplicate }` per contracts/api.md
- [ ] T012 [P] [US1] Build the add-bookmark form UI in `public/index.html` and `public/app.js`: fields for url (required), title, notes, tags; submit via `POST /api/bookmarks`; show validation error message on `400`; show non-blocking duplicate warning when `duplicate:true` (FR-011)
- [ ] T013 [P] [US1] Base styling in `public/styles.css` for the form and page layout, responsive down to small screen widths (plan Constraints)

**Checkpoint**: User Story 1 fully functional — bookmarks can be saved, validated, and persist

---

## Phase 4: User Story 2 - Browse and find saved bookmarks (Priority: P2)

**Goal**: A user can see all bookmarks, search by keyword, and open a bookmark's address.

**Independent Test**: With several bookmarks saved, list shows all; a keyword filters to matching title/url/notes; clicking a bookmark opens its address in a new tab.

### Tests for User Story 2

- [ ] T014 [P] [US2] Integration test in `tests/integration/api.test.js` for `GET /api/bookmarks`: returns all bookmarks newest-first, filters by `q` (case-insensitive substring across title/url/notes), and returns `{bookmarks:[]}` when nothing matches (FR-005,006,012; contracts/api.md)

### Implementation for User Story 2

- [ ] T015 [US2] Implement list/search in repository `src/repository.js`: `listBookmarks({q,tag})` returns bookmarks with their tag names, ordered by `created_at` DESC, with case-insensitive substring match on title/url/notes for `q` (tag filtering used by US4)
- [ ] T016 [US2] Implement `GET /api/bookmarks` handler and `GET /api/bookmarks/:id` (404 when missing) in `src/routes/bookmarks.js` per contracts/api.md
- [ ] T017 [US2] Render bookmark list in `public/app.js`/`public/index.html`: show title + url (+ tags), load on startup, each item opens its url in a new tab (`target="_blank"`, FR-007); truncate long values in the list (edge case)
- [ ] T018 [US2] Add search input in `public/app.js` that queries `GET /api/bookmarks?q=` and renders results, with a clear no-results message and a welcoming empty state when there are no bookmarks (FR-012)
- [ ] T019 [US2] Set `data-harness-ready="true"` on the main UI container in `public/app.js` only after the initial bookmark list (or empty state) has loaded (runtime presentation rule)

**Checkpoint**: User Stories 1 and 2 both work — save, list, search, open

---

## Phase 5: User Story 3 - Edit and delete bookmarks (Priority: P3)

**Goal**: A user can edit a bookmark's fields and delete a bookmark with a confirmation step.

**Independent Test**: Edit a bookmark's title and confirm it persists; delete a bookmark after confirming and confirm it is gone after reload.

### Tests for User Story 3

- [ ] T020 [P] [US3] Integration test in `tests/integration/api.test.js` for `PUT /api/bookmarks/:id` (updates url/title/notes/tags, 400 on invalid url, 404 when missing) and `DELETE /api/bookmarks/:id` (204, cascades bookmark_tags, 404 when missing) per contracts/api.md

### Implementation for User Story 3

- [ ] T021 [US3] Implement `updateBookmark(id, fields)` and `deleteBookmark(id)` in `src/repository.js`: update provided fields, replace tag set when `tags` provided, delete cascades links (FR-008,009; data-model.md)
- [ ] T022 [US3] Implement `PUT /api/bookmarks/:id` and `DELETE /api/bookmarks/:id` handlers in `src/routes/bookmarks.js` per contracts/api.md
- [ ] T023 [US3] Add edit and delete controls in `public/app.js`/`public/index.html`: edit populates the form and saves via `PUT`; delete asks for confirmation before calling `DELETE` and removing the item (FR-009)

**Checkpoint**: User Stories 1–3 independently functional

---

## Phase 6: User Story 4 - Organize with tags (Priority: P4)

**Goal**: A user can tag bookmarks and filter the list by a tag.

**Independent Test**: Tag two bookmarks `work`, filter by `work`, and see only those two.

### Tests for User Story 4

- [ ] T024 [P] [US4] Integration test in `tests/integration/api.test.js` for `GET /api/bookmarks?tag=` (returns only bookmarks carrying that tag) and `GET /api/tags` (returns all in-use tag names) per contracts/api.md

### Implementation for User Story 4

- [ ] T025 [US4] Implement `listTags()` in `src/repository.js` (distinct tag names in use) and extend `listBookmarks` tag filtering (FR-010; already scaffolded in T015)
- [ ] T026 [US4] Implement `GET /api/tags` handler in `src/routes/bookmarks.js` per contracts/api.md
- [ ] T027 [US4] Add tag-filter UI in `public/app.js`/`public/index.html`: populate available tags from `GET /api/tags` and filter the list via `GET /api/bookmarks?tag=`, combinable with keyword search

**Checkpoint**: All four user stories independently functional

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: End-to-end validation and finishing touches across stories

- [ ] T028 [P] Add Playwright config pinned to `1.61.0` and end-to-end spec `tests/e2e/bookmarks.spec.js` covering the quickstart scenarios (save, persist, search+open, edit, delete-with-confirm, tag filter, empty/no-results, duplicate warning)
- [ ] T029 Create `/work/.harness/app.json` with `{"kind":"application","port":4000,"path":"/","start_command":["npm","start"],"start_cwd":"/work"}`
- [ ] T030 [P] Run full quickstart.md validation (`npm install`, `node --test`, `npx playwright test`, manual scenario walkthrough) and confirm SC-001–SC-005; fix any divergence from spec via implementation (not ad-hoc)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories
- **User Stories (Phase 3–6)**: All depend on Foundational; then proceed in priority order P1→P2→P3→P4 (or in parallel if staffed)
- **Polish (Phase 7)**: Depends on the desired user stories being complete

### User Story Dependencies

- **US1 (P1)**: After Foundational — no dependency on other stories (MVP)
- **US2 (P2)**: After Foundational — independent; `listBookmarks` (T015) also underpins US4 tag filtering
- **US3 (P3)**: After Foundational — independent; operates on bookmarks from US1
- **US4 (P4)**: After Foundational — independent; reuses tag scaffolding

### Within Each User Story

- Tests written first and expected to fail before implementation
- Repository (data access) before route handlers before UI

### Parallel Opportunities

- Setup: T003, T004 in parallel
- Foundational: T006, T008 in parallel with T005/T007 work
- Within a story, tasks marked [P] touch different files (e.g. T012/T013)
- Different user stories can be built in parallel by different developers once Foundational is done

---

## Parallel Example: User Story 1

```bash
# After T010/T011 (repository + endpoint), the UI tasks touch different files:
Task: "Build add-bookmark form UI in public/index.html and public/app.js"   # T012
Task: "Base styling in public/styles.css"                                    # T013
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1 Setup → 2. Phase 2 Foundational → 3. Phase 3 US1 → 4. **STOP and validate** saving + persistence → demo the MVP.

### Incremental Delivery

Foundation → US1 (MVP) → US2 → US3 → US4, validating each story independently before moving on. Each story adds value without breaking the previous ones.

---

## Notes

- [P] = different files, no dependencies
- Verify tests fail before implementing
- Commit after each task or logical group
- Stop at any checkpoint to validate a story independently
