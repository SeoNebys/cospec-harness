---

description: "Task list for Bookmark Manager implementation"
---

# Tasks: Bookmark Manager

**Input**: Design documents from `/specs/001-bookmark-manager/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Included — the plan and quickstart explicitly require unit tests
(search parser, URL normalization, Netscape round-trip, delayed-metadata
safeguard) and Playwright 1.61.0 E2E journeys per user story.

**Organization**: Grouped by user story (priority order from spec.md) so each is
independently implementable and testable.

## Path conventions

Web app, single Node process (per plan.md): backend in `server/`, frontend in
`web/`, E2E in `tests/e2e/`, runtime data in `data/`.

---

## Phase 1: Setup (Shared Infrastructure)

- [X] T001 Create workspace layout per plan.md (`server/src/`, `web/src/`, `tests/e2e/`, `data/`) and root `package.json` with npm workspaces + scripts `start`, `build`, `dev`, `test`, `test:e2e`
- [X] T002 [P] Initialize server workspace `server/package.json` with dependencies express, better-sqlite3, cheerio, marked, dompurify, jsdom, and `playwright@1.61.0` (pinned to match `/opt/playwright-browsers`)
- [X] T003 [P] Initialize web workspace `web/package.json` (react, react-dom, vite), `web/vite.config.js`, and `web/index.html`
- [X] T004 [P] Add `@playwright/test@1.61.0` and `playwright.config.js` at repo root pointing at `http://127.0.0.1:4000`, browsers from `/opt/playwright-browsers`
- [X] T005 [P] Configure ESLint + Prettier configs and a `.gitignore` excluding `node_modules/`, `web/dist/`, and `data/`

**Checkpoint**: Toolchain and workspaces ready.

---

## Phase 2: Foundational (Blocking Prerequisites)

**⚠️ No user story work begins until this phase is complete.**

- [X] T006 Implement SQLite connection module `server/src/db/connection.js` (open `data/app.db`, enable `PRAGMA foreign_keys=ON`, WAL)
- [X] T007 Write `server/src/db/schema.sql` + migration runner creating ALL tables per data-model.md: `bookmark` (incl. `title_user_set INTEGER NOT NULL DEFAULT 0`, `description_user_set INTEGER NOT NULL DEFAULT 0`, `read_state` in {`unread`,`read`} default `unread`, `archived` 0/1 default 0, `metadata_status` in {`pending`,`complete`,`failed`}, `url_key` UNIQUE, `date_added`/`date_updated` ISO 8601), `tag` (`name_key` UNIQUE), `bookmark_tag` (PK `(bookmark_id, tag_id)`, FKs ON DELETE CASCADE), `saved_search`, `snapshot` (`bookmark_id` UNIQUE FK CASCADE, `kind` in {`html`,`pdf`}), `preferences` (singleton `CHECK(id=1)`, `items_per_page` positive default 25, `font_size` in {`small`,`medium`,`large`} default `medium`, `default_sort` default `date_added_desc`); seed the preferences row; add indexes on `url_key`, `archived`, `read_state`, `date_added`, `title`
- [X] T008 [P] Implement URL normalization + validation `server/src/services/url.js`: add `https://` when scheme missing, reject non-http/https, lower-case host, strip default ports and fragment, keep path/query, derive `url_key` (research R11, FR-002/003)
- [X] T009 [P] Implement Tag model `server/src/models/tag.js`: resolve-or-create by case-folded `name_key` (one identity per name — FR-008a), attach/detach on `bookmark_tag`, count-by-tag query (used by US1/US3)
- [X] T010 Implement Express bootstrap `server/src/index.js`: JSON body parsing, mount `/api` router, serve built `web/dist` statically, uniform error shape `{error:{code,message}}`, listen on `0.0.0.0:4000`
- [X] T011 [P] Implement frontend API client `web/src/api/client.js` (typed fetch wrappers + error handling) and app shell `web/src/main.jsx` + `web/src/App.jsx` with view routing (normal/unread/archived), shared `EmptyState`, and sets `data-harness-ready="true"` after the initial list (or empty state) loads

**Checkpoint**: Server boots on 4000, DB schema in place, URL + tag primitives ready.

---

## Phase 3: User Story 1 - Save a link with automatic details (Priority: P1) 🎯 MVP

**Goal**: Save a URL; auto-capture title/description/favicon/preview; edit
title/description/tags/note during save and later; duplicate opens existing; the
delayed-metadata safeguard never overwrites user input.

**Independent Test**: Save a real URL → metadata fills `pending`→`complete`; edit
fields and reload (persist); re-save same URL → existing opens; empty/non-http
rejected; a fetch resolving after a user edit leaves the user's value intact.

### Tests for User Story 1

- [X] T012 [P] [US1] Unit tests for URL normalization/validation in `server/tests/url.test.js` (missing scheme, non-http rejection, host casing, port/fragment stripping, url_key equality for duplicates)
- [X] T013 [P] [US1] Unit test for delayed-metadata safeguard in `server/tests/metadata-safeguard.test.js`: a metadata write that resolves AFTER a simulated user edit must NOT change `title`/`description` when `*_user_set=1`; MUST fill when 0 (research R13, FR-004)
- [X] T014 [P] [US1] E2E `tests/e2e/us1-save.spec.js`: save with auto-details, edit fields, duplicate-opens-existing, invalid-URL rejection, and the safeguard (edit while pending)

### Implementation for User Story 1

- [X] T015 [P] [US1] Bookmark model `server/src/models/bookmark.js`: `create` (dedupe by `url_key`, set `metadata_status='pending'`, `*_user_set` from supplied fields), `getById`, `update` (re-normalize url + re-dedupe, set `*_user_set=1` when title/description supplied, resolve tags via Tag model, touch `date_updated`)
- [X] T016 [US1] Metadata service `server/src/services/metadata.js`: fetch page with ~10s timeout, parse title/description (OpenGraph/Twitter/meta/`<title>`), favicon (`<link rel=icon>`), preview image (`og:image`) via cheerio; download + cache favicon/preview under `data/cache/` (best-effort, remote/placeholder fallback); write results with **conditional update** `WHERE id=? AND title_user_set=0` (and same for description); set `metadata_status` to `complete`/`failed` (FR-003/005, R5, R13)
- [X] T017 [US1] Routes `server/src/routes/bookmarks.js`: `POST /api/bookmarks` (validate→dedupe returns `200 {duplicate,bookmark}`, else `201` and kicks async metadata), `GET /api/bookmarks/:id`, `PATCH /api/bookmarks/:id` (edit url/title/description/tags/note/read_state/archived) per contracts/api.md
- [X] T018 [P] [US1] Binary routes: `GET /api/bookmarks/:id/favicon` and `.../preview` serving cached files with remote/placeholder fallback (guard against path traversal)
- [X] T019 [P] [US1] Frontend `web/src/components/SaveDialog.jsx` (URL + optional title/description/tags/note) and `web/src/components/EditDialog.jsx` (all editable fields), showing a spinner while `metadata_status='pending'` and routing a duplicate response to open the existing bookmark
- [X] T020 [US1] Frontend `web/src/components/BookmarkCard.jsx` (favicon/title/description/tags) and wire save/edit into `App.jsx`, polling `GET /api/bookmarks/:id` until metadata resolves

**Checkpoint**: US1 fully functional and independently testable (MVP).

---

## Phase 4: User Story 2 - Browse and open saved bookmarks (Priority: P1)

**Goal**: Normal list shows title/description/tags/favicon; click opens the
original page in a new tab; friendly empty state.

**Independent Test**: With several bookmarks, the normal list renders all four
fields and clicking opens the original in a new tab; empty collection shows the
empty state.

### Tests for User Story 2

- [X] T021 [P] [US2] E2E `tests/e2e/us2-browse.spec.js`: list shows title/description/tags/favicon, open-in-new-tab, and empty state

### Implementation for User Story 2

- [X] T022 [US2] Extend `server/src/routes/bookmarks.js` with `GET /api/bookmarks` list: `view=normal|unread|archived` (normal excludes archived), `sort`, `page`/`pageSize` (defaults from preferences), returns `{items,total,page,pageSize}` (FR-013/016/025)
- [X] T023 [US2] Bookmark model list query `server/src/models/bookmark.js`: filter by view/archived, sort keys, pagination (data-model sort keys)
- [X] T024 [P] [US2] Frontend `web/src/components/BookmarkList.jsx` + `web/src/views/NormalView.jsx` rendering cards, open-in-new-tab (`target=_blank rel=noopener`), and the empty state (FR-015)

**Checkpoint**: US1 + US2 both independently functional — core capture/browse loop works.

---

## Phase 5: User Story 3 - Organize with notes, tags, read state, archive, delete (Priority: P2)

**Goal**: Markdown notes rendered on view; tags with suggestions and shared
identity; click-a-tag filter; read/unread; reversible archive with unread &
archived views; permanent single delete distinct from archive.

**Independent Test**: Add a Markdown note (renders formatted); tag with
suggestions from existing tags; reuse a tag name → one shared identity; click a
tag → filtered list; toggle read/unread; archive → leaves normal list/search,
appears in archived view, unarchive restores; permanently delete → gone
everywhere.

### Tests for User Story 3

- [X] T025 [P] [US3] E2E `tests/e2e/us3-organize.spec.js`: Markdown render, tag suggest + shared identity (no duplicate tag), click-to-filter, read/unread, archive/unarchive visibility, permanent delete vs archive

### Implementation for User Story 3

- [X] T026 [P] [US3] Frontend Markdown note render `web/src/lib/markdown.js` (marked + DOMPurify) and `web/src/components/NoteMarkdown.jsx` for rendered display + edit (FR-007)
- [X] T027 [US3] Tags route `server/src/routes/tags.js`: `GET /api/tags` (name + count) and `GET /api/tags?prefix=` for suggestions (FR-008/019)
- [X] T028 [US3] `DELETE /api/bookmarks/:id` permanent delete in `server/src/routes/bookmarks.js` (hard delete, cascade tags/snapshot) — distinct from archive (FR-011)
- [X] T029 [P] [US3] Frontend `web/src/components/TagSuggest.jsx` + `web/src/components/TagChips.jsx` (assign tags, suggestions, click-a-tag → `GET /api/bookmarks?tag=` filter — FR-008a/015)
- [X] T030 [P] [US3] Frontend read/unread + archive/unarchive controls on `BookmarkCard.jsx`, a delete-with-confirmation dialog, and `web/src/views/UnreadView.jsx` + `web/src/views/ArchivedView.jsx` (FR-009/010/011/016)

**Checkpoint**: US1–US3 independently functional.

---

## Phase 6: User Story 4 - Search precisely (Priority: P2)

**Goal**: Case-insensitive search over title/description/note/url; `#tag`,
phrases, AND/OR/NOT + parentheses, implicit-AND for `#tag`+words, literal
operators when quoted; sorting; invalid-expression errors; archived excluded.

**Independent Test**: Run keyword/`#tag`/`#tag word`/phrase/boolean/quoted-`"AND"`
queries and confirm correct matches; change sort; invalid expression shows a
clear error; archived never appears.

### Tests for User Story 4

- [X] T031 [P] [US4] Unit tests for the search grammar in `server/tests/search.test.js` covering every row of contracts/search-grammar.md (words, phrase, `#tag`, implicit AND `#js promise`, AND/OR/NOT precedence, parentheses, quoted-literal `"AND"`, invalid-expression errors)
- [X] T032 [P] [US4] E2E `tests/e2e/us4-search.spec.js`: the worked-example queries + sort + invalid-query error + archived exclusion

### Implementation for User Story 4

- [X] T033 [P] [US4] Search tokenizer `server/src/search/tokenizer.js` (phrases, `#tag`, bare `AND`/`OR`/`NOT` operators, parens, words; quoted content literal — FR-021/023)
- [X] T034 [US4] Search parser `server/src/search/parser.js` → expression tree with precedence NOT>AND(implicit)>OR; clear errors on unbalanced parens / dangling operator / unterminated quote (FR-022)
- [X] T035 [US4] Search evaluator `server/src/search/evaluate.js`: match tree against candidates (case-insensitive fields, tag membership by identity) — FR-018/019/020
- [X] T036 [US4] Wire search + sort into `GET /api/bookmarks` (`q`, `sort`); invalid → `400 invalid_query`; evaluate over active-view candidates so archived is excluded from normal/unread (FR-024)
- [X] T037 [P] [US4] Frontend `web/src/components/SearchBar.jsx` + sort control + inline invalid-query message

**Checkpoint**: US1–US4 independently functional.

---

## Phase 7: User Story 5 - Act on many bookmarks at once (Priority: P3)

**Goal**: Multi-select bulk actions and "apply to all matching the current
view," with confirmation + affected count for destructive actions. "Apply to all
matching" MUST target the **complete active result set** — every part of the
current view, not just the search words: view scope (normal/unread/archived), a
clicked tag filter, a saved search's included/excluded tags, and the search
expression — across all pages, so only bookmarks actually visible in the current
results are affected (FR-027).

**Independent Test**: Select several → bulk tag/read/archive. Then, with a view
that combines a tag filter / unread or archived scope / saved-search
include+exclude tags / search words and spans multiple pages, use "apply to all
matching" and confirm it affects **exactly** the full result set (including
matching items on later pages) and **no** bookmark outside that view. Bulk delete
confirms and reports the count.

### Tests for User Story 5

- [X] T038 [P] [US5] E2E `tests/e2e/us5-bulk.spec.js`: (a) selected-set bulk action; (b) "apply to all matching" over a view that combines view scope (e.g. unread/archived), a clicked tag filter, saved-search included/excluded tags, and search words spanning **more than one page** — assert every matching item (including on later pages) is changed and every non-matching bookmark (wrong scope, excluded tag, non-match) is left untouched; (c) confirmed bulk delete reports the count
- [X] T038a [P] [US5] Unit test `server/tests/bulk-selection.test.js`: the server rebuilds the match set from the full view descriptor (scope + tag filter + include/exclude tags + `q`) identically to the list query, ignores pagination, and returns only that set (guards against affecting non-visible bookmarks)

### Implementation for User Story 5

- [X] T039 [US5] `POST /api/bookmarks/bulk` in `server/src/routes/bookmarks.js`: actions tag/untag/read/unread/archive/unarchive/delete over either `select.ids` **or** `select.matchView` — a full **view descriptor** `{ view, q, tag, includeTags, excludeTags, sort }` (same fields as `GET /api/bookmarks`, per contracts/api.md). The server resolves the descriptor with the **same query + search-evaluator path as the list endpoint** so the affected set is exactly the complete current result set across all pages (pagination ignored); it MUST honor view scope, the tag filter, and saved-search include/exclude tags, not just `q` (FR-027). Delete requires `confirm:true`; returns `{affected}` (FR-026/028)
- [X] T040 [P] [US5] Frontend multi-select on lists + `web/src/components/BulkActionBar.jsx` with an "apply to all matching" option that sends the **exact active view descriptor** (current view scope, clicked tag filter, active saved-search include/exclude tags, and search text) — never a bare `q` — plus a confirm dialog

**Checkpoint**: US1–US5 independently functional.

---

## Phase 8: User Story 6 - Save and reuse searches (Priority: P3)

**Goal**: Save a named search (query + include/exclude tags + view + sort);
reopen to restore it; rename/delete.

**Independent Test**: Save a search including some tags and excluding others;
reopen → query/include/exclude/view/sort restored; rename and delete persist.

### Tests for User Story 6

- [X] T041 [P] [US6] E2E `tests/e2e/us6-saved-searches.spec.js`: save with include/exclude tags, reopen restores all facets, rename, delete

### Implementation for User Story 6

- [X] T042 [US6] SavedSearch model `server/src/models/savedSearch.js` (name UNIQUE; `include_tags`/`exclude_tags` as JSON name_keys; `view_scope`; `sort`) per data-model.md
- [X] T043 [US6] Routes `server/src/routes/savedSearches.js`: list/create/patch/delete + `GET /api/saved-searches/:id/results` (applies query + include/exclude tags + view + sort — FR-030/031)
- [X] T044 [P] [US6] Frontend `web/src/components/SavedSearches.jsx` (define include/exclude tags, save/reopen/rename/delete)

**Checkpoint**: US1–US6 independently functional.

---

## Phase 9: User Story 7 - Snapshots and Internet Archive (Priority: P3)

**Goal**: Local snapshot — self-contained HTML for web pages, PDF kept as PDF —
reopenable offline; Internet Archive saving records the archived link; failures
are recoverable and leave the bookmark intact.

**Independent Test**: Snapshot a normal page → self-contained HTML reopens
offline; snapshot a PDF URL → stored as the PDF; request IA save → link recorded
(or a recoverable error if archive.org is unreachable).

### Tests for User Story 7

- [X] T045 [P] [US7] E2E `tests/e2e/us7-snapshots.spec.js`: HTML snapshot reopen, PDF-stays-PDF, IA link recorded or recoverable-error path (skips gracefully if archive.org unreachable)

### Implementation for User Story 7

- [X] T046 [US7] Snapshot service `server/src/services/snapshot.js`: detect content-type; PDF → store original under `data/snapshots/`; HTML → render with Playwright 1.61.0/Chromium and inline CSS/images/fonts as `data:` URIs into a single self-contained HTML file; record `snapshot` row (kind, file_path, byte_size) — FR-032, R6
- [X] T047 [US7] Snapshot model `server/src/models/snapshot.js` + routes `POST /api/bookmarks/:id/snapshot` and `GET /api/bookmarks/:id/snapshot` (serve html/pdf, path-traversal safe); failure → `502 snapshot_failed`, bookmark intact (FR-034)
- [X] T048 [P] [US7] Internet Archive service `server/src/services/archiveOrg.js` (submit to Save Page Now, record `internet_archive_url`) + `POST /api/bookmarks/:id/archive-org`; failure → `502 archive_unavailable`, recoverable (FR-033/034, R7)
- [X] T049 [P] [US7] Frontend snapshot + IA controls, `web/src/components/SnapshotViewer.jsx`, IA link display, and recoverable-error messaging

**Checkpoint**: US1–US7 independently functional.

---

## Phase 10: User Story 8 - Import and export bookmarks (Priority: P3)

**Goal**: Import a Netscape bookmark file preserving address/title/tags/date
added and skipping duplicates; export the same format; reject malformed files
whole.

**Independent Test**: Import a browser-exported file → address/title/tags/date
added preserved, duplicates skipped; export → re-imports into a browser and back;
malformed file → rejected, nothing imported.

### Tests for User Story 8

- [X] T050 [P] [US8] Unit tests for Netscape import/export in `server/tests/netscape.test.js`: parse HREF/title/ADD_DATE(epoch→ISO)/TAGS, dedupe by url_key, whole-file rejection of malformed input, and export→re-import round-trip (FR-035/036/037)
- [X] T051 [P] [US8] E2E `tests/e2e/us8-import-export.spec.js`: import fixture, export download, malformed rejection

### Implementation for User Story 8

- [X] T052 [US8] Netscape service `server/src/services/netscape.js`: `parse` (cheerio → address/title/tags/date-added) and `generate` (HREF/ADD_DATE seconds/TAGS) per contracts/netscape-format.md
- [X] T053 [US8] Routes `server/src/routes/importExport.js`: `POST /api/import` (multipart; dedupe by url_key; `400 invalid_bookmark_file` imports nothing; returns `{imported,skipped}`) and `GET /api/export` (attachment)
- [X] T054 [P] [US8] Frontend `web/src/components/ImportExport.jsx` (upload + export button, result summary)

**Checkpoint**: US1–US8 independently functional.

---

## Phase 11: User Story 9 - Tune the display (Priority: P3)

**Goal**: Set default sort, items-per-page, and font size; changes take effect
immediately and persist across reloads.

**Independent Test**: Change each preference → applies immediately and survives
reload.

### Tests for User Story 9

- [X] T055 [P] [US9] E2E `tests/e2e/us9-preferences.spec.js`: change default sort, items-per-page, font size; verify effect and persistence

### Implementation for User Story 9

- [X] T056 [US9] Preferences model + routes `server/src/models/preferences.js` and `server/src/routes/preferences.js` (`GET`/`PATCH`; validate `items_per_page` positive, `font_size` enum, `default_sort` in supported set — FR-038)
- [X] T057 [P] [US9] Frontend `web/src/components/PreferencesPanel.jsx` applying default sort + page size to lists and font size globally, persisted via the API

**Checkpoint**: All user stories independently functional.

---

## Phase 12: Polish & Cross-Cutting Concerns

- [X] T058 [P] Write `/work/.harness/app.json` = `{"kind":"application","port":4000,"path":"/","start_command":["npm","start"],"start_cwd":"/work"}` and confirm the built app serves on `0.0.0.0:4000` with `data-harness-ready` set only after initial load
- [X] T059 [P] Add a ~500-bookmark seed/import fixture in `tests/fixtures/` and a perf check that list/search updates in <1s (SC-008) and a bulk action covers ≥100 (SC-006)
- [X] T060 [P] Security hardening pass: DOMPurify sanitization of rendered notes, `rel=noopener` on external links, path-traversal guards on favicon/preview/snapshot serving, graceful low-local-storage handling for snapshots
- [X] T061 [P] Author `README.md` (build/run on 4000, run tests) and verify `quickstart.md` scenarios end-to-end
- [X] T062 Run full unit + E2E suites, lint/format, and confirm success criteria SC-001–SC-010

---

## Dependencies & Execution Order

### Phase dependencies

- **Setup (Phase 1)** → no dependencies.
- **Foundational (Phase 2)** → depends on Setup; **blocks all user stories**.
- **User Stories (Phases 3–11)** → each depends only on Foundational; can proceed
  in priority order or in parallel by different developers.
- **Polish (Phase 12)** → after the desired stories are complete.

### Story dependencies & notes

- **US1 (P1)** and **US2 (P2 list)** share the bookmarks route file; US2's list
  endpoint (T022) builds on US1's route module.
- **US4 (search evaluator)** is reused by **US5 (apply-to-matching)** — do US4
  before US5's T039 if building sequentially.
- **US3/US4/US5** touch the shared bookmarks route/model; sequence their route
  edits to avoid conflicts. All other stories are largely independent.
- Tag model (T009, foundational) underpins US1 save-with-tags and US3
  suggestions/filtering.

### Parallel opportunities

- Setup: T002–T005 in parallel.
- Foundational: T008, T009, T011 in parallel after T006/T007.
- Within a story, `[P]` tasks (distinct files — tests, separate components) run
  in parallel.
- After Foundational, different stories can be staffed in parallel.

---

## Implementation strategy

### MVP first

1. Phase 1 Setup → 2. Phase 2 Foundational → 3. Phase 3 **US1** → **STOP &
   VALIDATE** (save + auto-metadata + edit + duplicate + safeguard). 4. Phase 4
   **US2** gives the full capture/browse loop (SC-009).

### Incremental delivery

Add US3 → US4 → US5 → US6 → US7 → US8 → US9, validating each independently, then
Polish. Each story adds value without breaking earlier ones.

---

## Notes

- `[P]` = different files, no incomplete dependencies.
- `[Story]` labels map tasks to spec user stories for traceability.
- Tests (unit + E2E) precede/accompany their story's implementation; verify the
  delayed-metadata safeguard test (T013) fails before T016 is complete.
- Commit after each task or logical group; stop at any checkpoint to validate.
