---

description: "Task list for Bookmark Manager implementation"
---

# Tasks: Bookmark Manager

**Input**: Design documents from `/specs/001-bookmark-manager/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api.md, quickstart.md

**Tests**: Included — the approved plan commits to a testing approach (Node `node:test`
unit/integration suites plus one Playwright 1.61.0 end-to-end smoke test).

**Organization**: Tasks are grouped by user story to enable independent implementation
and testing. User Stories 1 and 2 are both **P1** and together form the MVP.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story the task belongs to (US1–US5)

## Path Conventions

Web application, single project. Backend under `src/`, static frontend under `public/`,
tests under `tests/`, per plan.md Structure Decision.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [X] T001 Create the project directory structure (`src/`, `src/routes/`, `public/`, `data/`, `tests/unit/`, `tests/integration/`, `tests/e2e/`) per plan.md
- [X] T002 Initialize `package.json` (ES modules, `"type": "module"`) with dependencies express, node-html-parser and devDependency `@playwright/test` pinned to `1.61.0`; add scripts `start`, `test`, `test:e2e`. (Storage uses the built-in `node:sqlite`, so no database addon dependency.)
- [X] T003 Run `npm install` and confirm Playwright uses the shared browsers at `/opt/playwright-browsers` (no second browser download)
- [X] T004 [P] Add a `.gitignore` excluding `node_modules/` and `data/*.db`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T005 Implement SQLite connection and schema init in `src/db.js` using `node:sqlite`: create tables `bookmarks` (id, url UNIQUE, title, description, favicon_url, created_at, updated_at), `tags` (id, name, norm_key UNIQUE), and join `bookmark_tags` (bookmark_id, tag_id, PRIMARY KEY(bookmark_id, tag_id), ON DELETE CASCADE) per data-model.md; enable foreign keys
- [X] T006 Implement the Express app skeleton in `src/server.js`: JSON body parsing, mount `/api` router, serve static `public/`, and listen on `0.0.0.0:4000`
- [X] T007 [P] Create the empty `/api` router module in `src/routes/api.js` and wire it into `src/server.js`
- [X] T008 [P] Implement a shared URL normalizer/validator helper in `src/bookmarks.js`: add `https://` when scheme omitted (FR-003), reject non-http/https or malformed URLs (FR-002), return normalized url
- [X] T009 [P] Implement tag normalization helper in `src/bookmarks.js`: trim whitespace and compute lowercased `norm_key` so tags de-duplicate case-insensitively (FR-015)
- [X] T010 Create the frontend app shell `public/index.html` + `public/styles.css` with containers for the add form, list, tag-filter, and search; load `public/app.js`
- [X] T011 [P] Write the runtime descriptor `.harness/app.json`: `{"kind":"application","port":4000,"path":"/","start_command":["npm","start"],"start_cwd":"/work"}`

**Checkpoint**: Server starts, serves an empty page, DB schema exists — story work can begin

---

## Phase 3: User Story 1 - Save a bookmark with auto-collected details (Priority: P1) 🎯 MVP

**Goal**: User saves a link; server auto-collects title/description/favicon (editable), duplicates navigate to the existing bookmark.

**Independent Test**: Save a reachable URL without a scheme → https applied, details populated; edit title persists after reload; save an existing address → taken to existing bookmark; empty/invalid url rejected.

### Tests for User Story 1 ⚠️

- [X] T012 [P] [US1] Unit tests for URL normalization/validation (scheme added, invalid rejected) in `tests/unit/url.test.js`
- [X] T013 [P] [US1] Unit tests for metadata parsing against fixture HTML (og:title/title, og:description/meta description, icon resolution, missing-tag fallbacks) in `tests/unit/metadata.test.js`
- [X] T014 [P] [US1] Integration tests for `POST /api/bookmarks`: 201 new, 200 `existed:true` on duplicate, 400 on missing/invalid url, save succeeds on fetch failure in `tests/integration/create.test.js`

### Implementation for User Story 1

- [X] T015 [P] [US1] Implement `src/metadata.js`: fetch target URL with an AbortController ~4s timeout, parse title (og:title → `<title>`), description (og:description → `<meta name="description">`), favicon (`<link rel="icon">`/apple-touch-icon → absolute URL, fallback site `/favicon.ico`) using node-html-parser; return fallbacks on timeout/error/non-HTML (FR-004, FR-007, SC-006)
- [X] T016 [US1] Implement `createBookmark(url, tags?, overrides?)` in `src/bookmarks.js`: normalize+validate url, look up existing by url and return it with `existed:true` if found (FR-019), else collect metadata, insert bookmark with created_at/updated_at, apply title host-fallback (FR-006), attach any tags
- [X] T017 [US1] Implement `GET /api/bookmarks/:id` and `POST /api/bookmarks` in `src/routes/api.js` per contracts/api.md (201/200/400 responses)
- [X] T018 [US1] Build the add-bookmark form in `public/app.js`: submit url, show returned/collected details, and on `existed:true` navigate to/highlight the existing bookmark (FR-019); show validation error on 400
- [X] T019 [US1] Add an edit affordance in `public/app.js` for title/description (calls PATCH from US4 endpoint once available; for MVP, wire title/description edit) ensuring user edits override collected values (FR-005)

**Checkpoint**: A user can save a link, see auto-collected details, and duplicates route to the existing bookmark

---

## Phase 4: User Story 2 - Browse and open saved bookmarks (Priority: P1) 🎯 MVP

**Goal**: User sees all saved bookmarks and opens them; friendly empty state when none.

**Independent Test**: With bookmarks saved, reload → all listed with title/address/favicon/tags; activating one opens it in a new tab; with none → empty state.

### Tests for User Story 2 ⚠️

- [X] T020 [P] [US2] Integration test for `GET /api/bookmarks` returning newest-first list and empty array in `tests/integration/list.test.js`

### Implementation for User Story 2

- [X] T021 [US2] Implement `listBookmarks({q?, tag?})` in `src/bookmarks.js` returning bookmarks with their tags, ordered by created_at DESC (FR-013); (q/tag filtering used by US3/US5)
- [X] T022 [US2] Implement `GET /api/bookmarks` in `src/routes/api.js` returning `{bookmarks, total}` per contracts/api.md
- [X] T023 [US2] Render the bookmark list in `public/app.js`: title, address, favicon (placeholder when missing), tags; open target in a new tab on activation (FR-008, FR-009)
- [X] T024 [US2] Implement the empty state in `public/index.html`/`public/app.js` and set `data-harness-ready="true"` once the list (or empty state) has loaded (FR-018)

**Checkpoint**: MVP complete — save, browse, and open bookmarks end to end

---

## Phase 5: User Story 3 - Organize bookmarks with tags (Priority: P2)

**Goal**: Assign tags (choose existing or create new), filter list by a tag.

**Independent Test**: Add tags; existing tags offered as suggestions; `Work` doesn't duplicate `work`; filter by tag shows only matches; clear filter restores all.

### Tests for User Story 3 ⚠️

- [X] T025 [P] [US3] Integration test for `GET /api/tags` and tag filtering via `GET /api/bookmarks?tag=` (case-insensitive, no duplicate tag) in `tests/integration/tags.test.js`

### Implementation for User Story 3

- [X] T026 [US3] Implement `setTagsForBookmark(bookmarkId, names)` and `listTags()` in `src/bookmarks.js`: reuse tag by norm_key or create, maintain join rows (FR-014, FR-015)
- [X] T027 [US3] Implement `GET /api/tags` in `src/routes/api.js` returning sorted, case-insensitive tag names (FR-014)
- [X] T028 [US3] Extend `listBookmarks` tag filtering in `src/bookmarks.js` to restrict by join rows for `tag` param (FR-016)
- [X] T029 [US3] Add tag input with existing-tag suggestions to the add/edit form in `public/app.js` (FR-014)
- [X] T030 [US3] Add a tag-filter control (select a tag / clear filter) to `public/app.js` (FR-016)

**Checkpoint**: Bookmarks can be tagged and filtered by tag

---

## Phase 6: User Story 4 - Edit and delete bookmarks (Priority: P2)

**Goal**: Edit title/description/address/tags; delete with confirmation.

**Independent Test**: Edit fields → persist after reload; changing url to an existing one → conflict; delete → confirmation → gone permanently.

### Tests for User Story 4 ⚠️

- [X] T031 [P] [US4] Integration tests for `PATCH /api/bookmarks/:id` (updates, 409 on url conflict, 400/404) and `DELETE /api/bookmarks/:id` (204/404) in `tests/integration/edit-delete.test.js`

### Implementation for User Story 4

- [X] T032 [US4] Implement `updateBookmark(id, fields)` in `src/bookmarks.js`: update title/description/url/tags, re-validate url, detect url conflict with another bookmark, bump updated_at (FR-010, FR-019)
- [X] T033 [US4] Implement `deleteBookmark(id)` in `src/bookmarks.js` (cascade removes join rows) (FR-011)
- [X] T034 [US4] Implement `PATCH /api/bookmarks/:id` and `DELETE /api/bookmarks/:id` in `src/routes/api.js` per contracts/api.md (200/400/404/409, 204)
- [X] T035 [US4] Add full edit dialog (title, description, address, tags) and a delete action with a confirmation prompt in `public/app.js` (FR-010, FR-011)

**Checkpoint**: Bookmarks are fully manageable

---

## Phase 7: User Story 5 - Find bookmarks (Priority: P3)

**Goal**: Search by title/description/address/tag, combinable with the tag filter.

**Independent Test**: Type a term → only matches show; combine with tag filter → both apply; no matches → "no results" message.

### Tests for User Story 5 ⚠️

- [X] T036 [P] [US5] Integration test for `GET /api/bookmarks?q=` searching title/description/url/tag and combining with `tag` in `tests/integration/search.test.js`

### Implementation for User Story 5

- [X] T037 [US5] Extend `listBookmarks` in `src/bookmarks.js`: case-insensitive `q` match across title, description, url, and tag names, combinable with `tag` filter (FR-017)
- [X] T038 [US5] Add a search box in `public/app.js` that requeries the list and shows a "no results" state distinct from the empty state (FR-017, FR-018)

**Checkpoint**: All user stories independently functional

---

## Phase 8: Polish & Cross-Cutting Concerns

- [X] T039 [P] End-to-end Playwright smoke test covering save → list → tag/filter → edit → delete in `tests/e2e/smoke.spec.js` (Playwright 1.61.0)
- [X] T040 [P] Add consistent API error handling (JSON `{error}` shape) and long title/address truncation in the UI (spec edge cases)
- [X] T041 Run through `quickstart.md` manual validation scenarios and confirm data persists across a server restart
- [X] T042 [P] Brief README with run/test instructions

---

## Dependencies & Execution Order

- **Setup (Phase 1)**: no dependencies.
- **Foundational (Phase 2)**: depends on Setup; **blocks all user stories**.
- **User Stories (Phases 3–7)**: depend on Foundational. US1 and US2 (both P1) form the MVP; US2's list rendering pairs with US1. US3/US4/US5 extend `listBookmarks` and the UI and are otherwise independent.
- **Polish (Phase 8)**: after the targeted stories are complete.

### Within each story

Tests first (should fail) → data-access in `src/bookmarks.js` → API routes → frontend wiring.

### Parallel opportunities

- Setup: T004 parallel with others where noted.
- Foundational: T007, T008, T009, T011 marked [P].
- Per story, all test tasks marked [P] and independent-file implementation tasks (e.g. T015) can run in parallel.

---

## Implementation Strategy

### MVP First (User Stories 1 + 2)

1. Phase 1 Setup → 2. Phase 2 Foundational → 3. Phase 3 (US1) + Phase 4 (US2) → **STOP & VALIDATE**: save, browse, open, dedupe work end to end. Demoable MVP.

### Incremental Delivery

Add US3 (tags) → US4 (edit/delete) → US5 (search), validating each independently, then Phase 8 polish.

---

## Notes

- [P] = different files, no incomplete-task dependencies.
- Metadata-fetch failures are not errors — saving always succeeds with fallbacks.
- Commit after each task or logical group; validate at each checkpoint.
