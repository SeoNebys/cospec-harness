---

description: "Task list for Bookmark Manager implementation"
---

# Tasks: Bookmark Manager

**Input**: Design documents from `/specs/001-bookmark-manager/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Included — the plan calls for Vitest (unit + integration) and one
Playwright end-to-end flow per user story. Test tasks are listed per story.

**Organization**: Tasks are grouped by user story so each can be implemented and
tested independently. Priority order from spec.md: US1 (P1) → US2 (P2), US6 (P2)
→ US3 (P3), US4 (P3), US5 (P3).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- Exact file paths are included in each task.

## Path Conventions

Single local web app in one repo: `src/shared`, `src/server`, `src/web`, `tests/`
(per plan.md "Source Code" layout).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [X] T001 Create the repo structure from plan.md (`src/shared`, `src/server/{db,routes,services,lib}`, `src/web/{api,pages,components}`, `tests/{unit,integration,e2e}`)
- [X] T002 Initialize TypeScript + Node 20 project with npm; add backend deps (Fastify, better-sqlite3, HTML-metadata parser, Markdown renderer + HTML sanitizer) and frontend deps (React 18, Vite, client router) in `package.json`
- [X] T003 [P] Configure TypeScript (`tsconfig.json`), ESLint + Prettier, and npm scripts (`dev`, `build`, `test`, `test:e2e`)
- [X] T004 [P] Configure Vitest (unit + integration with in-memory SQLite) and Playwright (e2e) in `vitest.config.ts` and `playwright.config.ts`
- [X] T005 [P] Define shared domain types (Bookmark, Tag, SavedSearch, TagFilter, SortOrder, View, ExportFile) in `src/shared/types.ts` per data-model.md and contracts/filter-model.md

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T006 Create SQLite schema in `src/server/db/schema.sql`: `bookmarks` (incl. `url_key` UNIQUE, `enrich_status`, `created_at`, `updated_at`), `tags` (name UNIQUE, lowercased), `bookmark_tags` join, `saved_searches`, plus the FTS5 virtual table and sync triggers (data-model.md)
- [X] T007 Implement DB connection/init/migration bootstrap (open on-disk file, create app-data dir, run schema, expose in-memory mode for tests) in `src/server/db/connection.ts`
- [X] T008 Bootstrap the Fastify app (JSON error envelope `{error:{code,message}}`, static serving of the built SPA, `/api` router mount) in `src/server/index.ts`
- [X] T009 [P] Implement URL normalization + validation + duplicate-key derivation (lowercase scheme/host, add https:// when missing, drop trailing slash, strip default port and #fragment) in `src/server/services/url.ts` (research §6, FR-002/FR-023)
- [X] T010 [P] Unit tests for URL normalization/validation edge cases in `tests/unit/url.test.ts`
- [X] T011 [P] Implement the typed frontend API client wrapper over the REST contract in `src/web/api/client.ts` (contracts/rest-api.md)
- [X] T012 [P] Scaffold the SPA shell + client router + app-wide layout in `src/web/main.tsx`
- [X] T013 [P] Implement the reusable `EmptyState` component (empty + no-results variants) in `src/web/components/EmptyState.tsx` (FR-024)

**Checkpoint**: Foundation ready — user stories can now begin

---

## Phase 3: User Story 1 - Save a bookmark with rich preview (Priority: P1) 🎯 MVP

**Goal**: A person saves a URL and gets a readable card; description/icon/image are
auto-fetched best-effort without blocking the save; malformed URLs rejected;
description editable.

**Independent Test**: Save a valid URL → card appears immediately and enriches within
seconds; save `example.com` → normalized; save gibberish → rejected; edit description → persists.

### Tests for User Story 1

- [X] T014 [P] [US1] Unit test for metadata parsing (OG/Twitter/meta/favicon priority, partial data) in `tests/unit/metadata.test.ts`
- [X] T015 [P] [US1] Integration test for `POST /api/bookmarks` + `GET /api/bookmarks/:id` (create, default title, validation reject, enrich status transitions) in `tests/integration/bookmarks-create.test.ts`
- [X] T016 [P] [US1] Playwright e2e for US1 save-with-preview flow in `tests/e2e/us1-save.spec.ts`

### Implementation for User Story 1

- [X] T017 [P] [US1] Implement best-effort metadata fetch/parse (timeout ~5s, capped size, limited redirects, http/https only) in `src/server/services/metadata.ts` (research §3, FR-005)
- [X] T018 [P] [US1] Implement background enrichment queue (create returns immediately, sets `enrich_status`, updates record on completion/failure) in `src/server/services/enrichment.ts`
- [X] T019 [US1] Implement bookmark create/get queries + default-title logic (FR-004) in `src/server/db/queries.ts`
- [X] T020 [US1] Implement `POST /api/bookmarks` (validate/normalize, dupe→return existing with `existing:true`, else 201 pending) and `GET /api/bookmarks/:id` in `src/server/routes/bookmarks.ts` (FR-001/002/004/005/023)
- [X] T021 [P] [US1] Implement `BookmarkCard` (title, address, description, icon, preview image; graceful long-text) in `src/web/components/BookmarkCard.tsx` (FR-007)
- [X] T022 [P] [US1] Implement `BookmarkEditor` add/save form (url, title, description; editable description) in `src/web/components/BookmarkEditor.tsx` (FR-003/FR-006)
- [X] T023 [US1] Implement `ListPage` minimal view (save box + card list, newest-first, refresh to show enrichment) in `src/web/pages/ListPage.tsx`

**Checkpoint**: MVP — a person can save links and see enriched cards. Fully testable alone.

---

## Phase 4: User Story 2 - Open, browse, and find bookmarks (Priority: P2)

**Goal**: Click opens the page; search by text, quoted phrase, and any/all/not tag
combinations; case-insensitive; clear filters; no-results state.

**Independent Test**: Click a bookmark → opens; search term + `"phrase"` narrows list;
"recipes or dinner, but not dessert" returns the right set; clear → full list.

### Tests for User Story 2

- [X] T024 [P] [US2] Unit test for filter→SQL builder (any/all/not, quoted phrase, case-insensitive, worked example) in `tests/unit/search.test.ts`
- [X] T025 [P] [US2] Integration test for `GET /api/bookmarks` filtering + `GET /api/tags` in `tests/integration/bookmarks-search.test.ts`
- [X] T026 [P] [US2] Playwright e2e for US2 open/search/filter flow in `tests/e2e/us2-find.spec.ts`

### Implementation for User Story 2

- [X] T027 [P] [US2] Implement search query builder (FTS text + quoted phrase + tag any/all/not, combined) in `src/server/services/search.ts` (contracts/filter-model.md, FR-009/010/011)
- [X] T028 [US2] Implement list query (filter + view scope + sort) and distinct-tags-with-counts query in `src/server/db/queries.ts`
- [X] T029 [US2] Implement `GET /api/bookmarks` (filter params) in `src/server/routes/bookmarks.ts` and `GET /api/tags` in `src/server/routes/tags.ts` (FR-024)
- [X] T030 [P] [US2] Implement `SearchBar` (text + quoted-phrase input + tag any/all/not builder + clear) in `src/web/components/SearchBar.tsx`
- [X] T031 [US2] Wire open-on-click (open `bookmark.url` in a new tab) into `BookmarkCard` in `src/web/components/BookmarkCard.tsx` (FR-008)
- [X] T032 [US2] Integrate search + no-results state into `ListPage` in `src/web/pages/ListPage.tsx`

**Checkpoint**: US1 + US2 both work independently — save, open, and find.

---

## Phase 5: User Story 6 - Back up and move the collection (Priority: P2)

**Goal**: Export the whole collection to a portable open-format file and import it
(incl. onto a fresh install), preserving original dates, merging by normalized URL,
and never corrupting the existing collection on a bad file.

**Independent Test**: Export → wipe → import → everything restored incl. dates and
sort-by-oldest order; re-import → no duplicates + summary; import junk → unchanged.

### Tests for User Story 6

- [X] T033 [P] [US6] Integration test for export→import round-trip (full fidelity incl. dates, sort-by-oldest identical) in `tests/integration/backup-roundtrip.test.ts` (SC-008)
- [X] T034 [P] [US6] Integration test for merge-on-import (no dupes by url_key, tag merge, summary) and invalid-file rollback in `tests/integration/backup-merge.test.ts` (FR-029/FR-030)
- [X] T035 [P] [US6] Playwright e2e for US6 export/import flow in `tests/e2e/us6-backup.spec.ts`

### Implementation for User Story 6

- [X] T036 [US6] Implement export/import service (serialize full collection; validate format/version; transactional import; merge by url_key; **preserve createdAt/updatedAt from file**) in `src/server/services/backup.ts` (FR-026..FR-030, SC-008)
- [X] T037 [US6] Implement `GET /api/export` (file download) and `POST /api/import` (400 + no-change on invalid; summary on success) in `src/server/routes/bookmarks.ts` (contracts/rest-api.md)
- [X] T038 [US6] Implement `BackupPanel` (export download button + import file picker + result summary/errors) in `src/web/components/BackupPanel.tsx`

**Checkpoint**: Data is safe — collection can be exported and restored on a new machine.

---

## Phase 6: User Story 3 - Organize, edit, and tidy bookmarks (Priority: P3)

**Goal**: Edit all fields incl. address; tag suggestions; sort orders; rich-text notes;
archive/restore; delete-with-confirm; batch actions incl. select-all-showing.

**Independent Test**: Edit address/title/notes/tags → persists; tag suggestions appear;
notes render formatted; sort changes; archive→archived view→restore; batch tag/archive/delete.

### Tests for User Story 3

- [X] T039 [P] [US3] Unit test for notes Markdown→sanitized-HTML allowlist (headings/bullets/links; unsupported→plain text) in `tests/unit/notes.test.ts` (FR-018)
- [X] T040 [P] [US3] Integration test for PATCH (incl. address change collision 409), archive/restore, delete, and `POST /api/bookmarks/batch` in `tests/integration/bookmarks-edit-batch.test.ts`
- [X] T041 [P] [US3] Playwright e2e for US3 organize/edit/batch flow in `tests/e2e/us3-organize.spec.ts`

### Implementation for User Story 3

- [X] T042 [P] [US3] Implement notes Markdown render + sanitize allowlist in `src/server/services/notes.ts` (FR-003/FR-018)
- [X] T043 [US3] Implement update/delete/batch queries (partial update, archive/read-later flags, batch add-tag/archive/unarchive/delete) in `src/server/db/queries.ts`
- [X] T044 [US3] Implement `PATCH /api/bookmarks/:id` (re-normalize address, 409 on collision with existing), `DELETE /api/bookmarks/:id`, and `POST /api/bookmarks/batch` in `src/server/routes/bookmarks.ts` (FR-013/016/017/019/020/023)
- [X] T045 [P] [US3] Implement `TagInput` with suggestions from used tags in `src/web/components/TagInput.tsx` (FR-012)
- [X] T046 [P] [US3] Implement `NotesEditor` constrained rich-text (headings/bullets/links) in `src/web/components/NotesEditor.tsx`
- [X] T047 [P] [US3] Implement `BatchToolbar` (multi-select, select-all-showing scoped to current view, batch tag/archive/delete with single delete confirm) in `src/web/components/BatchToolbar.tsx` (FR-019/FR-020)
- [X] T048 [P] [US3] Implement `ArchivedPage` (archived view + restore) in `src/web/pages/ArchivedPage.tsx` (FR-016)
- [X] T049 [US3] Extend `BookmarkEditor` with address/notes/tags editing and sort control; wire delete confirmation into `ListPage` in `src/web/pages/ListPage.tsx` and `src/web/components/BookmarkEditor.tsx` (FR-013/FR-014)

**Checkpoint**: US1–US3 + US6 all independently functional.

---

## Phase 7: User Story 4 - Read-later shortlist (Priority: P3)

**Goal**: Flag/unflag "read later" and view only those.

**Independent Test**: Flag two → read-later view shows only those → clear one → it leaves the view but stays in the collection.

### Tests for User Story 4

- [ ] T050 [P] [US4] Integration test for read-later flag toggle + read-later view filter in `tests/integration/read-later.test.ts`
- [ ] T051 [P] [US4] Playwright e2e for US4 read-later flow in `tests/e2e/us4-readlater.spec.ts`

### Implementation for User Story 4

- [ ] T052 [US4] Add "read later" toggle action to `BookmarkCard`/`BookmarkEditor` (reuses PATCH) in `src/web/components/BookmarkCard.tsx` (FR-015)
- [ ] T053 [US4] Implement `ReadLaterPage` (view scoped to read_later=1, non-archived) in `src/web/pages/ReadLaterPage.tsx` (FR-015)

**Checkpoint**: Read-later shortlist works on top of existing views.

---

## Phase 8: User Story 5 - Saved searches (Priority: P3)

**Goal**: Save a text+tag filter under a name; apply it live; rename/remove; persists.

**Independent Test**: Build filter → save named → clear → apply saved → filter restored + live results; rename/remove persists across restart.

### Tests for User Story 5

- [ ] T054 [P] [US5] Integration test for saved-search CRUD + apply-runs-live in `tests/integration/saved-searches.test.ts`
- [ ] T055 [P] [US5] Playwright e2e for US5 saved-search flow in `tests/e2e/us5-saved-search.spec.ts`

### Implementation for User Story 5

- [ ] T056 [US5] Implement saved-search queries (CRUD, store filter definition) in `src/server/db/queries.ts`
- [ ] T057 [US5] Implement saved-search routes (`GET/POST/PATCH/DELETE /api/saved-searches`) in `src/server/routes/savedSearches.ts` (FR-021)
- [ ] T058 [US5] Implement `SavedSearchBar` (save current filter, apply→loads filter and re-queries live, rename, remove) in `src/web/components/SavedSearchBar.tsx` (FR-021)

**Checkpoint**: All six user stories independently functional.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Improvements spanning multiple stories

- [ ] T059 [P] Verify performance targets (search/filter <100ms and instant feel at 500 bookmarks) with a seed script in `tests/integration/perf.test.ts` (SC-002/SC-005)
- [ ] T060 [P] Add server-side fetch safety review (timeout/size/redirect caps) note + tests in `tests/unit/metadata.test.ts` (research §3)
- [ ] T061 [P] Write README with run/build instructions and the tracked "double-click desktop app (Tauri) fast-follow" note from plan.md in `README.md`
- [ ] T062 Run the full `quickstart.md` validation (US1–US6 + duplicate check) end to end
- [ ] T063 [P] Final code cleanup, consistent error messages, and lint pass across `src/`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately.
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories.
- **User Stories (Phases 3–8)**: All depend on Foundational. In priority order:
  US1 (P1) → US2 & US6 (P2) → US3, US4, US5 (P3). US2/US6 are independent of each
  other; US4 and US5 build lightly on US2/US3 endpoints but remain independently testable.
- **Polish (Phase 9)**: After the desired stories are complete.

### User Story Dependencies

- **US1 (P1)**: After Foundational. No dependency on other stories. → MVP.
- **US2 (P2)**: After Foundational. Uses list/search; independently testable.
- **US6 (P2)**: After Foundational. Independent of US2; touches bookmark/tag/saved-search data.
- **US3 (P3)**: After Foundational. Reuses PATCH/batch; independently testable.
- **US4 (P3)**: After Foundational. Reuses PATCH; light dependence on list views.
- **US5 (P3)**: After Foundational. Reuses the filter model from US2.

### Within Each User Story

- Tests written first and expected to FAIL before implementation.
- Models/schema → queries → services → routes → UI.
- Story complete before moving to next priority.

### Parallel Opportunities

- Setup: T003, T004, T005 in parallel.
- Foundational: T009/T010, T011, T012, T013 in parallel (after T006–T008).
- Within a story, `[P]` tasks touch different files and can run together (e.g. US1: T014/T015/T016 tests; T017/T018 services; T021/T022 UI).
- With capacity, US2 and US6 can proceed in parallel once Foundational is done.

---

## Parallel Example: User Story 1

```bash
# Tests together:
Task: "Unit test metadata parsing in tests/unit/metadata.test.ts"          # T014
Task: "Integration test create/get in tests/integration/bookmarks-create.test.ts"  # T015
Task: "Playwright e2e save flow in tests/e2e/us1-save.spec.ts"             # T016

# Then services + UI in parallel:
Task: "metadata.ts fetch/parse"   # T017
Task: "enrichment.ts queue"       # T018
Task: "BookmarkCard.tsx"          # T021
Task: "BookmarkEditor.tsx"        # T022
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Phase 1 Setup → 2. Phase 2 Foundational → 3. Phase 3 US1 → **STOP & validate** save+preview → demo.

### Incremental Delivery

Foundation → US1 (MVP, save+preview) → US2 (find/open) → US6 (backup safety) →
US3 (organize) → US4 (read-later) → US5 (saved searches). Each increment is
independently testable and adds value without breaking prior stories.

---

## Notes

- `[P]` = different files, no dependencies.
- Every task cites its file path and, where relevant, the FR/SC or research section it satisfies (traceability back to the approved spec).
- Verify tests fail before implementing.
- Stop at any checkpoint to validate a story independently.
