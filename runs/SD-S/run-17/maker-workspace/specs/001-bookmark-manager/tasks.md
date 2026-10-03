---
description: "Task list for Bookmark Manager implementation"
---

# Tasks: Bookmark Manager

**Input**: Design documents from `/specs/001-bookmark-manager/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api.md, quickstart.md

**Tests**: Included — the approved plan and quickstart specify unit/API tests
(`node --test`) and Playwright 1.61.0 end-to-end tests.

**Organization**: Tasks are grouped by user story so each can be implemented and
tested independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1–US4)

## Path Conventions

Single web-application project rooted at the repository (per plan.md): `src/`,
`public/`, `tests/`, `data/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [X] T001 Create project structure per plan.md: `src/`, `public/`, `tests/unit/`, `tests/api/`, `tests/e2e/`, and a `data/` directory (with `data/` git-ignored)
- [X] T002 Initialize Node.js project: create `package.json` (ES modules, `"type": "module"`), add dependencies `express` and `better-sqlite3`, dev dependency `playwright@1.61.0` and `@playwright/test@1.61.0`, and scripts `start` (`node src/server.js`) and `test` (`node --test tests/unit tests/api`); run `npm install` and preserve the lockfile
- [X] T003 [P] Add a `.gitignore` (ignore `node_modules/`, `data/*.db`) and configure Playwright to use the shared browsers at `/opt/playwright-browsers` in `playwright.config.js`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T004 Implement SQLite connection and idempotent schema init in `src/db.js`: create tables `bookmarks` (id, url, title, notes, created_at, updated_at, url_key), `tags` (id, name unique case-insensitive), and join `bookmark_tags` (bookmark_id, tag_id); add indexes on `bookmarks.url_key`, `bookmarks.created_at`, and `tags.name`; timestamps stored as UTC ISO-8601 (per data-model.md)
- [X] T005 [P] Implement URL helpers in `src/url.js`: `normalize(input)` prepends `https://` when no scheme is present (FR-003) and returns a valid http/https URL or throws for invalid input (FR-002); `dedupeKey(url)` returns lowercased host + path, trailing-slash tolerant (FR-010, per data-model.md `url_key`)
- [X] T006 [P] Implement best-effort title fetch in `src/title-fetch.js`: fetch the page with a ~5s timeout, parse the `<title>`, and on any failure/timeout return null so the caller can fall back — never throws to the caller (FR-004)
- [X] T007 Create the Express app skeleton in `src/server.js`: JSON body parsing, serve `public/` statically, mount an `/api` router, centralized error handler emitting `{ "error": code, "message": text }` (per contracts/api.md), and listen on `0.0.0.0:4000`
- [X] T008 [P] Unit tests for foundational helpers in `tests/unit/url.test.js` (normalize + dedupeKey cases) and `tests/unit/title-fetch.test.js` (fallback returns null on failure)

**Checkpoint**: Foundation ready — user story implementation can begin

---

## Phase 3: User Story 1 - Save a bookmark (Priority: P1) 🎯 MVP

**Goal**: A user saves a bookmark by entering an address; it is validated,
normalised, auto-titled when blank, deduped-warned, and persisted.

**Independent Test**: Enter `example.com` with a blank title, save, and confirm a
persisted bookmark appears with normalised address and an auto-filled title; enter an
invalid address and confirm rejection.

### Tests for User Story 1

- [X] T009 [P] [US1] API test for `POST /api/bookmarks` in `tests/api/create.test.js`: 201 on valid input (address normalised, title auto-filled, created_at set), 400 on invalid address (FR-002/003/004/014)
- [X] T010 [P] [US1] API test for duplicate handling in `tests/api/duplicate.test.js`: second save of the same address returns 409 `already_saved`; re-submitting with `confirmDuplicate: true` returns 201 (FR-010)

### Implementation for User Story 1

- [X] T011 [US1] Implement bookmark data-access + business rules in `src/bookmarks.js`: `create({url,title,notes,tags,confirmDuplicate})` normalising url, computing url_key, detecting duplicates, auto-fetching title when blank (fallback to address), upserting tags, and inserting the row (depends on T004–T006)
- [X] T012 [US1] Implement `POST /api/bookmarks` route wiring to `src/bookmarks.js` in `src/server.js`: 201 with the created Bookmark object, 400 invalid address, 409 duplicate without confirm (per contracts/api.md)
- [X] T013 [US1] Build the add-bookmark UI in `public/index.html`, `public/app.js`, `public/styles.css`: a form (address, optional title, notes, tags), submit via `fetch` to `POST /api/bookmarks`, show validation errors and the duplicate-warning prompt with a "save anyway" action

**Checkpoint**: A user can save bookmarks; invalid input and duplicates are handled.

---

## Phase 4: User Story 2 - Browse and open saved bookmarks (Priority: P1)

**Goal**: A user sees all saved bookmarks newest-first and opens any in a new tab;
sensible empty state when none exist.

**Independent Test**: With bookmarks saved, load the app and confirm all appear
newest-first with title + address, click one to open it in a new tab, and confirm the
empty state shows when the database is empty.

### Tests for User Story 2

- [X] T014 [P] [US2] API test for `GET /api/bookmarks` in `tests/api/list.test.js`: returns bookmarks newest-first with `total` and `matched` counts (FR-006, FR-013)

### Implementation for User Story 2

- [X] T015 [US2] Add `list({q,tag})` to `src/bookmarks.js` returning bookmarks ordered by created_at DESC with attached tags plus `total` and `matched` counts (FR-006, FR-013); q/tag filtering added in US4
- [X] T016 [US2] Implement `GET /api/bookmarks` and `GET /api/bookmarks/:id` routes in `src/server.js` (per contracts/api.md; 404 on missing id)
- [X] T017 [US2] Render the bookmark list in `public/app.js`/`index.html`: fetch on load, show title + address newest-first, each opening the target in a new tab (`target="_blank"` with `rel="noopener"`, FR-007), and an empty state when `total === 0` (FR-013)
- [X] T018 [US2] Set `data-harness-ready="true"` on the main list element once the initial list (or empty state) has loaded (per project conventions)

**Checkpoint**: Stories 1 + 2 together form the MVP — save, browse, open.

---

## Phase 5: User Story 3 - Edit and delete bookmarks (Priority: P2)

**Goal**: A user edits a bookmark's fields or deletes it after confirmation.

**Independent Test**: Edit a bookmark's title and confirm it persists after reload;
delete a bookmark, confirm the confirmation step, and confirm it does not reappear.

### Tests for User Story 3

- [X] T019 [P] [US3] API test for `PUT /api/bookmarks/:id` in `tests/api/update.test.js`: updates fields and `updated_at`, re-validates url, 404 on missing id (FR-008)
- [X] T020 [P] [US3] API test for `DELETE /api/bookmarks/:id` in `tests/api/delete.test.js`: 204 on success, 404 on missing id (FR-009)

### Implementation for User Story 3

- [X] T021 [US3] Add `update(id, fields)` and `remove(id)` to `src/bookmarks.js`: update re-normalises/validates url when provided, refreshes tags and `updated_at`; remove deletes the row and its tag links (FR-008, FR-009)
- [X] T022 [US3] Implement `PUT /api/bookmarks/:id` and `DELETE /api/bookmarks/:id` routes in `src/server.js` (per contracts/api.md)
- [X] T023 [US3] Add edit and delete UI in `public/app.js`/`index.html`: an edit form pre-filled from the bookmark saving via `PUT`, and a delete action that requires an explicit confirmation before calling `DELETE` (FR-009)

**Checkpoint**: Collection can be kept accurate and uncluttered.

---

## Phase 6: User Story 4 - Find bookmarks with search and tags (Priority: P3)

**Goal**: A user narrows a large collection by search term or tag filter, with a
clear no-results state.

**Independent Test**: With varied bookmarks/tags saved, search a term and confirm only
matches show, filter by a tag and confirm only tagged items show, and apply a
non-matching filter to confirm the no-results state that can be cleared.

### Tests for User Story 4

- [X] T024 [P] [US4] API test for search/filter in `tests/api/search.test.js`: `?q=` matches title/url/notes/tags, `?tag=` restricts to tagged bookmarks, `matched` reflects filtered count (FR-011, FR-012, FR-013)
- [X] T025 [P] [US4] API test for `GET /api/tags` in `tests/api/tags.test.js`: returns existing tag names (FR-012)

### Implementation for User Story 4

- [X] T026 [US4] Extend `list({q,tag})` in `src/bookmarks.js` to apply case-insensitive `q` matching against title/url/notes/tags and `tag` filtering, and add `listTags()` (FR-011, FR-012)
- [X] T027 [US4] Implement `GET /api/tags` route and wire `q`/`tag` query params into `GET /api/bookmarks` in `src/server.js` (per contracts/api.md)
- [X] T028 [US4] Add search box and tag-filter control in `public/app.js`/`index.html`: live-filter the list via the API, and show a clearable no-results state when `total > 0 && matched === 0` (FR-013)

**Checkpoint**: All user stories are independently functional.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Validation, hardening, and delivery readiness

- [X] T029 [P] Add end-to-end Playwright tests in `tests/e2e/` covering quickstart Scenarios A–E (save, browse/open, edit/delete, search/filter, duplicate+persistence)
- [X] T030 [P] Verify long title/address truncation in the UI and full storage of values (spec Edge Cases)
- [X] T031 Create `/work/.harness/app.json` with `{"kind":"application","port":4000,"path":"/","start_command":["npm","start"],"start_cwd":"/work"}` after install/build are complete
- [X] T032 Run `npm test`, `npx playwright test`, and the quickstart.md validation end-to-end; fix any failures

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories
- **User Stories (Phase 3–6)**: All depend on Foundational; then proceed in priority
  order (US1 → US2 → US3 → US4) or in parallel if staffed
- **Polish (Phase 7)**: Depends on the desired user stories being complete

### User Story Dependencies

- **US1 (P1)**: After Foundational — no dependency on other stories
- **US2 (P1)**: After Foundational — adds `list()`; independently testable
- **US3 (P2)**: After Foundational — independently testable (needs data from US1 to be meaningful)
- **US4 (P3)**: After Foundational — extends `list()`; independently testable

### Within Each User Story

- Tests written first and expected to fail before implementation
- Data-access (`src/bookmarks.js`) before routes; routes before UI

### Parallel Opportunities

- Setup: T003 parallel with the rest once T001/T002 land
- Foundational: T005, T006, T008 are [P] (different files)
- Within a story, the [P] test tasks can run together
- Across stories, US1–US4 can be split among developers after Phase 2

---

## Parallel Example: User Story 1

```bash
# Tests for US1 together:
Task: "API test for POST /api/bookmarks in tests/api/create.test.js"
Task: "API test for duplicate handling in tests/api/duplicate.test.js"
```

---

## Implementation Strategy

### MVP First

1. Phase 1 Setup → 2. Phase 2 Foundational → 3. Phase 3 (US1) → 4. Phase 4 (US2)
5. **STOP and VALIDATE**: save, browse, open work end-to-end (MVP = US1 + US2)

### Incremental Delivery

Add US3 (edit/delete), then US4 (search/tags), validating each independently, then
Phase 7 polish and full quickstart validation.

---

## Notes

- [P] = different files, no dependencies
- Verify tests fail before implementing
- Commit after each task or logical group
- Do not create `/work/.harness/app.json` (T031) or start the server until install and
  any build steps are complete (per project conventions)
