---

description: "Task list for Bookmark Manager implementation"
---

# Tasks: Bookmark Manager

**Input**: Design documents from `/specs/001-bookmark-manager/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api.md, quickstart.md

**Tests**: Targeted tests ARE included because the spec's testing approach requested
them for the highest-risk logic (search grammar, address normalisation, Netscape
import/export, metadata parsing) plus a Playwright smoke test. Broad test coverage
of every endpoint is intentionally out of scope.

**Organization**: Tasks are grouped by user story (US1–US12) in priority order.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story the task belongs to

## Path Conventions

Single Node web-application project at repository root: `src/`, `src/public/`,
`tests/`, `data/` (runtime). Paths per plan.md Project Structure.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [ ] T001 Create project structure per plan.md: `src/`, `src/db/`, `src/services/`, `src/routes/`, `src/public/`, `tests/unit/`, `tests/smoke/`
- [ ] T002 Initialize Node.js ES-module project in `package.json` with dependencies express, better-sqlite3, node-html-parser, sanitize-html and devDependencies playwright@1.61.0 and @playwright/test@1.61.0 (pinned to match installed browsers); add `"start": "node src/server.js"` and `"test": "node --test tests/unit && playwright test tests/smoke"` scripts; generate `package-lock.json`
- [ ] T003 [P] Add `.gitignore` entries for `node_modules/` and runtime `data/`; create `playwright.config.js` in repo root using `PLAYWRIGHT_BROWSERS_PATH=/opt/playwright-browsers` and baseURL `http://127.0.0.1:4000`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T004 Define SQLite schema in `src/db/schema.sql` for all entities per data-model.md: `bookmark` (id PK; url text required; canonical_key text required UNIQUE; title, description, icon_url, preview_image_url, note_html text; is_unread integer default 0; is_archived integer default 0; preserved_path text; preserved_kind text `html`|`pdf`|null; archive_org_url text; date_added text ISO-8601 required; updated_at text), `tag` (id PK; name text required UNIQUE case-insensitive), `bookmark_tag` (bookmark_id FK cascade delete, tag_id FK, PK(bookmark_id,tag_id)), `saved_search` (id PK; name text required UNIQUE; query text; included_tags text JSON array; excluded_tags text JSON array; created_at text), `preferences` (id PK always 1; default_sort text; items_per_view integer; text_size text)
- [ ] T005 Implement DB connection + schema bootstrap + preferences singleton seeding in `src/db/index.js` using better-sqlite3 against `data/bookmarks.db` (create `data/` and `data/preserved/` on startup)
- [ ] T006 Implement Express app skeleton in `src/server.js`: JSON body parsing, HTTP session cookie for the single local user, static hosting of `src/public/`, mount `/api` routes, consistent error shape `{ "error": { "code", "message", "details?" } }`, and listen on `0.0.0.0:4000`
- [ ] T007 [P] Implement address normalisation in `src/services/normalize.js`: lowercase scheme+host, strip default ports, remove trailing slash on path, drop tracking params (`utm_*`, `fbclid`, `gclid`), sort remaining query params; export `canonicalKey(url)` and http(s) validity check
- [ ] T008 [P] Unit tests for normalisation in `tests/unit/normalize.test.js` covering trailing-slash, host-case, tracking-param, and invalid-URL cases
- [ ] T009 [P] Create the SPA shell in `src/public/index.html`, `src/public/styles.css`, `src/public/app.js` with a root container and the API client helper; set `data-harness-ready="true"` only after the initial list/empty state renders
- [ ] T010 Create runtime manifest `/work/.harness/app.json` = `{"kind":"application","port":4000,"path":"/","start_command":["npm","start"],"start_cwd":"/work"}`

**Checkpoint**: Foundation ready — server boots, DB persists, SPA shell loads

---

## Phase 3: User Story 1 - Save a bookmark with automatic metadata (Priority: P1) 🎯 MVP

**Goal**: Save a URL; auto-fetch title/description/icon/preview; edit title/description before and after saving; persist.

**Independent Test**: Enter a valid URL → metadata populates → edit title → save → reload → persists; invalid URL rejected.

- [ ] T011 [P] [US1] Implement metadata fetch/parse in `src/services/metadata.js`: fetch with timeout, parse `<title>`, `meta description`, OpenGraph (`og:title/og:description/og:image`), Twitter-card fallback, favicon; derive title from host/path and mark `fallbacksUsed` when fields missing (FR-002, FR-004)
- [ ] T012 [P] [US1] Unit tests for metadata parsing in `tests/unit/metadata.test.js` against sample HTML fixtures (full metadata, missing description/image, no title)
- [ ] T013 [US1] Implement bookmark create/read/update in `src/services/bookmarks.js`: `create({url,title,description,tags,noteHtml,readLater})` sets canonical_key via normalize, `is_unread` only if readLater, date_added=now; `getById`; `update` fields; sanitise note_html via sanitize-html allow-list (b/strong,i/em,ul/ol/li,a,p,br) (FR-001, FR-003, FR-016 default read)
- [ ] T014 [US1] Implement `POST /api/metadata` in `src/routes/metadata.js`: return metadata or `{existingId}` when canonical_key exists; 422 for malformed URL (FR-002, FR-005, FR-006)
- [ ] T015 [US1] Implement `POST /api/bookmarks`, `GET /api/bookmarks/:id`, `PATCH /api/bookmarks/:id` in `src/routes/bookmarks.js` per contracts/api.md; 409 `{existingId}` on duplicate create (FR-001, FR-003, FR-006, FR-007)
- [ ] T016 [US1] Build the add/edit bookmark UI in `src/public/app.js` + view markup: URL input → fetch metadata → editable title/description → save; edit an existing bookmark's title/description; invalid-URL and duplicate→open-existing handling

**Checkpoint**: A bookmark can be saved with metadata, edited, and persists across reload (MVP)

---

## Phase 4: User Story 2 - Re-saving an existing address opens it for editing (Priority: P1)

**Goal**: Re-submitting an existing (or trivially-variant) address opens the existing bookmark, never duplicates.

**Independent Test**: Save a URL; submit it again and a trailing-slash/host-case variant → no duplicate, existing opens.

- [ ] T017 [P] [US2] Unit tests in `tests/unit/duplicate.test.js` asserting variant URLs map to one canonical_key and create is rejected as duplicate
- [ ] T018 [US2] Ensure `POST /api/bookmarks` and `POST /api/metadata` return `existingId`/409 consistently; wire the UI in `src/public/app.js` to open the existing bookmark's editor on that response (FR-006, US2)

**Checkpoint**: Duplicate submissions open the existing bookmark for editing

---

## Phase 5: User Story 3 - Browse, sort, and open bookmarks (Priority: P1)

**Goal**: Main list shows title/description/tags/icon; sortable; selecting opens original; empty state.

**Independent Test**: With several bookmarks, rows show all fields; change sort reorders; select opens original; empty state when none.

- [ ] T019 [US3] Implement list query in `src/services/bookmarks.js`: `list({view,sort,page,pageSize})` for `main` (is_archived=0), ordered by `date_added_desc|date_added_asc|title_asc|title_desc`, returning items+total (FR-010, FR-012)
- [ ] T020 [US3] Implement `GET /api/bookmarks` in `src/routes/bookmarks.js` with `view`/`sort`/`page`/`pageSize` params (defaults from preferences) per contracts/api.md
- [ ] T021 [US3] Build the main list UI in `src/public/app.js`: render title/description/tags/icon per row, sort control, open-original link (new tab), friendly empty state (FR-010, FR-011, FR-029)

**Checkpoint**: Bookmarks list, sort, and open correctly; MVP set (US1–US3) fully usable

---

## Phase 6: User Story 4 - Powerful search (Priority: P2)

**Goal**: Case-insensitive search over title/description/note/address; `#tag`, quoted phrases, implicit-AND, AND/OR/NOT/parens with quoted-operator literal rule; clear no-match and malformed-query states.

**Independent Test**: Run the queries in quickstart scenario 4 and confirm correct matches and messages.

- [ ] T022 [P] [US4] Implement search grammar in `src/services/search.js`: tokenizer (quoted phrase, `#tag`, bare word, `AND`/`OR`/`NOT`/`(`/`)`), recursive-descent parser (precedence NOT > AND(incl. implicit) > OR; operators literal only when quoted), and evaluator matching case-insensitively across title/description/note-as-plain-text/address and tag set; throw a typed error for malformed queries (FR-013, FR-014, FR-015)
- [ ] T023 [P] [US4] Unit tests in `tests/unit/search.test.js` covering: case-insensitivity; `#travel`; implicit AND `#travel japan`; quoted `"rock and roll"` operators-as-text; `#travel AND (japan OR korea) NOT flight`; no-match; unbalanced parens/quotes error
- [ ] T024 [US4] Wire `q` into `GET /api/bookmarks` (evaluator applied to view-filtered candidates); return 400 with clear message on malformed query (FR-015)
- [ ] T025 [US4] Add search box + no-match and malformed-query states to `src/public/app.js`

**Checkpoint**: All search rules behave exactly per spec

---

## Phase 7: User Story 5 - Rich editing: address, tags, formatted notes (Priority: P2)

**Goal**: Edit address/title/description/tags/note; formatted notes rendered; tag suggestions; editing URL to a colliding one prevented.

**Independent Test**: Edit all fields incl. formatted note with tag suggestions; formatting renders and persists; colliding URL edit blocked.

- [ ] T026 [P] [US5] Implement tag assignment + suggestions in `src/services/tags.js`: attach/detach tags to a bookmark (case-insensitive tag reuse), `listWithCounts()` most-used first (FR-009)
- [ ] T027 [US5] Implement `GET /api/tags` in `src/routes/tags.js` (FR-009)
- [ ] T028 [US5] Extend `PATCH /api/bookmarks/:id` to accept url/title/description/tags(full set)/noteHtml(sanitised)/isUnread/isArchived; return 409 `{existingId}` when edited url collides (FR-006, FR-007, FR-008, US5-4)
- [ ] T029 [US5] Build the note editor (contenteditable toolbar: bold/italic/lists/links) and tag input with live suggestions in `src/public/app.js`; render sanitised note HTML in the detail view (FR-008)

**Checkpoint**: Full field editing, formatted notes, and tag suggestions work

---

## Phase 8: User Story 6 - Read-later workflow (Priority: P2)

**Goal**: read/unread state; dedicated unread view; mark read/unread; new bookmarks read-by-default.

**Independent Test**: Save without/with "read later"; mark ordinary unread and back; confirm unread view membership.

- [ ] T030 [US6] Add unread-view filter (`is_archived=0 AND is_unread=1`) to list query and `view=unread` handling in `src/services/bookmarks.js` + `GET /api/bookmarks` (FR-016)
- [ ] T031 [US6] Add "read later" toggle at save, per-item mark read/unread (via PATCH), and an unread view tab in `src/public/app.js` (FR-016)

**Checkpoint**: Read-later flow works; new bookmarks are ordinary unless flagged

---

## Phase 9: User Story 7 - Archive and delete (Priority: P2)

**Goal**: Archive hides from normal list/search, appears in archive view, restorable; delete requires confirmation and is permanent.

**Independent Test**: Archive → gone from list/search, in archive, restore works; delete with confirm → gone after reload.

- [ ] T032 [US7] Add archive-view filter (`is_archived=1`), archive/restore via PATCH, and permanent delete in `src/services/bookmarks.js`; ensure normal list/search exclude archived (FR-017)
- [ ] T033 [US7] Implement `DELETE /api/bookmarks/:id?confirm=true` (428 if confirm missing) and `view=archive` in `GET /api/bookmarks` (FR-018)
- [ ] T034 [US7] Add archive/restore/delete controls with a confirmation step and an archive view tab in `src/public/app.js` (FR-017, FR-018)

**Checkpoint**: Archive and delete behave per spec

---

## Phase 10: User Story 8 - Bulk actions (Priority: P3)

**Goal**: Multi-select or "all matching current search/filter"; add/remove tags as deltas (never replace), set read/archive, delete; partial failures reported.

**Independent Test**: Bulk add/remove tags on differing selections (other tags untouched); bulk archive over a full search result; partial-failure report.

- [ ] T035 [US8] Implement bulk operations in `src/services/bookmarks.js`: resolve targets from `ids` OR `match{view,q,tags,notTags}`; `addTags`/`removeTags` as deltas that never clear other associations; `setUnread`/`setArchived`; `delete`; collect per-item failures (FR-019, FR-020)
- [ ] T036 [US8] Implement `POST /api/bookmarks/bulk` per contracts/api.md returning `{updated,failures}` (FR-019, FR-020)
- [ ] T037 [P] [US8] Unit tests in `tests/unit/bulkTags.test.js` proving add/remove tag deltas leave each bookmark's other tags intact
- [ ] T038 [US8] Add multi-select, a bulk-action bar, and an "apply to all matching" option to `src/public/app.js`

**Checkpoint**: Bulk actions work on selections and full match sets without tag clobbering

---

## Phase 11: User Story 9 - Saved searches and filter sets (Priority: P3)

**Goal**: Save named `{query, includedTags, excludedTags}`; reapply, rename, delete.

**Independent Test**: Save a query with included/excluded tags; reapply returns same results; rename/delete update the list.

- [ ] T039 [US9] Implement saved-search CRUD in `src/services/savedSearches.js` (included_tags/excluded_tags stored as JSON arrays) (FR-021)
- [ ] T040 [US9] Implement `GET/POST /api/saved-searches`, `PATCH/DELETE /api/saved-searches/:id` in `src/routes/savedSearches.js`
- [ ] T041 [US9] Wire `tag`/`nottag` params into `GET /api/bookmarks` filtering (combined with `q`) and add saved-search save/apply/rename/delete UI in `src/public/app.js` (FR-021)

**Checkpoint**: Saved searches persist and reapply correctly

---

## Phase 12: User Story 10 - Import and export (Netscape format) (Priority: P3)

**Goal**: Import/export Netscape bookmark HTML preserving titles, TAGS, ADD_DATE; skip duplicates on import; invalid file imports nothing.

**Independent Test**: Export → import into empty collection → titles/tags/dates preserved; duplicates skipped; invalid file rejected.

- [ ] T042 [P] [US10] Implement Netscape parse+emit in `src/services/netscape.js`: export `<DT><A HREF ADD_DATE TAGS>` preserving title/TAGS/ADD_DATE; import reads them, applies canonical-key duplicate skip, defaults missing fields (FR-022, FR-023)
- [ ] T043 [P] [US10] Unit tests in `tests/unit/netscape.test.js` for round-trip preservation, missing-field defaults, duplicate skip, and invalid-file rejection
- [ ] T044 [US10] Implement `POST /api/import` (422 + nothing imported on invalid file) and `GET /api/export` (text/html) in `src/routes/importExport.js` (FR-022, FR-023)
- [ ] T045 [US10] Add import (file picker) and export (download) UI with a result summary in `src/public/app.js`

**Checkpoint**: Import/export round-trips preserving titles, tags, dates

---

## Phase 13: User Story 11 - Local preservation and Internet Archive (Priority: P3)

**Goal**: Preserve a page as single self-contained HTML (PDF stays PDF), openable offline; optional Internet Archive submission; graceful failure keeps bookmark.

**Independent Test**: Preserve a web page → self-contained HTML opens offline; preserve a PDF URL → PDF; request archive.org → reference recorded or graceful failure.

- [ ] T046 [P] [US11] Implement preservation in `src/services/preserve.js`: detect content-type; PDF → store bytes as `.pdf` under `data/preserved/`; HTML → render in Playwright/Chromium (1.61.0, `/opt/playwright-browsers`), inline CSS/images(data URIs)/fonts, strip scripts, serialise single `.html`; set preserved_path/preserved_kind (FR-024)
- [ ] T047 [P] [US11] Implement Internet Archive submission in `src/services/archiveOrg.js`: POST to Save Page Now, record archive_org_url; on failure/unavailable return a distinguishable error without touching the bookmark (FR-025, FR-026)
- [ ] T048 [US11] Implement `POST /api/bookmarks/:id/preserve`, `GET /api/bookmarks/:id/preserved` (serve html/pdf), `POST /api/bookmarks/:id/archive-org` per contracts/api.md; 502 with bookmark intact on failure (FR-024, FR-025, FR-026)
- [ ] T049 [US11] Add "preserve copy", "open preserved", and "save to Internet Archive" controls with honest success/failure messaging in `src/public/app.js`

**Checkpoint**: Local preservation and optional archiving work with graceful degradation

---

## Phase 14: User Story 12 - Personal display preferences (Priority: P3)

**Goal**: Set default sort, items per view, text size; remembered and applied.

**Independent Test**: Change each preference; reload; confirm remembered and applied.

- [ ] T050 [US12] Implement preferences get/update in `src/services/preferences.js` and `GET/PUT /api/preferences` in `src/routes/preferences.js` (singleton row) (FR-027)
- [ ] T051 [US12] Build a preferences screen in `src/public/app.js` (default_sort, items_per_view, text_size) and apply them to list rendering and defaults on load (FR-027)

**Checkpoint**: Preferences persist and shape the UI

---

## Phase 15: Polish & Cross-Cutting Concerns

**Purpose**: Cross-cutting quality and presentation readiness

- [ ] T052 Add Playwright smoke test in `tests/smoke/app.spec.js`: app loads with `data-harness-ready`, save a bookmark, it renders in the list
- [ ] T053 [P] Defensive re-sanitisation of note HTML on render and of fetched metadata strings across the UI (stored-XSS guard)
- [ ] T054 [P] Long title/description/note/address truncation in list views and layout safety (edge cases)
- [ ] T055 Verify `data-harness-ready="true"` timing and HTTP session cookie behaviour in the review environment; confirm `.harness/app.json` matches the running command
- [ ] T056 Run full quickstart.md validation (all 12 scenarios) and `npm test`; fix any divergence from acceptance scenarios

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies
- **Foundational (Phase 2)**: depends on Setup; BLOCKS all user stories
- **User Stories (Phases 3–14)**: all depend on Foundational
  - US1→US2→US3 (all P1) form the MVP and share the bookmark/list core, so build in order
  - US4–US12 depend only on Foundational + the bookmark core from US1/US3; can proceed in priority order or in parallel by area
- **Polish (Phase 15)**: after the desired stories are complete

### User Story Dependencies

- **US1 (P1)**: after Foundational — core save/metadata
- **US2 (P1)**: builds on US1 create/metadata endpoints
- **US3 (P1)**: needs US1 data to list; independent UI
- **US4 (P2)**: needs list endpoint (US3) to attach search
- **US5 (P2)**: needs US1 edit + tags
- **US6, US7 (P2)**: need US3 list (view filters)
- **US8 (P3)**: needs US5 tags + US6/US7 flags + US4 match resolution
- **US9 (P3)**: needs US4 search + tags
- **US10 (P3)**: needs bookmark core + normalize (dup skip)
- **US11 (P3)**: needs bookmark core
- **US12 (P3)**: needs list/sort (US3)

### Parallel Opportunities

- Setup: T003 [P]
- Foundational: T007/T008/T009 [P] (distinct files)
- Within stories, [P] tasks touch different files: metadata vs its tests (T011/T012), search vs its tests (T022/T023), preserve vs archive.org (T046/T047), netscape service vs tests (T042/T043)
- Polish: T053/T054 [P]

---

## Parallel Example: User Story 4

```bash
# Grammar implementation and its unit tests target different files:
Task: "Implement search grammar in src/services/search.js"
Task: "Unit tests in tests/unit/search.test.js"
```

---

## Implementation Strategy

### MVP First

1. Phase 1 Setup → 2 Foundational → 3–5 (US1–US3, all P1).
2. STOP and VALIDATE: save with metadata, no duplicates, browse/sort/open.
3. Demo the MVP.

### Incremental Delivery

Add P2 stories (US4 search, US5 rich edit, US6 read-later, US7 archive) → then
P3 stories (US8 bulk, US9 saved searches, US10 import/export, US11 preservation,
US12 preferences). Validate each story independently against its acceptance
scenarios before moving on. Finish with Phase 15 polish and full quickstart run.

---

## Notes

- [P] = different files, no dependency on incomplete tasks
- Each story maps to spec acceptance scenarios and FR numbers for traceability
- Tests included only for the highest-risk logic + one smoke test, per the spec's testing approach
- Do not start implementation until this task breakdown is approved (SDD gate)
