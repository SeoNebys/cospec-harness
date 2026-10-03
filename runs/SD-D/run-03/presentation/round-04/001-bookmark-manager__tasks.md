# Tasks: Personal Bookmark Manager

**Input**: Approved design documents from `specs/001-bookmark-manager/`

**Status**: Draft — awaiting client approval

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), and [quickstart.md](./quickstart.md)

**Tests**: The approved plan requires unit, contract, integration, component, end-to-end, accessibility, security, and performance verification. Within each user-story phase, create the listed tests first and confirm they fail for the intended missing behavior before implementing that phase.

**Organization**: Tasks are grouped by user story so each approved behavior has a visible implementation and independent-test checkpoint.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel with adjacent tasks because it targets different files and has no dependency on an incomplete adjacent task.
- **[Story]**: Maps the task to one approved user story from the specification.
- Every task names its intended file or directory.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Initialize the project, build, quality, and test toolchain without implementing product behavior.

- [ ] T001 Create `package.json` and `package-lock.json` with the approved runtime/dev dependencies and scripts for dev, build, start, migrate, format, lint, typecheck, unit, integration, performance, and E2E verification
- [ ] T002 Create strict ESM compiler and build configuration in `tsconfig.json`, `tsconfig.client.json`, `tsconfig.server.json`, `vite.config.ts`, and `index.html`
- [ ] T003 [P] Configure Biome formatting/lint rules and source exclusions in `biome.json`
- [ ] T004 [P] Configure Vitest projects and browser-like component environment in `vitest.config.ts` and `tests/setup.ts`
- [ ] T005 [P] Configure Playwright 1.61.0 to use the built app and shared Chromium in `playwright.config.ts`
- [ ] T006 Create the planned source/test/runtime directories and safe repository exclusions in `src/`, `migrations/`, `public/`, `tests/`, `e2e/`, `data/.gitkeep`, and `.gitignore`

**Checkpoint**: Dependency installation, formatting, linting, typechecking, and empty test discovery run successfully.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish the shared server, database, contract, client, and test foundations required by every story.

**Critical**: No user-story implementation begins until this phase is complete.

- [ ] T007 Implement environment parsing for `PORT` defaulting to 4000, `HOST` defaulting to `0.0.0.0`, database path, metadata limits, and test overrides in `src/server/config.ts`
- [ ] T008 Implement SQLite connection setup with foreign keys, WAL, busy timeout, graceful close, and injectable database paths in `src/server/db/database.ts`
- [ ] T009 Implement ordered transactional migration discovery, `schema_migrations(version PRIMARY KEY, name, applied_at)`, and startup application in `src/server/db/migrate.ts` and `migrations/000_migrations.sql`
- [ ] T010 [P] Encode the OpenAPI request/response enums, DTOs, problem responses, and runtime TypeBox schemas in `src/shared/contracts/api.ts` and `src/shared/contracts/errors.ts`
- [ ] T011 Implement the Fastify application factory, JSON-only mutation validation, same-origin checks, security headers, error mapping, health route, static client delivery, and SPA fallback in `src/server/app.ts`, `src/server/index.ts`, and `src/server/routes/health.ts`
- [ ] T012 [P] Implement the typed same-origin API client and URL-backed view-state utilities in `src/client/lib/api.ts` and `src/client/lib/view-state.ts`
- [ ] T013 [P] Build reusable keyboard-safe button, field, dialog, status, empty-state, and icon-placeholder primitives in `src/client/components/`
- [ ] T014 [P] Create isolated temporary-database helpers, deterministic clocks, entity factories, metadata fixtures, and Fastify test harnesses in `tests/helpers/` and `tests/fixtures/metadata/`
- [ ] T015 Create the responsive application shell, error boundary, loading/empty readiness states, navigation regions, and global design tokens in `src/client/app/App.tsx`, `src/client/app/main.tsx`, and `src/client/styles/global.css`

**Checkpoint**: The migrated empty application serves `/api/health` and a valid empty UI; it does not claim harness readiness while loading or on fatal error.

---

## Phase 3: User Story 1 — Save a Bookmark by Pasting Its Address (Priority: P1) — MVP

**Goal**: Save from an address alone, show fallback or retrieved metadata, persist across sessions, open destinations safely, and route duplicate attempts to the existing editor.

**Independent Test**: Start empty, paste a reachable fixture URL, save immediately without a title, observe fallback then enrichment, reload and open it, manually override text without later clobbering, and verify an equivalent active or archived address creates no duplicate and opens the existing bookmark in edit mode.

### Tests for User Story 1

- [ ] T016 [P] [US1] Write failing table tests for HTTP(S) validation, FR-005 normalization equivalence/non-equivalence, readable fallback titles, and archived duplicate identity in `tests/unit/address-normalization.test.ts`
- [ ] T017 [P] [US1] Write failing metadata extraction tests for HTML title, standard/OG description fallback, base/relative icons, malformed markup, whitespace cleanup, and missing values in `tests/unit/metadata-extraction.test.ts`
- [ ] T018 [P] [US1] Write failing outbound-security and icon tests for IP classes, all-answer DNS validation, DNS pinning, redirects, time/byte/type limits, active icon rejection, PNG re-encoding, and no remote-browser icon URL in `tests/integration/metadata-security.test.ts`
- [ ] T019 [P] [US1] Write failing contract tests for metadata preview, bookmark create/list/detail/icon responses, validation problems, and duplicate 409 payloads from `contracts/openapi.yaml` in `tests/contract/bookmarks-create.contract.test.ts`
- [ ] T020 [P] [US1] Write failing integration tests for durable address-only creation, unique-constraint races, fallback-first saving, pending-job restart, field provenance, stale address revisions, and archived conflicts in `tests/integration/bookmark-capture.test.ts`
- [ ] T021 [P] [US1] Write failing accessible component tests for address paste, automatic preview progress, immediate save, fallback/error states, duplicate navigation, card content, and external opening in `tests/component/bookmark-capture.test.tsx`
- [ ] T022 [P] [US1] Write the failing P1 browser journey with deterministic metadata fixtures and persistence reload in `e2e/capture-bookmark.spec.ts`

### Implementation for User Story 1

- [ ] T023 [US1] Create `bookmark_icons` and `bookmarks` schema in `migrations/001_bookmarks.sql` with `UNIQUE(normalized_address)`, required title and `title_sort_key`, provenance restricted to `fallback|retrieved|user`, metadata status restricted to `pending|complete|partial|failed|skipped_unsafe`, boolean `CHECK` constraints, nullable `archived_at`, address revision, candidate fields, note fields, and timestamps exactly as defined in `data-model.md`
- [ ] T024 [P] [US1] Implement WHATWG address validation/normalization and fallback-title generation in `src/shared/types/address.ts` and `src/server/services/bookmarks/address-normalizer.ts`
- [ ] T025 [US1] Implement transactional bookmark creation, uniqueness conflict lookup across active/archived rows, list/detail reads, metadata-safe conditional updates, and icon reads in `src/server/repositories/bookmark-repository.ts` and `src/server/repositories/icon-repository.ts`
- [ ] T026 [P] [US1] Implement the bounded HTTP(S) client with public-IP classification, all-answer lookup, pinned connections, manual redirect validation, accepted types, decompressed-byte limits, deadlines, and injectable test transport in `src/server/services/metadata/safe-fetch.ts` and `src/server/services/metadata/ip-policy.ts`
- [ ] T027 [P] [US1] Implement tolerant page metadata parsing, candidate ranking, text cleanup, raster signature validation, Sharp bounds/re-encoding, content hashing, and address fallbacks in `src/server/services/metadata/extract-metadata.ts` and `src/server/services/metadata/process-icon.ts`
- [ ] T028 [US1] Implement bounded background enrichment, restart of pending work, address-revision tokens, per-field provenance, retrieved candidates, and stale-result no-ops in `src/server/services/metadata/metadata-coordinator.ts`
- [ ] T029 [US1] Implement `/api/metadata/preview`, bookmark create/list/detail, and app-origin icon routes with TypeBox validation and duplicate payloads in `src/server/routes/metadata.ts` and `src/server/routes/bookmarks.ts`
- [ ] T030 [US1] Implement the paste-first capture form with debounced preview, immediate save, optional manual title/description override, Read Later/favorite defaults, field guidance, and duplicate-to-editor routing in `src/client/features/capture/CaptureForm.tsx`
- [ ] T031 [US1] Implement the active collection, bookmark card, basic detail/editor surface, metadata progress/fallbacks, persisted reload, and safe external-link behavior in `src/client/features/bookmarks/BookmarkList.tsx`, `src/client/features/bookmarks/BookmarkCard.tsx`, and `src/client/features/bookmarks/BookmarkDetail.tsx`

**Checkpoint**: User Story 1 passes independently and delivers the address-only bookmark MVP with no duplicates.

---

## Phase 4: User Story 2 — Find Bookmarks with Precise Search and Filters (Priority: P2)

**Goal**: Search with partial terms, exact phrases, exact `#tags`, implicit/explicit `AND`, `OR`, multiple required tag filters, status filters, scopes, sorting, and actionable syntax errors.

**Independent Test**: Seed overlapping fields/tags and verify every grammar example, invalid form, filter combination, and sort order returns exactly the expected IDs without changing data.

### Tests for User Story 2

- [ ] T032 [P] [US2] Write failing lexer/parser tests for every grammar rule, precedence, implicit `AND`, quoted escapes, exact tags, stable errors/ranges/hints, adversarial inputs, and termination in `tests/unit/search-parser.test.ts`
- [ ] T033 [P] [US2] Write failing evaluator tests for cross-field terms, same-field phrases, relational tag matching, one/two-character fallback, Unicode normalization, multi-tag all-match filters, scopes, statuses, pagination, and sort tie-breakers in `tests/integration/search-evaluator.test.ts`
- [ ] T034 [P] [US2] Write failing API contract tests for bookmark query parameters, tag summaries, pagination, and `SearchProblem` responses in `tests/contract/bookmark-search.contract.test.ts`
- [ ] T035 [P] [US2] Create a failing 10,000-bookmark benchmark covering rare/common substrings, short atoms, phrases, five-atom expressions, tag filters, sorts, total count, and first page in `tests/performance/search-performance.test.ts`
- [ ] T036 [P] [US2] Write failing component tests for search help, syntax feedback, multi-tag/status filters, clear actions, empty results, and all sort controls in `tests/component/search-controls.test.tsx`
- [ ] T037 [P] [US2] Write the failing P2 browser journey for terms, phrases, `#tag`, `AND`/`OR`, combined filters, errors, and sorts in `e2e/search-bookmarks.spec.ts`

### Implementation for User Story 2

- [ ] T038 [US2] Add `tags`, `bookmark_tags`, contentful FTS5 trigram search rows, all data-model uniqueness/foreign-key constraints, and scope/status/sort indexes in `migrations/002_search_and_tags.sql`, including startup verification that FTS5 trigram support is available
- [ ] T039 [P] [US2] Implement grammar-version-1 tokens, immutable AST, recursive-descent parsing, implicit `AND`, `AND` precedence, quoted escapes, and position-aware errors in `src/shared/search/tokenizer.ts`, `src/shared/search/parser.ts`, and `src/shared/search/types.ts`
- [ ] T040 [US2] Implement parameter-bound AST ID-set evaluation, trigram phrase queries, short-atom scans, relational tag predicates, all-selected-tag filtering, active/Read Later/archived scopes, status filters, stable sorting, total counts, and cursor pagination in `src/server/services/search/search-compiler.ts` and `src/server/repositories/search-repository.ts`
- [ ] T041 [P] [US2] Implement tag-key normalization, tag summary reads, and exact/partial tag lookup without SQLite `NOCASE` in `src/server/repositories/tag-repository.ts` and `src/server/routes/tags.ts`
- [ ] T042 [US2] Extend bookmark list routing to parse shared criteria, return pages, and map syntax ranges/hints from the search contract in `src/server/routes/bookmarks.ts`
- [ ] T043 [US2] Implement URL-backed search, syntax help/errors, multi-tag selectors, favorite/read filters, scope-aware controls, sorts, result counts, pagination, clearing, and distinct no-result state in `src/client/features/search/SearchControls.tsx`, `src/client/features/search/FilterPanel.tsx`, and `src/client/features/bookmarks/BookmarkList.tsx`

**Checkpoint**: User Story 2 passes independently against seeded data and meets the 10,000-bookmark p95 target.

---

## Phase 5: User Story 3 — Maintain a Read-Later List (Priority: P3)

**Goal**: Keep unread/Read Later independent from favorites and provide its own searchable, filterable view.

**Independent Test**: Mark favorite and non-favorite links unread, find both in Read Later, mark one read, and verify it leaves Read Later but remains active while favorite state is unchanged.

### Tests for User Story 3

- [ ] T044 [P] [US3] Write failing repository/API tests for default-read creation, read/unread transitions, `read_later = active AND unread`, favorite independence, and retained unread state while archived in `tests/integration/read-later.test.ts`
- [ ] T045 [P] [US3] Write failing accessible component tests for capture-time Read Later choice, card toggles, dedicated navigation/counts, empty state, and focus/status feedback in `tests/component/read-later.test.tsx`
- [ ] T046 [P] [US3] Write the failing P3 browser journey for capture-time unread choice, favorite independence, searching Read Later, and marking an item read in `e2e/read-later.spec.ts`

### Implementation for User Story 3

- [ ] T047 [US3] Implement atomic reading-state updates and Read Later scope counts without modifying favorite/archive fields in `src/server/repositories/bookmark-repository.ts` and `src/server/services/bookmarks/bookmark-state-service.ts`
- [ ] T048 [US3] Extend the bookmark patch/list API for unread transitions and Read Later scope semantics in `src/server/routes/bookmarks.ts`
- [ ] T049 [P] [US3] Add capture-time Read Later selection and card-level mark-read/mark-unread controls in `src/client/features/capture/CaptureForm.tsx` and `src/client/features/bookmarks/BookmarkCard.tsx`
- [ ] T050 [US3] Implement dedicated Read Later navigation, count, searchable/filterable results, and distinct empty state in `src/client/app/App.tsx` and `src/client/features/bookmarks/BookmarkList.tsx`

**Checkpoint**: User Story 3 passes independently; the cross-story archive/hide/restore behavior is completed and proven in User Story 4.

---

## Phase 6: User Story 4 — Organize and Annotate Bookmarks (Priority: P4)

**Goal**: Edit metadata/address, manage tags and favorite/archive states, preserve dates/provenance, and write safely rendered basic formatted notes.

**Independent Test**: Edit every organizational field, apply every allowed note format, search visible note text, archive/restore an unread favorite, reload, and verify all details and state transitions persist.

### Tests for User Story 4

- [ ] T051 [P] [US4] Write failing note tests for Markdown-to-plain-text extraction, allowed headings/emphasis/lists/links/inline-code, raw HTML/image/media exclusion, and dangerous protocol rejection in `tests/unit/formatted-notes.test.ts`
- [ ] T052 [P] [US4] Write failing integration tests for tag normalization, tag replacement, favorite independence, archive retention, restore-to-Read-Later, timestamps, metadata candidates, address revision, and atomic edit rollback in `tests/integration/bookmark-organization.test.ts`
- [ ] T053 [P] [US4] Write failing contract tests for bookmark patch, metadata refresh, candidate acceptance, and tag-list changes in `tests/contract/bookmark-update.contract.test.ts`
- [ ] T054 [P] [US4] Write failing component tests for the editor, tag entry, note toolbar/preview, metadata replacement choice, favorite/archive actions, and timestamp display in `tests/component/bookmark-editor.test.tsx`
- [ ] T055 [P] [US4] Write the failing P4 browser journey for edit, formatted note, favorite, archive, restore, reload, and Read Later resurfacing in `e2e/organize-bookmarks.spec.ts`

### Implementation for User Story 4

- [ ] T056 [P] [US4] Implement canonical Markdown parsing, plain visible-text extraction, safe link checks, and the approved node allowlist in `src/server/services/notes/note-service.ts` and `src/shared/types/notes.ts`
- [ ] T057 [P] [US4] Implement transactional tag upsert/replacement/removal and orphan cleanup with preserved display spelling and normalized `name_key` in `src/server/repositories/tag-repository.ts`
- [ ] T058 [US4] Implement atomic bookmark editing with address validation/conflict rollback, address-revision refresh, user provenance, candidate acceptance, note derivation, tag replacement, favorite/read/archive independence, and updated timestamps in `src/server/services/bookmarks/bookmark-update-service.ts`
- [ ] T059 [US4] Complete bookmark patch and metadata-refresh endpoints with field-specific validation and friendly duplicate navigation payloads in `src/server/routes/bookmarks.ts`
- [ ] T060 [US4] Implement the complete editor for address, title, description, tags, retrieved candidates, note source, and save/cancel behavior in `src/client/features/bookmarks/BookmarkEditor.tsx`
- [ ] T061 [P] [US4] Implement the keyboard-accessible Markdown toolbar, source editor, safe rendered view, and supported-format help in `src/client/features/bookmarks/NoteEditor.tsx` and `src/client/features/bookmarks/FormattedNote.tsx`
- [ ] T062 [P] [US4] Implement favorite, archive, restore, and metadata-refresh controls with announced outcomes in `src/client/features/bookmarks/BookmarkActions.tsx`
- [ ] T063 [US4] Complete Archived navigation, archive-specific empty state, restore flow, favorite/unread retention, and creation/modification detail display in `src/client/app/App.tsx` and `src/client/features/bookmarks/BookmarkDetail.tsx`
- [ ] T064 [US4] Keep relational tags, `note_plain`, normalized searchable fields, and FTS rows consistent in the same edit transaction in `src/server/repositories/search-repository.ts` and `src/server/repositories/bookmark-repository.ts`

**Checkpoint**: User Story 4 passes independently; archive/restore preserves favorite and unread state exactly as approved.

---

## Phase 7: User Story 5 — Act on Many Bookmarks at Once (Priority: P5)

**Goal**: Select individual bookmarks or a stable snapshot of every current result and safely apply all supported bulk actions with exact counts and transactional isolation.

**Independent Test**: Select all results across off-screen pages, let live data change, apply each action, and verify only snapshot members change; confirm view changes clear selection and deletion cancel/confirm uses the stable count.

### Tests for User Story 5

- [ ] T065 [P] [US5] Write failing integration tests for individual/all-result snapshots, off-screen inclusion, criteria hashes, expiry, metadata-drift stability, every bulk action, FTS/tag consistency, exact counts, rollback injection, and out-of-set isolation in `tests/integration/bulk-actions.test.ts`
- [ ] T066 [P] [US5] Write failing contract tests for selection creation/clearing, expired selection errors, bulk action variants, and count responses in `tests/contract/selections.contract.test.ts`
- [ ] T067 [P] [US5] Write failing component tests for selection count, select-page/select-all distinction, automatic clearing, action controls, results, and counted delete confirmation in `tests/component/bulk-actions.test.tsx`
- [ ] T068 [P] [US5] Write the failing P5 browser journey spanning pagination, filtered select-all, every non-delete action, cancelled deletion, and confirmed deletion in `e2e/bulk-actions.spec.ts`

### Implementation for User Story 5

- [ ] T069 [US5] Add `selection_sets` and `selection_items` with opaque primary token, criteria hash, selected count, timestamps/expiry, cascading foreign keys, composite membership primary key, and bookmark index in `migrations/003_selection_sets.sql`
- [ ] T070 [US5] Implement criteria-snapshot materialization, explicit-ID snapshots, exact counts, expiry cleanup, view-hash validation, lookup, and consumption in `src/server/repositories/selection-repository.ts`
- [ ] T071 [US5] Implement one-transaction add/remove tags, favorite/unfavorite, mark read/unread, archive/restore, and permanent delete with selected/processed/changed counts and full rollback in `src/server/services/selection/bulk-action-service.ts`
- [ ] T072 [US5] Implement selection create/clear and bulk-action endpoints from the OpenAPI contract in `src/server/routes/selections.ts`
- [ ] T073 [P] [US5] Implement individual selection, page selection, all-current-results snapshot, visible count, off-screen explanation, and automatic clear-on-view-change in `src/client/features/selection/SelectionControls.tsx`
- [ ] T074 [US5] Implement the bulk toolbar, tag action input, status actions, progress/results, expiry recovery, and count-specific permanent-delete dialog in `src/client/features/selection/BulkActionBar.tsx`

**Checkpoint**: User Story 5 passes independently and the 1,000-bookmark slowest action meets the approved ten-second limit.

---

## Phase 8: User Story 6 — Correct or Remove a Bookmark (Priority: P6)

**Goal**: Make individual edits failure-safe and permanently delete only after confirmation from every current and future live result.

**Independent Test**: Edit and reload every field, attempt invalid and duplicate address edits without changing the source row, cancel deletion, then confirm deletion and verify all dependent records and visible results disappear.

### Tests for User Story 6

- [ ] T075 [P] [US6] Write failing integration tests for invalid edit rollback, duplicate-address edit rollback/navigation, metadata job cancellation, permanent-delete cascades, icon cleanup safety, FTS removal, tag cleanup, selection membership, and live-result disappearance in `tests/integration/bookmark-edit-delete.test.ts`
- [ ] T076 [P] [US6] Write failing contract tests for individual delete 204/404 behavior and patch conflict payloads in `tests/contract/bookmark-delete.contract.test.ts`
- [ ] T077 [P] [US6] Write failing component tests for invalid edit preservation, duplicate navigation, cancel/confirm deletion, focus restoration, and announced deletion in `tests/component/bookmark-delete.test.tsx`
- [ ] T078 [P] [US6] Write the failing P6 browser journey for full edit persistence, invalid/duplicate address handling, cancel, confirm, and absence from all scopes in `e2e/edit-delete-bookmark.spec.ts`

### Implementation for User Story 6

- [ ] T079 [US6] Implement permanent deletion with dependent FTS/tag/selection cleanup, safe shared-icon garbage collection, pending-job no-op behavior, and not-found mapping in `src/server/services/bookmarks/bookmark-delete-service.ts` and `src/server/routes/bookmarks.ts`
- [ ] T080 [US6] Complete individual edit error recovery, duplicate-to-existing editor navigation, and accessible count-neutral delete confirmation/cancel behavior in `src/client/features/bookmarks/BookmarkEditor.tsx` and `src/client/features/bookmarks/DeleteBookmarkDialog.tsx`

**Checkpoint**: User Story 6 passes independently; cancelled/invalid edits and deletions apply no partial changes.

---

## Phase 9: User Story 7 — Reuse a Saved View (Priority: P7)

**Goal**: Save, reopen, rename, replace, and delete named live criteria without snapshotting or changing bookmarks.

**Independent Test**: Save a combined query/filter/scope/sort view, mutate collection data, reopen it against current records, preserve an absent tag criterion, update/rename, cancel deletion, and then confirm deletion without bookmark changes.

### Tests for User Story 7

- [ ] T081 [P] [US7] Write failing integration tests for normalized unique names, grammar validation, atomic create/update/rename, live reevaluation, grammar version 1, preserved missing tag keys, and delete-without-bookmark-change in `tests/integration/saved-views.test.ts`
- [ ] T082 [P] [US7] Write failing contract tests for saved-view list/create/update/delete, duplicate-name conflicts, and search syntax problems in `tests/contract/saved-views.contract.test.ts`
- [ ] T083 [P] [US7] Write failing component tests for save/update/name conflict, open/URL restoration, missing-tag empty state, rename, and confirm/cancel deletion in `tests/component/saved-views.test.tsx`
- [ ] T084 [P] [US7] Write the failing P7 browser journey for live criteria reuse after collection changes in `e2e/saved-views.spec.ts`

### Implementation for User Story 7

- [ ] T085 [US7] Add `saved_views` and `saved_view_tags` with unique normalized name, validated query text, `grammar_version = 1`, scope, nullable favorite/unread filters, sort enum, timestamps, cascading view deletion, and deliberately non-foreign-keyed preserved tag keys in `migrations/004_saved_views.sql`
- [ ] T086 [US7] Implement normalized-name uniqueness, ordered listing, atomic create/update/rename/tag-criteria replacement, get, and delete in `src/server/repositories/saved-view-repository.ts`
- [ ] T087 [US7] Implement saved-view validation through the shared parser and conversion to/from live SearchCriteria without storing result IDs in `src/server/services/search/saved-view-service.ts`
- [ ] T088 [US7] Implement saved-view list/create/update/delete endpoints and contract errors in `src/server/routes/saved-views.ts`
- [ ] T089 [P] [US7] Implement saved-view navigation/list and create/rename/update forms with unique-name and syntax guidance in `src/client/features/saved-views/SavedViewList.tsx` and `src/client/features/saved-views/SavedViewDialog.tsx`
- [ ] T090 [US7] Implement opening criteria into URL-backed state, current-data reevaluation, selection clearing, missing-tag display, and confirm/cancel deletion in `src/client/features/saved-views/useSavedViews.ts` and `src/client/app/App.tsx`

**Checkpoint**: User Story 7 passes independently and every saved view remains a live reusable definition rather than a result snapshot.

---

## Phase 10: Polish and Cross-Cutting Validation

**Purpose**: Verify the whole approved product, harden shared boundaries, and prepare the runnable review artifact.

- [ ] T091 [P] Add Axe scans plus manual-keyboard/focus assertions for empty, populated, filtered, editor, dialog, Read Later, archived, saved-view, and bulk states in `e2e/accessibility.spec.ts`
- [ ] T092 [P] Add 320-pixel and desktop responsive assertions for capture, collection, filters, notes, saved views, and bulk controls with no horizontal page scrolling in `e2e/responsive.spec.ts`
- [ ] T093 [P] Add security integration coverage for CSP/frame/MIME/referrer headers, JSON-only mutations, same-origin checks, friendly errors, and absent internal details in `tests/integration/application-security.test.ts`
- [ ] T094 Complete the full SSRF/resource/race matrix from `research.md` with fake DNS and HTTP/TLS fixtures in `tests/integration/metadata-security.test.ts` and `tests/integration/metadata-races.test.ts`
- [ ] T095 Profile seeded search and the slowest 1,000-row bulk action, tune only measured bottlenecks, and record query plans/percentiles in `tests/performance/search-performance.test.ts`, `tests/performance/bulk-performance.test.ts`, and `specs/001-bookmark-manager/performance-results.md`
- [ ] T096 Validate runtime TypeBox responses against every operation and re-run lint for `specs/001-bookmark-manager/contracts/openapi.yaml` via `tests/contract/openapi-conformance.test.ts`
- [ ] T097 Document local setup, data location/backups, trusted-network limitation, commands, supported search syntax, and recovery guidance in `README.md`
- [ ] T098 Finalize the production build/start path, migration-before-ready behavior, shutdown handling, and `data-harness-ready="true"` timing in `src/server/index.ts`, `src/client/app/App.tsx`, and `package.json`
- [ ] T099 Build and verify the application, then create `/work/.harness/app.json` with `{"kind":"application","port":4000,"path":"/","start_command":["npm","start"],"start_cwd":"/work"}` only after installation, tests, and production build succeed
- [ ] T100 Run every command and manual scenario in `specs/001-bookmark-manager/quickstart.md`, resolve failures, and record honest final evidence or unavailable checks in `specs/001-bookmark-manager/validation.md`

**Checkpoint**: All approved behaviors, security boundaries, accessibility requirements, performance targets, and runtime presentation requirements have evidence.

---

## Dependencies and Execution Order

### Phase Dependencies

- **Setup (Phase 1)** starts immediately.
- **Foundational (Phase 2)** depends on Setup and blocks every user story.
- **US1 / MVP (Phase 3)** depends on Foundational and establishes persistent bookmarks and metadata.
- **US2 (Phase 4)** depends on US1 bookmark persistence and adds search/tag query infrastructure.
- **US3 (Phase 5)** depends on US1 and may proceed alongside US2.
- **US4 (Phase 6)** depends on US1 and the tag/search persistence introduced by US2.
- **US5 (Phase 7)** depends on US2 result compilation and US4 organization actions.
- **US6 (Phase 8)** depends on the complete editor from US4; it may proceed alongside US5.
- **US7 (Phase 9)** depends on US2 criteria parsing/evaluation; it may proceed alongside US4, US5, or US6 once US2 is complete.
- **Polish (Phase 10)** depends on every story included in the release.

### User Story Dependency Graph

```text
Setup → Foundation → US1 (capture MVP)
                         ├─→ US2 (search) ──→ US4 (organize) ──→ US5 (bulk)
                         │        └─────────────────────────────→ US7 (saved views)
                         └─→ US3 (Read Later)      US4 ─────────→ US6 (edit/delete)

US1–US7 → Polish and full validation
```

### Within Each User Story

1. Write the listed tests and confirm they fail for the intended missing behavior.
2. Apply story-specific migration/entity changes.
3. Implement pure rules and repositories before workflow services.
4. Implement server endpoints before client integration.
5. Complete accessible client behavior.
6. Run the story's unit, contract, integration, component, and E2E tests.
7. Stop at the checkpoint if independent criteria fail.

## Parallel Opportunities

- Setup configuration tasks T003–T005 target separate files.
- Foundational contract, client-state, component, and fixture tasks T010 and T012–T014 can run in parallel after package setup.
- All `[P]` test tasks within a story target separate test layers and can be authored together before implementation.
- Pure address, fetch, and extraction work in US1 (T024, T026, T027) can proceed in parallel after their tests exist.
- US3 can proceed alongside US2 after US1 is complete.
- US7 can proceed once US2 is complete while US4–US6 continue.
- Client and server tasks marked `[P]` within later stories target separate files, but must still respect their phase prerequisites.

## Parallel Examples

### User Story 1

```text
T016 address normalization tests | T017 extraction tests | T018 network safety tests | T019 contract tests | T020 integration tests | T021 component tests | T022 E2E test
T024 address rules | T026 safe fetcher | T027 extraction/icon processing
```

### User Story 2

```text
T032 parser tests | T033 evaluator tests | T034 contract tests | T035 performance test | T036 component tests | T037 E2E test
T039 shared parser | T041 tag reads/routes
```

### User Stories After Search

```text
US3 Read Later can proceed independently while US2 search completes its client integration.
After US2: US7 saved views can proceed while US4 organization is implemented.
After US4: US5 bulk actions and US6 individual deletion can proceed in parallel.
```

## Implementation Strategy

### MVP First

1. Complete Setup and Foundational phases.
2. Complete User Story 1 only.
3. Run the P1 independent test and its full automated layers.
4. Demonstrate paste-only capture, fallback/enrichment, persistence, external opening, manual-override safety, and zero duplicates.
5. Continue only after the MVP checkpoint is sound.

### Incremental Delivery

1. **US1**: Capture and revisit a unique bookmark.
2. **US2**: Find it precisely with the approved grammar and filters.
3. **US3**: Manage a separate Read Later queue.
4. **US4**: Organize, annotate, favorite, archive, and restore.
5. **US5**: Apply those actions safely to stable result snapshots.
6. **US6**: Harden individual corrections and permanent deletion.
7. **US7**: Reuse live saved views.
8. **Polish**: Prove cross-cutting accessibility, security, performance, and delivery.

## Notes

- `[P]` means safe file-level parallelism, not permission to bypass dependencies.
- Story labels preserve traceability to the approved specification.
- Tests precede implementation in each story phase and must fail for the intended reason first.
- All database writes that represent one user action are transactional.
- No implementation task may weaken the approved duplicate, Read Later/archive, search, bulk snapshot, formatted-note, or saved-view behavior.
