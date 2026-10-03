# Tasks: Bookmark Manager

**Input**: Design documents from `specs/001-manage-bookmarks/`

**Prerequisites**: Approved `plan.md` and `spec.md`; supporting `research.md`, `data-model.md`, `contracts/`, and `quickstart.md`

**Tests**: The approved plan requires unit, component, contract, integration, security, and browser validation. In every story phase, create the listed tests first and confirm they fail for the intended reason before implementing the behavior.

**Organization**: Tasks are grouped by approved user story so each increment can be implemented and validated independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel with adjacent tasks after their shared prerequisites are complete
- **[Story]**: Maps directly to a user story in `spec.md`
- Every task includes the exact files it creates or changes

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish the workspace, build, quality, and test commands without implementing product behavior.

- [ ] T001 Create the npm workspace manifests and pinned Node 24 engine for `package.json`, `apps/server/package.json`, `apps/web/package.json`, and `packages/contracts/package.json`
- [ ] T002 Install and lock the approved runtime and development dependencies, including Playwright 1.61.0 without downloading another browser, in `package-lock.json`
- [ ] T003 [P] Configure shared strict TypeScript settings and workspace references in `tsconfig.base.json`, `apps/server/tsconfig.json`, `apps/web/tsconfig.json`, and `packages/contracts/tsconfig.json`
- [ ] T004 [P] Configure Vite, Vitest projects, React Testing Library setup, and Playwright browser resolution in `apps/web/vite.config.ts`, `vitest.workspace.ts`, `apps/web/tests/setup.ts`, and `playwright.config.ts`
- [ ] T005 [P] Configure repository formatting, linting, ignores, and runtime-data exclusions in `eslint.config.js`, `.prettierrc.json`, and `.gitignore`
- [ ] T006 Create the planned server, web, shared-contract, test-fixture, and data placeholder directories with module entrypoints in `apps/server/src/server.ts`, `apps/web/src/main.tsx`, `packages/contracts/src/index.ts`, and `tests/capture-site/README.md`
- [ ] T007 Wire root scripts for typecheck, test, build, end-to-end tests, migrations, development, and production start in `package.json`

**Checkpoint**: `npm run typecheck`, `npm test`, and empty production builds execute through the workspace.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Create shared configuration, storage, database, API, client, and security primitives required by every story.

**⚠️ CRITICAL**: No user-story implementation starts until this phase passes.

- [ ] T008 Define validated configuration for `HOST=0.0.0.0`, `PORT=4000`, controlled `BOOKMARK_DATA_DIR`, capture limits, test-only fixture allowance, and refusal of data paths inside built static assets in `apps/server/src/config.ts` and `apps/server/tests/unit/config.test.ts`
- [ ] T009 [P] Define shared error envelopes, UUID/timestamp primitives, pagination types, and stable error codes from `contracts/api.yaml` in `packages/contracts/src/common.ts` and `packages/contracts/src/errors.ts`
- [ ] T010 [P] Implement structured logging and request/job correlation with redaction of notes, full queries, and downloaded content in `apps/server/src/logging.ts` and `apps/server/tests/unit/logging.test.ts`
- [ ] T011 Configure SQLite connection lifecycle with WAL mode, foreign keys, bounded busy timeout, forward migrations, and test-database helpers in `apps/server/src/db/client.ts`, `apps/server/src/db/migrate.ts`, and `apps/server/tests/helpers/database.ts`
- [ ] T012 Implement opaque asset-key path resolution, temporary-file creation, atomic rename, fixed media-type serving metadata, and traversal rejection in `apps/server/src/storage/asset-store.ts` and `apps/server/tests/unit/asset-store.test.ts`
- [ ] T013 Implement public HTTP(S) URL normalization and network policy that rejects loopback, link-local, private, reserved, metadata-service, and non-network IPv4/IPv6 targets and revalidates DNS/redirect destinations in `apps/server/src/capture/url-policy.ts` and `apps/server/tests/unit/url-policy.test.ts`
- [ ] T014 [P] Create the Fastify application factory, schema compiler/type provider, uniform error mapper, health endpoint, and migration/worker-aware readiness endpoint in `apps/server/src/app.ts`, `apps/server/src/api/errors.ts`, and `apps/server/src/api/system-routes.ts`
- [ ] T015 [P] Create the typed same-origin API client with JSON/error decoding, cancellation, and test adapters in `apps/web/src/api/client.ts` and `apps/web/tests/api/client.test.ts`
- [ ] T016 [P] Create the accessible responsive application shell and navigation placeholders for Collection, Read later, Archived, Saved views, and Settings in `apps/web/src/App.tsx`, `apps/web/src/components/AppShell.tsx`, and `apps/web/src/styles/base.css`
- [ ] T017 Add server static-client fallback, safe asset routing, graceful shutdown, SQLite close/checkpoint, and the production `0.0.0.0:4000` entrypoint in `apps/server/src/server.ts` and `apps/server/tests/integration/lifecycle.test.ts`

**Checkpoint**: Foundation is ready; health/readiness, controlled file storage, common schemas, client shell, and hostile-URL rejection work independently of bookmark features.

---

## Phase 3: User Story 1 — Save an enriched, durable bookmark (Priority: P1) 🎯 MVP

**Goal**: Save a valid URL immediately, fill in editable page details asynchronously, retain one current safe visual snapshot, and keep the bookmark usable when capture fails.

**Independent Test**: Save a deterministic reachable page using only its URL, observe independent metadata/snapshot progress, verify title/description/icon/preview and a dated viewable snapshot, protect a user-edited title on normal refresh, confirm replacement refresh, then stop the source and reopen the snapshot.

### Tests for User Story 1

- [ ] T018 [P] [US1] Create failing contract tests for bookmark create/get/update/delete, duplicate conflict, refresh, snapshot state, and inert asset responses from `contracts/api.yaml` in `apps/server/tests/contract/bookmarks.contract.test.ts`
- [ ] T019 [P] [US1] Create failing repository/integration tests for bookmark/tag/asset/snapshot/job constraints, cascades, job recovery, user-edit protection, atomic replacement, and cleanup in `apps/server/tests/integration/bookmark-persistence.test.ts` and `apps/server/tests/integration/capture-jobs.test.ts`
- [ ] T020 [P] [US1] Create failing capture security/integration tests for redirects, subresources, timeout/byte/height bounds, missing metadata, partial captures, and safe local test-fixture allowance in `apps/server/tests/integration/capture-pipeline.test.ts` and `tests/capture-site/server.ts`
- [ ] T021 [P] [US1] Create failing component and end-to-end tests for URL-only save, progress, manual edits, duplicate handling, retry/refresh confirmation, live-page action, and snapshot viewer in `apps/web/tests/bookmarks/save-edit.test.tsx` and `tests/e2e/save-snapshot.spec.ts`

### Implementation for User Story 1

- [ ] T022 [US1] Define Bookmark, Tag, BookmarkTag, Asset, PageSnapshot, and CaptureJob tables plus indexes and migrations in `apps/server/src/db/schema.ts` and `apps/server/src/db/migrations/0001_bookmarks.sql`, enforcing: URL maximum 4,096 and unique normalized URL; title 1–500; description maximum 2,000; notes maximum 20,000; tag name 1–80 with case-insensitive unique normalized name; booleans constrained to 0/1; enums and timestamps from `data-model.md`; one current snapshot; and at most one pending/processing job per bookmark
- [ ] T023 [P] [US1] Define TypeBox bookmark, tag, snapshot, asset, create/update/refresh, and error contracts aligned to `contracts/api.yaml` in `packages/contracts/src/bookmarks.ts`
- [ ] T024 [US1] Implement bookmark/tag repositories, normalized duplicate lookup, transactional create/edit/tag replacement, archive-independent delete cascades, and hostname title fallback in `apps/server/src/db/bookmark-repository.ts` and `apps/server/src/domain/bookmark-service.ts`
- [ ] T025 [P] [US1] Implement isolated Chromium lifecycle and bounded job claiming/retry/recovery with concurrency two and no cross-job credentials, downloads, or service-worker persistence in `apps/server/src/capture/browser.ts`, `apps/server/src/capture/job-worker.ts`, and `apps/server/src/db/capture-job-repository.ts`
- [ ] T026 [P] [US1] Implement deterministic metadata candidate extraction and local favicon/preview downloading with approved image types and kind-specific size limits in `apps/server/src/capture/metadata.ts` and `apps/server/src/capture/image-download.ts`
- [ ] T027 [US1] Implement fixed-viewport full-page WebP capture, extreme-height/output caps, complete/partial/failed states, temporary-file atomic promotion, and prior-snapshot preservation during refresh in `apps/server/src/capture/snapshot.ts` and `apps/server/src/capture/capture-service.ts`
- [ ] T028 [US1] Implement create/detail/update/delete/refresh/snapshot and opaque asset endpoints with 202 asynchronous creation, explicit replacement flag, explicit delete confirmation, fixed content types, `nosniff`, and restrictive CSP in `apps/server/src/api/bookmark-routes.ts` and `apps/server/src/api/asset-routes.ts`
- [ ] T029 [P] [US1] Build bookmark editor fields and reusable case-insensitive tag input with metadata source/protection indicators in `apps/web/src/features/bookmarks/BookmarkEditor.tsx`, `apps/web/src/components/TagInput.tsx`, and `apps/web/src/features/bookmarks/bookmark-form.ts`
- [ ] T030 [P] [US1] Build bookmark cards/list with title fallback, host, visual metadata, tags, favorite/read/snapshot state, dates, and live/snapshot/edit actions in `apps/web/src/features/bookmarks/BookmarkCard.tsx`, `apps/web/src/features/bookmarks/BookmarkList.tsx`, and `apps/web/src/features/bookmarks/CollectionPage.tsx`
- [ ] T031 [US1] Integrate immediate-save progress, background status polling, duplicate decision, manual fallback, retry, and protected-field replacement confirmation in `apps/web/src/features/bookmarks/AddBookmarkDialog.tsx`, `apps/web/src/features/bookmarks/EditBookmarkDialog.tsx`, and `apps/web/src/features/bookmarks/useBookmark.ts`
- [ ] T032 [US1] Implement the inert snapshot viewer with source URL, capture timestamp, complete/partial limitation state, prior-snapshot refresh status, open-live, and refresh controls in `apps/web/src/features/bookmarks/SnapshotViewer.tsx` and `apps/web/src/features/bookmarks/SnapshotPage.tsx`
- [ ] T033 [US1] Make all US1 contract, persistence, security, component, and end-to-end tests pass and record the independent journey result in `specs/001-manage-bookmarks/validation/us1.md`

**Checkpoint**: A user can save, enrich, edit, revisit, snapshot, refresh, and delete bookmarks safely even when remote retrieval fails.

---

## Phase 4: User Story 2 — Keep and complete a read-later list (Priority: P2)

**Goal**: Mark bookmarks unread/read-later, view active unread items together, and mark them read without conflating read state with favorites or archive state.

**Independent Test**: Save bookmarks with default/read-later states, open Read later, mark one read and see it leave while remaining in Collection, mark it unread again, restart, and verify persistence.

### Tests for User Story 2

- [ ] T034 [P] [US2] Create failing contract/integration tests for default `read`, read/unread transitions, active-only unread listing, and persistence across reopen in `apps/server/tests/contract/read-state.contract.test.ts` and `apps/server/tests/integration/read-state.test.ts`
- [ ] T035 [P] [US2] Create failing component/end-to-end tests for creation-time Read later, dedicated unread view, mark-read removal, session undo, favorite independence, and restart persistence in `apps/web/tests/bookmarks/read-later.test.tsx` and `tests/e2e/read-later.spec.ts`

### Implementation for User Story 2

- [ ] T036 [P] [US2] Extend shared bookmark query/update contracts with `readState: read|unread` defaulting to `read` and active-unread scope in `packages/contracts/src/bookmarks.ts`
- [ ] T037 [US2] Implement persisted read-state transitions and active-only unread repository queries without changing favorite/archive state in `apps/server/src/domain/bookmark-service.ts`, `apps/server/src/db/bookmark-repository.ts`, and `apps/server/src/api/bookmark-routes.ts`
- [ ] T038 [US2] Implement Read later navigation/page, creation/edit toggle, card controls, immediate removal, and short client-session undo in `apps/web/src/features/bookmarks/ReadLaterPage.tsx`, `apps/web/src/features/bookmarks/ReadStateButton.tsx`, and `apps/web/src/App.tsx`
- [ ] T039 [US2] Make all US2 tests pass and record the independent journey result in `specs/001-manage-bookmarks/validation/us2.md`

**Checkpoint**: Read-later is a persistent, independently testable queue layered on the bookmark collection.

---

## Phase 5: User Story 3 — Find bookmarks with expressive searches (Priority: P3)

**Goal**: Search by terms, exact phrases, exact tags, NOT, AND, OR, and parentheses; combine filters/sort; receive positioned errors; and save reusable live views.

**Independent Test**: Exercise every normative query in `contracts/search-grammar.md` against a varied collection, verify precedence and malformed-input behavior, save query+filters+sort, change the collection, and reopen/rename/update/delete the saved view.

### Tests for User Story 3

- [ ] T040 [P] [US3] Create failing tokenizer/parser conformance and limit tests for all grammar examples, escapes, NOT-only input, precedence, Unicode offsets, 2,000-code-point query limit, 256-token limit, 16-level nesting limit, and 500-code-point token limit in `apps/server/tests/unit/search-parser.test.ts`
- [ ] T041 [P] [US3] Create failing SQL-compiler/integration tests for case-insensitive term matching, phrase adjacency within one field, exact normalized tags, grouped exclusion, injection metacharacters, filters, sorting, and 10,000-record correctness in `apps/server/tests/integration/search.test.ts`
- [ ] T042 [P] [US3] Create failing API contract tests for bookmark list/search pagination, positioned 422 errors, tag suggestions, and saved-view CRUD/name conflicts/live reevaluation in `apps/server/tests/contract/search-saved-views.contract.test.ts`
- [ ] T043 [P] [US3] Create failing component/end-to-end tests for syntax help, invalid-query preservation, filters, sorting, tag suggestions, saved-view unsaved changes, and normative complex queries in `apps/web/tests/search/search.test.tsx`, `apps/web/tests/saved-views/saved-views.test.tsx`, and `tests/e2e/search-saved-views.spec.ts`

### Implementation for User Story 3

- [ ] T044 [US3] Implement the bounded tokenizer with Unicode code-point positions, quoted phrases, escapes, exact tags, uppercase `NOT`/`OR`, and stable lexical errors in `apps/server/src/search/tokenizer.ts`
- [ ] T045 [US3] Implement the recursive-descent AST parser with parenthesis → NOT → implicit AND → OR precedence, NOT-only support, empty match-all, and positioned syntax errors in `apps/server/src/search/ast.ts` and `apps/server/src/search/parser.ts`
- [ ] T046 [US3] Compile AST and filters into parameterized SQLite predicates that never interpolate query text, keep phrase matches within one field, and support exact normalized tag membership in `apps/server/src/search/sql-compiler.ts` and `apps/server/src/db/bookmark-search-repository.ts`
- [ ] T047 [P] [US3] Define list/filter/sort/search-error, tag suggestion, and SavedView contracts in `packages/contracts/src/search.ts` and `packages/contracts/src/saved-views.ts`
- [ ] T048 [US3] Add SavedView migration and repository in `apps/server/src/db/migrations/0002_saved_views.sql`, `apps/server/src/db/schema.ts`, and `apps/server/src/db/saved-view-repository.ts`, enforcing: name 1–120 with case-insensitive unique normalized name; query maximum 2,000 and parse-valid; versioned filters; sort in `createdAt|updatedAt|title|destination`; direction in `asc|desc`; no stored bookmark IDs
- [ ] T049 [US3] Implement list/search/filter/sort pagination, tag suggestions capped at 20 ordered by prefix quality/usage/name, and SavedView CRUD/live evaluation endpoints in `apps/server/src/api/search-routes.ts`, `apps/server/src/api/tag-routes.ts`, and `apps/server/src/api/saved-view-routes.ts`
- [ ] T050 [P] [US3] Build the search input with debounced valid execution, preserved invalid input, positioned errors, syntax help, and accessible query examples in `apps/web/src/features/search/SearchInput.tsx`, `apps/web/src/features/search/SearchHelp.tsx`, and `apps/web/src/features/search/useSearchQuery.ts`
- [ ] T051 [P] [US3] Build tag/favorite/read/archive filters and date-saved/date-updated/title/destination bidirectional sorting in `apps/web/src/features/search/FilterBar.tsx`, `apps/web/src/features/search/SortControl.tsx`, and `apps/web/src/features/bookmarks/CollectionPage.tsx`
- [ ] T052 [US3] Build Saved views list/editor with exact query+filters+sort capture, unique-name errors, live opening, unsaved-change state, rename/update/save-as-new, and delete confirmation in `apps/web/src/features/saved-views/SavedViewsPage.tsx`, `apps/web/src/features/saved-views/SaveViewDialog.tsx`, and `apps/web/src/features/saved-views/useSavedViews.ts`
- [ ] T053 [US3] Make all US3 parser, SQL, contract, component, end-to-end, and 10,000-record response-under-one-second tests pass and record reproducible timings in `specs/001-manage-bookmarks/validation/us3.md`

**Checkpoint**: The complete approved search language and saved live views work without relying on later bulk or preference features.

---

## Phase 6: User Story 4 — Organize one or many bookmarks (Priority: P4)

**Goal**: Maintain individual bookmarks and safely add a tag, archive, or delete an explicit selection or every current result, including unloaded results.

**Independent Test**: Filter a multi-page collection, tag explicit items, choose all current results, preview and execute archive, provoke a stale-count conflict, cancel and confirm deletion, and verify accurate counts and cleanup.

### Tests for User Story 4

- [ ] T054 [P] [US4] Create failing contract tests for explicit/all-results selectors, exclusions, preview, confirmed count, stale-count conflict, add-tag/archive/delete outcomes, and stable failed-item reporting in `apps/server/tests/contract/bulk.contract.test.ts`
- [ ] T055 [P] [US4] Create failing transactional integration/security tests for unloaded matches, changed criteria, all-or-consistent mutations, case-insensitive tag reuse, deletion cascades, and idempotent snapshot-file cleanup in `apps/server/tests/integration/bulk-actions.test.ts`
- [ ] T056 [P] [US4] Create failing component/end-to-end tests for selection mode, visible versus all-results scope wording, query-change invalidation, count confirmation, cancellation, success/failure reporting, archive/restore, and delete in `apps/web/tests/bulk-actions/bulk-actions.test.tsx` and `tests/e2e/bulk-maintenance.spec.ts`

### Implementation for User Story 4

- [ ] T057 [P] [US4] Define explicit-ID and all-results selectors, excluded IDs, add-tag/archive/delete actions, preview counts, confirmed counts, stale conflicts, and per-item failures in `packages/contracts/src/bulk-actions.ts`
- [ ] T058 [US4] Implement server-side target resolution through the shared search compiler and transactional bulk add-tag/archive/delete with accurate current counts and failure reporting in `apps/server/src/domain/bulk-action-service.ts` and `apps/server/src/db/bulk-action-repository.ts`
- [ ] T059 [US4] Implement bulk preview/execute endpoints with mandatory count confirmation for destructive actions and 409 stale-count response in `apps/server/src/api/bulk-routes.ts`
- [ ] T060 [P] [US4] Implement explicit and all-results selection state, per-item exclusions, query/filter invalidation, and current scope count in `apps/web/src/features/bulk-actions/useSelection.ts` and `apps/web/src/features/bulk-actions/SelectionBar.tsx`
- [ ] T061 [US4] Implement add-tag/archive dialogs, destructive delete confirmation naming action/count, stale-preview recovery, partial-failure reporting, archive page, and restore controls in `apps/web/src/features/bulk-actions/BulkActionDialog.tsx`, `apps/web/src/features/bulk-actions/BulkDeleteDialog.tsx`, and `apps/web/src/features/bookmarks/ArchivedPage.tsx`
- [ ] T062 [US4] Make all US4 contract, transaction, security, component, and end-to-end tests pass and record the independent journey result in `specs/001-manage-bookmarks/validation/us4.md`

**Checkpoint**: Individual and all-results cleanup is efficient, count-consistent, confirmed when destructive, and snapshot-safe.

---

## Phase 7: User Story 5 — Adjust collection presentation (Priority: P5)

**Goal**: Persist light/dark/system theme and comfortable/compact density while retaining all information and actions across responsive layouts.

**Independent Test**: Change sort, theme, and density, reload/restart, verify persistence, switch device theme under system mode, and repeat core actions at a mobile viewport with keyboard-only navigation.

### Tests for User Story 5

- [ ] T063 [P] [US5] Create failing preferences contract/persistence tests for `theme: light|dark|system`, `density: comfortable|compact`, defaults, validation, and restart persistence in `apps/server/tests/contract/preferences.contract.test.ts` and `apps/server/tests/integration/preferences.test.ts`
- [ ] T064 [P] [US5] Create failing component/end-to-end accessibility and responsive tests for immediate preview, reload, system-theme reaction, density information parity, keyboard focus, dialog restoration, and mobile controls in `apps/web/tests/settings/preferences.test.tsx` and `tests/e2e/preferences-accessibility.spec.ts`

### Implementation for User Story 5

- [ ] T065 [US5] Add the singleton DisplayPreferences migration, repository, shared schema, and GET/PATCH endpoints in `apps/server/src/db/migrations/0003_preferences.sql`, `apps/server/src/db/preferences-repository.ts`, `packages/contracts/src/preferences.ts`, and `apps/server/src/api/preferences-routes.ts`, enforcing fixed key `default`, theme `light|dark|system` default `system`, density `comfortable|compact` default `comfortable`, and updated timestamp
- [ ] T066 [US5] Implement Settings page, immediate theme/density preview, persistence/retry, system color-scheme listener, root data attributes, compact/comfortable responsive styles, and information/action parity in `apps/web/src/features/settings/SettingsPage.tsx`, `apps/web/src/features/settings/usePreferences.ts`, `apps/web/src/styles/theme.css`, and `apps/web/src/styles/density.css`
- [ ] T067 [US5] Make all US5 contract, persistence, component, accessibility, responsive, and end-to-end tests pass and record the independent journey result in `specs/001-manage-bookmarks/validation/us5.md`

**Checkpoint**: Presentation choices are persistent and accessible without changing collection meaning or capability.

---

## Phase 8: Polish & Cross-Cutting Validation

**Purpose**: Prove the complete approved product works together, harden operational edges, and prepare the review runtime.

- [ ] T068 [P] Add global keyboard/focus, landmark, accessible-name/state, contrast, and narrow-screen regression coverage across `apps/web/tests/accessibility/app-accessibility.test.tsx` and `tests/e2e/responsive.spec.ts`
- [ ] T069 [P] Add malformed URL/search/payload, SSRF redirect/rebinding defenses, resource-bound, path traversal, CSP/nosniff, and SQL-injection regression coverage in `apps/server/tests/security/security-regression.test.ts`
- [ ] T070 [P] Add deterministic 10,000-bookmark seed and benchmark harness recording dataset, environment, warm-up, samples, p50, p95, and worst timings in `apps/server/tests/performance/search-benchmark.ts` and `specs/001-manage-bookmarks/validation/performance.md`
- [ ] T071 Implement startup reconciliation for orphan temporary/assets, bounded graceful worker shutdown, interrupted-job requeue, and actionable disk-full handling in `apps/server/src/storage/reconcile.ts`, `apps/server/src/capture/job-worker.ts`, and `apps/server/src/server.ts`
- [ ] T072 Validate every endpoint and runtime TypeBox schema against `specs/001-manage-bookmarks/contracts/api.yaml`, resolving any design/implementation drift in `apps/server/tests/contract/openapi-conformance.test.ts` and `packages/contracts/src/index.ts`
- [ ] T073 Run the full command sequence and every acceptance/security/performance journey from `specs/001-manage-bookmarks/quickstart.md`, recording truthful results and any external limitations in `specs/001-manage-bookmarks/validation/final.md`
- [ ] T074 Build production artifacts and create the runtime declaration with `kind: application`, port 4000, path `/`, foreground `npm start`, and `/work` start directory in `/work/.harness/app.json`
- [ ] T075 Start the prepared app through the declared runtime, verify health/readiness and `data-harness-ready="true"` on a valid initial state, then record the client review URL `http://maker:4000/` in `specs/001-manage-bookmarks/validation/final.md`

**Final Checkpoint**: The complete application meets all five stories, cross-cutting safety requirements, performance targets, and runtime presentation contract.

---

## Dependencies & Execution Order

### Phase dependencies

- **Phase 1 — Setup**: Starts immediately.
- **Phase 2 — Foundation**: Depends on Phase 1 and blocks all story work.
- **Phase 3 — US1**: Depends on Foundation and supplies the persisted bookmark collection used by later stories.
- **Phase 4 — US2**: Depends on Foundation and US1's Bookmark record/API projection.
- **Phase 5 — US3**: Depends on Foundation and US1's Bookmark/Tag persistence; it does not require US2, but includes the read-state filter when US2 is present.
- **Phase 6 — US4**: Depends on US1 persistence and US3's shared result/query compiler for all-results selection.
- **Phase 7 — US5**: Depends on Foundation and can run alongside US2/US3 after the shell exists.
- **Phase 8 — Polish**: Depends on all five stories selected for the release.

### User-story completion graph

```text
Setup → Foundation → US1 ─┬→ US2 ───────────┐
                          ├→ US3 → US4 ─────┼→ Polish/Release
                          └→ US5 ───────────┘
```

### Within each story

1. Add tests and confirm expected failures.
2. Add/extend shared contracts and schema.
3. Implement repository/domain behavior.
4. Expose validated API routes.
5. Implement UI behavior.
6. Pass story tests and record the independent validation.

### Parallel opportunities

- In Setup: T003–T005 can proceed in parallel after workspace manifests exist.
- In Foundation: contracts/logging, server API setup, API client, and UI shell tasks marked `[P]` can proceed alongside database/storage work.
- In each story, contract/integration/component test files can be authored in parallel before implementation.
- After US1, US2 and US5 can proceed independently while US3 is built; US4 waits for US3.
- In Polish, accessibility, security, and performance suites can run in parallel before final integration validation.

## Parallel Examples

### User Story 1

```text
T018: Bookmark API contract tests
T019: Persistence/job integration tests
T020: Capture/security integration tests
T021: Save/snapshot UI and end-to-end tests
```

After T022–T024 establish persistence and contracts:

```text
T025: Browser and job worker
T026: Metadata and image extraction
T029: Bookmark editor/tag input
T030: Bookmark card/list
```

### User Story 3

```text
T040: Parser conformance tests
T041: Search SQL integration tests
T042: Search/saved-view contract tests
T043: Search/saved-view UI tests
```

After the parser/compiler is stable, the API work in T049 and UI work in T050–T052 can be divided across server and client contributors.

### User Story 4

```text
T054: Bulk API contract tests
T055: Bulk transaction/security tests
T056: Bulk UI/end-to-end tests
T057: Shared bulk contracts
```

## Implementation Strategy

### MVP first

1. Complete Setup and Foundation.
2. Complete US1 through T033.
3. Stop and validate the core differentiator: URL-only save, safe enrichment, editable details, and a durable current snapshot.
4. Demonstrate that increment before layering on organization features if an early review is useful.

### Incremental delivery

1. **US1**: Enriched, durable bookmarks.
2. **US2**: Actionable read-later queue.
3. **US3**: Full search language and saved live views.
4. **US4**: Efficient, safe bulk organization.
5. **US5**: Persistent display preferences and final presentation controls.
6. **Polish**: Cross-story security, scale, accessibility, operations, and review runtime.

## Notes

- `[P]` denotes work on separate files that can proceed concurrently once prerequisites are complete.
- Story labels provide traceability to `spec.md`; setup, foundation, and polish tasks intentionally have no story label.
- Keep runtime schemas aligned with `contracts/api.yaml` and search behavior aligned with `contracts/search-grammar.md`.
- Do not bypass the persisted job or URL-policy layers for convenience in UI flows or tests.
- Commit after each task or coherent task group and stop at each checkpoint for independent verification.
