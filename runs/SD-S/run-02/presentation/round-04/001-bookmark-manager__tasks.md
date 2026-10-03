---

description: "Task list for Bookmark Manager implementation"
---

# Tasks: Bookmark Manager

**Input**: Design documents from `/specs/001-bookmark-manager/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/rest-api.md, quickstart.md

**Tests**: Included. plan.md and quickstart.md call for `node --test` (validation,
enrichment parsing, REST behavior) and a Playwright 1.61.0 e2e smoke. Test tasks
are scoped to each story; write them alongside the story's implementation.

**Organization**: Tasks are grouped by user story (spec.md priorities) so each
story is an independently testable increment.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: US1–US5 map to the spec's user stories
- Exact file paths are included in each task

## Path Conventions

Web application, single deployable process (per plan.md): backend in `src/`,
static frontend in `public/`, tests in `tests/`, SQLite file under `data/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and structure.

- [ ] T001 Create the project directory structure at repo root: `src/`, `src/routes/`, `public/`, `tests/unit/`, `tests/api/`, `tests/e2e/`, and `data/` (with a `.gitkeep`), per plan.md.
- [ ] T002 Initialize `package.json` at `/work/package.json` with ES modules (`"type": "module"`), scripts `start` = `node src/server.js`, `test` = `node --test tests/unit tests/api`, `test:e2e` = `playwright test`; add dependencies `express@^5`, `better-sqlite3`, `node-html-parser`; add devDependency `@playwright/test` pinned to `1.61.0`. Run `npm install` and preserve the lockfile.
- [ ] T003 [P] Add `.gitignore` at `/work/.gitignore` excluding `node_modules/` and `data/*.db*` (keep `data/.gitkeep`).
- [ ] T004 [P] Add `playwright.config.js` at `/work/playwright.config.js` targeting Chromium, `baseURL` `http://127.0.0.1:4000`, using the shared browsers at `/opt/playwright-browsers`, with `testDir` `tests/e2e`.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure every user story depends on. No story work starts until this phase is complete.

**⚠️ CRITICAL**: Blocks all user stories.

- [ ] T005 Implement the SQLite connection and schema init in `src/db.js`: open `data/bookmarks.db`, enable WAL mode, and create tables per data-model.md — `bookmarks` (`id` PK, `url` required, `normalized_url` unique, `title`, `description` nullable, `favicon_url` nullable, `preview_url` nullable, `note` nullable, `enrichment_status` one of `pending`|`done`|`failed`, `created_at`, `updated_at`), `tags` (`id` PK, `name` unique case-insensitively, non-empty after trim), and `bookmark_tags` (`bookmark_id` FK cascade-delete, `tag_id` FK, composite-unique on `(bookmark_id, tag_id)`). Add an index on `bookmarks.created_at`.
- [ ] T006 [P] Implement URL validation and normalization in `src/validation.js`: reject anything that is not an absolute `http`/`https` URL (FR-002); `normalizeUrl()` lowercases scheme+host, strips default ports and a trailing slash, and preserves path/query (research.md Decision 4). Also provide `deriveTitleFromUrl()` for the fallback title (FR-003).
- [ ] T007 Implement the Express app skeleton in `src/server.js`: create the app, mount JSON body parsing, serve `public/` statically at `/`, mount the bookmarks router under `/api`, add centralized error handling returning `{ "error": { "code", "message" } }`, and listen on `0.0.0.0:4000` (runtime env). Router file may be a stub at this point.
- [ ] T008 [P] Scaffold the REST router in `src/routes/bookmarks.js` with all routes from contracts/rest-api.md returning `501` placeholders: `GET/POST /api/bookmarks`, `GET/PATCH/DELETE /api/bookmarks/:id`, `POST /api/bookmarks/:id/refresh`, `GET /api/tags`.
- [ ] T009 Write `/work/.harness/app.json` = `{"kind":"application","port":4000,"path":"/","start_command":["npm","start"],"start_cwd":"/work"}` so the app is presentable per CLAUDE.md.

**Checkpoint**: Server boots on 4000, DB schema exists, routes respond (as stubs).

---

## Phase 3: User Story 1 - Save a bookmark with automatic enrichment (Priority: P1) 🎯 MVP

**Goal**: A user saves a URL; it persists immediately and is enriched (title, description, favicon, preview) shortly after, best-effort and non-blocking.

**Independent Test**: POST a reachable OG-tagged URL → bookmark persisted immediately (`enrichmentStatus: pending`), then enriched fields appear on a subsequent GET; POST an unreachable URL → still saved, status becomes `failed`; restart server → bookmark remains.

- [ ] T010 [P] [US1] Implement best-effort enrichment in `src/enrichment.js`: `fetch` the URL with a ~5s timeout and capped response size; parse with `node-html-parser` to extract title (`og:title` → `<title>` → fallback), description (`og:description` → `meta[name=description]`), preview (`og:image`, resolved to absolute), favicon (`<link rel~=icon>` → `/favicon.ico`, resolved to absolute), per research.md Decision 3. Never throw to the caller — return partial results and signal failure.
- [ ] T011 [US1] Implement repository create + read in `src/repository.js`: `createBookmark({url, title, note, tags})` computes `normalized_url`, inserts with `enrichment_status='pending'`, sets `created_at`/`updated_at`, and returns the row; on `normalized_url` collision throw a typed duplicate error carrying the existing row (used by US4/US2 edit routing); `getBookmark(id)` returns a bookmark with its tag names; `updateEnrichment(id, fields, status)` fills enrichment columns without overwriting user-edited values.
- [ ] T012 [US1] Wire `POST /api/bookmarks` in `src/routes/bookmarks.js`: validate URL (400 `invalid_url`), create the bookmark, return `201` immediately, then kick off enrichment asynchronously that calls `updateEnrichment` on completion/failure (FR-007, FR-008). On duplicate, return `409` `duplicate` with `existing` (FR-009).
- [ ] T013 [US1] Wire `GET /api/bookmarks/:id` in `src/routes/bookmarks.js` to return the bookmark (reflecting enrichment) or `404 not_found`.
- [ ] T014 [P] [US1] Unit test URL validation/normalization in `tests/unit/validation.test.js` (valid/invalid schemes, trailing-slash + default-port normalization equivalence).
- [ ] T015 [P] [US1] Unit test metadata parsing in `tests/unit/enrichment.test.js` against saved HTML fixtures (OG present, only `<title>`, none → fallback; relative image/favicon resolved to absolute).
- [ ] T016 [US1] API test in `tests/api/bookmarks-create.test.js` against a temp DB: create returns 201 with `pending`; invalid URL → 400; enrichment result reflected on subsequent GET; persistence across a fresh DB handle.

**Checkpoint**: Saving with enrichment works end-to-end via the API and persists.

---

## Phase 4: User Story 2 - Browse and open saved bookmarks (Priority: P1)

**Goal**: See all saved bookmarks (title, address, favicon, tags, preview) newest-first, open one in a new tab, and see a friendly empty state when there are none. Delivers, with US1, the MVP.

**Independent Test**: With several bookmarks saved, the list renders newest-first with details; clicking opens the original page in a new tab; with none saved, the empty state shows.

- [ ] T017 [US2] Implement `listBookmarks({q, tag})` in `src/repository.js` returning bookmarks newest-first (`created_at` DESC, FR-017) with tag names; `q`/`tag` may be ignored here and fully implemented in US5 (leave the parameters wired).
- [ ] T018 [US2] Wire `GET /api/bookmarks` in `src/routes/bookmarks.js` to return `{ "bookmarks": [...] }` (FR-005).
- [ ] T019 [US2] Build the frontend shell in `public/index.html` and `public/styles.css`: desktop-first layout, an add-bookmark input/form, a list container, and an empty-state block; readable on smaller screens.
- [ ] T020 [US2] Implement `public/app.js` core: on load, fetch and render the bookmark list (title, address, favicon, tags, preview image with placeholder fallback); each item's link opens in a new tab (`target="_blank" rel="noopener"`); render the empty state when the list is empty (FR-006, FR-015). Set `data-harness-ready="true"` on a visible element only after the initial list/empty-state has rendered.
- [ ] T021 [US2] Implement the add-bookmark flow in `public/app.js`: submit to `POST /api/bookmarks`, then refresh the list; poll or re-fetch the new bookmark so enriched fields appear once ready; surface a clear message for `400 invalid_url`.
- [ ] T022 [US2] API test in `tests/api/bookmarks-list.test.js`: list is newest-first and includes tag names; empty DB returns an empty array.

**Checkpoint**: MVP complete — save, enrich, browse, and open all work in the UI.

---

## Phase 5: User Story 3 - Organize with tags and notes (Priority: P2)

**Goal**: Add/edit/remove user tags and a free-text note on a bookmark, with tag-reuse suggestions.

**Independent Test**: Add two tags and a note, reload → they persist; type a tag → existing tags are suggested; remove a tag → it disappears.

- [ ] T023 [US3] Implement tag persistence in `src/repository.js`: `setTags(bookmarkId, names)` trims and rejects empty names, upserts tags case-insensitively (reuse existing, FR-011), and replaces the bookmark's associations; `listTagNames(prefix?)` returns distinct existing tag names for suggestions.
- [ ] T024 [US3] Wire `GET /api/tags` (optional `prefix`) in `src/routes/bookmarks.js` to return `{ "tags": [...] }` (FR-011, FR-016).
- [ ] T025 [US3] Extend `public/app.js` and `public/index.html`: tag input with suggestions from `GET /api/tags`, a note field, and rendering of tags/note on each bookmark; adding/removing tags and editing the note (wired through the edit flow in US4).
- [ ] T026 [US3] API test in `tests/api/tags.test.js`: tags are reused case-insensitively (no duplicates), `GET /api/tags` returns distinct names, `prefix` filters suggestions.

**Checkpoint**: Bookmarks can be organized with tags and notes; suggestions work.

---

## Phase 6: User Story 4 - Edit and delete bookmarks (Priority: P2)

**Goal**: Edit title/address/description/tags/note (overriding auto-filled values), refresh enrichment, and delete with confirmation. Also completes duplicate→edit routing.

**Independent Test**: Edit a bookmark and confirm persistence and that manual values override auto-filled ones; refresh re-runs enrichment; delete asks for confirmation (cancel keeps it, confirm removes it permanently).

- [ ] T027 [US4] Implement `updateBookmark(id, fields)` and `deleteBookmark(id)` in `src/repository.js`: update any of `url` (re-validate + recompute `normalized_url`, 409 on collision with a different bookmark), `title`, `description`, `note`, `tags`; mark user-edited fields so enrichment refresh won't overwrite them; delete cascades associations.
- [ ] T028 [US4] Wire `PATCH /api/bookmarks/:id` (200 / 400 `invalid_url` / 409 `duplicate` / 404) and `DELETE /api/bookmarks/:id` (204 / 404) in `src/routes/bookmarks.js` (FR-012, FR-014).
- [ ] T029 [US4] Wire `POST /api/bookmarks/:id/refresh` in `src/routes/bookmarks.js`: return `202` and re-run enrichment asynchronously without overwriting user-edited fields (FR-013).
- [ ] T030 [US4] Extend `public/app.js`: an edit view/modal for title/address/description/tags/note (save via PATCH), a "refresh details" action (POST refresh), and a delete action with a confirmation step (cancel leaves it). Handle the `409 duplicate` from creating an existing URL by opening that bookmark in the edit view (FR-009).
- [ ] T031 [US4] API test in `tests/api/bookmarks-edit.test.js`: PATCH updates and persists; manual edits survive a refresh; changing URL to an existing one → 409; DELETE removes and returns 404 afterward; duplicate create returns 409 with `existing`.

**Checkpoint**: Full lifecycle (create/enrich/browse/organize/edit/refresh/delete) works, including duplicate→edit.

---

## Phase 7: User Story 5 - Find bookmarks quickly (Priority: P3)

**Goal**: Search across title, address, description, note, and tags, and filter by a selected tag.

**Independent Test**: Search a keyword found only in a note/description/tag → only matches show; filter by a tag; clear to restore the full list; a no-match search shows a clear "no results" message.

- [ ] T032 [US5] Complete `listBookmarks({q, tag})` in `src/repository.js`: `q` performs a case-insensitive substring match across `title`, `url`, `description`, `note`, and associated tag names; `tag` restricts to bookmarks carrying that tag; both combine; results stay newest-first (FR-016, SC-003).
- [ ] T033 [US5] Extend `public/app.js` and `public/index.html`: a search box (debounced) driving `GET /api/bookmarks?q=`, clickable tag chips driving `?tag=`, a clear control that restores the full list, and a "no results" message for empty result sets.
- [ ] T034 [US5] API test in `tests/api/bookmarks-search.test.js`: matches by note/description/tag/title/url; tag filter; combined q+tag; empty result set for no match.

**Checkpoint**: All five user stories are independently functional.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: End-to-end validation and finishing touches across stories.

- [ ] T035 [P] Playwright e2e smoke in `tests/e2e/bookmarks.spec.js`: save → list → add tag/note → edit → search across the running app (Chromium, `@playwright/test@1.61.0`).
- [ ] T036 [P] Verify long titles/addresses/notes/many tags truncate visually and large/missing preview images fall back to a placeholder without breaking layout in `public/styles.css` (spec edge cases).
- [ ] T037 Run the quickstart.md validation scenarios against `npm start`, confirm `data-harness-ready` appears after initial load, and confirm bookmarks survive a server restart (FR-004, SC-002).
- [ ] T038 [P] Add a short `README.md` at `/work/README.md` documenting run (`npm start` on port 4000), test commands, and the local `data/` store.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies.
- **Foundational (Phase 2)**: Depends on Setup. BLOCKS all user stories.
- **User Stories (Phases 3–7)**: All depend on Foundational.
  - US1 (P1) and US2 (P1) form the MVP; US2's UI consumes US1's create flow.
  - US3, US4, US5 build on the US1/US2 base and can otherwise proceed in priority order.
- **Polish (Phase 8)**: Depends on the desired stories being complete.

### User Story Dependencies

- **US1 (P1)**: After Foundational. No dependency on other stories.
- **US2 (P1)**: After Foundational; consumes US1's `POST` and enriched fields for its list/add UI.
- **US3 (P2)**: After Foundational; tag/note edit surfaces integrate via US4's edit flow.
- **US4 (P2)**: After Foundational; also finalizes duplicate→edit routing (uses US1's typed duplicate error).
- **US5 (P3)**: After Foundational; completes the `listBookmarks` filters stubbed in US2.

### Within Each User Story

- Repository/data layer before routes; routes before UI wiring.
- Tests can be written in parallel with (or just after) the code they cover; `[P]` test tasks touch separate files.

### Parallel Opportunities

- Setup: T003, T004 in parallel.
- Foundational: T006 and T008 in parallel with T005/T007 respectively (different files).
- US1: T014 and T015 in parallel (separate test files); T010 in parallel with repository work.
- Polish: T035, T036, T038 in parallel.

---

## Parallel Example: User Story 1

```bash
# Enrichment module and unit tests touch separate files:
Task: "Implement enrichment in src/enrichment.js"          # T010
Task: "Unit test validation in tests/unit/validation.test.js"   # T014
Task: "Unit test enrichment in tests/unit/enrichment.test.js"   # T015
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2)

1. Phase 1: Setup → 2. Phase 2: Foundational → 3. Phase 3 (US1) → 4. Phase 4 (US2).
5. **STOP and VALIDATE**: save + enrich + browse + open works; demo the MVP.

### Incremental Delivery

- MVP (US1+US2) → add US3 (tags/notes) → add US4 (edit/delete/refresh) → add US5 (search/filter) → Polish. Each increment is independently testable and adds value without breaking prior stories.

---

## Notes

- `[P]` = different files, no incomplete dependencies.
- `[Story]` labels map tasks to spec user stories for traceability.
- Enrichment is always best-effort and must never block or fail a save (FR-008).
- Commit after each task or logical group; validate at each checkpoint.
