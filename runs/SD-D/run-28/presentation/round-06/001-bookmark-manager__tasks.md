---
description: "Task list for Bookmark Manager implementation"
---

# Tasks: Bookmark Manager

**Input**: Design documents from `/specs/001-bookmark-manager/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Targeted tests are included per the approved plan (research.md §11):
Vitest unit tests on the highest-risk pure logic (search parser, URL
normalization, import/export, metadata parse) + route integration, and a thin
Playwright e2e layer on primary journeys. Not exhaustive TDD.

**Organization**: Tasks are grouped by user story (US1–US13) for independent
implementation and testing. Priorities: US1–US3 = P1, US4–US8 = P2, US9–US13 = P3.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- File paths follow the web-app layout in plan.md (`backend/src/`, `frontend/src/`)

---

## Phase 1: Setup (Shared Infrastructure)

- [ ] T001 Create workspace structure per plan.md: `backend/`, `frontend/`, gitignored `data/`, root `package.json` with npm workspaces
- [ ] T002 Initialize backend TS project in `backend/` with Fastify, `better-sqlite3`, `zod`, `cheerio`, and `playwright@1.61.0` (pin exact version to match installed browsers); add `backend/tsconfig.json`
- [ ] T003 [P] Initialize frontend Vite + React + TS project in `frontend/` with `marked` + an HTML sanitizer for notes; add `frontend/tsconfig.json` and `frontend/vite.config.ts`
- [ ] T004 [P] Configure ESLint + Prettier for both workspaces
- [ ] T005 Add root npm scripts in `package.json`: `build` (frontend then backend), `start` (runs backend serving built SPA on 0.0.0.0:4000), `test` (Vitest), `test:e2e` (Playwright)
- [ ] T006 [P] Configure Playwright in `frontend/playwright.config.ts` to use browsers at `/opt/playwright-browsers` (no download); Vitest config in `backend/vitest.config.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**⚠️ CRITICAL**: Must complete before any user story.

- [ ] T007 Create `backend/src/db/schema.sql` with tables per data-model.md: `bookmark`, `tag`, `bookmark_tag`, `saved_view`, `preferences`, plus contentless FTS5 `bookmark_fts(title,url,description,note)` and insert/update/delete sync triggers. Enforce `bookmark.url_key UNIQUE`, `tag.name UNIQUE`, `preferences` single row `CHECK(id=1)`, FK `ON DELETE CASCADE` on `bookmark_tag`
- [ ] T008 Implement `backend/src/db/db.ts`: `better-sqlite3` connection to `data/bookmarks.db`, apply `schema.sql` on startup (idempotent), enable foreign keys
- [ ] T009 [P] Implement `backend/src/lib/url.ts`: normalize + derive `url_key` — "lowercase scheme and host, add `http(s)://` when the scheme is missing, drop a trailing slash on the path, and preserve the rest" (data-model.md, research.md §8); reject non-http/https and whitespace-only input
- [ ] T010 Implement `backend/src/server.ts`: Fastify bootstrap listening on `0.0.0.0:4000`, static serving of built frontend, JSON error handler emitting `{error:{code,message,details?}}` (400/404/409/502 per contracts/api.md), structured logger
- [ ] T011 [P] Implement `backend/src/services/captureQueue.ts`: in-process FIFO with limited concurrency; runs jobs after response; exposes per-artifact status (`pending`/`ready`/`failed`) writable to `bookmark.capture_status` (research.md §9)
- [ ] T012 Implement `backend/src/services/search/resolveView.ts`: the SINGLE shared query builder taking `{q, tag[], view, scope}` → SQL WHERE, applying scope (active/unread/archived/all) and, when `view` is given, the saved view's query + included/excluded tags in full (plan.md bulk-parity; FR-019). Text/tag compilation delegated to compile.ts (added in US3)
- [ ] T013 [P] Implement `backend/src/models/preferences.ts` and seed the single defaults row (`default_sort='date_added_desc'`, `items_shown`, `text_size='medium'`) so the list has defaults before US13 builds the UI
- [ ] T014 [P] Scaffold frontend shell in `frontend/src/App.tsx` + routing (`pages/`), typed API client in `frontend/src/api/`, and selection/search/preferences stores in `frontend/src/state/`; set `data-harness-ready="true"` only after the initial list (or empty state) loads
- [ ] T015 Create `.harness/app.json`: `{"kind":"application","port":4000,"path":"/","start_command":["npm","start"],"start_cwd":"/work"}` (after build works)

**Checkpoint**: Foundation ready — user stories can begin.

---

## Phase 3: User Story 1 - Save a bookmark with automatic metadata (Priority: P1) 🎯 MVP

**Goal**: Save a URL; auto-capture title/description/favicon/preview; it persists and lists; title/description editable.

**Independent Test**: Save a valid URL → appears with captured metadata → persists after reload → edit title/description overrides captured values.

### Tests for US1

- [ ] T016 [P] [US1] Unit tests for `backend/src/lib/url.ts` in `backend/tests/unit/url.test.ts` (scheme add, trailing slash, host case, invalid/whitespace rejection)
- [ ] T017 [P] [US1] Unit tests for metadata parsing in `backend/tests/unit/metadata.test.ts` (og/standard title, description, og:image, favicon; missing-field fallbacks)
- [ ] T018 [US1] Integration test in `backend/tests/integration/bookmarks.create.test.ts`: `POST /api/bookmarks` creates row, returns 201 with capture pending, derives title on fetch failure

### Implementation for US1

- [ ] T019 [P] [US1] Implement `backend/src/models/bookmark.ts`: create/read with fields per data-model.md (captured vs. user title/description, `note_md`, favicon/preview paths, `is_unread`, `is_archived` default 0, `capture_status`, `date_added`, `date_modified`); display title = `title_user ?? title_captured ?? deriveFromUrl(url)`
- [ ] T020 [P] [US1] Implement `backend/src/services/metadata.ts`: fetch page, parse title/description/favicon/preview via cheerio; Playwright/Chromium fallback for JS pages; store captured values; mark per-artifact status
- [ ] T021 [P] [US1] Implement `backend/src/services/snapshot.ts` (HTML branch): capture self-contained single-file HTML snapshot via Playwright into `data/snapshots/<id>/`; set `snapshot_path`/`snapshot_kind='html'` (PDF branch added in US11)
- [ ] T022 [US1] Implement `POST /api/bookmarks` route in `backend/src/routes/bookmarks.ts`: validate+normalize URL (zod + url.ts), insert, enqueue metadata + snapshot capture, return 201 (depends on T019–T021, T011)
- [ ] T023 [US1] Implement `GET /api/bookmarks/:id` and `GET /api/bookmarks` (basic list, newest-first, active scope) in `backend/src/routes/bookmarks.ts`
- [ ] T024 [US1] Implement `PATCH /api/bookmarks/:id` (title, description overrides + note) in `backend/src/routes/bookmarks.ts`; update `date_modified` (extended for url/tags/state in later stories)
- [ ] T025 [P] [US1] Frontend save form in `frontend/src/components/SaveForm.tsx` (URL + optional title) posting to the API and showing validation errors
- [ ] T026 [P] [US1] Frontend `frontend/src/components/BookmarkRow.tsx` + `pages/List.tsx` rendering captured metadata and a capture/pending + "metadata unavailable" indicator
- [ ] T027 [US1] Frontend edit-title/description UI in `pages/BookmarkDetail.tsx` calling PATCH

**Checkpoint**: US1 fully functional — the MVP (save + auto metadata + list + edit).

---

## Phase 4: User Story 2 - Save an existing address takes me to it (Priority: P1)

**Goal**: Re-saving an existing address opens the existing bookmark for editing; no duplicates.

**Independent Test**: Save a URL twice (incl. trailing-slash/scheme/case variants) → no duplicate → land on existing bookmark in edit mode.

### Tests for US2

- [ ] T028 [P] [US2] Integration test in `backend/tests/integration/bookmarks.duplicate.test.ts`: second POST of same `url_key` (and variants) returns 409 with `existingId`, no new row

### Implementation for US2

- [ ] T029 [US2] Extend `POST /api/bookmarks` to detect existing `url_key` and return 409 `{existingId}` instead of inserting (FR-007/FR-008), using url.ts key equivalence
- [ ] T030 [US2] Frontend: on 409 from save, navigate to `pages/BookmarkDetail.tsx` for `existingId` in editable state

**Checkpoint**: US1 + US2 work; no duplicates.

---

## Phase 5: User Story 3 - Browse, sort, and search (Priority: P1)

**Goal**: Advanced search (case-insensitive; phrases, `#tag`, AND/OR/NOT, parens; quoted operators literal; tag+text combine) + sorting + list display + open-original.

**Independent Test**: Run `#work AND ("quarterly report" OR budget) NOT draft` → correct matches; `"rock and roll"` treats `and` as a word; malformed query → error; change sort → reorders; clicking a row opens original.

### Tests for US3

- [ ] T031 [P] [US3] Unit tests for the search parser in `backend/tests/unit/searchParser.test.ts` per contracts/search-grammar.md: precedence (NOT>AND>OR), implicit AND, quoted operators literal (`"rock and roll"`), `#tag` + text combos, malformed (unbalanced quotes/parens) errors
- [ ] T032 [P] [US3] Integration test in `backend/tests/integration/search.test.ts`: end-to-end query → expected result set incl. tag+text combination and case-insensitivity

### Implementation for US3

- [ ] T033 [US3] Implement `backend/src/services/search/parser.ts`: query string → AST (`And/Or/Not/Text/Tag`) per grammar; operators only unquoted (FR-012a); implicit AND; parentheses; report malformed queries (FR-013)
- [ ] T034 [US3] Implement `backend/src/services/search/compile.ts`: AST → SQL — `Text`→`bookmark_fts MATCH ?` (phrase vs term), `Tag`→tag-membership EXISTS (lowercased), boolean nodes → AND/OR/AND NOT (FR-011/012/012b); wire into `resolveView.ts` (T012)
- [ ] T035 [US3] Extend `GET /api/bookmarks` in `backend/src/routes/bookmarks.ts` to accept `q`, `tag[]`, `scope`, `sort`, `page`, `pageSize`; return `{items,total,page,pageSize}`; 400 on malformed `q`; sort keys per data-model.md (`date_added_*`, `date_modified_desc`, `title_*`, `unread_first`)
- [ ] T036 [P] [US3] Frontend `frontend/src/components/SearchBar.tsx` with malformed-query error display + no-results state
- [ ] T037 [P] [US3] Frontend `frontend/src/components/SortMenu.tsx` wired to the list
- [ ] T038 [US3] Frontend: `BookmarkRow` shows title, description, tags, favicon (FR-028); activating a row opens original URL in a new tab via `window.open` (FR-029), kept distinct from the multi-select checkbox

**Checkpoint**: P1 slice complete (US1–US3) — a genuinely usable product.

---

## Phase 6: User Story 4 - Edit and delete bookmarks (Priority: P2)

**Goal**: Edit title/description/address/tags; permanent delete with confirmation.

**Independent Test**: Edit fields persist; delete (confirmed) stays gone after reload.

- [ ] T039 [P] [US4] Integration test in `backend/tests/integration/bookmarks.edit-delete.test.ts`: PATCH url re-validates + re-checks duplicate; DELETE removes row and snapshot files
- [ ] T040 [US4] Extend `PATCH /api/bookmarks/:id` to also edit `url` (re-normalize + duplicate re-check) and `tags[]` persistence in `backend/src/routes/bookmarks.ts`
- [ ] T041 [US4] Implement `DELETE /api/bookmarks/:id` in `backend/src/routes/bookmarks.ts`: permanent removal + delete `data/snapshots/<id>/`
- [ ] T042 [US4] Frontend edit form (address, tags) + delete action with confirmation dialog in `pages/BookmarkDetail.tsx`

---

## Phase 7: User Story 5 - Read later and unread view (Priority: P2)

**Goal**: Mark read-later/unread; dedicated unread view; toggle read/unread.

**Independent Test**: Mark unread → shows in unread view; mark read → leaves it.

- [ ] T043 [US5] Extend `PATCH /api/bookmarks/:id` to toggle `is_unread`; ensure `scope=unread` filter in `resolveView.ts`/list
- [ ] T044 [P] [US5] Frontend `pages/Unread.tsx` + a read/unread toggle control on `BookmarkRow`/detail

---

## Phase 8: User Story 6 - Archive as reversible alternative to delete (Priority: P2)

**Goal**: Archive/restore; archived hidden from normal list + default search; own archive view.

**Independent Test**: Archive → gone from normal list, present in archive view; restore → returns.

- [ ] T045 [P] [US6] Integration test in `backend/tests/integration/archive.test.ts`: archived excluded from active scope + default search; present in archived scope
- [ ] T046 [US6] Extend `PATCH /api/bookmarks/:id` to set `is_archived`; confirm `resolveView.ts` excludes archived from `active`/default and includes them only for `archived`/`all` (FR-009/FR-015)
- [ ] T047 [P] [US6] Frontend `pages/Archive.tsx` + archive/restore actions

---

## Phase 9: User Story 7 - Tags and tag suggestions (Priority: P2)

**Goal**: Assign tags; filter by tag; autocomplete from previously used tags.

**Independent Test**: Typing a used tag prefix suggests it; filter by tag shows only tagged items.

- [ ] T048 [P] [US7] Implement `backend/src/models/tag.ts`: upsert tags (lowercased/trimmed, `name UNIQUE`), link/unlink to bookmarks, usage counts
- [ ] T049 [US7] Implement `GET /api/tags?prefix=` in `backend/src/routes/tags.ts` returning tags + counts for suggestions (FR-017) and filters (FR-016)
- [ ] T050 [P] [US7] Frontend `frontend/src/components/TagInput.tsx` with prefix-based suggestions from `/api/tags`
- [ ] T051 [P] [US7] Frontend tag-filter control adding `#tag`/`tag[]` to the current query

---

## Phase 10: User Story 8 - Descriptions and formatted notes (Priority: P2)

**Goal**: Editable description + separate markdown note; both searchable.

**Independent Test**: Add a markdown note → renders + persists; search finds text in it.

- [ ] T052 [P] [US8] Frontend `frontend/src/components/NoteEditor.tsx`: markdown editing + sanitized render (headings, bold/italic, lists, links) writing `note_md` via PATCH
- [ ] T053 [US8] Confirm `note`/`description` are indexed in `bookmark_fts` (T007 triggers) so they are searchable (FR-018); add integration assertion in `backend/tests/integration/search.test.ts`

---

## Phase 11: User Story 9 - Bulk selection and actions (Priority: P3)

**Goal**: Select individually or all-matching (honoring the complete current view incl. saved views); bulk add/remove tags, read/unread, archive, delete.

**Independent Test**: Select all matching a search/saved view → add a tag once → every match carries it; bulk delete confirmed.

- [ ] T054 [P] [US9] Integration test in `backend/tests/integration/bulk.test.ts`: `match` selector with `view` applies the saved view's query + include/exclude tags to the FULL set (not just a page); each action type; delete affects only the set
- [ ] T055 [US9] Implement `POST /api/bookmarks/bulk` in `backend/src/routes/bookmarks.ts`: `selector` = `{ids[]}` or `{match:{q,tag[],view,scope}}` resolved via the SAME `resolveView.ts` (T012) ignoring pagination; actions addTags/removeTags/setUnread/archive/delete; return `{affected}` (FR-019/FR-020, US9 scenario 2a)
- [ ] T056 [P] [US9] Frontend `frontend/src/components/BulkBar.tsx`: per-row checkboxes + "select all matching current view" + action buttons; confirmation for bulk delete

---

## Phase 12: User Story 10 - Saved views (Priority: P3)

**Goal**: Create/open/edit/delete named views (query + included/excluded tags).

**Independent Test**: Save a query + include/exclude tags → reopen → expected results.

- [ ] T057 [P] [US10] Implement `backend/src/models/savedView.ts` (name, query, include_tags JSON, exclude_tags JSON, date_created)
- [ ] T058 [US10] Implement `GET/POST/PATCH/DELETE /api/views` in `backend/src/routes/views.ts` (FR-021)
- [ ] T059 [US10] Wire `view` param through `GET /api/bookmarks` → `resolveView.ts` (applies query + include/exclude tags)
- [ ] T060 [P] [US10] Frontend `pages/SavedView.tsx` + save/edit/delete-view UI built from the current search + chosen include/exclude tags

---

## Phase 13: User Story 11 - Page preservation (Priority: P3)

**Goal**: Self-contained snapshot at save; keep PDF when link is a PDF; optional Internet Archive submission (best-effort, never affects bookmark/local copy).

**Independent Test**: Open preserved copy → renders from storage; PDF link retains PDF; IA submission stores reference or reports failure harmlessly.

- [ ] T061 [P] [US11] Extend `backend/src/services/snapshot.ts` PDF branch: detect PDF content type, download + retain original file, set `snapshot_kind='pdf'`
- [ ] T062 [US11] Implement `GET /api/bookmarks/:id/snapshot` in `backend/src/routes/bookmarks.ts`: serve stored HTML or PDF with correct content type (FR-022)
- [ ] T063 [P] [US11] Implement `backend/src/services/archiveOrg.ts`: submit to Internet Archive Save Page Now; store `archive_org_url` on success; on failure return 502 and leave bookmark + local snapshot untouched (FR-023)
- [ ] T064 [US11] Implement `POST /api/bookmarks/:id/archive-org` route + frontend "view preserved copy" and "submit to Internet Archive" controls in `pages/BookmarkDetail.tsx`

---

## Phase 14: User Story 12 - Import and export (Priority: P3)

**Goal**: Import Netscape bookmark HTML (preserve titles/tags/dates, merge duplicates); export same format.

**Independent Test**: Import a browser HTML file → titles/tags/dates preserved, no duplicates; export → re-imports faithfully.

- [ ] T065 [P] [US12] Unit tests in `backend/tests/unit/importExport.test.ts`: parse `HREF`/text/`ADD_DATE`/`TAGS` (folder fallback), merge on `url_key`, round-trip export→import fidelity
- [ ] T066 [US12] Implement `backend/src/services/importExport.ts`: Netscape HTML parse (cheerio) + build; merge on `url_key`; preserve titles/tags/dates (FR-024/025, SC-006)
- [ ] T067 [US12] Implement `POST /api/import` (multipart) and `GET /api/export` in `backend/src/routes/importExport.ts`; imported bookmarks enqueue capture; return `{imported,merged,skipped}`
- [ ] T068 [P] [US12] Frontend import (file upload) + export (download) UI in `pages/Preferences.tsx` or a dedicated panel

---

## Phase 15: User Story 13 - Display preferences (Priority: P3)

**Goal**: Set + persist default sort, items shown, text size.

**Independent Test**: Change each → reload → still applied.

- [ ] T069 [US13] Implement `GET /api/preferences` and `PATCH /api/preferences` in `backend/src/routes/preferences.ts` (FR-026)
- [ ] T070 [P] [US13] Frontend `pages/Preferences.tsx`: default sort, items shown, text size; apply text size app-wide; feed defaults into list/sort

---

## Phase 16: Polish & Cross-Cutting Concerns

- [ ] T071 [P] Playwright e2e in `frontend/tests/primary-journey.spec.ts`: save → appears in list → search → open original (pinned 1.61.0)
- [ ] T072 [P] Performance check: search over 500 bookmarks < 1s (SC-002) and bulk over ≤500 < 5s (SC-005); add indexes if needed
- [ ] T073 [P] Empty/placeholder states: empty collection, empty unread, empty archive, no-results; favicon/preview placeholders (edge cases)
- [ ] T074 Long-value truncation in list display; verify capture never blocks save (SC-001)
- [ ] T075 [P] README/run notes referencing quickstart.md; confirm `.harness/app.json` + `data-harness-ready` marker
- [ ] T076 Run full quickstart.md validation (all 13 scenarios) before requesting review

---

## Dependencies & Execution Order

### Phase dependencies

- **Setup (P1)** → no deps.
- **Foundational (P2)** → after Setup; **blocks all user stories**. Note T012 (`resolveView.ts`) is completed by US3's T034 (compile.ts) — its text/tag branch is inert until then, which is fine for US1/US2.
- **User stories** → after Foundational. P1 order US1 → US2 → US3 (US2 and US3 extend US1's routes). P2/P3 stories mostly independent but extend shared route files.
- **Polish** → after desired stories complete.

### Story dependencies

- **US1 (P1)**: foundation only — the MVP.
- **US2 (P1)**: extends US1 POST route.
- **US3 (P1)**: needs parser/compile feeding `resolveView.ts`; list depends on US1.
- **US4–US8 (P2)**: build on US1–US3; extend PATCH/list; largely independent of each other.
- **US9 (P3)**: depends on `resolveView.ts` (T012) + saved views (US10) for the full "select all matching a saved view" test; core bulk works without US10.
- **US10–US13 (P3)**: independent additive features.

### Parallel opportunities

- Setup: T003/T004/T006 in parallel.
- Foundational: T009/T011/T013/T014 in parallel after T007/T008.
- Within a story, `[P]` tasks touch different files (e.g. US1 T019/T020/T021, frontend T025/T026).
- Once foundation is done, P2/P3 stories can be split across developers.

---

## Implementation Strategy

### MVP first

1. Phase 1 Setup → 2. Phase 2 Foundational → 3. US1 → **STOP & validate** (save + auto metadata + list + edit). This alone is a demoable product.

### Incremental delivery

Add US2, then US3 to complete the P1 slice (duplicates + advanced search/sort). Then layer P2 (edit/delete, read-later, archive, tags, notes) and P3 (bulk, saved views, preservation, import/export, preferences), validating each story independently at its checkpoint.

---

## Notes

- `[P]` = different files, no incomplete dependencies.
- Shared route files (`routes/bookmarks.ts`) are extended across stories — sequence edits to the same file (not `[P]` against each other).
- Verify each story at its checkpoint against the acceptance scenarios in spec.md.
- Do not create `.harness/app.json` (T015) until `npm run build` + `npm start` succeed locally, per CLAUDE.md runtime rules.
