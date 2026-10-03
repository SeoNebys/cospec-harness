---

description: "Task list for Bookmark Manager implementation"
---

# Tasks: Bookmark Manager

**Input**: Design documents from `/specs/001-bookmark-manager/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api.md

**Tests**: Test tasks are included — the approved plan calls for `node:test`
API/integration tests and a Playwright `1.61.0` e2e smoke test.

**Organization**: Tasks are grouped by user story so each story can be
implemented, tested, and demonstrated independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on incomplete tasks)
- **[Story]**: US1–US4, mapping to the spec's user stories
- File paths are relative to the repo root `/work`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and structure.

- [X] T001 Create the project directory structure (`server/`, `server/routes/`, `public/`, `data/` with a `.gitkeep`, `tests/`) per plan.md
- [X] T002 Initialize `package.json` at repo root: `"type": "module"`, scripts `start` → `node server/index.js` and `test` → `node --test`; add dependencies `express` and `better-sqlite3`, devDependency `@playwright/test` pinned to `1.61.0`; run `npm install` preserving `package-lock.json`
- [X] T003 [P] Create `/work/.harness/app.json` runtime descriptor: `{"kind": "application", "port": 4000, "path": "/", "start_command": ["npm", "start"], "start_cwd": "/work"}`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure required before any user story. 

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T004 Implement the SQLite connection and schema in `server/db.js`: create `bookmarks` (`id` PK autoincrement, `url` text required, `url_norm` text required UNIQUE, `title` text required, `note` text, `created_at` text ISO-8601 required, `updated_at` text ISO-8601 required), `tags` (`id` PK, `name` text UNIQUE required non-empty), and `bookmark_tags` (`bookmark_id` FK→bookmarks ON DELETE CASCADE, `tag_id` FK→tags ON DELETE CASCADE, PK `(bookmark_id, tag_id)`); add an index on `created_at`; enable foreign keys; open the DB file at `data/bookmarks.db`
- [X] T005 Implement the Express bootstrap in `server/index.js`: JSON body parsing, serve `public/` as static files, mount the `/api` router, and listen on host `0.0.0.0` port `4000`
- [X] T006 [P] Implement URL validation and normalization in `server/url.js`: validate via the WHATWG `URL` parser accepting only `http`/`https` (reject others with a clear message per FR-002); produce `url_norm` by trimming, lowercasing scheme and host, dropping the default port, and removing a single trailing slash (per data-model.md, for FR-013 dedupe)
- [X] T007 Implement the API router skeleton in `server/routes/bookmarks.js`: a shared JSON error helper (`{ "error": "<message>" }`) and `GET /api/bookmarks` returning all bookmarks ordered by `created_at` descending with their `tags` array attached, in the shape defined in contracts/api.md (depends on T004, T006)
- [X] T008 Implement the frontend shell in `public/index.html`, `public/styles.css`, and `public/app.js`: on load, fetch `GET /api/bookmarks`, render a list container and a helpful empty state (FR-014), and set `data-harness-ready="true"` on a visible element after the initial list (or empty state) has loaded (depends on T005, T007)

**Checkpoint**: App boots at `http://maker:4000`, shows the empty state, and marks readiness.

---

## Phase 3: User Story 1 - Save a bookmark (Priority: P1) 🎯 MVP

**Goal**: A person can save a valid URL and see it appear in the list, with a
derived title (or the URL as fallback), invalid input rejected, and duplicates
warned.

**Independent Test**: Add a valid link and confirm it appears with a title;
submit non-URL text and confirm a clear error; save the same URL twice and
confirm the second is warned, not silently duplicated.

### Tests for User Story 1

- [X] T009 [P] [US1] API test in `tests/api.test.js`: `POST /api/bookmarks` with a valid URL returns 201 and persists it; invalid URL returns 400; a duplicate normalized URL returns 409 with `existingId`

### Implementation for User Story 1

- [X] T010 [US1] Implement `POST /api/bookmarks` in `server/routes/bookmarks.js`: validate `url` via `server/url.js` (400 on failure, FR-002), compute `url_norm` and reject duplicates with 409 + `existingId` (FR-013), set `created_at`/`updated_at`, insert, and return 201 with the created bookmark (depends on T007)
- [X] T011 [US1] Implement best-effort title fetch in `server/title.js` (global `fetch` with a short timeout, extract `<title>`, fall back to the URL on any failure) and use it in `POST` when no title is supplied, without blocking or failing the save (FR-003) (depends on T010)
- [X] T012 [US1] Add the "Add bookmark" form in `public/index.html` and wire it in `public/app.js`: submit the URL, prepend the new bookmark to the list, preserve typed input and show the error message on 400, and show a warning on 409 (depends on T008, T010)

**Checkpoint**: User Story 1 is fully functional — the MVP is demonstrable.

---

## Phase 4: User Story 2 - Browse, search, and open (Priority: P2)

**Goal**: A person can see bookmarks newest-first, search by keyword across
title/url/note, see a clear no-results state, and open a bookmark in a new tab.

**Independent Test**: With several bookmarks saved, confirm newest-first order;
search a keyword and confirm only matches show; search a nonsense term and
confirm a "no results" message; click a bookmark and confirm it opens the
original page in a new tab.

### Tests for User Story 2

- [X] T013 [P] [US2] API test in `tests/api.test.js`: `GET /api/bookmarks` returns newest-first; `?search=` matches case-insensitively against title, url, and note; a non-matching term returns an empty array

### Implementation for User Story 2

- [X] T014 [US2] Extend `GET /api/bookmarks` in `server/routes/bookmarks.js` with an optional `search` query parameter performing a case-insensitive match against `title`, `url`, and `note` (FR-007) (depends on T007)
- [X] T015 [US2] Add a search box and a no-results message in `public/index.html`/`public/app.js`, and render each bookmark's title as a link opening the original page in a new tab (`target="_blank"` with `rel="noopener"`, FR-009) (depends on T012, T014)

**Checkpoint**: User Stories 1 and 2 both work independently.

---

## Phase 5: User Story 3 - Organize and annotate (Priority: P2)

**Goal**: A person can add tags and a note to bookmarks, filter the list by a
tag, and see the tags listed for filtering.

**Independent Test**: Add tags and a note to a few bookmarks, filter by one tag,
and confirm only bookmarks carrying that tag are shown.

### Tests for User Story 3

- [X] T016 [P] [US3] API test in `tests/api.test.js`: creating with `tags` and `note` persists them; `GET /api/tags` returns distinct in-use tag names; `GET /api/bookmarks?tag=` returns only bookmarks carrying that tag (combining with `search` when both present)

### Implementation for User Story 3

- [X] T017 [US3] Extend `POST /api/bookmarks` in `server/routes/bookmarks.js` to accept an optional `note` (FR-004) and optional `tags` array (FR-005): trim tags, upsert into `tags`, and create `bookmark_tags` join rows (depends on T010)
- [X] T018 [US3] Extend `GET /api/bookmarks` with an optional `tag` filter parameter and implement `GET /api/tags` returning distinct in-use tag names, in `server/routes/bookmarks.js` (FR-008) (depends on T014)
- [X] T019 [US3] Add tag and note inputs to the add form, render each bookmark's tags, and add a tag-filter control (populated from `GET /api/tags`) in `public/index.html`/`public/app.js`/`public/styles.css` (depends on T015, T017, T018)

**Checkpoint**: User Stories 1–3 all work independently.

---

## Phase 6: User Story 4 - Edit and delete (Priority: P3)

**Goal**: A person can edit a bookmark's title, url, tags, and note, and delete
a bookmark after a confirmation step.

**Independent Test**: Edit a saved bookmark's title and confirm it persists;
delete a bookmark, confirm the confirmation prompt, and confirm removal.

### Tests for User Story 4

- [X] T020 [P] [US4] API test in `tests/api.test.js`: `PUT /api/bookmarks/:id` updates title/url/note/tags and refreshes `updated_at`, returns 404 for unknown id and 409 when the new url duplicates a different bookmark; `DELETE /api/bookmarks/:id` returns 204 and removes it (404 for unknown id)

### Implementation for User Story 4

- [X] T021 [US4] Implement `PUT /api/bookmarks/:id` (validate url, dedupe against other bookmarks → 409, update fields including tag join rows, refresh `updated_at`, 404 if missing) and `DELETE /api/bookmarks/:id` (204 on success with cascade, 404 if missing) in `server/routes/bookmarks.js` (FR-010, FR-011) (depends on T017, T018)
- [X] T022 [US4] Add edit UI (inline or modal) and a delete action with a confirmation step in `public/index.html`/`public/app.js`, reflecting changes in the list (FR-010, FR-011) (depends on T019, T021)

**Checkpoint**: All four user stories are independently functional.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Validation and refinements spanning stories.

- [X] T023 [P] Add a Playwright `1.61.0` e2e smoke test in `tests/e2e.spec.js` covering save → list → search
- [X] T024 [P] Styling and responsiveness pass in `public/styles.css`, including long-title/long-note truncation with a way to see full text (edge case)
- [X] T025 Run the `quickstart.md` validation scenarios, including the persistence-across-restart check (FR-012, SC-005)
- [X] T026 Save review screenshot(s) under `prototypes/` and name them in the review guidance, per project conventions

---

## Dependencies & Execution Order

### Phase dependencies

- **Setup (Phase 1)**: no dependencies.
- **Foundational (Phase 2)**: depends on Setup; blocks all user stories.
- **User Stories (Phases 3–6)**: all depend on Foundational; then proceed in
  priority order P1 → P2 → P2 → P3 (or in parallel if staffed).
- **Polish (Phase 7)**: depends on the targeted user stories being complete.

### Within each user story

- Tests are written first and should fail before implementation.
- Endpoint/data changes before the UI that consumes them.
- Story complete and independently testable before moving to the next.

### Parallel opportunities

- T003 can run alongside other setup work.
- T006 is parallelizable within Foundational.
- Each story's test task ([P]) can be written in parallel with its peers.
- Because backend and frontend tasks within a story touch different files, a
  backend/frontend split is possible once the story's endpoints are defined.

---

## Implementation Strategy

### MVP first

1. Phase 1 (Setup) → 2. Phase 2 (Foundational) → 3. Phase 3 (US1 Save).
4. **STOP and VALIDATE**: test US1 independently; this is the demonstrable MVP.

### Incremental delivery

Add US2 (browse/search/open) → US3 (tags/notes) → US4 (edit/delete), validating
each independently, then Phase 7 polish and quickstart validation.

---

## Notes

- Single-user, no login (FR-015): there is no auth or user entity.
- Field constraints are quoted from data-model.md; honor them exactly.
- Keep `package-lock.json` intact; pin Playwright to `1.61.0`.
- Commit after each task or logical group.
