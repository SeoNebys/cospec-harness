---
description: "Task list for Bookmark Manager implementation"
---

# Tasks: Bookmark Manager

**Input**: Design documents from `/specs/001-bookmark-manager/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api.md, quickstart.md

**Tests**: Per-story validation tasks are included because plan.md defines a test
strategy (pytest + Playwright driving quickstart.md). They are not strict
test-first; write them alongside/after each story's implementation to prove the
acceptance scenarios.

**Organization**: Grouped by user story (spec.md priorities) for independent
implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: US1–US7 maps to the spec's user stories

## Path Conventions (from plan.md — local web app)

- Backend: `backend/src/`, `backend/tests/`
- Frontend: `frontend/src/`, `frontend/tests/`
- End-to-end: `e2e/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and structure

- [ ] T001 Create the repo structure per plan.md (`backend/src/{models,services,api}`, `backend/tests/{unit,integration}`, `frontend/src/{components,pages,api}`, `frontend/tests`, `e2e/`)
- [ ] T002 Initialize Python backend in `backend/`: create `backend/requirements.txt` (fastapi, uvicorn, sqlmodel, httpx, beautifulsoup4, pytest, httpx test client) and `backend/pyproject.toml`
- [ ] T003 [P] Initialize React + TypeScript + Vite frontend in `frontend/` (package.json, vite config, tsconfig) with Vitest and a Markdown renderer dependency
- [ ] T004 [P] Initialize Playwright in `e2e/` with config pointing at `http://localhost:8765`
- [ ] T005 [P] Configure linting/formatting: ruff + black for `backend/`, eslint + prettier for `frontend/`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure every user story depends on

**⚠️ CRITICAL**: No user story work begins until this phase is complete

- [ ] T006 Configure SQLite engine/session and the per-user data directory path in `backend/src/db.py`
- [ ] T007 Create the base `Bookmark` model (url, title, icon, description, notes, date_added, is_read, is_archived) in `backend/src/models/bookmark.py`
- [ ] T008 [P] Create the `Tag` model with case-insensitive-unique name and the Bookmark↔Tag join in `backend/src/models/tag.py`
- [ ] T009 Create table-creation/migration bootstrap (create tables on startup) in `backend/src/db.py`
- [ ] T010 [P] Implement URL validation + normalization helper (http/https, lowercase scheme/host, trim trailing slash) in `backend/src/services/url_util.py`
- [ ] T011 Wire the FastAPI app: `/api` router mount, error handling, and static serving of the built frontend, binding to localhost, in `backend/src/app.py`
- [ ] T012 [P] Create the typed backend API client scaffold and app shell (routing, layout) in `frontend/src/api/client.ts` and `frontend/src/pages/App.tsx`

**Checkpoint**: Foundation ready — user stories can begin

---

## Phase 3: User Story 1 - Save a bookmark (Priority: P1) 🎯 MVP

**Goal**: Save a link; app captures title/icon/description best-effort; re-saving an existing URL opens it instead of duplicating.

**Independent Test**: Add a valid URL → appears with title/icon/description; add a malformed value → rejected; re-add an existing URL → existing bookmark opens for editing, no duplicate.

- [ ] T013 [US1] Implement best-effort metadata capture service (fetch with ~3s timeout; parse `<title>`, OG/meta description, favicon; cache icon) in `backend/src/services/metadata.py`
- [ ] T014 [US1] Implement `POST /api/bookmarks`: validate URL (FR-002), on duplicate return existing with `{existing:true}` (FR-011), else create with url-fallback title and trigger async metadata enrichment (FR-001, FR-003), in `backend/src/api/bookmarks.py`
- [ ] T015 [P] [US1] Build the add-bookmark form component with inline validation messaging in `frontend/src/components/AddBookmark.tsx`
- [ ] T016 [US1] Wire the form to `POST /api/bookmarks`, routing a returned existing bookmark to the edit view, in `frontend/src/pages/App.tsx`
- [ ] T017 [P] [US1] Integration test for save/validation/dedupe in `backend/tests/integration/test_save.py`
- [ ] T018 [P] [US1] E2E test for save scenarios (valid, malformed, fallback title, re-save) in `e2e/save.spec.ts`

**Checkpoint**: Saving works end to end.

---

## Phase 4: User Story 2 - Browse and open saved bookmarks (Priority: P1)

**Goal**: See saved (non-archived) bookmarks in a list and open any in the browser; friendly empty state.

**Independent Test**: With several bookmarks, list shows title/icon/description/address; activating one opens the correct page; empty collection shows the empty state.

- [ ] T019 [US2] Implement `GET /api/bookmarks` returning non-archived bookmarks with tags and a result `count` in `backend/src/api/bookmarks.py`
- [ ] T020 [P] [US2] Build the bookmark list/list-item component (title, icon, description, address, open action, graceful truncation) in `frontend/src/components/BookmarkList.tsx`
- [ ] T021 [P] [US2] Build the empty-state component in `frontend/src/components/EmptyState.tsx`
- [ ] T022 [US2] Render the list on the main page and open links in the browser in `frontend/src/pages/App.tsx`
- [ ] T023 [P] [US2] E2E test for browse/open/empty-state in `e2e/browse.spec.ts`

**Checkpoint**: MVP complete — save + browse/open work independently.

---

## Phase 5: User Story 3 - Organise, search, and edit (Priority: P2)

**Goal**: Search (case-insensitive, quoted phrase), multi-tag include/exclude filter, search-within-tag, selectable sort, edit (incl. tag suggestions + rich notes), delete with confirmation.

**Independent Test**: Keyword and quoted-phrase search narrow correctly; include two tags (any-of) and exclude one; combine keyword with tag filter; switch sort; edit title/notes/tags and persist; tag typing suggests existing tags; delete asks to confirm then removes.

- [ ] T024 [US3] Implement search query parser (quoted exact phrase vs. case-insensitive substring words) in `backend/src/services/search.py`
- [ ] T025 [US3] Extend `GET /api/bookmarks` with `q`, `tags_any` (OR), `tags_not` (NOT), and `sort=recent|title` (FR-009, FR-010, FR-013) in `backend/src/api/bookmarks.py`
- [ ] T026 [P] [US3] Implement `GET /api/tags?prefix=&in_use=` for suggestions and the in-use filter list (FR-004a) in `backend/src/api/tags.py`
- [ ] T027 [US3] Implement `PATCH /api/bookmarks/{id}` for title/description/notes/tags edits (FR-004, FR-004b, FR-007), canonicalizing tag names, in `backend/src/api/bookmarks.py`
- [ ] T028 [US3] Implement `DELETE /api/bookmarks/{id}` (permanent) in `backend/src/api/bookmarks.py`
- [ ] T029 [P] [US3] Build the search bar (parses quotes) and sort toggle in `frontend/src/components/SearchBar.tsx`
- [ ] T030 [P] [US3] Build the multi-tag filter bar with include (any-of) and exclude controls in `frontend/src/components/TagFilter.tsx`
- [ ] T031 [P] [US3] Build the tag-input component with existing-tag autocomplete in `frontend/src/components/TagInput.tsx`
- [ ] T032 [P] [US3] Build the edit form with a Markdown notes editor and rendered read-only notes view in `frontend/src/components/EditBookmark.tsx`
- [ ] T033 [P] [US3] Build the delete confirmation dialog in `frontend/src/components/ConfirmDialog.tsx`
- [ ] T034 [US3] Wire search/filter/sort/edit/delete into the main page in `frontend/src/pages/App.tsx`
- [ ] T035 [P] [US3] Backend unit tests for query parsing and tag canonicalization in `backend/tests/unit/test_search_and_tags.py`
- [ ] T036 [P] [US3] E2E test for search/multi-tag filter/sort/edit/notes/delete in `e2e/organise.spec.ts`

**Checkpoint**: Collection is manageable — search, filter, edit, delete work.

---

## Phase 6: User Story 4 - Import and export (Priority: P2)

**Goal**: Import a browser bookmark file (folders→tags, preserve dates, skip duplicates); export in two clearly-labeled formats — portable HTML and lossless JSON.

**Independent Test**: Import a Netscape file → items appear, folders become tags, original dates kept, existing addresses not duplicated. Export HTML → opens in a browser (tags as folders); export JSON → re-import with no loss of tags/notes/state; export UI clearly states which format and what it keeps.

- [ ] T037 [US4] Implement the Netscape bookmark-file parser (folders→tags per level, `ADD_DATE`→date_added, de-dupe against existing URLs) in `backend/src/services/netscape.py`
- [ ] T038 [US4] Implement `POST /api/import` (multipart upload; create+dedupe; background metadata enrichment) returning `{imported, skipped_duplicates}` (FR-014) in `backend/src/api/porting.py`
- [ ] T039 [P] [US4] Implement the HTML exporter (tags as folders + `TAGS` attribute, notes as plain text, re-emit `ADD_DATE`) in `backend/src/services/export_html.py`
- [ ] T040 [P] [US4] Implement the JSON full-backup exporter (tags, Markdown notes, read/unread, archived, dates) in `backend/src/services/export_json.py`
- [ ] T041 [US4] Implement `GET /api/export?format=html|json` (FR-015) in `backend/src/api/porting.py`
- [ ] T042 [P] [US4] Build the import file-picker component in `frontend/src/components/ImportDialog.tsx`
- [ ] T043 [P] [US4] Build the export dialog that clearly labels each format and what it preserves (FR-015 clarity) in `frontend/src/components/ExportDialog.tsx`
- [ ] T044 [US4] Wire import/export into the main page in `frontend/src/pages/App.tsx`
- [ ] T045 [P] [US4] Backend tests: Netscape parse (folders/dates/dedupe) and JSON round-trip fidelity in `backend/tests/integration/test_porting.py`
- [ ] T046 [P] [US4] E2E test for import then export-and-reimport in `e2e/porting.spec.ts`

**Checkpoint**: Data moves in and out; nothing trapped.

---

## Phase 7: User Story 5 - Triage: read-later and archive (Priority: P2)

**Goal**: Mark read/unread and filter to the unread pile; archive to remove from the main list while retaining, and restore.

**Independent Test**: Mark unread → shows in unread filter; mark read → leaves it. Archive → leaves main list, appears in archive view, restore brings it back unchanged.

- [ ] T047 [US5] Extend `GET /api/bookmarks` with `unread=true` and `archived=true` scoping (FR-016, FR-017) in `backend/src/api/bookmarks.py`
- [ ] T048 [P] [US5] Add read/unread toggle and archive/restore actions to the list item in `frontend/src/components/BookmarkList.tsx`
- [ ] T049 [P] [US5] Build the archive view page in `frontend/src/pages/Archive.tsx`
- [ ] T050 [US5] Add the unread filter and archive navigation to the main page in `frontend/src/pages/App.tsx`
- [ ] T051 [P] [US5] E2E test for read-later filter and archive/restore in `e2e/triage.spec.ts`

**Checkpoint**: Main list stays focused; nothing lost.

---

## Phase 8: User Story 6 - Bulk actions incl. select-everything-matching (Priority: P2)

**Goal**: Select many by hand or the whole filtered set, then tag/archive/mark-read-unread/delete in one action (delete confirmed once).

**Independent Test**: Hand-select several → tag all. Filter to a tag with many matches → "select everything matching" → archive/delete the whole set in one action.

- [ ] T052 [US6] Implement `POST /api/bookmarks/bulk` accepting `target` = explicit `ids` OR `filter` criteria, resolving the set server-side and applying add_tag/archive/unarchive/mark_read/mark_unread/delete in one transaction (FR-018) in `backend/src/api/bookmarks.py`
- [ ] T053 [P] [US6] Add multi-select (checkboxes) and a "select everything matching" control to the list in `frontend/src/components/BookmarkList.tsx`
- [ ] T054 [P] [US6] Build the bulk-action bar (tag/archive/mark/delete) reusing the confirm dialog for delete in `frontend/src/components/BulkActionBar.tsx`
- [ ] T055 [US6] Wire bulk selection + actions into the main page in `frontend/src/pages/App.tsx`
- [ ] T056 [P] [US6] Backend integration test for bulk-by-ids and bulk-by-filter (incl. confirmed delete) in `backend/tests/integration/test_bulk.py`
- [ ] T057 [P] [US6] E2E test for hand-select and select-all-matching bulk actions in `e2e/bulk.spec.ts`

**Checkpoint**: Tidying an imported pile is practical.

---

## Phase 9: User Story 7 - Save a frequently used search (Priority: P3)

**Goal**: Save a named keyword+tag+unread combination and reapply it in one step. (First to drop if scope slips — plan.md §5.)

**Independent Test**: Save "unread + tag cooking" under a name; clear filters; reopen the saved search → same results.

- [ ] T058 [P] [US7] Create the `SavedSearch` model (name, keyword, include_tags, exclude_tags, unread_only) in `backend/src/models/saved_search.py`
- [ ] T059 [US7] Implement saved-search endpoints (list, create, apply→reuse the bookmarks filter path, delete) in `backend/src/api/saved_searches.py`
- [ ] T060 [P] [US7] Build the saved-search UI (save current combo, list, apply, delete) in `frontend/src/components/SavedSearches.tsx`
- [ ] T061 [US7] Wire saved searches into the main page in `frontend/src/pages/App.tsx`
- [ ] T062 [P] [US7] E2E test for save/apply saved search in `e2e/saved-search.spec.ts`

**Checkpoint**: All user stories independently functional.

---

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: Cross-story quality, performance, and the run/validation pass

- [ ] T063 [P] Verify search/filter over ~1,000 bookmarks returns < 200 ms; add indexes on url/date_added/tag-name if needed, in `backend/src/db.py` (SC-002)
- [ ] T064 [P] Confirm import of ~1,000 bookmarks completes in a few seconds with background metadata enrichment (SC-007) — measured in `backend/tests/integration/test_porting.py`
- [ ] T065 [P] Ensure site icons are cached and the list renders without per-item network calls in `backend/src/services/metadata.py`
- [ ] T066 [P] Write the launch/run README (venv, build frontend, `uvicorn`, open localhost) in `README.md`
- [ ] T067 Run the full quickstart.md validation pass (all scenarios 1–14) and fix any gaps
- [ ] T068 [P] Accessibility/empty-state and long-value truncation polish across list/edit views in `frontend/src/components/`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies.
- **Foundational (Phase 2)**: after Setup — **blocks all user stories**.
- **User Stories (Phase 3–9)**: all depend on Foundational. Then orderable by priority; US1→US2 form the MVP.
- **Polish (Phase 10)**: after the desired stories are complete.

### User Story Dependencies

- **US1 (P1)** and **US2 (P2→P1 pairing)**: independent of other stories; together = MVP.
- **US3 (P2)**: uses Tag model (foundational) and the list (US2) but is testable on its own.
- **US4 (P2)**: independent; import de-dupe reuses the URL util (foundational).
- **US5 (P2)**: extends list/query; independent behavior.
- **US6 (P2)**: reuses the filter criteria (US3) for select-all-matching; independently testable.
- **US7 (P3)**: reuses the filter path (US3); isolated; safe to drop last.

### Within Each Story

- Backend model → service → endpoint → frontend → wire-in → tests.

### Parallel Opportunities

- Setup: T003, T004, T005 in parallel.
- Foundational: T008, T010, T012 in parallel after T006/T007.
- Within a story, `[P]` frontend components and backend services on different files run in parallel; different stories can be built in parallel by different people once Foundational is done.

---

## Implementation Strategy

### MVP First

1. Phase 1 Setup → 2. Phase 2 Foundational → 3. Phase 3 (US1) → 4. Phase 4 (US2) → **STOP & VALIDATE**: save + browse/open is a usable product.

### Incremental Delivery

Add US3 (organise) → US4 (import/export) → US5 (triage) → US6 (bulk) → US7 (saved searches), validating each independently against its checkpoint. Finish with Phase 10 polish + full quickstart validation.

---

## Notes

- `[P]` = different files, no dependencies.
- Every task lists a concrete file path for immediate execution.
- US7 (saved searches) is intentionally last so it can be dropped with zero impact if scope slips, per the client's plan-gate decision.
- Delete actions (single and bulk) always route through the confirm dialog (SC-005).
