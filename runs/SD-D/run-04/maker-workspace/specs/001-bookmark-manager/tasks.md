---

description: "Task list for Bookmark Manager implementation"
---

# Tasks: Bookmark Manager

**Input**: Design documents from `/specs/001-bookmark-manager/`

**Prerequisites**: plan.md, spec.md (revision 3), research.md, data-model.md, contracts/api.md, quickstart.md

**Tests**: Included as a focused set (unit for pure logic + a few API/e2e flows), per the plan's testing strategy and the spec's measurable success criteria.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1–US14)
- Exact file paths are included in each task. Paths follow the single web-app structure in plan.md.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [X] T001 Create the project directory structure per plan.md (`server.js`, `src/{app.js,db,models,services,routes,public}`, `tests/{unit,integration,e2e}`, `data/` placeholder) at repo root `/work`
- [X] T002 Initialize npm project in `/work/package.json` with ES modules (`"type":"module"`) and scripts `start` (`node server.js`), `test` (`node --test`), `test:e2e` (`playwright test`); add dependencies express, better-sqlite3, and a maintained HTML sanitizer; pin `playwright` and `@playwright/test` to `1.61.0` in devDependencies
- [X] T003 [P] Add `.gitignore` (ignore `node_modules/`, `data/`) and Playwright config `/work/playwright.config.js` using the shared Chromium at `/opt/playwright-browsers` (baseURL `http://127.0.0.1:4000`)
- [X] T004 [P] Configure linting/formatting in `/work/.editorconfig` and an eslint flat config `/work/eslint.config.js`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T005 Implement SQLite connection + migration runner in `/work/src/db/index.js` (open `data/bookmarks.db`, create dir if missing, run migrations on boot)
- [X] T006 Create schema migration `/work/src/db/migrations/001_init.sql` for all entities per data-model.md: `bookmarks` (with `url_key` **UNIQUE**, `is_read` default 0, `is_archived` default 0, `created_at`/`updated_at`), `tags` (`name_key` **UNIQUE**), `bookmark_tags` (unique pair), `saved_views` (`included_tags`/`excluded_tags` as JSON text), `preserved_copies` (`kind` in `html|pdf|archive_org`), and a single-row `preferences` (`default_sort` in `added_desc|added_asc|title|updated_desc|read_status`, `items_per_page` integer, `text_size` in `small|medium|large`)
- [X] T007 Seed the single global `preferences` row in a migration/bootstrap step in `/work/src/db/index.js` with defaults (`default_sort=added_desc`, `items_per_page=25`, `text_size=medium`); this is one global row, **not** session-scoped (FR-042)
- [X] T008 Assemble the Express app in `/work/src/app.js`: JSON body parsing, static hosting of `src/public`, `/api` router mounting, and a cookie/session layer that is **global-only** — it MUST NOT key any data by session; all bookmarks, tags, saved views, and preferences are one shared collection served identically on every visit/restart (FR-042; research §9)
- [X] T009 [P] Add centralized error-handling + JSON error shape `{error:{code,message}}` with status mapping (400/404/409/502) in `/work/src/app.js` (or `/work/src/middleware/errors.js`)
- [X] T010 Create `/work/server.js` to start the app listening on `0.0.0.0:4000`
- [X] T011 [P] Implement URL validation + normalization service in `/work/src/services/url.js` implementing FR-041 exactly: http/https only; lowercase host; drop default port (80 http / 443 https); remove at most one trailing slash on path; compare scheme/path/query/fragment exactly; never strip query/fragment wholesale; apply an (initially curated) known-harmless allow-list. Export `isValidUrl(url)` and `normalizeKey(url)`
- [X] T012 [P] Implement note sanitizer in `/work/src/services/sanitize.js`: allow only headings, bold/italic, lists, links; strip scripts/handlers/unsafe URLs; export `sanitizeNote(html)` and `toPlainText(html)` for the search index
- [X] T013 [P] Unit tests for URL normalization in `/work/tests/unit/url.test.js` covering FR-041 cases (host case, default port, single trailing slash → same; fragment/query differences → different)

**Checkpoint**: Foundation ready — server boots, DB migrates, shared services available.

---

## Phase 3: User Story 1 - Save a bookmark with rich metadata (Priority: P1) 🎯 MVP

**Goal**: Save a bookmark from a URL, auto-collecting title/description/icon/preview, with editable title/description/address.

**Independent Test**: POST a URL → 201 with metadata; PATCH title/description/address → overrides persist.

- [X] T014 [P] [US1] Implement best-effort metadata service in `/work/src/services/metadata.js`: fetch page, parse `<title>`, meta description, Open Graph/Twitter tags (`og:title`,`og:description`,`og:image`), favicon; use Playwright/Chromium with a strict timeout fallback; return partial data, never throw (FR-002/005)
- [X] T015 [US1] Implement Bookmark model create/read/update/delete in `/work/src/models/bookmark.js` (compute `url_key` via url.js, set `note_html` via sanitize.js + `note_text`, defaults `is_read=0`/`is_archived=0`, `created_at`/`updated_at`) (FR-001/003/004/005/006)
- [X] T016 [US1] Implement `POST /api/bookmarks` and `PATCH /api/bookmarks/:id` in `/work/src/routes/bookmarks.js`: validate URL (400 on invalid), collect metadata, allow editing title/description/address/note; on `url_key` conflict return 409 with existing bookmark (FR-001–005; duplicate hook wired in US2)
- [X] T017 [US1] Implement `GET /api/bookmarks/:id` and `DELETE /api/bookmarks/:id` in `/work/src/routes/bookmarks.js` (FR-006/038)
- [X] T018 [P] [US1] Front-end: add-bookmark form + bookmark editor (title/description/address editable) in `/work/src/public/js/editor.js` and `/work/src/public/index.html`
- [X] T019 [US1] Front-end: initial list render and set `data-harness-ready="true"` after first load (or empty state) in `/work/src/public/js/app.js`
- [X] T020 [P] [US1] Integration test for save + edit + metadata fallback in `/work/tests/integration/bookmarks.save.test.js`

**Checkpoint**: A bookmark can be saved with metadata, edited, and deleted — minimal usable app.

---

## Phase 4: User Story 2 - Duplicate save opens existing (Priority: P1)

**Goal**: Re-saving an existing address (incl. archived) opens the existing bookmark; no duplicate.

**Independent Test**: Save same URL / host-case / trailing-slash variant → 409 with existing bookmark; archived match → restore hint.

- [X] T021 [US2] Extend `POST /api/bookmarks` and `PATCH` (address change) in `/work/src/routes/bookmarks.js` to detect existing `url_key` and return 409 `{bookmark, duplicate:true, archived?}` with restore hint when archived (FR-007/008/041)
- [X] T022 [P] [US2] Front-end: on duplicate 409, open the existing bookmark for editing and, if archived, offer restore, in `/work/src/public/js/editor.js`
- [X] T023 [P] [US2] Integration test for duplicate + normalization + archived-match in `/work/tests/integration/bookmarks.duplicate.test.js`

**Checkpoint**: Zero duplicates on re-save (SC-006).

---

## Phase 5: User Story 3 - Browse and reopen (Priority: P1)

**Goal**: Readable list emphasizing title/description/tags/icon; open in new tab; click a tag to filter.

**Independent Test**: `GET /api/bookmarks` lists items; `?tag=` filters; opening reaches original page.

- [X] T024 [US3] Implement base list query in `/work/src/models/bookmark.js` (default `is_archived=0`, sort `added_desc`, pagination) exposing `list({filters, sort, page, page_size})`; filters accept `tag`, `included_tags[]`, `excluded_tags[]`, `view`, and `saved_view_id` so the same resolver backs browse and bulk (FR-005/014)
- [X] T025 [US3] Implement `GET /api/bookmarks` in `/work/src/routes/bookmarks.js` accepting `tag` (repeatable), `included_tags`/`excluded_tags` (repeatable), `view`, `saved_view_id`, and pagination (FR-014/014a); returns `{items,total,page,page_size}`
- [X] T026 [P] [US3] Front-end list UI emphasizing title/description/tags/icon, "open in new tab", clickable tags that filter (FR-014/014a/015) in `/work/src/public/js/list.js` and `/work/src/public/css/styles.css`
- [X] T027 [P] [US3] Front-end empty state in `/work/src/public/js/list.js` (FR-016)

**Checkpoint**: Core save→browse→open loop complete (MVP candidate = US1+US2+US3).

---

## Phase 6: User Story 4 - Descriptions and formatted notes (Priority: P2)

**Goal**: Short description + separate formatted note that round-trips safely.

**Independent Test**: Add a formatted note; reopen; formatting preserved; note distinct from description.

- [X] T028 [US4] Ensure model persists `note_html` (sanitized) + `note_text` and keeps description separate in `/work/src/models/bookmark.js` (FR-009/010)
- [X] T029 [P] [US4] Front-end formatted-note editor (headings, bold/italic, lists, links) in `/work/src/public/js/note-editor.js`
- [X] T030 [P] [US4] Unit test for sanitizer (strips scripts, keeps allowed tags) in `/work/tests/unit/sanitize.test.js`

---

## Phase 7: User Story 5 - Tagging with suggestions (Priority: P2)

**Goal**: Assign tags with case-insensitive suggestions from existing tags; no near-duplicates.

**Independent Test**: Type partial tag → existing matches suggested; selecting reuses tag; new tag created only when no match.

- [X] T031 [US5] Implement Tag model + `bookmark_tags` join operations in `/work/src/models/tag.js` (case-insensitive `name_key` uniqueness; add-if-missing) (FR-011/012/013)
- [X] T032 [US5] Implement `GET /api/tags` and `GET /api/tags/suggest?q=` in `/work/src/routes/tags.js` (FR-012)
- [X] T033 [US5] Wire tag assignment into `POST/PATCH /api/bookmarks` in `/work/src/routes/bookmarks.js` (reuse existing tags, create new when needed) (FR-011/012/013)
- [X] T034 [P] [US5] Front-end tag input with live suggestions in `/work/src/public/js/tag-input.js`
- [X] T035 [P] [US5] Unit test for tag reuse/uniqueness in `/work/tests/unit/tag.test.js`

---

## Phase 8: User Story 6 - Powerful search (Priority: P1)

**Goal**: Case-insensitive search across title/description/note/address/tags with phrase, `#tag`, AND/OR/NOT + parentheses; quoted operators literal.

**Independent Test**: keyword, `"exact phrase"`, `#tag`, `(#a OR #b) AND word NOT #c`, `"rock and roll"` literal, malformed → error, archived excluded.

- [X] T036 [P] [US6] Implement search query parser (recursive descent → expression tree; quoted phrases with literal AND/OR/NOT; `#tag`; implicit AND; parentheses; malformed → error) in `/work/src/services/search.js` (FR-018/019)
- [X] T037 [US6] Implement evaluator matching the tree against bookmarks case-insensitively over title/description/note_text/url/tags, excluding archived unless archive view, in `/work/src/services/search.js` (FR-017/020)
- [X] T038 [US6] Wire `q` into `GET /api/bookmarks` in `/work/src/routes/bookmarks.js`; return 400 on malformed query (FR-017/018/019/020)
- [X] T039 [P] [US6] Front-end search box + no-results state in `/work/src/public/js/search.js` (FR-016)
- [X] T040 [P] [US6] Unit tests for parser/evaluator (phrase, #tag, boolean, quoted-operator-literal, malformed) in `/work/tests/unit/search.test.js`

---

## Phase 9: User Story 7 - Read status and unread view (Priority: P2)

**Goal**: Read/unread status (default unread) + separate unread view.

**Independent Test**: New bookmarks default unread; `?view=unread` shows only unread, non-archived.

- [X] T041 [US7] Add `is_read` set/get in `/work/src/models/bookmark.js` and `view=unread` filter (`is_read=0 AND is_archived=0`) to the list query (FR-021/022)
- [X] T042 [US7] Support `view=unread` in `GET /api/bookmarks` and read-status update via `PATCH` in `/work/src/routes/bookmarks.js` (FR-021/022)
- [X] T043 [P] [US7] Front-end read/unread toggle + unread view switch in `/work/src/public/js/list.js`

---

## Phase 10: User Story 8 - Reversible archiving (Priority: P2)

**Goal**: Archive excludes from normal browsing/search/unread; archive view; restore keeps tags/note/read status.

**Independent Test**: Archive → absent from default/search/unread; present in `?view=archive`; restore → reappears intact.

- [X] T044 [US8] Add `is_archived` set/get and `view=archive` filter in `/work/src/models/bookmark.js`; ensure all default/search/unread queries exclude archived (FR-020/023/024)
- [X] T045 [US8] Support archive/restore via `PATCH` and `view=archive` in `GET /api/bookmarks` in `/work/src/routes/bookmarks.js` (FR-023/024)
- [X] T046 [P] [US8] Front-end archive/restore actions + archive view + empty-archive state in `/work/src/public/js/list.js` (FR-016)
- [X] T047 [P] [US8] Integration test: archive excluded everywhere, restore round-trip (SC-009) in `/work/tests/integration/archive.test.js`

---

## Phase 11: User Story 9 - Bulk actions (Priority: P2)

**Goal**: Act on explicit selections or the complete current view (all pages) with a correct pre-deletion count.

**Independent Test**: select by ids and by "all matching" (q + included/excluded tags + view + saved view); apply tag/read/archive; delete requires confirm and reports affected.

- [X] T048 [US9] Implement a shared view-resolver in `/work/src/models/bookmark.js` (reused by T024/T025 list and by bulk) that resolves the **complete current view** (`q`, `included_tags`, `excluded_tags`, `tag`, `view`, `saved_view_id`) to the full matching id set, ignoring pagination; a `saved_view_id` MUST expand to that view's exact stored filters (FR-025/025a)
- [X] T049 [US9] Implement `POST /api/bookmarks/bulk` (addTags/removeTags/is_read/is_archived/delete) accepting `{selector:{ids}}` or `{selector:{matching:<full filter incl. saved_view_id>}}`; destructive actions require `confirm:true`; the number of items changed MUST equal the resolver's count (FR-025/025a/026/027) in `/work/src/routes/bookmarks.js`
- [X] T050 [US9] Implement `POST /api/bookmarks/bulk/count` returning the exact affected count for the selector (equal to items that would change), used before destructive confirmation (FR-027) in `/work/src/routes/bookmarks.js`
- [X] T051 [P] [US9] Front-end selection UI: per-item select, "select all matching current view", bulk action bar showing the confirmed count before delete; when a saved view is open, pass its `saved_view_id` (or expanded filters) to the bulk call (FR-025a) in `/work/src/public/js/bulk.js`
- [X] T052 [P] [US9] Integration test: "select all matching" honors included/excluded tags + view + saved view across pages; from an open saved view the affected set equals the view's results; count equals items changed (FR-025/025a/027) in `/work/tests/integration/bulk.test.js`

---

## Phase 12: User Story 10 - Sorting (Priority: P2)

**Goal**: Sort by date added, title, last updated, read status; default from preferences.

**Independent Test**: switch `sort`; reopening applies default sort from preferences.

- [X] T053 [US10] Add `sort` handling (`added_desc|added_asc|title|updated_desc|read_status`) to the list query in `/work/src/models/bookmark.js` and `GET /api/bookmarks` (FR-028)
- [X] T054 [P] [US10] Front-end sort control defaulting to preference in `/work/src/public/js/list.js`

---

## Phase 13: User Story 11 - Saved views (Priority: P3)

**Goal**: Save/reopen/rename/delete named query + included/excluded tag combinations.

**Independent Test**: create view; reopen reproduces results; rename/delete don't affect bookmarks.

- [X] T055 [US11] Implement SavedView model (name, query, included_tags/excluded_tags JSON) in `/work/src/models/savedView.js` (FR-029)
- [X] T056 [US11] Implement `GET/POST/PATCH/DELETE /api/views` and `GET /api/views/:id/results` (reuses list + view-resolver) in `/work/src/routes/views.js` (FR-029/030)
- [X] T057 [P] [US11] Front-end saved-views list + save-current-view control in `/work/src/public/js/views.js`

---

## Phase 14: User Story 12 - Page preservation (Priority: P3)

**Goal**: Self-contained HTML for pages, stored PDF for PDF links, Internet Archive reference; failures reported, bookmark unchanged.

**Independent Test**: preserve page → self-contained HTML served back; PDF URL → stored PDF; archive_org → reference stored; unreachable → 502.

- [X] T058 [US12] Implement PreservedCopy model in `/work/src/models/bookmark.js` or `/work/src/models/preserved.js` (kind `html|pdf|archive_org`, location, captured_at, bookmark_id) (data-model.md)
- [X] T059 [US12] Implement preservation service in `/work/src/services/preserve.js`: self-contained HTML via Playwright/Chromium with inlined assets; PDF download for PDF addresses; Internet Archive "Save Page Now" submission storing the returned reference; all best-effort (FR-031/032/033/034)
- [X] T060 [US12] Implement `POST /api/bookmarks/:id/preserve` (mode `local|archive_org`; 502 on failure, bookmark unchanged) and `GET /api/bookmarks/:id/preserved/:copyId` (serve html/pdf) in `/work/src/routes/ioRoutes.js` (FR-031–034)
- [X] T061 [P] [US12] Front-end preserve controls + links to stored copies in `/work/src/public/js/editor.js`

---

## Phase 15: User Story 13 - Import/export (Priority: P2)

**Goal**: Import/export Netscape bookmark HTML retaining titles/tags/dates; predictable merge.

**Independent Test**: import retains titles/tags/dates; duplicates merge keeping existing fields, adding only missing tags; export reproduces valid file.

- [X] T062 [P] [US13] Implement Netscape bookmark parser + writer in `/work/src/services/importExport.js` (address/title/`ADD_DATE`/`LAST_MODIFIED`/`TAGS`, folders→tags when no TAGS) (FR-035/037)
- [X] T063 [US13] Implement merge on import: existing bookmark keeps own title/description/note/read/archive/dates; add only missing tags; report `{added,merged,skipped}` in `/work/src/services/importExport.js` (FR-036)
- [X] T064 [US13] Implement `POST /api/import` (multipart) and `GET /api/export` in `/work/src/routes/ioRoutes.js` (FR-035/036/037)
- [X] T065 [P] [US13] Front-end import/export UI showing import counts in `/work/src/public/js/settings.js`
- [X] T066 [P] [US13] Unit test: import merge keeps existing fields + adds only missing tags; round-trip retains titles/tags/dates (SC-007) in `/work/tests/unit/importExport.test.js`

---

## Phase 16: User Story 14 - Display preferences (Priority: P3)

**Goal**: Default sort, items per page, text size — persisted globally, applied to the list.

**Independent Test**: change preferences; reopen app → applied; pagination respects items-per-page.

- [X] T067 [US14] Implement Preferences model (single global row) in `/work/src/models/preferences.js` (FR-039)
- [X] T068 [US14] Implement `GET /api/preferences` and `PUT /api/preferences` (validate enum values) in `/work/src/routes/preferences.js` (FR-039)
- [X] T069 [US14] Apply items-per-page pagination default across the list query/endpoint in `/work/src/routes/bookmarks.js` (FR-040)
- [X] T070 [P] [US14] Front-end settings screen for default sort/items-per-page/text-size in `/work/src/public/js/settings.js`

---

## Phase 17: Polish & Cross-Cutting Concerns

**Purpose**: Verification and delivery readiness across stories

- [X] T071 Write `/work/.harness/app.json`: `{"kind":"application","port":4000,"path":"/","start_command":["npm","start"],"start_cwd":"/work"}`
- [X] T072 [P] End-to-end Playwright test (save→search→open, archive round-trip, bulk "select all matching") in `/work/tests/e2e/flows.spec.js` (pinned 1.61.0)
- [X] T073 [P] Persistence check: bookmarks, tags, saved views, and preferences survive restart and appear identically on a new browser visit with no session partitioning or separate/empty collection (FR-042; SC-005/SC-010) in `/work/tests/integration/persistence.test.js`
- [X] T074 [P] Seed script for 1,000–5,000 bookmarks to validate search/browse performance (SC-002/SC-003) in `/work/scripts/seed.js`
- [X] T074a [P] Large-collection bulk performance check: over a seeded 5,000+ bookmark set, "select all matching the complete current view" + apply a bulk action (tag/archive) completes under 10 seconds and the affected count equals items changed (SC-008; FR-025/027) in `/work/tests/integration/bulk.perf.test.js`
- [X] T075 Run `quickstart.md` validation scenarios end-to-end and fix any gaps
- [X] T076 [P] README with run/test instructions in `/work/README.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies
- **Foundational (Phase 2)**: depends on Setup — BLOCKS all user stories
- **User Stories (Phases 3–16)**: depend on Foundational; then largely independent
- **Polish (Phase 17)**: depends on desired stories being complete

### Story dependencies / notes

- **US1, US2, US3, US6 (all P1)** form the core loop; recommended first.
- US2 extends US1's create/patch routes (same file — sequence T016 → T021).
- US9 (bulk) reuses the view-resolver that also serves US6 search and US11 saved views; implement US6 before US9's "select all matching" test.
- US11 `GET /api/views/:id/results` reuses the list/search stack (US3/US6).
- US14 pagination default feeds US3 list endpoint; US3 can ship with a hardcoded default first, then read preferences in US14.

### Parallel opportunities

- Setup: T003, T004 in parallel.
- Foundational: T011, T012, T013 in parallel after T005–T010.
- Within a story, `[P]` front-end/test tasks run alongside model/route work in different files.
- After Foundational, different developers can take different stories in parallel.

---

## Implementation Strategy

### MVP first

1. Phase 1 Setup → Phase 2 Foundational.
2. Phase 3 (US1) + Phase 4 (US2) + Phase 5 (US3) + Phase 8 (US6) → the core save / dedupe / browse / search loop.
3. **STOP and VALIDATE** against quickstart scenarios 1–5, then demo.

### Incremental delivery

Add P2 stories (US4, US5, US7, US8, US9, US10, US13) → then P3 (US11, US12, US14) → Polish. Each story is independently testable per its Independent Test line.

---

## Notes

- `[P]` = different files, no incomplete dependencies.
- Every task lists an exact file path.
- Tests included are a focused set (pure-logic unit tests + key API/e2e flows), not exhaustive TDD.
- Commit after each task or logical group; validate at each checkpoint.
