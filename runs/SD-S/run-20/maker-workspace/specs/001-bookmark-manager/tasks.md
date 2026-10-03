---

description: "Task list for Bookmark Manager implementation"
---

# Tasks: Bookmark Manager

**Input**: Design documents from `/specs/001-bookmark-manager/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api.md, quickstart.md

**Tests**: Included — the plan defines a testing strategy (`node:test` API/unit +
Playwright E2E). Test tasks are marked and precede the implementation they cover.

**Organization**: Tasks are grouped by user story (US1–US4) so each is
independently implementable and testable.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: US1–US4 (setup/foundational/polish tasks carry no story label)
- All paths are relative to repo root `/work/`

## Path Conventions

Single web-application project rooted at `/work` (server + static frontend +
tests), per plan.md "Project Structure".

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and structure

- [X] T001 Create the directory structure per plan.md: `server/`, `public/`, `data/`, `tests/api/`, `tests/e2e/` under `/work`
- [X] T002 Create `/work/package.json` with `"type": "module"`, Node 24 engine, and scripts `start` (`node server/index.js`), `test` (`node --test tests/api`), `test:e2e` (`playwright test`); add dependency `express`, `better-sqlite3`, and devDependency `@playwright/test` pinned to `1.61.0`
- [X] T003 Run `npm install` in `/work` to generate `package-lock.json`; confirm `better-sqlite3` native build succeeds and the pinned Playwright browser (1.61.0) is used from `/opt/playwright-browsers` (do not download another revision)
- [X] T004 [P] Create `/work/.gitignore` (ignore `node_modules/`, `data/*.db`) and `/work/playwright.config.js` targeting `http://127.0.0.1:4000`, Chromium only

**Checkpoint**: Project installs cleanly; scripts resolve.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core server, storage, and safe-rendering infrastructure that every user story depends on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T005 Implement SQLite connection and schema init in `server/db.js`: open `data/bookmarks.db`, create table `bookmarks(id INTEGER PRIMARY KEY AUTOINCREMENT, url TEXT NOT NULL, title TEXT NOT NULL, tags_json TEXT NOT NULL DEFAULT '[]', created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`, and an index on `url` for duplicate detection (per data-model.md storage representation)
- [X] T006 Implement URL normalization + validation helper in `server/bookmarks.js`: prepend `https://` when no scheme present (VR-2), parse with WHATWG `URL`, accept only `http`/`https` else signal `invalid_url` (VR-1); title defaulting to normalized url when blank/whitespace (VR-3, max 2048 chars stored full); tag normalization (trim, lowercase, drop empties, dedupe — VR-4)
- [X] T007 Create Express app in `server/app.js`: JSON body parsing, static serving of `public/`, restrictive `Content-Security-Policy` header on all responses (FR-014), and a JSON 404/error handler emitting `{ "error", "message" }` (contract "Cross-cutting")
- [X] T008 Create server entry `server/index.js`: initialize db, mount app, listen on `0.0.0.0:4000`
- [X] T009 [P] Create static frontend shell `public/index.html`, `public/styles.css`, and `public/app.js`: root container, empty `<main>` regions for form/list, and a bootstrap that sets `data-harness-ready="true"` on the root element only after the initial bookmark load completes (including empty state) — render all user content via `textContent`/DOM nodes, never `innerHTML` (FR-014)

**Checkpoint**: Server starts, serves an empty page that reaches ready state; DB schema exists.

---

## Phase 3: User Story 1 - Save a bookmark (Priority: P1) 🎯 MVP

**Goal**: A user can save a web address (with optional title/tags); it is validated, normalized, persisted, and duplicates are warned about without blocking.

**Independent Test**: POST a valid address and confirm it is stored & returned; submit `example.com` and confirm normalization to `https://example.com`; submit an invalid entry and confirm rejection.

### Tests for User Story 1

- [X] T010 [P] [US1] API tests in `tests/api/validation.test.js`: valid create → 201 with normalized url; blank title → title defaults to url (VR-3); `example.com` → `https://example.com` (VR-2); `not a url` → 400 `invalid_url` (FR-002); duplicate url → 201 with `warning: "duplicate_url"` (FR-013); tags normalized/deduped (VR-4)

### Implementation for User Story 1

- [X] T011 [US1] Implement `createBookmark(input)` in `server/bookmarks.js`: apply validation/normalization from T006, set `created_at`/`updated_at` (ISO UTC), detect existing normalized url for non-blocking `duplicate_url` warning (VR-6/FR-013), insert row, return the bookmark representation (contract "Bookmark representation")
- [X] T012 [US1] Add `POST /api/bookmarks` route in `server/routes.js` (wired in `server/app.js`): 201 with `{ bookmark, warning? }`, 400 `{ error: "invalid_url", message }` on failure (contract POST /api/bookmarks)
- [X] T013 [US1] Build the save form in `public/index.html` + `public/app.js`: URL field (required), optional title, optional comma-separated tags; submit via `fetch` POST; on success prepend to list and show duplicate warning inline when present; on 400 show the error message; mirror client-side URL check for fast feedback

**Checkpoint**: Saving works end to end and persists across restart.

---

## Phase 4: User Story 2 - Browse and open saved bookmarks (Priority: P1) 🎯 MVP

**Goal**: A user sees all bookmarks newest-first and can open one in a new tab; a friendly empty state shows when none exist.

**Independent Test**: With saved bookmarks, GET the list newest-first; load the page and confirm rendering + open-in-new-tab; delete all and confirm empty state.

### Tests for User Story 2

- [X] T014 [P] [US2] API test in `tests/api/crud.test.js` (list portion): `GET /api/bookmarks` returns `{ bookmarks, total }` ordered `created_at DESC` (FR-005); empty collection returns empty array with total 0 (FR-012)
- [X] T015 [P] [US2] E2E test in `tests/e2e/save-browse.spec.js`: save a bookmark then reload → appears in list; clicking it opens target in a new tab (`target="_blank"`); empty state visible when no bookmarks (US1+US2 MVP journey)

### Implementation for User Story 2

- [X] T016 [US2] Implement `listBookmarks({ q, tag })` in `server/bookmarks.js` (list-only for now, filters added in US4): return rows ordered `created_at DESC` plus total (FR-005)
- [X] T017 [US2] Add `GET /api/bookmarks` route in `server/routes.js` returning `{ bookmarks, total }` (contract GET /api/bookmarks)
- [X] T018 [US2] Render the bookmark list in `public/app.js`: title as text, address shown and linked via a safe anchor (`href` = stored url, `target="_blank"`, `rel="noopener noreferrer"`), newest first; show the friendly empty state when the list is empty (FR-006, FR-012); ensure initial load sets `data-harness-ready`

**Checkpoint**: MVP complete — save, browse, open, empty state all work.

---

## Phase 5: User Story 3 - Edit and delete bookmarks (Priority: P2)

**Goal**: A user can edit a bookmark's title/address/tags and delete a bookmark behind a confirmation.

**Independent Test**: Edit a title and confirm persistence after reload; delete with confirm and confirm removal; cancel a delete and confirm no change.

### Tests for User Story 3

- [X] T019 [P] [US3] API tests in `tests/api/crud.test.js` (edit/delete portion): `PUT /api/bookmarks/{id}` updates fields with same validation/normalization and refreshes `updated_at` (FR-007), returns 404 `not_found` for missing id; `DELETE /api/bookmarks/{id}` → 204, then 404 on repeat (FR-008)

### Implementation for User Story 3

- [X] T020 [US3] Implement `updateBookmark(id, input)` and `deleteBookmark(id)` in `server/bookmarks.js`: partial update of `url`/`title`/`tags` with reused validation/normalization, refresh `updated_at`; return not-found signal when id absent (data-model lifecycle)
- [X] T021 [US3] Add `PUT /api/bookmarks/{id}` and `DELETE /api/bookmarks/{id}` routes in `server/routes.js`: 200 with updated bookmark / 204 no content; 400 `invalid_url`; 404 `not_found` (contract PUT & DELETE)
- [X] T022 [US3] Add edit and delete UI in `public/app.js` + `public/index.html`: per-bookmark edit (inline or modal) submitting a PUT and refreshing the row; delete control that requires an explicit confirmation before issuing DELETE, and leaves the bookmark unchanged if cancelled (FR-008)

**Checkpoint**: Full create/read/update/delete works and persists.

---

## Phase 6: User Story 4 - Organize and find bookmarks (Priority: P3)

**Goal**: A user can tag bookmarks, filter the list by a tag, and search by title/address text; empty results are clearly messaged; tag filter + search combine with AND.

**Independent Test**: Tag two bookmarks differently, filter by one tag → only matches; type part of a title → list narrows; unmatched term → "no matching bookmarks" with a clear control; clearing restores the full list.

### Tests for User Story 4

- [X] T023 [P] [US4] API tests in `tests/api/search-filter.test.js`: `GET /api/bookmarks?q=` case-insensitive substring over title+url (FR-011); `?tag=` returns only bookmarks carrying that normalized tag (FR-010); `q`+`tag` combine with AND; `GET /api/tags` returns distinct sorted tags (contract GET /api/tags)
- [X] T024 [P] [US4] E2E test in `tests/e2e/edit-delete-search.spec.js`: covers the US3 edit/delete journey and the US4 tag-filter + search journeys including the "no matching bookmarks" state and clearing filters

### Implementation for User Story 4

- [X] T025 [US4] Extend `listBookmarks({ q, tag })` in `server/bookmarks.js` to apply case-insensitive title/url substring match and exact normalized-tag membership, combined with AND (FR-010, FR-011)
- [X] T026 [US4] Implement `listTags()` in `server/bookmarks.js` and add `GET /api/tags` route in `server/routes.js` returning distinct sorted tags (FR-010, contract GET /api/tags); wire `q`/`tag` query params into `GET /api/bookmarks`
- [X] T027 [US4] Add search box and tag-filter control to `public/index.html` + `public/app.js`: re-query the API as the user types/selects, render the "no matching bookmarks" state distinct from the empty-collection state, and provide a clear/reset action (FR-011, FR-012)

**Checkpoint**: All four user stories independently functional.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Validation, hardening, and review wiring

- [X] T028 [P] Handle edge cases from spec end-to-end: long title/address truncated in display with full value accessible, special characters rendered safely, deleting the last bookmark returns the empty state (spec Edge Cases)
- [X] T029 Run `npm test` and `npm run test:e2e`; fix failures until green (quickstart "Automated validation")
- [X] T030 Manually validate every user story per `quickstart.md` against `http://127.0.0.1:4000`
- [X] T031 Write `/work/.harness/app.json` = `{"kind":"application","port":4000,"path":"/","start_command":["npm","start"],"start_cwd":"/work"}`; ensure any manually started server is stopped so the broker starts the declared command fresh; confirm the app reaches `data-harness-ready` for client review at `http://maker:4000`

**Checkpoint**: Feature validated and ready for the client review gate.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies
- **Foundational (Phase 2)**: depends on Setup — BLOCKS all user stories
- **User Stories (Phases 3–6)**: all depend on Foundational
  - US1 and US2 together form the MVP (both P1); US2 depends on US1 existing data to be meaningful but is independently testable via seeded creates
  - US3 (P2) and US4 (P3) build on the list/create foundation; each independently testable
- **Polish (Phase 7)**: depends on the targeted user stories being complete

### Within Each User Story

- Tests before implementation; data-access (`server/bookmarks.js`) before routes before UI

### Parallel Opportunities

- T004 in Setup is [P]
- T009 (frontend shell) is [P] against server foundational work
- Each story's test task ([P]) can be written alongside its start
- After Foundational, different developers could take US3 and US4 in parallel

---

## Parallel Example: User Story 1

```bash
# Write the US1 API test first, then implement to green:
Task: "API tests in tests/api/validation.test.js"   # T010 [P]
# Then implementation in dependency order:
Task: "createBookmark in server/bookmarks.js"        # T011
Task: "POST /api/bookmarks route in server/routes.js"# T012
Task: "Save form in public/app.js"                   # T013
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2)

1. Phase 1 Setup → 2. Phase 2 Foundational → 3. Phase 3 (US1 Save) → 4. Phase 4 (US2 Browse/Open)
5. **STOP and VALIDATE**: save, browse, open, empty state — this is the demoable MVP

### Incremental Delivery

1. Setup + Foundational → foundation ready
2. US1 + US2 → MVP (save/browse/open)
3. US3 → edit/delete
4. US4 → tags/search
5. Polish → tests green + review wiring

---

## Notes

- [P] = different files, no incomplete dependencies
- Server-side validation is authoritative; the client mirrors it only for fast feedback
- User content is always rendered as text (FR-014) — no `innerHTML`
- Commit after each task or logical group; stop at any checkpoint to validate a story
