---

description: "Task list for Bookmark Manager implementation"
---

# Tasks: Bookmark Manager

**Input**: Design documents from `/specs/001-bookmark-manager/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api.md, quickstart.md

**Tests**: Included — the plan designates the HTTP API (Supertest) and model/validation layers (Vitest) as the verification seam tying requirements to behaviour.

**Organization**: Tasks are grouped by user story so each story can be implemented and tested as an independent increment.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story the task belongs to (US1–US4)

## Path Conventions

Single project (per plan.md): backend in `src/`, static frontend in `web/`, tests in `tests/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [ ] T001 Create project structure per plan.md: `src/`, `src/models/`, `src/services/`, `src/api/`, `web/`, `tests/integration/`, `tests/unit/`, and a git-ignored `data/`
- [ ] T002 Initialize Node.js project: `package.json` with Node 20, dependencies (express, better-sqlite3, an HTML title-parsing helper) and devDependencies (vitest, supertest), plus `dev` and `test` scripts
- [ ] T003 [P] Add `.gitignore` (ignore `node_modules/` and `data/`) and a minimal `README.md` describing the one-command launch
- [ ] T004 [P] Add Vitest config in `vitest.config.js` wiring the `tests/` suites

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T005 Implement database bootstrap in `src/db.js`: open the SQLite file under `data/`, create `bookmarks`, `tags`, and `bookmark_tags` tables and indexes per data-model.md (idempotent on startup)
- [ ] T006 Create the Express app + server entry in `src/server.js`: JSON body parsing, serve static `web/`, mount the `/api` router, centralized error handler returning `{ "error": ... }` per contracts/api.md
- [ ] T007 [P] Create the API router skeleton in `src/api/bookmarks.js` with all routes from contracts/api.md returning "not implemented" placeholders, wired into `src/server.js`

**Checkpoint**: Server starts, DB initializes, routes respond — story implementation can begin

---

## Phase 3: User Story 1 - Save a bookmark (Priority: P1) 🎯 MVP

**Goal**: User saves a web link (with best-effort auto-title), sees it in a list, and can open it. Invalid URLs are rejected; duplicates warn.

**Independent Test**: Enter a valid URL, save it, confirm it appears with a title and opens; enter an invalid URL and confirm a clear rejection; re-save the same URL and confirm a duplicate warning.

### Tests for User Story 1 ⚠️ (write first, ensure they fail)

- [ ] T008 [P] [US1] Integration tests in `tests/integration/save.test.js` covering POST valid URL → 201 (Scenario 1), auto-title fallback (Scenario 2), invalid URL → 400 (Scenario 4), duplicate → 409 then override with `confirmDuplicate` (Edge case), and GET list shows saved item
- [ ] T009 [P] [US1] Unit tests in `tests/unit/bookmark.test.js` for URL validation (http/https only) and `url_key` normalization (duplicate detection rules from research.md)
- [ ] T010 [P] [US1] Unit tests in `tests/unit/titleFetcher.test.js` for title extraction, timeout/failure fallback (network stubbed)

### Implementation for User Story 1

- [ ] T011 [P] [US1] Implement `src/services/titleFetcher.js`: fetch a page with timeout, byte cap, limited redirects; parse `<title>`; return null on any failure (FR-003, research Decision 4)
- [ ] T012 [US1] Implement Bookmark model in `src/models/bookmark.js`: `create`, `getById`, `list` (newest-first), URL validation, `url_key` normalization, and duplicate lookup (FR-001, FR-002, FR-013, FR-014)
- [ ] T013 [US1] Implement `POST /api/bookmarks` in `src/api/bookmarks.js`: validate URL (400), auto-fetch title when blank with url fallback, duplicate check (409 unless `confirmDuplicate`), else 201 (FR-001–FR-004, FR-013)
- [ ] T014 [US1] Implement `GET /api/bookmarks` (basic list, newest-first) and `GET /api/bookmarks/:id` in `src/api/bookmarks.js` (FR-006)
- [ ] T015 [US1] Build the frontend save + list view in `web/index.html`, `web/app.js`, `web/styles.css`: add-URL form, render list with clickable titles that open the link, show validation and duplicate messages (FR-006, FR-007, and the empty-state prompt FR-015)

**Checkpoint**: User Story 1 fully functional and independently testable — this is the MVP

---

## Phase 4: User Story 2 - Browse, search, and find (Priority: P2)

**Goal**: User searches across title/url/note/tags and sees only matches; clearing search restores the full list; empty results show a friendly message.

**Independent Test**: With several bookmarks saved, type a term and confirm only matches show; search for nothing-matching and confirm an empty-result message; clear and confirm all return.

### Tests for User Story 2 ⚠️

- [ ] T016 [P] [US2] Integration tests in `tests/integration/search.test.js`: `GET /api/bookmarks?q=` returns only matches across title/url/note/tags, empty array for no matches, full list when `q` absent (FR-008)

### Implementation for User Story 2

- [ ] T017 [US2] Extend Bookmark model `list` in `src/models/bookmark.js` to accept a search term `q` matching title, url, note, and tag names via indexed queries (FR-008, SC-003)
- [ ] T018 [US2] Wire `q` query parameter into `GET /api/bookmarks` in `src/api/bookmarks.js` (FR-008)
- [ ] T019 [US2] Add search box to `web/index.html` + `web/app.js`: live-filter the list, show an empty-result message, restore on clear (FR-008, empty-result edge case)

**Checkpoint**: Stories 1 and 2 both work independently

---

## Phase 5: User Story 3 - Organise with tags and notes (Priority: P3)

**Goal**: User attaches tags and a note to bookmarks and filters the list by a tag.

**Independent Test**: Add tags + a note to a bookmark, filter by one tag, confirm only tagged bookmarks appear and the note displays.

### Tests for User Story 3 ⚠️

- [ ] T020 [P] [US3] Integration tests in `tests/integration/tags.test.js`: create/update bookmark with tags + note, `GET /api/bookmarks?tag=` filters correctly, `GET /api/tags` lists tags, tag removal affects only that bookmark (FR-009, FR-010, tag edge case)

### Implementation for User Story 3

- [ ] T021 [US3] Extend Bookmark model in `src/models/bookmark.js` to persist notes and manage tag associations (case-insensitive, trimmed, dedup) via `bookmark_tags`, plus a `listTags` query (FR-009, FR-010, data-model rules)
- [ ] T022 [US3] Accept `note` and `tags` in `POST`/`PUT` handlers and add `tag` filter to `GET /api/bookmarks` and a `GET /api/tags` handler in `src/api/bookmarks.js` (FR-009, FR-010)
- [ ] T023 [US3] Frontend in `web/index.html` + `web/app.js`: tag + note inputs on the add/edit form, display tags/notes on list items, and a tag-filter control populated from `GET /api/tags` (FR-009, FR-010)

**Checkpoint**: Stories 1–3 independently functional

---

## Phase 6: User Story 4 - Edit and delete (Priority: P3)

**Goal**: User edits a bookmark's fields (persisted) and deletes bookmarks with a confirmation step.

**Independent Test**: Edit a title and confirm it persists after reload; delete with confirmation and confirm removal; cancel a delete and confirm it remains.

### Tests for User Story 4 ⚠️

- [ ] T024 [P] [US4] Integration tests in `tests/integration/edit-delete.test.js`: `PUT /api/bookmarks/:id` updates fields and validates URL (400), `DELETE` returns 204 and removes, 404 for missing id (FR-011, FR-012)

### Implementation for User Story 4

- [ ] T025 [US4] Implement `update` and `delete` in `src/models/bookmark.js` (re-validate URL, re-apply tag/note handling on update) (FR-011, FR-012)
- [ ] T026 [US4] Implement `PUT /api/bookmarks/:id` and `DELETE /api/bookmarks/:id` handlers in `src/api/bookmarks.js` (FR-011, FR-012)
- [ ] T027 [US4] Frontend edit form and delete button with a confirmation prompt in `web/index.html` + `web/app.js` (FR-011, FR-012)

**Checkpoint**: All four user stories independently functional

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Improvements spanning multiple stories

- [ ] T028 [P] Handle display of very long titles/notes/urls and special/non-Latin characters without breaking layout (spec Edge Cases)
- [ ] T029 [P] Ensure friendly, consistent error messaging across the frontend for all API error codes (contracts/api.md)
- [ ] T030 Run the `quickstart.md` validation scenarios end-to-end, including the SC-004 restart-persistence check
- [ ] T031 [P] Add a seed/generate script or test to sanity-check search/filter responsiveness at ~1,000 bookmarks (SC-002, SC-003)
- [ ] T032 Update `README.md` with final run/test instructions

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies — start immediately
- **Foundational (Phase 2)**: depends on Setup — BLOCKS all user stories
- **User Stories (Phases 3–6)**: all depend on Foundational; then proceed in priority order (US1 → US2 → US3 → US4) or in parallel if staffed
- **Polish (Phase 7)**: after the desired user stories are complete

### User Story Dependencies

- **US1 (P1)**: after Foundational — no dependency on other stories (MVP)
- **US2 (P2)**: after Foundational — extends US1's list/model but is independently testable
- **US3 (P3)**: after Foundational — extends model/UI; independently testable
- **US4 (P4/P3)**: after Foundational — depends only on bookmarks existing; independently testable

### Within Each User Story

- Tests written first and failing → models → API handlers → frontend
- Story complete before moving to next priority

### Parallel Opportunities

- Setup tasks T003, T004 run in parallel
- All `[P]` test tasks within a story run in parallel before its implementation
- T011 (title fetcher) is `[P]` — independent of the model
- With multiple developers, US1–US4 can proceed in parallel once Foundational is done

---

## Parallel Example: User Story 1

```bash
# Tests first (parallel):
Task: "Integration tests in tests/integration/save.test.js"
Task: "Unit tests in tests/unit/bookmark.test.js"
Task: "Unit tests in tests/unit/titleFetcher.test.js"

# Then independent implementation piece:
Task: "Implement src/services/titleFetcher.js"
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Phase 1: Setup
2. Phase 2: Foundational (blocks all stories)
3. Phase 3: User Story 1
4. **STOP and VALIDATE**: test saving/listing/opening independently
5. Demo the MVP

### Incremental Delivery

Foundation → US1 (MVP) → US2 → US3 → US4, validating each story independently before moving on. Each adds value without breaking prior stories. Finish with Phase 7 polish.

---

## Notes

- `[P]` = different files, no dependencies
- `[Story]` labels map tasks to spec user stories for traceability
- Verify tests fail before implementing
- Each user story is an independently testable increment
- Total: 32 tasks
