---

description: "Task list for Bookmark Manager implementation"
---

# Tasks: Bookmark Manager

**Input**: Design documents from `/work/specs/001-bookmark-manager/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api.md, quickstart.md

**Tests**: Included — the plan and quickstart call for `node:test` unit tests and
Playwright 1.61.0 end-to-end tests.

**Organization**: Tasks are grouped by user story. User Stories 1 and 2 are both
P1 and together form the MVP (capture + retrieve).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: US1–US4 map to the user stories in spec.md
- Exact file paths are included in each task

## Path Conventions

Single web-application project (per plan.md): server code under `server/`, static
frontend under `public/`, tests under `tests/`, SQLite file under `data/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [ ] T001 Create project structure per plan.md: `server/`, `server/routes/`, `server/lib/`, `public/`, `data/`, `tests/unit/`, `tests/e2e/` under `/work`
- [ ] T002 Initialize npm project at `/work/package.json` with ES modules (`"type": "module"`) and scripts `start` (`node server/index.js`), `test` (`node --test tests/unit`), `test:e2e` (`playwright test`); add dependencies `express`, `better-sqlite3` and devDependency `@playwright/test` pinned to `1.61.0`
- [ ] T003 [P] Add `.gitignore` at `/work/.gitignore` ignoring `node_modules/` and `data/`; add `playwright.config.js` at `/work/playwright.config.js` pinned to baseURL `http://127.0.0.1:4000`
- [ ] T004 [P] Run `npm install` in `/work` and verify the Playwright browser revision matches the shared binaries at `/opt/playwright-browsers` (do not download a second browser version)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T005 Implement SQLite connection and schema init in `server/db.js`: create tables `bookmarks` (`id` INTEGER PK, `url` TEXT NOT NULL UNIQUE, `title` TEXT NOT NULL, `created_at` TEXT, `updated_at` TEXT), `tags` (`id` INTEGER PK, `name` TEXT NOT NULL UNIQUE), and join `bookmark_tags` (`bookmark_id`, `tag_id`, UNIQUE(`bookmark_id`,`tag_id`), ON DELETE CASCADE); database file at `/work/data/bookmarks.db`
- [ ] T006 [P] Implement URL validation + normalization in `server/lib/url.js`: parse with WHATWG `URL`, accept only `http:`/`https:` schemes (reject others as invalid), normalize by lowercasing scheme and host, removing default ports, and collapsing an empty path to `/`
- [ ] T007 [P] Implement best-effort page-title fetch in `server/lib/title.js`: `fetch` the URL with a ~5s timeout and response-size cap, extract `<title>`, and return `null` on any failure (timeout, non-HTML, network error, missing title) so callers fall back to the URL
- [ ] T008 Create Express app skeleton in `server/app.js`: JSON body parsing, static serving of `public/`, JSON error handler mapping error codes (`invalid_url`→400, `duplicate_url`→409, `validation_error`→400, `not_found`→404) to the `{ "error": { "code", "message" } }` shape from contracts/api.md
- [ ] T009 Create server entry in `server/index.js`: start the Express app listening on `0.0.0.0:4000`
- [ ] T010 [P] Write `/work/.harness/app.json`: `{"kind":"application","port":4000,"path":"/","start_command":["npm","start"],"start_cwd":"/work"}`

**Checkpoint**: Server boots, DB schema exists, shared libs available.

---

## Phase 3: User Story 1 - Save a bookmark (Priority: P1) 🎯 MVP

**Goal**: A person saves a bookmark by URL (optional title); it is validated,
titled (best-effort), de-duplicated, persisted, and returned.

**Independent Test**: POST a valid URL with no title → 201 with a derived title;
reload data → still present. POST a malformed URL → 400. POST a duplicate → 409.

### Tests for User Story 1

- [ ] T011 [P] [US1] Unit tests for `server/lib/url.js` in `tests/unit/url.test.js`: valid http/https accepted, non-http rejected, malformed rejected, normalization (host lowercased, default port stripped, empty path → `/`)
- [ ] T012 [P] [US1] Unit tests for `server/lib/title.js` in `tests/unit/title.test.js`: extracts `<title>`, returns `null` on non-HTML/timeout (use a stubbed fetch)
- [ ] T013 [P] [US1] E2E test in `tests/e2e/save.spec.js`: add a valid URL with blank title → appears in list with derived label and persists after reload; malformed URL shows a clear error; duplicate URL shows an "already bookmarked" warning

### Implementation for User Story 1

- [ ] T014 [US1] Implement bookmark repository create/read in `server/bookmarks.repo.js`: `create({url,title,tags})` normalizing URL, checking duplicates (throw `duplicate_url`), resolving title (custom → fetched → url), upserting tags and links, setting `created_at`/`updated_at`; `getById(id)` returning the Bookmark shape with `tags` array (depends on T005–T007)
- [ ] T015 [US1] Implement `POST /api/bookmarks` and `GET /api/bookmarks/:id` in `server/routes/bookmarks.js` per contracts/api.md (201 create, 400 `invalid_url`, 409 `duplicate_url`, 404 `not_found`) and mount the router in `server/app.js`
- [ ] T016 [P] [US1] Build the add-bookmark UI in `public/index.html` and `public/app.js`: URL + optional title form that POSTs and refreshes the list; show validation and duplicate error messages
- [ ] T017 [US1] Style the add form and list in `public/styles.css`; set `data-harness-ready="true"` on the root container once the initial list/empty state has loaded

**Checkpoint**: Bookmarks can be saved, titled, de-duplicated, and persisted.

---

## Phase 4: User Story 2 - Browse and open saved bookmarks (Priority: P1) 🎯 MVP

**Goal**: A person sees all saved bookmarks (most-recent-first) and opens any in
a new browser tab; an empty state invites a first add.

**Independent Test**: With several saved, `GET /api/bookmarks` returns them
newest-first; the UI lists them and titles open the original URL in a new tab;
with none saved, the empty state shows.

### Tests for User Story 2

- [ ] T018 [P] [US2] E2E test in `tests/e2e/browse.spec.js`: seed several bookmarks → list shows all newest-first; clicking a title opens the original URL in a new tab (`target=_blank`); empty database → empty state visible

### Implementation for User Story 2

- [ ] T019 [US2] Implement `GET /api/bookmarks` list in `server/bookmarks.repo.js` and `server/routes/bookmarks.js`: return all bookmarks ordered by `created_at` DESC with their `tags` (FR-014)
- [ ] T020 [US2] Render the bookmark list in `public/app.js`: each item shows title (link with `target="_blank" rel="noopener"` to the URL), the address, tags, and saved date; distinct empty state when there are no bookmarks (FR-013)

**Checkpoint**: MVP complete — capture (US1) and retrieve (US2) both work.

---

## Phase 5: User Story 3 - Edit and delete bookmarks (Priority: P2)

**Goal**: A person edits a bookmark's title/URL/tags, or deletes it after a
confirmation step; changes persist.

**Independent Test**: PUT updates title/URL and persists after reload; DELETE (via
a confirm step) removes it and it does not return after reload.

### Tests for User Story 3

- [ ] T021 [P] [US3] E2E test in `tests/e2e/edit-delete.spec.js`: edit a title → persists after reload; edit to a duplicate URL → 409/warning; delete → confirmation prompt, item gone and absent after reload

### Implementation for User Story 3

- [ ] T022 [US3] Implement `update(id, {...})` and `remove(id)` in `server/bookmarks.repo.js`: re-validate/normalize URL, duplicate check excluding self, replace tag set, refresh `updated_at`; delete cascades to `bookmark_tags` (FR-007, FR-008, FR-009)
- [ ] T023 [US3] Implement `PUT /api/bookmarks/:id` and `DELETE /api/bookmarks/:id` in `server/routes/bookmarks.js` per contracts/api.md (200/204, 400, 409, 404)
- [ ] T024 [US3] Add edit and delete UI in `public/app.js`: inline edit form (title/URL/tags) and a delete action that requires explicit confirmation before issuing DELETE (FR-008)

**Checkpoint**: Collection is fully manageable (add/browse/edit/delete).

---

## Phase 6: User Story 4 - Organize with tags and search (Priority: P3)

**Goal**: A person tags bookmarks, filters by tag, and keyword-searches across
title, URL, and tags; clear no-results state when nothing matches.

**Independent Test**: Tag two bookmarks `tech`; filter by `tech` → only those
two; search a keyword → matching bookmarks; a non-matching query → no-results
state.

### Tests for User Story 4

- [ ] T025 [P] [US4] E2E test in `tests/e2e/tags-search.spec.js`: assign a tag to two bookmarks, filter by it → only those two; keyword search matches title/url/tag; non-matching query shows the no-results state

### Implementation for User Story 4

- [ ] T026 [US4] Extend list query in `server/bookmarks.repo.js` to support `q` (case-insensitive substring over title, url, and tag name — FR-012) and repeatable `tag` filter (FR-011), preserving newest-first ordering
- [ ] T027 [US4] Wire `q` and `tag` query params into `GET /api/bookmarks` and implement `GET /api/tags` (name + count) in `server/routes/bookmarks.js` and `server/routes/tags.js`; mount the tags router
- [ ] T028 [US4] Add search box and tag-filter controls in `public/app.js` and `public/index.html`: query the API, render results, and show a distinct no-results state versus the empty state (FR-013)

**Checkpoint**: All four user stories independently functional.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Improvements affecting multiple user stories

- [ ] T029 [P] Handle long titles/URLs gracefully in `public/styles.css` (truncation with full value available) per the edge cases in spec.md
- [ ] T030 [P] Add a short `README.md` at `/work/README.md` summarizing setup/run/test from quickstart.md
- [ ] T031 Run the full quickstart.md manual validation and both test suites (`npm test`, `npm run test:e2e`); confirm the app starts on `0.0.0.0:4000` and the root sets `data-harness-ready="true"`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories
- **User Stories (Phase 3–6)**: All depend on Foundational
  - US1 and US2 (both P1) are the MVP; US2 depends on US1's repo/UI scaffolding in practice
  - US3 and US4 build on the same repo/routes/UI but are independently testable
- **Polish (Phase 7)**: After the desired user stories are complete

### User Story Dependencies

- **US1 (P1)**: After Foundational — no dependency on other stories
- **US2 (P1)**: After Foundational — reuses US1 list/UI scaffolding; independently testable
- **US3 (P2)**: After Foundational — extends repo/routes/UI; independently testable
- **US4 (P3)**: After Foundational — extends list query + UI; independently testable

### Within Each User Story

- Tests written first and expected to fail before implementation
- Repository/data layer before routes; routes before UI wiring

### Parallel Opportunities

- Setup: T003, T004 in parallel after T001/T002
- Foundational: T006, T007, T010 in parallel (distinct files)
- US1 tests T011, T012, T013 in parallel; UI T016 parallel with route work
- Each story's E2E test ([P]) can be written alongside its implementation

---

## Parallel Example: User Story 1

```bash
# Tests for US1 together:
Task: "Unit tests for server/lib/url.js in tests/unit/url.test.js"
Task: "Unit tests for server/lib/title.js in tests/unit/title.test.js"
Task: "E2E test in tests/e2e/save.spec.js"
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2)

1. Phase 1: Setup
2. Phase 2: Foundational (CRITICAL — blocks all stories)
3. Phase 3: US1 (save) → Phase 4: US2 (browse/open)
4. **STOP and VALIDATE**: capture + retrieve loop works end-to-end
5. Demo the MVP

### Incremental Delivery

1. Setup + Foundational → foundation ready
2. US1 + US2 → MVP (capture + retrieve)
3. US3 → edit/delete → demo
4. US4 → tags/search → demo

---

## Notes

- [P] tasks = different files, no dependencies
- Pin Playwright/@playwright/test to 1.61.0 to match the shared browser binaries
- Verify tests fail before implementing
- Stop at any checkpoint to validate a story independently
