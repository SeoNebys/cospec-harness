---

description: "Task list for Bookmark Manager implementation"
---

# Tasks: Bookmark Manager

**Input**: Design documents from `/specs/001-bookmark-manager/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Focused test tasks are included for the risk-bearing logic the plan
called out (search parser, URL normalization, import/merge, bulk "all-matching")
plus end-to-end journeys. They are not exhaustive per story.

**Organization**: Tasks are grouped by user story (spec priorities P1–P4) so each
story is independently implementable and testable.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on incomplete work)
- **[Story]**: US1–US14 maps to the spec's user stories
- File paths follow the web-application layout in plan.md (`server/`, `web/`,
  `tests/e2e/`)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and tooling

- [ ] T001 Create the workspace layout (`server/`, `web/`, `tests/e2e/`, `data/`) per plan.md at repository root
- [ ] T002 Initialize root `package.json` with npm workspaces and `start`/`build`/`test`/`test:e2e` scripts in `package.json`
- [ ] T003 [P] Initialize `server/` with TypeScript, Express, better-sqlite3, `playwright@1.61.0`, node-html-parser, and zod in `server/package.json` and `server/tsconfig.json`
- [ ] T004 [P] Initialize `web/` with React, Vite, react-router, markdown-it, and dompurify in `web/package.json` and `web/vite.config.ts`
- [ ] T005 [P] Configure ESLint + Prettier for both workspaces in `.eslintrc.cjs` and `.prettierrc`
- [ ] T006 [P] Configure Vitest (unit + integration) and Playwright Test pinned to `1.61.0` using the shared browsers at `/opt/playwright-browsers` in `vitest.config.ts` and `playwright.config.ts`
- [ ] T007 [P] Add `.gitignore` excluding `data/` (`bookmarks.db`, `captures/`) at repository root
- [ ] T008 Write `/work/.harness/app.json` = `{"kind":"application","port":4000,"path":"/","start_command":["npm","start"],"start_cwd":"/work"}`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST exist before any user story

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T009 Create the SQLite schema in `server/src/db/schema.sql`: `bookmarks`, `tags`, `bookmark_tags`, `saved_filters`, `preserved_copies`, `display_preferences`, and the `bookmarks_fts` FTS5 virtual table with sync triggers — field types/constraints per data-model.md (UNIQUE `bookmarks.normalized_url`, UNIQUE case-insensitive `tags.name`, `read` default 1, `archived` default 0)
- [ ] T010 Implement the better-sqlite3 connection handle in `server/src/db/connection.ts`
- [ ] T011 Implement startup migration in `server/src/db/migrate.ts`: apply `schema.sql` and seed the singleton `display_preferences` row (`default_sort=saved_desc`, `page_size=50`, `text_size=medium`)
- [ ] T012 Implement config (host `0.0.0.0`, port `4000`, `data/` paths, 25 MB capture cap) in `server/src/config.ts`
- [ ] T013 Implement light URL normalization in `server/src/services/normalizeUrl.ts` per research §8 (lowercase scheme+host, drop leading `www.`, unify http/https, strip trailing slash, remove tracking params `utm_*`,`fbclid`,`gclid`,`mc_eid`,`igshid`; keep path and other query params)
- [ ] T014 [P] Unit tests for `normalizeUrl` (trailing slash, `www.`, scheme, `utm_*`, distinct-path/query stay separate) in `server/tests/unit/normalizeUrl.test.ts`
- [ ] T015 Build the Express app skeleton (JSON body parsing, central error handler `{error:{code,message}}`, static SPA serving, `GET /api/health`) in `server/src/app.ts` and the entry that listens on `0.0.0.0:4000` in `server/src/index.ts`
- [ ] T016 [P] Define shared entity/API TypeScript types (Bookmark, Tag, SavedFilter, PreservedCopy, DisplayPreferences, list response) in `server/src/types.ts`
- [ ] T017 [P] Implement the typed REST client base (fetch wrapper, error mapping) in `web/src/api/client.ts`
- [ ] T018 [P] Build the app shell + routing (All, Read Later, Archive, Settings) in `web/src/main.tsx` and `web/src/pages/`, setting `data-harness-ready="true"` only after the initial list (or empty state) loads
- [ ] T019 [P] Implement the safe Markdown render+sanitize util (markdown-it + DOMPurify) in `web/src/lib/markdown.ts`

**Checkpoint**: Foundation ready — user stories can begin

---

## Phase 3: User Story 1 - Save a bookmark with rich metadata (Priority: P1) 🎯 MVP

**Goal**: Save a URL; auto-collect editable title/description/icon/preview; it persists and lists.

**Independent Test**: Save an article URL → fetched metadata appears and is editable → save → it shows in the list and survives reload; invalid URL is rejected.

- [ ] T020 [P] [US1] Implement the Bookmark model (create/get/list/update/delete; `title` never empty — fall back to the URL) in `server/src/models/bookmarks.ts`
- [ ] T021 [P] [US1] Implement the metadata service (page title, `og:description`/`meta[name=description]`, preview via `og:image`/`twitter:image`, favicon via `link[rel~=icon]` with `/favicon.ico` fallback; Playwright fallback when static fetch is blocked) in `server/src/services/metadata.ts`
- [ ] T022 [US1] Implement `POST /api/bookmarks` (validate well-formed URL → 400 on invalid per FR-002; best-effort metadata fill that never blocks save; create → 201) in `server/src/routes/bookmarks.ts`
- [ ] T023 [US1] Implement `GET /api/bookmarks/:id` (single bookmark with tags) in `server/src/routes/bookmarks.ts`
- [ ] T024 [P] [US1] Build the Save dialog UI (enter URL, show editable fetched title/description/icon/preview, save) in `web/src/components/SaveBookmarkDialog.tsx`
- [ ] T025 [US1] Wire the save flow into the app shell and show the new bookmark in `web/src/pages/AllView.tsx`
- [ ] T026 [P] [US1] Integration test: valid URL creates a bookmark; invalid URL → 400; missing title falls back to the address in `server/tests/integration/bookmarks.create.test.ts`

**Checkpoint**: US1 is a usable MVP — save and view bookmarks.

---

## Phase 4: User Story 2 - Save the same address without duplicates (Priority: P1)

**Goal**: Re-saving a known address opens the existing bookmark instead of duplicating.

**Independent Test**: Save a URL, then save it again (and a `utm_`/trailing-slash variant) → no copy is created and the existing bookmark opens for editing.

- [ ] T027 [US2] Extend the Bookmark model to compute and store `normalized_url` on write and enforce the UNIQUE constraint in `server/src/models/bookmarks.ts`
- [ ] T028 [US2] Extend `POST /api/bookmarks`: on an existing `normalized_url`, return `200 {bookmark, duplicate:true}` and create no copy (FR-006) in `server/src/routes/bookmarks.ts`
- [ ] T029 [US2] Web: on a `duplicate` response, open the existing bookmark for editing in `web/src/components/SaveBookmarkDialog.tsx`
- [ ] T030 [P] [US2] Unit tests: duplicate detection across trailing-slash, `www.`, scheme, and `utm_*` variants; distinct paths/queries stay separate in `server/tests/unit/duplicate.test.ts`

**Checkpoint**: Saving is duplicate-free.

---

## Phase 5: User Story 3 - Browse and find bookmarks (Priority: P2)

**Goal**: A readable list (title, description, tags, icon) with basic case-insensitive search and open-in-new-tab.

**Independent Test**: With several bookmarks saved, the list shows all four fields; a keyword found only in a note matches; no-match shows a clear empty state; activating a link opens a new tab.

- [ ] T031 [US3] Implement `GET /api/bookmarks` list (plain-text `q`, `view=all`, `sort`, `page`/`pageSize`; exclude archived) in `server/src/routes/bookmarks.ts`
- [ ] T032 [US3] Implement basic FTS-backed search across title/description/note/url (case-insensitive) in `server/src/models/bookmarks.ts`
- [ ] T033 [P] [US3] Build the readable list + card (title, description, tags, site icon; open link in a new tab; empty-collection and no-results states) in `web/src/components/BookmarkList.tsx` and `web/src/components/BookmarkCard.tsx`
- [ ] T034 [P] [US3] Build the search bar with a no-results empty state in `web/src/components/SearchBar.tsx`
- [ ] T035 [US3] Wire list + search + open into `web/src/pages/AllView.tsx`

**Checkpoint**: Collection is browsable and searchable.

---

## Phase 6: User Story 4 - Rich search expressions (Priority: P2)

**Goal**: `#tag`, quoted phrases, AND/OR/NOT with parentheses; quoted operator words are literal; malformed input errors clearly.

**Independent Test**: `#work AND ("release notes" OR changelog) NOT #archive` honors the logic; `"rise and fall"` matches `and` literally; `(` returns a clear error.

- [ ] T036 [P] [US4] Implement the tokenizer (double-quoted phrases, `#tag`, `AND`/`OR`/`NOT` as operators only when unquoted, parentheses, terms) in `server/src/search/tokenizer.ts`
- [ ] T037 [US4] Implement the recursive-descent parser → boolean AST (precedence NOT > AND > OR; adjacency = implicit AND) in `server/src/search/parser.ts`
- [ ] T038 [US4] Implement the AST evaluator → SQLite predicate (terms/phrases via FTS across title/description/note/url; `#tag` via `bookmark_tags` EXISTS; NOT/group) in `server/src/search/evaluator.ts`
- [ ] T039 [US4] Integrate the parser into `GET /api/bookmarks` `q`; malformed expressions → 400 with a clear message (FR-012) in `server/src/routes/bookmarks.ts`
- [ ] T040 [P] [US4] Unit tests: `#tag`, quoted phrases, quoted-operator-as-literal, precedence/grouping, and error cases (unbalanced quotes/parens, dangling operator, empty `#`) per contracts/search-grammar.md in `server/tests/unit/search.test.ts`

**Checkpoint**: Powerful retrieval works.

---

## Phase 7: User Story 5 - Read-later workflow (Priority: P2)

**Goal**: New saves are read by default; a dedicated read-later view lists only items marked "read later".

**Independent Test**: A new save is absent from the read-later view; mark it "read later" → it appears; mark read → it leaves.

- [ ] T041 [US5] Implement read-state handling (default `read=1`; PATCH mark read / read-later individually; `GET /api/bookmarks?view=readlater` lists `read=0`) in `server/src/models/bookmarks.ts` and `server/src/routes/bookmarks.ts`
- [ ] T042 [P] [US5] Build the Read Later view and per-card mark read / read-later controls in `web/src/pages/ReadLaterView.tsx` and `web/src/components/BookmarkCard.tsx`

**Checkpoint**: Read-later queue works.

---

## Phase 8: User Story 6 - Organize with tags (Priority: P3)

**Goal**: Add/remove multiple tags, filter by a tag, and reuse existing tags via typed suggestions.

**Independent Test**: Tag two bookmarks and filter to see only them; typing an existing tag suggests it; selecting it applies the existing tag (no near-duplicate).

- [ ] T043 [US6] Implement the Tag model (UNIQUE case-insensitive `name`) and `bookmark_tags` attach/detach in `server/src/models/tags.ts`
- [ ] T044 [US6] Implement tag editing via `PATCH /api/bookmarks/:id` `tags[]` and `GET /api/tags?query=` suggestions for reuse (FR-015a) in `server/src/routes/tags.ts`
- [ ] T045 [US6] Add the `tag` quick-filter param to the list endpoint in `server/src/routes/bookmarks.ts`
- [ ] T046 [P] [US6] Build the TagInput component (existing-tag suggestions + reuse) and the tag filter control in `web/src/components/TagInput.tsx`

**Checkpoint**: Tagging and consistent reuse work.

---

## Phase 9: User Story 7 - Personal notes with Markdown (Priority: P3)

**Goal**: Attach a Markdown note, displayed formatted and safely; note text is searchable.

**Independent Test**: Add a Markdown note → it renders with formatting and persists; a word only in the note is found by search.

- [ ] T047 [US7] Support `note_markdown` in create/update and include it in the `bookmarks_fts` index/triggers in `server/src/models/bookmarks.ts` and `server/src/db/schema.sql`
- [ ] T048 [P] [US7] Build the note editor and safe rendered display (via `web/src/lib/markdown.ts`) in `web/src/components/NoteEditor.tsx`

**Checkpoint**: Notes work and are searchable.

---

## Phase 10: User Story 8 - Edit and delete bookmarks (Priority: P3)

**Goal**: Edit any field (recompute normalized_url) and permanently delete with confirmation.

**Independent Test**: Edit a title and note → persists; delete with confirm → gone after reload; editing a URL into an existing one is rejected.

- [ ] T049 [US8] Implement `PATCH /api/bookmarks/:id` (edit url/title/description/tags/note/read/archived; recompute `normalized_url` with 409 on collision; bump `updated_at`) in `server/src/routes/bookmarks.ts`
- [ ] T050 [US8] Implement `DELETE /api/bookmarks/:id` (permanent, distinct from archive; cascades tags/copy) in `server/src/routes/bookmarks.ts`
- [ ] T051 [P] [US8] Build the edit form and delete-with-confirmation UI in `web/src/components/EditBookmarkDialog.tsx`

**Checkpoint**: Maintenance works.

---

## Phase 11: User Story 9 - Sort and bulk actions (Priority: P3)

**Goal**: Sort the list and apply one action to many bookmarks, including all matching the current search/filter.

**Independent Test**: Add a tag to three selected bookmarks at once; then "apply to all matching" a multi-page search tags every match (incl. off-page) and no non-match.

- [ ] T052 [US9] Add sort options (`saved_desc`/`saved_asc`/`title_asc`/`title_desc`/`updated_desc`) to the list endpoint in `server/src/routes/bookmarks.ts`
- [ ] T053 [US9] Implement `POST /api/bookmarks/bulk` (target `{ids}` or `{allMatching:{q,tag,filterId,view}}` re-evaluated server-side, excluding archived unless `view=archive`; actions addTags/removeTags/markRead/markReadLater/archive/restore/delete; delete requires `confirm:true`) in `server/src/routes/bookmarks.ts`
- [ ] T054 [P] [US9] Build multi-select, the bulk action bar (incl. "apply to all matching"), and the sort control in `web/src/components/BulkActionBar.tsx`
- [ ] T055 [P] [US9] Integration test: `allMatching` affects off-page matches and excludes non-matching items (SC-006) in `server/tests/integration/bulk.test.ts`

**Checkpoint**: Bulk maintenance works at scale.

---

## Phase 12: User Story 10 - Archive bookmarks (Priority: P3)

**Goal**: Reversible archive, separate from delete; archived items get their own view and leave the main list and ordinary search.

**Independent Test**: Archive an item → absent from main list and ordinary search, present in the archive view → restore → back in the main list.

- [ ] T056 [US10] Implement archive/restore (single + via bulk), `view=archive`, and exclusion of archived items from the main list and ordinary search in `server/src/models/bookmarks.ts` and `server/src/routes/bookmarks.ts`
- [ ] T057 [P] [US10] Build the Archive view and archive/restore controls in `web/src/pages/ArchiveView.tsx`

**Checkpoint**: Archiving works and is reversible.

---

## Phase 13: User Story 11 - Saved reusable filters (Priority: P4)

**Goal**: Save/apply/edit/delete named filters combining a search with included and excluded tags.

**Independent Test**: Save a filter (search + included + excluded tag), apply it later → the same results return.

- [ ] T058 [US11] Implement the SavedFilter model and CRUD routes; apply = `parse(search)` AND has-all-included AND has-none-excluded in `server/src/models/filters.ts` and `server/src/routes/filters.ts`
- [ ] T059 [US11] Add the `filterId` param to the list endpoint in `server/src/routes/bookmarks.ts`
- [ ] T060 [P] [US11] Build the saved-filters UI (create/apply/edit/delete with included/excluded tags) in `web/src/components/SavedFilterList.tsx`

**Checkpoint**: Reusable filters work.

---

## Phase 14: User Story 12 - Preserve a local and Internet Archive copy (Priority: P4)

**Goal**: Full-page MHTML local copy (original PDF for PDF links) with a 25 MB cap; offer a Wayback snapshot link.

**Independent Test**: Open a saved page's full-page local copy; a PDF link preserves the original PDF; a Wayback link is offered (or "none available / request" when absent); capture failure still saves the bookmark.

- [ ] T061 [US12] Implement the capture service (MHTML via Playwright Chromium CDP `Page.captureSnapshot`; original-PDF download when `Content-Type: application/pdf`/`.pdf`; enforce 25 MB cap; status `available`/`unavailable`/`pending`) in `server/src/services/capture.ts`
- [ ] T062 [US12] Persist `preserved_copies` and trigger capture on create without blocking the save (FR-028) in `server/src/models/preservedCopies.ts`
- [ ] T063 [US12] Implement `GET /api/bookmarks/:id/copy` (serve `.mhtml`/`.pdf` with correct content type; 404 when unavailable) in `server/src/routes/bookmarks.ts`
- [ ] T064 [US12] Implement the Internet Archive service (Wayback availability lookup + save request) and `POST /api/bookmarks/:id/archive-copy/refresh`, degrading gracefully when unreachable in `server/src/services/archiveorg.ts` and `server/src/routes/bookmarks.ts`
- [ ] T065 [P] [US12] Build the copy UI (open local copy; Wayback link or "none available / request one") in `web/src/components/CopyLinks.tsx`

**Checkpoint**: Durable copies work (best-effort for external services).

---

## Phase 15: User Story 13 - Import and export bookmarks (Priority: P4)

**Goal**: Import/export Netscape bookmark HTML with the `TAGS` attribute; import merges non-destructively.

**Independent Test**: Export → re-import → titles, tags, and saved dates preserved with zero duplicates (SC-008).

- [ ] T066 [US13] Implement the importer: parse Netscape HTML (`HREF`, `ADD_DATE`→saved_at, `TAGS`) and merge non-destructively by `normalized_url` (union tags, earliest date, preserve existing fields, fill empties) per contracts/bookmark-html.md in `server/src/services/importer.ts`
- [ ] T067 [US13] Implement the exporter: generate Netscape HTML with `TAGS="tag1,tag2"`, preserving titles and saved dates in `server/src/services/exporter.ts`
- [ ] T068 [US13] Implement `POST /api/import` (multipart) and `GET /api/export` routes in `server/src/routes/importexport.ts`
- [ ] T069 [P] [US13] Build the import/export UI in `web/src/pages/Settings.tsx`
- [ ] T070 [P] [US13] Unit tests: merge rules and export→import round-trip fidelity (SC-008) in `server/tests/unit/importexport.test.ts`

**Checkpoint**: Portability works.

---

## Phase 16: User Story 14 - Personal display preferences (Priority: P4)

**Goal**: Persist default sort, page size, and text size; apply on load.

**Independent Test**: Change all three → reload → remembered and applied.

- [ ] T071 [US14] Implement the DisplayPreferences model (singleton) and `GET`/`PUT /api/preferences` in `server/src/models/preferences.ts` and `server/src/routes/preferences.ts`
- [ ] T072 [P] [US14] Build the Settings UI for default sort / page size / text size and apply it on load in `web/src/pages/Settings.tsx`

**Checkpoint**: Personalization works.

---

## Phase 17: Polish & Cross-Cutting Concerns

**Purpose**: Validation and hardening across stories

- [ ] T073 [P] Add Playwright end-to-end journeys for the key stories (save, duplicate, rich search, read-later, bulk-all-matching, archive, import/export round-trip) in `tests/e2e/`
- [ ] T074 [P] Write run/build docs in `README.md`
- [ ] T075 Seed 1,000+ bookmarks and verify list/search stays under 1s (SC-002) via `server/tests/perf/seed-and-measure.ts`
- [ ] T076 Readability/accessibility pass on the list and text-size settings in `web/src/`
- [ ] T077 Verify the harness contract end to end: `npm run build` then `npm start` serves on `0.0.0.0:4000` and `data-harness-ready` appears only after initial data loads
- [ ] T078 Run the quickstart.md validation scenarios and record results

---

## Dependencies & Execution Order

### Phase dependencies

- **Setup (Phase 1)**: no dependencies.
- **Foundational (Phase 2)**: depends on Setup — **blocks all user stories**.
- **User Stories (Phases 3–16)**: all depend on Foundational. US1 → US2 (US2 extends US1's save endpoint). US3 underpins the list UI reused by later stories; US4 extends US3's search; US6 (tags) is needed by US11 (saved filters) and enriches US4's `#tag`. Otherwise stories are independently testable.
- **Polish (Phase 17)**: depends on the targeted stories being complete.

### Key cross-story notes

- `server/src/routes/bookmarks.ts` is touched by several stories (US1–US5, US8–US10, US12) — those edits are **sequential**, not parallel, within that file.
- URL normalization (T013) is a shared dependency for US2, US8, and US13.
- The search parser (US4) is reused by US11 saved filters and US9 "all matching".

### Parallel opportunities

- Setup: T003–T007 in parallel.
- Foundational: T014, T016, T017, T018, T019 in parallel after T009–T013/T015.
- Within a story, `[P]` tasks (mostly web components + tests in separate files) run in parallel with the server work.

---

## Parallel Example: User Story 1

```bash
# After the Bookmark model (T020), these can proceed together:
Task: "T021 [US1] Metadata service in server/src/services/metadata.ts"
Task: "T024 [US1] Save dialog UI in web/src/components/SaveBookmarkDialog.tsx"
Task: "T026 [US1] Integration test in server/tests/integration/bookmarks.create.test.ts"
```

---

## Implementation Strategy

### MVP first (US1 + US2, both P1)

1. Phase 1 Setup → Phase 2 Foundational.
2. Phase 3 (US1: save with metadata) → **STOP and validate** (savable, viewable MVP).
3. Phase 4 (US2: no duplicates) → validate duplicate-free saving.

### Incremental delivery

Add stories in priority order — P2 (US3 browse, US4 rich search, US5 read-later),
then P3 (US6 tags, US7 notes, US8 edit/delete, US9 bulk, US10 archive), then P4
(US11 filters, US12 copies, US13 import/export, US14 preferences). Each story is a
testable increment that does not break earlier ones. Finish with Phase 17 polish
and the quickstart validation.

---

## Notes

- `[P]` = different files, no incomplete dependency.
- `[Story]` labels map tasks to spec user stories for traceability.
- External-dependent tasks (T021 metadata, T061 capture, T064 Internet Archive)
  are best-effort: failures must never block saving and are surfaced honestly.
- Commit after each task or logical group; stop at any checkpoint to validate.
