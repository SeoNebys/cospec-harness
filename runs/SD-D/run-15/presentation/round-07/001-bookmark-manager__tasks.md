---
description: "Task list for Bookmark Manager implementation"
---

# Tasks: Bookmark Manager

**Input**: Design documents from `specs/001-bookmark-manager/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ (all present)

**Tests**: Targeted tests are included because plan.md §D10 commits to them (unit tests for
the search parser, import/export round-trip, and metadata parsing; Playwright e2e per user
story). They are focused, not full TDD.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: US1–US12, mapping to the spec's user stories
- Exact file paths are included in each task

## Path Conventions

Single web-app project rooted at `/work` (see plan.md → Project Structure): server code in
`src/server/`, client in `src/client/`, built client in `public/`, tests in `tests/`,
runtime data (DB + snapshots) under `data/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and build tooling.

- [X] T001 Create the project directory tree per plan.md (src/server/{db,models,services,routes,lib}, src/client/{views,lib}, public/, tests/{unit,integration,e2e}, data/) with a `.gitignore` that excludes `node_modules/`, `public/`, and `data/`.
- [X] T002 Initialize the npm project in `package.json` (ES modules, `"type":"module"`, Node 24 engine) with pinned dependencies express, better-sqlite3, cheerio, marked, sanitize-html, multer and devDependencies playwright@1.61.0 and esbuild; add scripts `start` (node src/server/index.js), `build` (esbuild bundle → public/), `test` (node --test), and `test:e2e` (playwright test); run install and commit `package-lock.json` unchanged thereafter.
- [X] T003 [P] Create the esbuild build script `build.js` that bundles `src/client/main.js` to `public/app.js` and copies `src/client/index.html` and `src/client/styles.css` into `public/`.
- [X] T004 [P] Write `/work/.harness/app.json` = `{"kind":"application","port":4000,"path":"/","start_command":["npm","start"],"start_cwd":"/work"}`.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Database, server wiring, and shared utilities that every user story depends on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T005 Create `src/server/db/schema.sql` defining all tables from data-model.md: `bookmarks` (id, url TEXT UNIQUE NOT NULL, title, description, note, icon_url, preview_image, is_read INTEGER DEFAULT 0, is_archived INTEGER DEFAULT 0, date_added TEXT, date_modified TEXT), `tags` (id, name TEXT UNIQUE NOT NULL — case-insensitive, trimmed, non-empty), `bookmark_tags` (bookmark_id, tag_id, PK(bookmark_id,tag_id), FKs ON DELETE CASCADE), `saved_copies` (id, bookmark_id FK ON DELETE CASCADE, kind TEXT in {html_snapshot,pdf,internet_archive}, location, created_at), `saved_searches` (id, name, query_text, included_tags TEXT json, excluded_tags TEXT json, created_at), `preferences` (id=1, default_sort default 'date_added_desc', page_size, text_size default 'medium').
- [X] T006 Implement `src/server/db/connection.js` opening `data/bookmarks.db` with Node's built-in `node:sqlite` (`DatabaseSync`; swapped from better-sqlite3 — see research §D2), enabling foreign keys, applying `schema.sql` idempotently on startup, and seeding the single `preferences` row (default_sort='date_added_desc', page_size=25, text_size='medium') if absent.
- [X] T007 [P] Implement `src/server/lib/url.js`: `normalizeUrl()` adds a missing scheme as `https://` and validates a well-formed http(s) address (FR-004), returning a normalized string or a validation error; include `deriveTitleFromUrl()` (host-based fallback, FR-006).
- [X] T008 [P] Implement `src/server/app.js` (Express app: JSON body parsing, static serving of `public/`, mount `/api` router, JSON error-handling middleware returning `{error}` with proper status) and `src/server/index.js` (entry that initializes the DB and listens on `0.0.0.0:4000`).
- [X] T009 [P] Create the API router skeleton `src/server/routes/api.js` mounted at `/api`, plus a stub `src/server/routes/index.js` if needed, so story phases attach endpoints without re-wiring.
- [X] T010 Build the client shell: `src/client/index.html` (root `#app` element), `src/client/main.js` (bootstrap + simple hash-router across views), `src/client/lib/api.js` (fetch wrapper for `/api`), and `src/client/styles.css`; set `data-harness-ready="true"` on the root element only after the initial view and its data have loaded (including the empty state).

**Checkpoint**: Server starts on :4000, DB initializes, empty SPA loads and marks ready.

---

## Phase 3: User Story 1 - Save a bookmark with automatic page information (Priority: P1) 🎯 MVP

**Goal**: Save a URL; auto-capture title/description/icon/preview; keep title/description
editable; saving an existing URL opens it for editing; graceful fallback when unreachable.

**Independent Test**: POST a fixture URL with OpenGraph tags → fields populated; edit title →
persists after reload; POST same URL → routed to existing (409+existingId); unreachable URL →
saved with derived title; invalid address → rejected with a clear message.

- [X] T011 [P] [US1] Implement `src/server/services/metadata.js`: fetch a URL (short timeout, size cap) and parse with cheerio to extract title (`<title>`/`og:title`), description (`meta description`/`og:description`), preview image (`og:image`/`twitter:image`), and icon (`link[rel~=icon]` → `/favicon.ico`); on any failure return an empty result so the caller can fall back (FR-002, FR-006).
- [X] T012 [P] [US1] Implement `src/server/models/bookmark.js` with `create()`, `getById()`, `getByUrl()`, and `update(fields)`; set `date_added`/`date_modified` (ISO-8601 UTC), default `is_read=0`/`is_archived=0`, and enforce URL uniqueness (FR-035, FR-005).
- [X] T013 [US1] Add endpoints in `src/server/routes/api.js`: `POST /api/bookmarks` (normalize URL via lib/url, if `getByUrl` exists respond 409 `{existingId}` per FR-005, else auto-capture metadata and create), `GET /api/bookmarks/:id`, and `PATCH /api/bookmarks/:id` limited to title/description here (FR-001–006).
- [X] T014 [US1] Build the client add/edit view `src/client/views/editor.js`: URL input + optional title, submit to create; on 409 navigate to the existing bookmark's editor; editable title/description fields that PATCH and persist; inline validation-error display without losing input (FR-003, FR-004, FR-005).
- [X] T015 [P] [US1] Unit test `tests/unit/metadata.test.js`: parse title/description/icon/preview from a fixture HTML string, and assert empty-result fallback on malformed input (node --test).
- [X] T016 [US1] E2e `tests/e2e/us1-save.spec.js` (Playwright, external fetch stubbed by a local fixture server): save→auto-populate→edit-title→reload persists; duplicate→opens existing; unreachable→derived title; invalid→error message.

**Checkpoint**: A bookmark can be saved with rich auto-filled data and edited — demoable MVP slice 1.

---

## Phase 4: User Story 2 - Browse and open bookmarks in a readable list (Priority: P1)

**Goal**: A readable list (title, description, tags, icon), open in a new tab, empty state,
long-text truncation.

**Independent Test**: Seed bookmarks → list shows the four fields; activating one opens the
correct address in a new tab; empty collection shows the empty state.

- [X] T017 [US2] Extend `src/server/models/bookmark.js` with `list({view,sort,page,page_size})` returning active (non-archived) bookmarks with their tags, default sort `date_added_desc` (FR-007, FR-027), plus a `total` count.
- [X] T018 [US2] Add `GET /api/bookmarks` in `src/server/routes/api.js` supporting `view=all` and default sort/pagination, returning `{items,total}` excluding archived (FR-007, FR-024-consistent).
- [X] T019 [US2] Build the list view `src/client/views/list.js`: render each row with title, description, tags, and site icon; clicking opens the URL in a new tab (`target=_blank rel=noopener`); show the empty state when none exist and truncate long title/description/URL with the full value available on hover/expand (FR-007, FR-008, FR-010).
- [X] T020 [US2] E2e `tests/e2e/us2-browse.spec.js`: seeded list shows all four fields; open action targets the right URL; empty state renders for a fresh collection.

**Checkpoint**: MVP complete (US1+US2) — save, see, and open bookmarks end-to-end.

---

## Phase 5: User Story 3 - Organize with tags (Priority: P2)

**Goal**: Assign tags, suggest existing tags while typing, filter the list by a tag.

**Independent Test**: Add a tag using a suggested existing tag; filter by that tag → only
matching bookmarks shown.

- [X] T021 [P] [US3] Implement `src/server/models/tag.js`: `getOrCreate(name)` (trim, non-empty, case-insensitive uniqueness), `listByPrefix(prefix)` for suggestions (FR-012), `setForBookmark(bookmarkId, names[])`, `addToBookmark`/`removeFromBookmark`, and prune orphan tags.
- [X] T022 [US3] Wire tags into `POST /api/bookmarks` and `PATCH /api/bookmarks/:id` (accept `tags[]`, FR-011); add `GET /api/tags?prefix=` for suggestions (FR-012); add `tag` filter param to `GET /api/bookmarks` combining conjunctively with other filters (FR-013).
- [X] T023 [US3] Client: add a tag input with type-ahead suggestions in `src/client/lib/tag-suggest.js` used by the editor, and a tag filter control in `src/client/views/list.js` (FR-011, FR-012, FR-013).
- [X] T024 [US3] E2e `tests/e2e/us3-tags.spec.js`: assign a tag with suggestion, filter by tag shows only tagged bookmarks.

**Checkpoint**: Tags are assignable, suggested, and filterable.

---

## Phase 6: User Story 4 - Add notes, edit, and delete (Priority: P2)

**Goal**: Markdown notes (searchable source), edit all fields, permanent delete with
confirmation.

**Independent Test**: Add a Markdown note → rendered and searchable; edit title → persists;
delete with confirmation → gone after reload.

- [X] T025 [P] [US4] Implement `src/server/services/markdown.js`: render note Markdown with marked and sanitize the output with sanitize-html allowing only bold, italics, lists, and links (FR-014); store raw Markdown as the note source.
- [X] T026 [US4] Extend `PATCH /api/bookmarks/:id` to accept `note` (Markdown source) and `url` (re-normalized) alongside title/description/tags (FR-015); add `DELETE /api/bookmarks/:id` cascading tags-join and saved copies (FR-016).
- [X] T027 [US4] Client: add a Markdown note field with rendered preview to `src/client/views/editor.js`, and a delete action with a confirmation dialog in the editor/list (FR-014, FR-016).
- [X] T028 [P] [US4] Unit test `tests/unit/markdown.test.js`: allowed formatting renders; disallowed HTML (e.g. `<script>`, `<img onerror>`) is stripped.
- [X] T029 [US4] E2e `tests/e2e/us4-notes.spec.js` (browser): add a formatted Markdown note and confirm it displays rendered; edit every bookmark field (title, description, url, note, tags) and confirm all changes persist after reload; permanently delete a bookmark through the confirmation dialog and confirm it is gone after reload (FR-014, FR-015, FR-016). Note-through-search is covered separately in US5 (T035).

**Checkpoint**: Notes, edits, and safe permanent deletion work in the browser.

---

## Phase 7: User Story 5 - Powerful search (Priority: P2)

**Goal**: Case-insensitive search across title/description/note/address; `#tag`; exact
phrases; AND/OR/NOT/parentheses; text+`#tag` conjunctive; quoted operators literal.

**Independent Test**: Run the contracts/search-query.md worked examples and confirm each
result set; a no-match query shows "no results".

- [X] T030 [P] [US5] Implement the tokenizer + recursive-descent parser to an AST in `src/server/services/search.js` per contracts/search-query.md: bare WORD, `#tag` TAG, quoted PHRASE (operator words inside quotes are literal, FR-019), bare AND/OR/NOT and parentheses, with precedence NOT>AND>OR and implicit AND between adjacent terms (FR-020).
- [X] T031 [US5] Implement the evaluator in `src/server/services/search.js`: WORD = case-insensitive substring over title/description/note/url (FR-017), TAG = tag membership, PHRASE = exact case-insensitive substring; combine text and `#tag` conjunctively (FR-018); expose `matches(bookmark, ast)` and wire the `q` param into `GET /api/bookmarks` over active bookmarks.
- [X] T032 [US5] Client: add a search box to `src/client/views/list.js` that queries `q`, and render the "no results" state distinctly from the empty-collection state (FR-010).
- [X] T033 [P] [US5] Unit test `tests/unit/search.test.js` covering every worked example in contracts/search-query.md: `recipes`, `#work`, `invoice #work` (both conditions), `"machine learning"`, literal `"AND"`, `python OR rust`, `#reading NOT #work`, `(a OR b) c`.
- [X] T034 [US5] E2e `tests/e2e/us5-search.spec.js`: seed varied bookmarks and verify text+`#tag`, phrase, literal `"AND"`, and a boolean+parentheses query.
- [X] T035 [US5] E2e `tests/e2e/us5-note-search.spec.js` (browser; depends on US4 notes + US5 search): create a bookmark whose note contains a distinctive word, search for that word, and confirm the bookmark is found via its note text (FR-017, note searchability).

**Checkpoint**: The full query language behaves to the letter of the contract, including finding bookmarks by note text.

---

## Phase 8: User Story 6 - Read-later status (Priority: P2)

**Goal**: Track read/unread; a separate unread view; toggle read/unread.

**Independent Test**: New bookmark appears in unread view; mark read → leaves; mark unread →
returns.

- [X] T036 [US6] Add `POST /api/bookmarks/:id/read` and `/unread` endpoints toggling `is_read` (FR-021), and support `view=unread` in `GET /api/bookmarks` / `bookmark.list` (active + `is_read=0`, FR-022).
- [X] T037 [US6] Client: add an unread view/route and read/unread toggles per bookmark in `src/client/views/list.js` (FR-021, FR-022).
- [X] T038 [US6] E2e `tests/e2e/us6-readlater.spec.js`: new→unread view; mark read→leaves; mark unread→returns.

**Checkpoint**: Read-later workflow functions with its own view.

---

## Phase 9: User Story 7 - Archive as a reversible action (Priority: P2)

**Goal**: Archive (reversible) hides from normal lists/searches; archive view; restore;
distinct from permanent delete.

**Independent Test**: Archive → hidden from list and search, visible in archive view; restore
→ returns.

- [X] T039 [US7] Add `POST /api/bookmarks/:id/archive` and `/restore` toggling `is_archived` (FR-023); ensure `bookmark.list` and the search endpoint exclude archived for all views except `view=archive` (FR-024).
- [X] T040 [US7] Client: add an archive view/route and archive/restore actions in `src/client/views/list.js`; keep archive visually distinct from delete (FR-023, FR-024).
- [X] T041 [US7] E2e `tests/e2e/us7-archive.spec.js`: archive hides from list+search and shows in archive view; restore returns; confirm archive is reversible while delete is not.

**Checkpoint**: Reversible archiving is separated from permanent deletion.

---

## Phase 10: User Story 8 - Act on many bookmarks at once (Priority: P3)

**Goal**: Select several or everything matching the current view; add/remove tag, mark
read/unread, archive, delete in one action (delete confirmed).

**Independent Test**: Select three → add a tag to all; select-all-matching a filtered view →
archive all; bulk delete asks for confirmation.

- [X] T042 [US8] Add `POST /api/bookmarks/bulk` in `src/server/routes/api.js` accepting `{ids[]}` or `{selector:{view,q,tag}}` and `action` ∈ add_tag|remove_tag|mark_read|mark_unread|archive|delete (delete requires `confirm:true`), executed in a transaction, returning `{affected}` (FR-025, FR-026).
- [X] T043 [US8] Client: add multi-select (row checkboxes) and a "select everything matching this view" control plus a bulk-action bar in `src/client/views/list.js`, with `src/client/lib/selection.js`; bulk delete shows a confirmation (FR-025, FR-026).
- [X] T044 [US8] E2e `tests/e2e/us8-bulk.spec.js`: bulk add/remove tag, mark read/unread, archive on a selection; select-all-matching then archive; bulk delete confirmation.

**Checkpoint**: Scale actions work on selections and whole filtered views.

---

## Phase 11: User Story 9 - Saved searches (Priority: P3)

**Goal**: Save a query combining text with included/excluded tags; rerun; delete.

**Independent Test**: Save `keyword` + one included + one excluded tag; rerun returns the
matching set; delete removes it.

- [X] T045 [P] [US9] Implement `src/server/models/savedSearch.js` (create/list/get/delete; `included_tags`/`excluded_tags` stored as JSON arrays) per data-model.md.
- [X] T046 [US9] Add `GET/POST /api/saved-searches`, `DELETE /api/saved-searches/:id`, and `GET /api/saved-searches/:id/run` that evaluates `query_text` via search.js then applies included/excluded tag constraints (FR-028).
- [X] T047 [US9] Client: add a saved-searches view `src/client/views/saved-searches.js` to save the current query+tags, list, run, and delete saved searches (FR-028).
- [X] T048 [US9] E2e `tests/e2e/us9-savedsearch.spec.js`: create with included/excluded tags, run returns correct set, delete removes it.

**Checkpoint**: Recurring queries are savable and rerunnable.

---

## Phase 12: User Story 10 - Sorting and display preferences (Priority: P3)

**Goal**: Sort by date added / title; persist default sort, page size, text size.

**Independent Test**: Sort by title reorders; set default sort, page size, text size → persist
across reload.

- [X] T049 [US10] Ensure `GET /api/bookmarks` honors `sort` ∈ date_added_desc|date_added_asc|title_asc|title_desc (FR-027); implement `src/server/models/preferences.js` and `GET/PUT /api/preferences` (FR-029).
- [X] T050 [US10] Client: add a settings view `src/client/views/settings.js` for default sort, page size, and text size; apply text size to the app and use preferences as list defaults, persisting across reload (FR-029).
- [X] T051 [US10] E2e `tests/e2e/us10-preferences.spec.js`: sort by title reorders; saved preferences persist after reload.

**Checkpoint**: Presentation is user-configurable and persistent.

---

## Phase 13: User Story 11 - Keep a saved copy of the page (Priority: P3)

**Goal**: Self-contained HTML snapshot for pages; store the PDF itself for PDF links; optional
Internet Archive preservation with honest failure.

**Independent Test**: Snapshot a fixture page → self-contained HTML stored and reopenable
offline; snapshot a PDF fixture → PDF stored; request Internet Archive → URL recorded on
success, clear failure (bookmark intact) when stubbed unavailable.

- [X] T052 [P] [US11] Implement `src/server/models/savedCopy.js` (create/listForBookmark/get; kind ∈ html_snapshot|pdf|internet_archive; location = file path or archived URL) per data-model.md.
- [X] T053 [US11] Implement `src/server/services/snapshot.js`: detect content type; for a page, render with the installed Playwright Chromium and inline stylesheets/images as data URIs into a self-contained `data/snapshots/<id>.html` (FR-030); for a PDF, stream it to `data/snapshots/<id>.pdf` (FR-031); record a SavedCopy.
- [X] T054 [P] [US11] Implement `src/server/services/archive.js`: submit the URL to the Internet Archive "Save Page Now" endpoint, record an `internet_archive` SavedCopy on success, and on any error/timeout return a failure without mutating the bookmark (FR-032).
- [X] T055 [US11] Add endpoints `POST /api/bookmarks/:id/snapshot`, `POST /api/bookmarks/:id/archive-copy` (502 + `{error}` on external failure), and `GET /api/saved-copies/:id/content` (serve stored HTML/PDF) in `src/server/routes/api.js`.
- [X] T056 [US11] Client: add "save a copy" and "preserve via Internet Archive" actions and a way to open stored copies in `src/client/views/editor.js`/list; surface archive failure honestly (FR-030–032).
- [X] T057 [US11] E2e `tests/e2e/us11-savedcopy.spec.js` (fixtures for a page and a PDF; Internet Archive stubbed for success and failure): HTML snapshot stored+reopenable, PDF stored, archive success records URL, archive failure reports clearly with bookmark intact.

**Checkpoint**: Page preservation works for HTML and PDF, with graceful external-service failure.

---

## Phase 14: User Story 12 - Import and export (Priority: P3)

**Goal**: Export/import standard Netscape bookmark HTML preserving title, tags, and original
date added; folders→tags; skip existing addresses.

**Independent Test**: Export → Netscape HTML with HREF/title/ADD_DATE/TAGS; import a fixture →
bookmarks added with fields preserved, folders mapped to tags, existing skipped; round-trip
adds no duplicates.

- [X] T058 [P] [US12] Implement `src/server/services/porting.js`: `exportHtml()` producing a Netscape bookmark file with HREF, title text, `ADD_DATE` (Unix seconds), and `TAGS` per contracts/bookmark-html.md (FR-033); `importHtml(buffer)` parsing with cheerio, mapping `TAGS` + enclosing `<H3>` folders to tags, `ADD_DATE` to original date added, normalizing URLs, and skipping already-saved addresses, returning `{added,skipped}` (FR-034).
- [X] T059 [US12] Add `GET /api/export` (attachment) and `POST /api/import` (multer multipart upload) in `src/server/routes/api.js` (FR-033, FR-034).
- [X] T060 [US12] Client: add export (download) and import (file upload) controls to `src/client/views/settings.js`, showing added/skipped counts (FR-033, FR-034).
- [X] T061 [P] [US12] Unit test `tests/unit/porting.test.js`: export→import round-trip preserves addresses, titles, tags, and original dates added and creates no duplicates (SC-008); folder→tag mapping.
- [X] T062 [US12] E2e `tests/e2e/us12-importexport.spec.js` (browser): export the collection through the interface and download the file; import a fixture bookmark-HTML file through the interface; confirm imported bookmarks display with their titles, tags, and original dates added preserved, and that an address already present is skipped (reported as skipped, not duplicated) (FR-033, FR-034, SC-008).

**Checkpoint**: Collection is portable via the standard browser format with fields preserved, verified through the interface.

---

## Phase 15: Polish & Cross-Cutting Concerns

**Purpose**: Validation, performance, and final wiring across stories.

- [X] T063 [P] Add `tests/e2e/fixtures/` local fixture server + sample pages/PDF/bookmark-HTML and a Playwright config pinned to browser channel/paths for `/opt/playwright-browsers`, shared by all e2e specs.
- [X] T064 [P] Seed script `tests/perf/seed.js` to load ~1,000 bookmarks and a check that search/filter stays perceptibly instant (SC-005) and a bulk action covers ≥50 items (SC-006).
- [X] T065 Verify data persists across a server stop/start (SC-004) and that archive→restore preserves tags/notes/copies (SC-007); document the check in `tests/e2e/us-crosscutting.spec.js`.
- [X] T066 [P] Write `README.md` (run, build, test, data location) referencing quickstart.md.
- [X] T067 Run the full `quickstart.md` validation pass, confirm `data-harness-ready` timing on real data, and confirm `.harness/app.json` starts the server cleanly on :4000.

---

## Dependencies & Execution Order

### Phase dependencies

- **Setup (P1)** → no deps.
- **Foundational (P2)** → after Setup; **blocks all user stories**.
- **User stories (P3–P14)** → after Foundational. Priority order US1→US12. US1+US2 = MVP.
- **Polish (P15)** → after the targeted stories are complete.

### Story dependencies (beyond Foundational)

- **US1** independent. **US2** uses the bookmark model from US1 (list) but is separately
  testable. **US3 (tags)** is used by US5 (`#tag`), US8 (bulk tag), US9 (saved searches) —
  do US3 before those. **US5 (search)** is used by US8 selectors and US9 run — do US5 before
  those. **US4/US6/US7** are independent of each other, except the note-through-search check
  (T035) needs both US4 (notes) and US5 (search) — run it after US5. **US10** relies on the
  list/prefs. **US11/US12** are independent leaf stories.

### Within each story

- Models → services → endpoints → client → tests. `[P]` tasks touch different files.

### Parallel opportunities

- Setup: T003, T004 in parallel.
- Foundational: T007, T008, T009 in parallel after T005/T006.
- Within a story, `[P]` model/service/unit-test tasks run in parallel (e.g. T011+T012+T015).

---

## Parallel Example: User Story 1

```bash
# After Foundational, launch US1 parallelizable tasks together:
Task: "T011 [US1] metadata service in src/server/services/metadata.js"
Task: "T012 [US1] bookmark model in src/server/models/bookmark.js"
Task: "T015 [US1] unit test in tests/unit/metadata.test.js"
# Then T013 (endpoints) → T014 (client) → T016 (e2e), which depend on the above.
```

---

## Implementation Strategy

### MVP first (US1 + US2)

1. Phase 1 Setup → 2. Phase 2 Foundational → 3. Phase 3 US1 → 4. Phase 4 US2 →
**STOP & VALIDATE**: save, browse, and open work end-to-end on :4000.

### Incremental delivery

Add P2 stories (US3 tags → US4 notes/edit/delete → US5 search → US6 read-later → US7 archive),
validating each independently, then P3 stories (US8 bulk → US9 saved searches → US10
sorting/prefs → US11 saved copies → US12 import/export), then Polish.

---

## Notes

- `[P]` = different files, no incomplete dependencies. `[Story]` maps each task to a spec user
  story for traceability.
- External network calls (page fetches, Internet Archive) are stubbed with local fixtures in
  tests for determinism; runtime honestly reports when a live page or the Archive is
  unavailable (FR-006, FR-032).
- Preserve `package-lock.json`; reuse the installed Playwright 1.61.0 / shared Chromium — do
  not download a second browser version.
- Stop at any checkpoint to demo the slice.
