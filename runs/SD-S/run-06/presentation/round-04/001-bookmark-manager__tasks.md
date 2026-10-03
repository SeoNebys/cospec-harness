---
description: "Task list for Bookmark Manager implementation"
---

# Tasks: Bookmark Manager

**Input**: Design documents from `/specs/001-bookmark-manager/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api.md, quickstart.md

**Tests**: The spec/plan call for API contract + unit tests and one end-to-end
flow (Testing section of plan.md). Test tasks are therefore included.

**Organization**: Tasks are grouped by user story. Each user-story phase is an
independently testable increment.

## Path conventions

Single Node web-application project (per plan.md Structure Decision):
`src/` (server, db, logic, static UI), `tests/`, `data/` (runtime SQLite).

---

## Phase 1: Setup

- [ ] T001 Initialize Node project at repo root: create `package.json` (ES modules, `"type": "module"`) with scripts `start` (`node src/server.js`) and `test` (`node --test`) in /work/package.json
- [ ] T002 Add and pin dependencies in /work/package.json: `express`, `better-sqlite3`, `node-html-parser`, and devDependency `playwright@1.61.0`; run install preserving the lockfile
- [ ] T003 [P] Create source and test directory skeleton: /work/src/, /work/src/public/, /work/tests/contract/, /work/tests/unit/, /work/tests/e2e/
- [ ] T004 [P] Add /work/.gitignore ignoring `node_modules/` and `data/`
- [ ] T005 [P] Add Playwright config pinned to 1.61.0 using shared browsers at /opt/playwright-browsers in /work/playwright.config.js

**Checkpoint**: Project installs and `npm start` can be wired up next.

---

## Phase 2: Foundational (blocking prerequisites)

**Purpose**: Shared infrastructure every user story depends on.

- [ ] T006 Implement SQLite connection + schema init in /work/src/db.js: create `data/bookmarks.db` if absent; create tables per data-model.md — `bookmarks` (id INTEGER PK autoincrement; address TEXT NOT NULL; normalized_key TEXT UNIQUE NOT NULL; title TEXT; description TEXT; icon_url TEXT; created_at TEXT; updated_at TEXT), `tags` (id INTEGER PK autoincrement; name TEXT UNIQUE NOT NULL, case-insensitive via `COLLATE NOCASE`), `bookmark_tags` (bookmark_id INTEGER FK→bookmarks.id ON DELETE CASCADE; tag_id INTEGER FK→tags.id ON DELETE CASCADE; PRIMARY KEY(bookmark_id, tag_id)); enable `PRAGMA foreign_keys = ON`
- [ ] T007 [P] Implement address normalization + validation in /work/src/bookmarks.js: `validateAddress` accepts only well-formed http/https URLs (FR-002); `normalizeKey` lowercases scheme+host and strips one trailing slash from the path (FR-015)
- [ ] T008 Implement Express app bootstrap in /work/src/server.js: create app, JSON body parsing, serve /work/src/public as static, mount `/api` router (empty for now), listen on host `0.0.0.0` port `4000`
- [ ] T009 [P] Create base UI shell in /work/src/public/index.html and /work/src/public/styles.css: header, add-bookmark form region, search box region, tag-filter region, and bookmark list container; readable truncation styles for long title/description/address (FR-016)
- [ ] T010 [P] Create frontend API client + render scaffolding in /work/src/public/app.js: helper to call the REST API and a `renderList(bookmarks)` stub; set `data-harness-ready="true"` on the main element once the initial list (or empty state) has loaded

**Checkpoint**: Server starts, serves an empty UI, DB schema exists — user stories can now be built.

---

## Phase 3: User Story 1 - Save with auto-collected details (Priority: P1) 🎯 MVP

**Goal**: Save a bookmark by address; auto-collect title/description/icon
best-effort; save returns immediately and never fails on collection.

**Independent test**: Add a valid address → bookmark appears with collected
details; add an unreachable address → still saves with address-derived title.

- [ ] T011 [P] [US1] Unit tests for normalization/validation in /work/tests/unit/normalize.test.js: valid/invalid addresses (FR-002); `Example.com/` and `example.com` produce the same normalized_key (FR-015)
- [ ] T012 [P] [US1] Unit tests for metadata extraction in /work/tests/unit/metadata.test.js: parse title, description (meta description / og:description), icon (link rel=icon / og:image); fallback to address-derived title and empty description/icon on failure (FR-004)
- [ ] T013 [US1] Implement metadata collection in /work/src/metadata.js: `fetchMetadata(address)` fetches the page with native `fetch`, parses `<head>` with node-html-parser, returns {title, description, iconUrl}; on any error resolve to empty fields (never throw) (FR-003/FR-004)
- [ ] T014 [US1] Implement `createBookmark(address, tags?)` in /work/src/bookmarks.js: validate address (FR-002); compute normalized_key; insert with address-derived title, created_at/updated_at now; return the new bookmark immediately (non-blocking) (FR-001/SC-001)
- [ ] T015 [US1] Wire non-blocking enrichment in /work/src/bookmarks.js: after create, call `fetchMetadata` and update the record's title/description/icon_url when it resolves, without blocking the create response (research Decision 6, FR-003/FR-004)
- [ ] T016 [US1] Implement `POST /api/bookmarks` in /work/src/server.js per contracts/api.md: 201 with created bookmark; 400 on empty/malformed address (FR-002)
- [ ] T017 [US1] Implement add-bookmark form behavior in /work/src/public/app.js: submit address → POST → prepend to list with address-derived title, then refresh the entry when enrichment lands; show validation error inline preserving typed input (FR-002)
- [ ] T018 [US1] Contract test for POST /api/bookmarks in /work/tests/contract/api.test.js: 201 shape, 400 on invalid address

**Checkpoint**: A user can save bookmarks and see details fill in — MVP usable.

---

## Phase 4: User Story 2 - Browse and open saved bookmarks (Priority: P1)

**Goal**: List all saved bookmarks newest-first; open one in a new tab; clear
empty state.

**Independent test**: With several saved, list shows newest first; clicking opens
the page in a new tab and the bookmark remains; no bookmarks → empty state.

- [ ] T019 [US2] Implement `listBookmarks({search?, tag?})` in /work/src/bookmarks.js (base list path only here): return all bookmarks with their tags ordered by created_at DESC (FR-006)
- [ ] T020 [US2] Implement `GET /api/bookmarks` in /work/src/server.js per contracts/api.md: return `{bookmarks:[...]}` (empty array valid) (FR-006/FR-008)
- [ ] T021 [US2] Implement `GET /api/bookmarks/:id` in /work/src/server.js: 200 with bookmark or 404
- [ ] T022 [US2] Implement list rendering in /work/src/public/app.js: render title, address, description, icon, tags; each entry opens the original address in a new tab (target=_blank rel=noopener) without deleting it (FR-007); render empty state when none (FR-008)
- [ ] T023 [P] [US2] Contract test for GET /api/bookmarks and GET /api/bookmarks/:id in /work/tests/contract/api.test.js: list shape + empty state; 404 for missing id

**Checkpoint**: Save + browse + open — the two-P1 core loop works.

---

## Phase 5: User Story 3 - Organize bookmarks with tags (Priority: P1)

**Goal**: Attach multiple reusable tags (no duplicates); filter list by a tag.

**Independent test**: Add multiple tags incl. a reused one → no duplicate tag,
persists after reload; filter by a tag shows only its bookmarks; clearing restores all.

- [ ] T024 [US3] Implement tag upsert + association in /work/src/bookmarks.js: `setTags(bookmarkId, names)` trims/ignores empties, upserts tags case-insensitively (reuse existing, no duplicate — FR-009), replaces the bookmark's associations
- [ ] T025 [US3] Extend `createBookmark` and add tags to responses in /work/src/bookmarks.js: apply provided tags on create; include `tags` array in bookmark output
- [ ] T026 [US3] Implement `listTags()` in /work/src/bookmarks.js: return distinct tag names currently associated with at least one bookmark (exclude orphan tags) (FR-010, edge case)
- [ ] T027 [US3] Implement `GET /api/tags` in /work/src/server.js per contracts/api.md
- [ ] T028 [US3] Add tag filtering to `listBookmarks` in /work/src/bookmarks.js: when `tag` provided, return only bookmarks carrying that tag (FR-010)
- [ ] T029 [US3] Support `tag` query param in `GET /api/bookmarks` in /work/src/server.js (FR-010)
- [ ] T030 [US3] Implement tag input + reuse suggestions in the add/edit form in /work/src/public/app.js: enter multiple tags, suggest existing tags from `GET /api/tags` (FR-009)
- [ ] T031 [US3] Implement tag-filter control in /work/src/public/app.js: select a tag to filter the list, and a clear action to restore all (FR-010)
- [ ] T032 [P] [US3] Contract test for GET /api/tags and tag-filtered GET /api/bookmarks in /work/tests/contract/api.test.js

**Checkpoint**: Bookmarks can be organized and filtered by tag.

---

## Phase 6: User Story 4 - Find bookmarks by search (Priority: P1)

**Goal**: Case-insensitive search across title, description, address, tags;
combinable with tag filter.

**Independent test**: Type a term in any case → matches across fields incl. tags;
"NEWS" matches "news"; no-match state; clearing restores all.

- [ ] T033 [US4] Add case-insensitive search to `listBookmarks` in /work/src/bookmarks.js: when `search` provided, match term (lowercased) against title, description, address, or any associated tag name; combine with an active tag filter (both narrow) (FR-011)
- [ ] T034 [US4] Support `search` query param in `GET /api/bookmarks` in /work/src/server.js (FR-011)
- [ ] T035 [US4] Implement search box behavior in /work/src/public/app.js: query as the user types, show a clear no-match state, and restore full list when cleared (FR-011)
- [ ] T036 [P] [US4] Contract test for search in /work/tests/contract/api.test.js: case-insensitive match across fields incl. tags; combined search+tag

**Checkpoint**: All P1 retrieval capabilities complete.

---

## Phase 7: User Story 5 - Edit and delete bookmarks (Priority: P1)

**Goal**: Edit address/title/description (re-validated); delete with confirmation.

**Independent test**: Edit address+title+description → persists after reload;
invalid edited address rejected keeping old value; delete with confirm → gone;
cancel → unchanged.

- [ ] T037 [US5] Implement `updateBookmark(id, {address?, title?, description?, tags?})` in /work/src/bookmarks.js: re-validate + re-normalize edited address (FR-012); update updated_at (keep created_at); replace tags if provided; on address normalizing to a different existing bookmark, signal conflict (contract 409)
- [ ] T038 [US5] Implement `deleteBookmark(id)` in /work/src/bookmarks.js: delete row; cascade removes tag associations (FR-013)
- [ ] T039 [US5] Implement `PUT /api/bookmarks/:id` in /work/src/server.js per contracts/api.md: 200 updated; 400 invalid address (keep previous); 409 conflict with existingId; 404 missing
- [ ] T040 [US5] Implement `DELETE /api/bookmarks/:id` in /work/src/server.js: 204 on success, 404 missing (FR-013)
- [ ] T041 [US5] Implement edit UI in /work/src/public/app.js: edit form for address/title/description/tags; inline error on invalid address preserving previous value (FR-012)
- [ ] T042 [US5] Implement delete UI in /work/src/public/app.js: delete action with a confirmation step; cancel leaves the bookmark unchanged (FR-013)
- [ ] T043 [P] [US5] Contract test for PUT and DELETE in /work/tests/contract/api.test.js: update success + 400/409/404; delete 204/404

**Checkpoint**: Full P1 collection management complete.

---

## Phase 8: User Story 6 - Saving an existing address opens it for update (Priority: P2)

**Goal**: Re-saving a known address returns the existing bookmark for editing
instead of creating a duplicate.

**Independent test**: Save an address, save it again (varying case/trailing slash)
→ app opens the existing bookmark for update; no duplicate created.

- [ ] T044 [US6] Update `createBookmark` in /work/src/bookmarks.js: before insert, look up by normalized_key; if found, return the existing bookmark flagged as existing rather than inserting (FR-014/FR-015)
- [ ] T045 [US6] Update `POST /api/bookmarks` in /work/src/server.js: return 200 `{bookmark, existing:true}` when the normalized address already exists (contracts/api.md, SC-006)
- [ ] T046 [US6] Update add-form behavior in /work/src/public/app.js: on `existing:true`, open the existing bookmark in the edit form for update instead of adding a duplicate (FR-014)
- [ ] T047 [P] [US6] Contract test for duplicate save in /work/tests/contract/api.test.js: re-POST same address (case/trailing-slash variants) → 200 existing:true, no duplicate

**Checkpoint**: Duplicate-save UX complete.

---

## Phase 9: Polish & cross-cutting

- [ ] T048 [P] End-to-end Playwright flow in /work/tests/e2e/flow.spec.js: save → appears with details → add/reuse tags → filter by tag → search (case-insensitive) → edit → delete → re-save existing opens for update (quickstart.md scenarios)
- [ ] T049 [P] Verify list readability for long titles/descriptions/addresses and truncation in /work/src/public/styles.css (FR-016)
- [ ] T050 Write /work/.harness/app.json: `{"kind":"application","port":4000,"path":"/","start_command":["npm","start"],"start_cwd":"/work"}`
- [ ] T051 Run quickstart.md validation end-to-end (npm test, playwright, manual scenarios); confirm persistence across restart (SC-002) and no-duplicate on re-save (SC-006)

---

## Dependencies & execution order

- **Setup (Phase 1)** → **Foundational (Phase 2)** block everything.
- **User stories (Phases 3–8)** depend on Foundational; within the P1 set they
  share `src/bookmarks.js` and `src/server.js`, so implement in order US1 → US2 →
  US3 → US4 → US5, then US6 (P2). Tasks marked [P] touch separate files and can run
  in parallel within their phase.
- **Polish (Phase 9)** depends on all targeted stories being complete.

### MVP scope

**US1 + US2** (both P1) form the minimum viable product: save a bookmark with
auto-collected details and browse/open the saved list. US3 (tags) and US4
(search) complete the organize/retrieve P1 set; US5 completes P1 management; US6
(P2) is the duplicate-save refinement.

### Parallel opportunities

- Setup: T003, T004, T005 in parallel.
- Foundational: T007, T009, T010 in parallel (T006, T008 first/independently).
- Per story, [P]-marked test tasks (T011/T012, T023, T032, T036, T043, T047) run
  alongside that story's implementation where they touch separate files.
- Polish: T048, T049 in parallel.

## Task summary

- **Total tasks**: 51
- **Setup**: 5 (T001–T005) · **Foundational**: 5 (T006–T010)
- **US1**: 8 (T011–T018) · **US2**: 5 (T019–T023) · **US3**: 9 (T024–T032)
- **US4**: 4 (T033–T036) · **US5**: 7 (T037–T043) · **US6**: 4 (T044–T047)
- **Polish**: 4 (T048–T051)
