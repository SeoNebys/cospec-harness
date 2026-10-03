---
description: "Task list for Bookmark Manager implementation"
---

# Tasks: Bookmark Manager

**Input**: Design documents from `/specs/001-bookmark-manager/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Included for the highest-risk areas (search-grammar parser, import/export
round-trip, and one end-to-end journey per major story), per the plan's testing
approach. Other tasks are implementation-only.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: User story the task belongs to (US1–US13)

## Path Conventions

Single Node web-application project at repo root: `src/`, `tests/`, `public/`,
`data/`, per plan.md Structure Decision.

---

## Phase 1: Setup (Shared Infrastructure)

- [ ] T001 Create project structure per plan.md: `src/{db,models,services,routes,public/js}`, `tests/{unit,e2e}`, `data/pagecopies/` in repo root
- [ ] T002 Initialize Node project: `package.json` (ES modules, `"start": "node src/server.js"`, `"migrate"`, `"test"` scripts) and install pinned deps `express`, `better-sqlite3`, `cheerio`, `marked`, `dompurify`, `jsdom`, and dev `playwright@1.61.0`/`@playwright/test@1.61.0`; commit `package-lock.json`
- [ ] T003 [P] Configure Playwright to use shared browsers at `/opt/playwright-browsers` (no download) in `playwright.config.js` (baseURL `http://127.0.0.1:4000`)
- [ ] T004 [P] Add `.gitignore` (node_modules, `data/bookmarks.db`, `data/pagecopies/*`) and a `data/.gitkeep`

---

## Phase 2: Foundational (Blocking Prerequisites)

**⚠️ CRITICAL**: Must complete before ANY user story.

- [ ] T005 Implement SQLite connection + forward-only migrations runner in `src/db/index.js` (opens `data/bookmarks.db`, `PRAGMA foreign_keys=ON`)
- [ ] T006 Create initial schema migration in `src/db/migrations/001_init.sql` per data-model.md: `bookmarks` (url unique required; title, description, note, icon_url, preview_image_url; `is_read` default **1**, `is_archived` default **0**; page_copy_path, page_copy_kind (`html`|`pdf`), archive_org_url; created_at, updated_at), `tags` (name unique case-insensitive), `bookmark_tags` (PK (bookmark_id,tag_id), FKs ON DELETE CASCADE), `saved_filters` (name unique; terms; include_tags JSON; exclude_tags JSON; created_at), `preferences` (single row id=1; default_sort in {newest,oldest,title,updated} default `newest`; page_size default 25; text_size in {small,medium,large} default `medium`)
- [ ] T007 [P] Add indexes migration in `src/db/migrations/002_indexes.sql`: unique `bookmarks.url`, unique case-insensitive `tags.name`, index on `bookmarks(is_archived,is_read)`, `created_at`, `updated_at`
- [ ] T008 Seed the single preferences row (id=1) with defaults during migration/bootstrap
- [ ] T009 [P] Bootstrap Express app + JSON/body/multipart middleware + centralized error handler (`{error}` shape, 4xx/5xx) in `src/server.js`; listen on `0.0.0.0:4000`
- [ ] T010 [P] Mount empty routers `src/routes/{bookmarks,tags,filters,preferences,io,views}.js` in `src/server.js`
- [ ] T011 [P] URL validation + normalization helper (reject empty/malformed → error) in `src/services/url.js`
- [ ] T012 [P] Server-rendered app shell `GET /` in `src/routes/views.js` + `src/public/index.html` with view scaffolding (normal/unread/archive) and `data-harness-ready="true"` set only after initial UI+data load (incl. valid empty state)
- [ ] T013 [P] Write `.harness/app.json`: `{"kind":"application","port":4000,"path":"/","start_command":["npm","start"],"start_cwd":"/work"}`

**Checkpoint**: DB, server, routing, shell ready — stories can begin.

---

## Phase 3: User Story 1 - Save a bookmark with page metadata (Priority: P1) 🎯 MVP

**Goal**: Save a URL; auto-capture title/description/favicon/preview; edit title & description in the save form and afterward; list rows show title/description/tags/icon.

**Independent Test**: Add a URL with OG tags → item shows fetched metadata; edit title/description before and after saving; list row shows title, description, tags, icon.

- [ ] T014 [P] [US1] Metadata service in `src/services/metadata.js`: fetch page, extract `<title>`, meta description, OG (`og:title`/`og:description`/`og:image`), Twitter-card fallbacks, favicon (`<link rel=icon>` + `/favicon.ico`); Chromium (Playwright) fallback for JS pages; best-effort — missing fields return empty, failures reported without throwing (FR-003/FR-005)
- [ ] T015 [P] [US1] Bookmark model in `src/models/bookmark.js`: create/get/update/list/delete with url-uniqueness lookup; title falls back to URL when empty; maintain created_at/updated_at (FR-001/FR-005)
- [ ] T016 [P] [US1] Tag model + `bookmark_tags` linking in `src/models/tag.js`: get-or-create by case-insensitive name (uniqueness, FR-014a), attach/detach tags to a bookmark
- [ ] T017 [US1] `POST /api/bookmarks` in `src/routes/bookmarks.js`: validate URL (400 on bad, FR-002), reject nothing saved on invalid; on new URL fetch metadata + create (201); accept optional title/description/tags (depends on T014–T016)
- [ ] T018 [US1] `GET /api/bookmarks` (basic list, `view=normal` excludes archived; default sort newest) and `GET /api/bookmarks/:id` in `src/routes/bookmarks.js`
- [ ] T019 [US1] `PATCH /api/bookmarks/:id` supporting title/description/url/tags edits (url collision → 409) in `src/routes/bookmarks.js` (FR-004/FR-025)
- [ ] T020 [US1] Save form UI (URL + editable fetched title/description + tags) and list rendering showing title, description, tags, site icon (FR-004a) in `src/public/index.html` + `src/public/js/bookmarks.js`
- [ ] T021 [US1] Empty state + malformed-URL error display in the UI (FR-010/edge cases)

**Checkpoint**: US1 fully functional — save with metadata, edit, list. MVP.

---

## Phase 4: User Story 2 - Open, note, and revisit bookmarks (Priority: P1)

**Goal**: Markdown notes rendered formatted + persisted; open original in new tab.

**Independent Test**: Add a Markdown note → renders formatted, persists; select bookmark → original opens in new tab.

- [ ] T022 [P] [US2] Notes service in `src/services/notes.js`: render Markdown via `marked` and sanitize via DOMPurify+jsdom (FR-006)
- [ ] T023 [US2] Extend `PATCH /api/bookmarks/:id` and `GET /api/bookmarks/:id` to store raw `note` and return sanitized rendered HTML in `src/routes/bookmarks.js` (FR-006)
- [ ] T024 [US2] Note editor + formatted display, and open-original-in-new-tab (`target=_blank rel=noopener`) in `src/public/js/bookmarks.js` (FR-007)

**Checkpoint**: US1–US2 work independently.

---

## Phase 5: User Story 3 - Edit-on-duplicate save (Priority: P1)

**Goal**: Re-saving an existing URL opens it for editing; no duplicate.

**Independent Test**: Save a URL, save it again → existing bookmark opens for edit, no new row.

- [ ] T025 [US3] Update `POST /api/bookmarks`: on existing URL return 200 with existing bookmark + `{duplicate:true}`, create no row (FR-008) in `src/routes/bookmarks.js`
- [ ] T026 [US3] Client handles `duplicate:true` by opening the existing bookmark in editable view in `src/public/js/bookmarks.js`

**Checkpoint**: US1–US3 work independently.

---

## Phase 6: User Story 4 - Advanced search across all text (Priority: P2)

**Goal**: Case-insensitive search across title/URL/description/note/tags with `#tag`, quoted phrases, AND/OR/NOT, parentheses, implicit-AND, quoted-operator-as-literal, and clear errors.

**Independent Test**: Run each row of the search-grammar worked-examples table; verify implicit-AND, explicit OR, quoted `"AND"` literal, grouped booleans, malformed-query error.

- [ ] T027 [P] [US4] Search tokenizer + recursive-descent parser → AST in `src/services/search.js` per contracts/search-grammar.md: word, `"phrase"`, `#tag`, `AND`/`OR`/`NOT` (uppercase, unquoted only), parentheses; implicit-AND adjacency (FR-010a); quoted operator = literal (FR-010b); precedence NOT>AND>OR
- [ ] T028 [P] [US4] Parser error detection (unbalanced quotes/parens, dangling operator, empty parens) returning clear error (FR-011) in `src/services/search.js`
- [ ] T029 [P] [US4] Unit tests for parser+evaluator covering every worked example and each error case in `tests/unit/search.test.js`
- [ ] T030 [US4] AST evaluator: case-insensitive substring match across title/URL/description/note (word/phrase); `#tag` matches tags only (FR-009) in `src/services/search.js`
- [ ] T031 [US4] Wire `q` param into `GET /api/bookmarks` (400 on malformed) + empty-results state; search box in `src/public/js/search.js` (FR-012)

**Checkpoint**: US1–US4 work independently.

---

## Phase 7: User Story 5 - Tagging with suggestions (Priority: P2)

**Goal**: Suggest existing tags while typing; typed names reuse existing tags (unique).

**Independent Test**: Type an existing tag prefix → suggested; typing an existing name (not selecting) reuses it, no duplicate.

- [ ] T032 [US5] `GET /api/tags?q=` prefix suggestions + full list in `src/routes/tags.js` (FR-014); reuse existing tag on typed match, never duplicate (FR-014a)
- [ ] T033 [US5] Tag input with type-ahead suggestions in `src/public/js/tags.js`

**Checkpoint**: US1–US5 work independently.

---

## Phase 8: User Story 6 - Read-later and read state (Priority: P2)

**Goal**: Unread view (unread, non-archived only); mark read/unread; new bookmarks start read.

**Independent Test**: New bookmark is read (absent from unread view); mark unread → appears; mark read → leaves.

- [ ] T034 [US6] `POST /api/bookmarks/:id/read` and `/unread` in `src/routes/bookmarks.js`; confirm create defaults `is_read=1` (FR-015)
- [ ] T035 [US6] `view=unread` filter (unread AND not archived) in `GET /api/bookmarks` + unread view UI/toggle in `src/public/js/bookmarks.js`

**Checkpoint**: US1–US6 work independently.

---

## Phase 9: User Story 7 - Reversible archiving (Priority: P2)

**Goal**: Archive excludes from normal list/default search; archive view; restore; page copy retained.

**Independent Test**: Archive → gone from normal list & default search, present in archive view; restore → returns.

- [ ] T036 [US7] `POST /api/bookmarks/:id/archive` and `/restore` (retain page copy) in `src/routes/bookmarks.js` (FR-016)
- [ ] T037 [US7] `view=archive` (archived only) + ensure `normal`/search exclude archived; archive view UI in `src/public/js/bookmarks.js`

**Checkpoint**: US1–US7 work independently.

---

## Phase 10: User Story 8 - Bulk actions (Priority: P2)

**Goal**: Select several or all-in-current-filter; add/remove tags, mark read/unread, archive/restore, delete (one confirm), carrying all filter conditions.

**Independent Test**: Multi-select and select-all-in-results; apply tag add + archive + delete to selection; verify all affected and selectAll honors include/exclude tags.

- [ ] T038 [US8] `POST /api/bookmarks/bulk` in `src/routes/bookmarks.js`: accept `ids[]` or `selectAll:{q,view,include_tags,exclude_tags}` resolved via the same list query so include/exclude tags carry through (FR-017); actions add_tags|remove_tags|mark_read|mark_unread|archive|restore|delete; return `{affected}`
- [ ] T039 [US8] Multi-select + "select all results" UI with a single confirm for bulk delete in `src/public/js/bulk.js`

**Checkpoint**: US1–US8 work independently.

---

## Phase 11: User Story 9 - Sorting options (Priority: P3)

**Goal**: Sort newest/oldest/title/updated; default from preferences.

**Independent Test**: Switch sorts; default respects preference (newest out of the box).

- [ ] T040 [US9] `sort` param (newest|oldest|title|updated) in `GET /api/bookmarks`, defaulting to preferences.default_sort, in `src/routes/bookmarks.js` (FR-018)
- [ ] T041 [US9] Sort selector UI reflecting current choice in `src/public/js/bookmarks.js`

**Checkpoint**: US1–US9 work independently.

---

## Phase 12: User Story 10 - Saved reusable filters (Priority: P3)

**Goal**: Named filters (terms + include/exclude tags); apply carries all conditions; delete.

**Independent Test**: Save a filter, apply it (results honor terms + include + exclude), delete it.

- [ ] T042 [P] [US10] SavedFilter model in `src/models/filter.js` (name unique; terms; include_tags/exclude_tags JSON arrays)
- [ ] T043 [US10] `GET/POST /api/filters` + `DELETE /api/filters/:id` in `src/routes/filters.js` (FR-019)
- [ ] T044 [US10] Apply filter by passing terms→`q` plus include_tags/exclude_tags to list query; wire `include_tags`/`exclude_tags` params into `GET /api/bookmarks`; saved-filter UI in `src/public/js/filters.js`

**Checkpoint**: US1–US10 work independently.

---

## Phase 13: User Story 11 - Import and export (browser HTML) (Priority: P3)

**Goal**: Import/export Netscape bookmark HTML preserving titles/tags/dates; merge by URL.

**Independent Test**: Import a browser HTML file (titles/tags/dates preserved, existing URLs merged); export and round-trip with no loss/duplication.

- [ ] T045 [P] [US11] Netscape bookmark HTML parse+generate in `src/services/porthtml.js` (cheerio): titles, `ADD_DATE`/`LAST_MODIFIED`, `TAGS` attribute
- [ ] T046 [P] [US11] Round-trip unit test (export→import preserves titles/tags/dates, no duplicates) in `tests/unit/porthtml.test.js` (SC-006)
- [ ] T047 [US11] `POST /api/import` (merge by URL, 400 on malformed/non-bookmark, `{imported,merged}`) and `GET /api/export` (attachment) in `src/routes/io.js` (FR-020)
- [ ] T048 [US11] Import/export controls in `src/public/js/io.js`

**Checkpoint**: US1–US11 work independently.

---

## Phase 14: User Story 12 - Preserved page copies (Priority: P3)

**Goal**: Self-contained single-file HTML copy (offline), PDFs kept as PDF; Internet Archive submission; failures reported without harming bookmark; delete removes copy.

**Independent Test**: Save local copy of HTML page → opens offline; PDF URL preserved as PDF; archive.org submission records link; failure reported, bookmark intact; deleting bookmark removes copy file.

- [ ] T049 [P] [US12] Page-copy service in `src/services/pagecopy.js`: detect content type; for HTML render in Chromium and inline CSS/images/fonts as data URIs into one self-contained file; for PDF download as-is; store under `data/pagecopies/` (FR-021)
- [ ] T050 [P] [US12] Internet Archive service in `src/services/archiveorg.js`: submit URL to Save Page Now with timeout; return snapshot link; failure surfaces as error (FR-022)
- [ ] T051 [US12] `POST /api/bookmarks/:id/pagecopy` (502 on failure, bookmark unchanged), `GET /api/bookmarks/:id/pagecopy` (serve file), `POST /api/bookmarks/:id/archiveorg` in `src/routes/bookmarks.js`
- [ ] T052 [US12] Update `DELETE /api/bookmarks/:id` to remove the local page-copy file on permanent delete (not on archive) in `src/routes/bookmarks.js` (data-model.md)
- [ ] T053 [US12] Page-copy + archive.org controls and links in `src/public/js/bookmarks.js`

**Checkpoint**: US1–US12 work independently.

---

## Phase 15: User Story 13 - Display preferences (Priority: P3)

**Goal**: Adjust default sort, page size, text size; persist.

**Independent Test**: Change each preference → applies and persists across restart.

- [ ] T054 [P] [US13] Preferences model in `src/models/preferences.js` (single row; validate enums per data-model.md)
- [ ] T055 [US13] `GET/PATCH /api/preferences` in `src/routes/preferences.js` (FR-024)
- [ ] T056 [US13] Preferences UI (default sort, page size, text size) applying text size + wiring pagination `page`/`page_size` into list in `src/public/js/preferences.js` and `bookmarks.js`

**Checkpoint**: All user stories independently functional.

---

## Phase 16: Polish & Cross-Cutting Concerns

- [ ] T057 [P] End-to-end journey tests (save+metadata, search, read-later, archive, bulk, import/export) in `tests/e2e/` with Playwright pinned 1.61.0
- [ ] T058 [P] Performance check: search + list feel instant at 500+ bookmarks (SC-002/SC-003); add missing indexes if needed
- [ ] T059 Run `quickstart.md` validation scenarios end-to-end and confirm `data-harness-ready` marker behavior
- [ ] T060 [P] README with setup/run/test instructions and the review URLs (`http://maker:4000`)

---

## Dependencies & Execution Order

- **Setup (Phase 1)** → **Foundational (Phase 2)** blocks all stories.
- **US1 (P1)** is the MVP and underpins later UI; US2/US3 extend US1's save/edit.
- **US4–US8 (P2)** and **US9–US13 (P3)** each build on the US1 list/model but are
  independently testable. US10 depends on the list-query tag params (also used by
  US8 selectAll — implement the shared `include_tags`/`exclude_tags` list support
  once, in T044/T038).
- **Polish (Phase 16)** last.

### Within Each User Story

- Models → services → endpoints → UI. Tests for US4 and US11 written alongside
  their services.

### Parallel Opportunities

- Setup: T003, T004 in parallel.
- Foundational: T007, T009–T013 in parallel after T005–T006.
- US1: T014, T015, T016 in parallel before endpoints.
- Cross-story: once Foundational + US1 land, different stories can proceed in
  parallel (distinct files).

---

## Implementation Strategy

### MVP First

1. Phase 1 Setup → 2. Phase 2 Foundational → 3. Phase 3 US1 → **validate** save +
   metadata + edit + list, then demo.

### Incremental Delivery

Add US2 → US3 (complete the P1 save/edit experience), then P2 stories
(search, tags, read-later, archive, bulk), then P3 (sorting, filters,
import/export, page copies, preferences), validating each independently.

---

## Notes

- [P] = different files, no dependencies.
- Pin Playwright to 1.61.0; use shared browsers, no second download.
- External steps (metadata, page copy, archive.org) must fail gracefully and
  never corrupt a bookmark.
- Commit after each task or logical group.
