---

description: "Task list for Bookmark Manager implementation"
---

# Tasks: Bookmark Manager

**Input**: Design documents from `/specs/001-bookmark-manager/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api.md, quickstart.md

**Tests**: Included — the plan commits to a `node:test` unit/API suite plus one Playwright end-to-end flow (research.md Decision 6, quickstart.md).

**Organization**: Tasks are grouped by user story so each story can be implemented and tested independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1–US4)
- Exact file paths are included in each description

## Path Conventions

Single project at repository root `/work/`: server code in `server/`, browser client in `public/`, tests in `tests/`, SQLite file under `data/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and runtime wiring

- [X] T001 Create project structure per plan: `server/`, `public/`, `tests/`, `data/` directories in `/work/`
- [X] T002 Create `/work/package.json` (ES modules, `"type":"module"`) with `start` script (`node server/index.js`) and `test` script (`node --test` + Playwright); add dependencies `express@^4`, `better-sqlite3`, and devDependency `@playwright/test@1.61.0`
- [X] T003 Run `npm install` in `/work` (preserving the generated lockfile) and add `/work/.gitignore` ignoring `node_modules/` and `data/`
- [X] T004 [P] Add `playwright.config.js` in `/work` pinned to the shared browsers (baseURL `http://127.0.0.1:4000`, reuse existing server), per quickstart.md

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core server, database, and shared URL logic that every story depends on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T005 Implement SQLite connection and schema init in `/work/server/db.js`: open `data/bookmarks.db`, create `bookmarks` (id, url NOT NULL, title, notes, date_added NOT NULL, date_updated NOT NULL), `tags` (id, name UNIQUE case-insensitive NOT NULL), and `bookmark_tags` (bookmark_id FK cascade delete, tag_id FK) tables per data-model.md
- [X] T006 [P] Implement URL normalization/validation in `/work/server/url.js`: prepend `https://` when no scheme present (FR-003), parse via WHATWG `URL`, accept only `http:`/`https:`, throw/return-invalid otherwise (FR-002)
- [X] T007 Implement Express app skeleton in `/work/server/index.js`: bind `0.0.0.0:4000`, serve `public/` as static files, mount `/api` router, JSON body parsing, and a JSON error handler returning `{ "error": "<message>" }`
- [X] T008 [P] Create the browser client shell `/work/public/index.html` (app title, container for list, add-bookmark form, search box, tag filter) and `/work/public/styles.css` (responsive layout usable on smaller screens)
- [X] T009 Create `/work/public/app.js` bootstrap that fetches `GET /api/bookmarks` on load, renders results (or empty state), and sets `data-harness-ready="true"` on a visible element only after the initial list/empty state has rendered
- [X] T010 [P] Author `/work/.harness/app.json`: `{"kind":"application","port":4000,"path":"/","start_command":["npm","start"],"start_cwd":"/work"}`

**Checkpoint**: Server starts, serves an empty app shell, DB and URL helpers ready

---

## Phase 3: User Story 1 - Save a bookmark (Priority: P1) 🎯 MVP

**Goal**: A user can save a bookmark by URL (optional title/notes), with validation, `https://` normalization, duplicate warning, and fallback display label.

**Independent Test**: Add a URL → it appears in the saved list and survives a reload; invalid input is rejected with a clear message.

### Tests for User Story 1

- [X] T011 [P] [US1] Unit tests in `/work/tests/url.test.js`: scheme-less `example.com` → `https://example.com`, reject `not a url` and non-http(s) schemes (FR-002, FR-003)
- [X] T012 [P] [US1] API tests in `/work/tests/api.test.js` for create: `POST /api/bookmarks` returns `201` with normalized url and server-computed `displayLabel`; missing/invalid url returns `400`; identical url returns `201` with `"warning":"duplicate_url"` (FR-001, FR-004, FR-013)

### Implementation for User Story 1

- [X] T013 [US1] Implement bookmark create + tag upsert in `/work/server/bookmarks.js`: `createBookmark({url,title,notes,tags})` normalizing via `url.js`, setting `date_added`/`date_updated`, linking tags, and detecting an existing identical url for the duplicate warning (FR-001, FR-003, FR-013)
- [X] T014 [US1] Add `displayLabel` derivation in `/work/server/bookmarks.js`: return `title` when non-empty else a label derived from the url host+path (FR-004)
- [X] T015 [US1] Implement `POST /api/bookmarks` route in `/work/server/index.js` per contracts/api.md (201 / 201+warning / 400)
- [X] T016 [US1] Build the add-bookmark form handler in `/work/public/app.js`: submit to the API, show validation errors inline, show a non-blocking duplicate warning, and prepend the new bookmark to the list on success

**Checkpoint**: Saving works end-to-end and persists across reloads

---

## Phase 4: User Story 2 - Browse and open saved bookmarks (Priority: P1) 🎯 MVP

**Goal**: A user sees all saved bookmarks (title + address, newest first), opens one in a new tab, and gets a friendly empty state.

**Independent Test**: With saved bookmarks, the list shows them and activating one opens the correct address; with none, an empty state explains how to add the first.

### Tests for User Story 2

- [X] T017 [P] [US2] API tests in `/work/tests/api.test.js` for `GET /api/bookmarks`: returns all bookmarks ordered by `date_added` DESC (FR-014) and an empty array when none exist (FR-012)

### Implementation for User Story 2

- [X] T018 [US2] Implement `listBookmarks()` in `/work/server/bookmarks.js` returning all bookmarks with tags, ordered most-recently-added first (FR-005, FR-014)
- [X] T019 [US2] Implement `GET /api/bookmarks` route in `/work/server/index.js` per contracts/api.md
- [X] T020 [US2] Render the bookmark list in `/work/public/app.js`: show display label + address per item, each opening its url in a new tab (`target="_blank"` + `rel="noopener"`) (FR-006)
- [X] T021 [US2] Implement the empty-state view in `/work/public/app.js` / `index.html` shown when the list is empty (FR-012)

**Checkpoint**: MVP complete — US1 + US2 deliver save, list, open, and empty state

---

## Phase 5: User Story 3 - Edit and delete bookmarks (Priority: P2)

**Goal**: A user edits a bookmark's title/address/notes and deletes bookmarks with a confirmation step.

**Independent Test**: Edit updates the list; delete asks for confirmation and the bookmark stays gone after reload.

### Tests for User Story 3

- [X] T022 [P] [US3] API tests in `/work/tests/api.test.js` for `PUT /api/bookmarks/:id` (200 with refreshed `dateUpdated`, 400 invalid url, 404 missing) and `DELETE /api/bookmarks/:id` (204, cascade removes tag links, 404 missing) (FR-007, FR-008)

### Implementation for User Story 3

- [X] T023 [US3] Implement `updateBookmark(id, fields)` and `deleteBookmark(id)` in `/work/server/bookmarks.js`: re-validate/normalize url, refresh `date_updated`, re-link tags, cascade-delete tag links on removal (FR-007, FR-008)
- [X] T024 [US3] Implement `PUT /api/bookmarks/:id` and `DELETE /api/bookmarks/:id` routes in `/work/server/index.js` per contracts/api.md
- [X] T025 [US3] Add edit UI in `/work/public/app.js`: an edit form pre-filled with current values that saves via `PUT` and updates the list in place
- [X] T026 [US3] Add delete UI in `/work/public/app.js`: a confirmation prompt before issuing `DELETE`, removing the item from the list on success (FR-008)

**Checkpoint**: Full CRUD available; collection is maintainable

---

## Phase 6: User Story 4 - Organize and find bookmarks (Priority: P3)

**Goal**: A user searches by keyword and filters by tag; clear "no results" state when nothing matches.

**Independent Test**: A keyword narrows the list to matches across title/address/notes/tags; a tag filter restricts to tagged bookmarks; a non-matching keyword shows "no results".

### Tests for User Story 4

- [X] T027 [P] [US4] API tests in `/work/tests/api.test.js`: `GET /api/bookmarks?q=` matches title/url/notes/tag case-insensitively (FR-011), `?tag=` restricts to tagged bookmarks (FR-010), no matches returns an empty array (FR-012); `GET /api/tags` returns distinct in-use tag names

### Implementation for User Story 4

- [X] T028 [US4] Extend `listBookmarks({q, tag})` in `/work/server/bookmarks.js` with case-insensitive `LIKE` search across title/url/notes/tag names and a tag-name filter join (FR-010, FR-011)
- [X] T029 [US4] Implement `listTags()` in `/work/server/bookmarks.js` and the `GET /api/tags` route in `/work/server/index.js` per contracts/api.md
- [X] T030 [US4] Wire search box and tag filter in `/work/public/app.js`: re-query the API on input/selection and render a "no results" state when the response is empty (FR-012)
- [X] T031 [US4] Add tag entry to the add/edit forms in `/work/public/app.js` so bookmarks can carry tags (FR-010)

**Checkpoint**: All four user stories independently functional

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: End-to-end validation and finishing touches

- [X] T032 [US1] [US2] [US3] Add the Playwright end-to-end flow in `/work/tests/e2e.spec.js`: save → list → open → edit → delete (quickstart.md scenarios 1–3)
- [X] T033 [P] Add long-value handling in `/work/public/styles.css` / `app.js`: truncate long titles/addresses with full value on hover/expand (Edge Cases)
- [X] T034 Run `npm test` and the quickstart.md manual scenarios; confirm SC-001..SC-005 and fix any failures before requesting review

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies — start immediately
- **Foundational (Phase 2)**: depends on Setup — BLOCKS all user stories
- **User Stories (Phases 3–6)**: all depend on Foundational; then proceed in priority order or in parallel if staffed
- **Polish (Phase 7)**: depends on the targeted user stories being complete

### User Story Dependencies

- **US1 (P1)**: after Foundational — no dependency on other stories
- **US2 (P1)**: after Foundational — independently testable (uses bookmarks created via US1 or seeded directly)
- **US3 (P2)**: after Foundational — operates on existing bookmarks; independently testable
- **US4 (P3)**: after Foundational — extends list querying; independently testable

### Within Each User Story

- Tests written first and expected to fail before implementation
- Data access (`bookmarks.js`) before routes (`index.js`) before client (`app.js`)

### Parallel Opportunities

- T004 alongside other setup; T006, T008, T010 within Foundational are `[P]`
- Each story's test task (`[P]`) can be written in parallel with its peers
- With multiple developers, US1–US4 can proceed in parallel after Phase 2

---

## Implementation Strategy

### MVP First

1. Phase 1 (Setup) → Phase 2 (Foundational)
2. Phase 3 (US1: Save) + Phase 4 (US2: Browse & open) — both P1
3. **STOP and VALIDATE**: save, reload, list, open, empty state
4. Demo the MVP

### Incremental Delivery

1. Foundation ready
2. US1 + US2 → MVP (save / browse / open)
3. US3 → edit / delete
4. US4 → search / tags
5. Polish → e2e + quickstart validation

---

## Notes

- MVP = User Story 1 + User Story 2 (both P1); the app is not useful with only one.
- `[P]` tasks touch different files with no incomplete dependencies.
- Commit after each task or logical group; stop at any checkpoint to validate a story independently.
- Server re-validates all writes so the API cannot be bypassed by the client.
