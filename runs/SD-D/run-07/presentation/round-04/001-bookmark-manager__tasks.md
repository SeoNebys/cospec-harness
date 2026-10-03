# Tasks: Bookmark Manager

**Input**: Approved design documents from `specs/001-bookmark-manager/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`

**Tests**: Included because the approved specification defines acceptance scenarios, safety requirements, persistence guarantees, accessibility outcomes, and measured performance thresholds.

**Organization**: Tasks are grouped by user story so each story can be implemented and validated as an independent increment.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel with adjacent eligible work because it touches different files and has no incomplete dependency
- **[Story]**: Maps the task to the corresponding user story in `spec.md`
- Every task names its implementation or validation path

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create the pinned application, toolchain, and repository structure described by the approved plan.

- [ ] T001 Initialize the strict TypeScript Next.js App Router project and production scripts in `package.json`, `tsconfig.json`, `next.config.ts`, `app/layout.tsx`, and `app/page.tsx`
- [ ] T002 Pin runtime, UI, SQLite, fetch, parsing, validation, and test dependencies—including `@playwright/test@1.61.0`—and generate `package-lock.json`
- [ ] T003 [P] Configure linting, formatting, type-checking, and test commands in `eslint.config.mjs`, `.prettierrc.json`, `vitest.config.ts`, and `playwright.config.ts`
- [ ] T004 [P] Establish responsive design tokens, accessible base styles, and the initial application shell in `styles/globals.css`, `app/globals.css`, and `components/ui/`
- [ ] T005 [P] Define validated environment configuration for the data directory, database file, host, port, and fetch limits in `lib/config.ts` and `.env.example`
- [ ] T006 Create ignored runtime directories and repository ignores for SQLite/WAL files, cached icons, build output, coverage, and test artifacts in `.gitignore` and `data/.gitkeep`

**Checkpoint**: The empty application installs, type-checks, tests, builds, and can be started on `0.0.0.0:4000`.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Implement shared persistence, domain, validation, error, and test infrastructure needed by every story.

**⚠️ CRITICAL**: No user-story implementation begins until this phase is complete.

- [ ] T007 Create versioned SQLite migration execution with foreign keys, WAL, busy timeout, FTS5 capability checks, and schema-version tracking in `lib/db/connection.ts`, `lib/db/migrate.ts`, and `lib/db/migrations/001_initial.sql`
- [ ] T008 Define the complete initial schema in `lib/db/migrations/001_initial.sql`: Bookmark URL/title required; description/note/icon nullable; `is_favorite` defaults false; `is_read` defaults true; archive nullable; immutable create time and advancing update time; Tag display name plus unique normalized name; unique BookmarkTag pair; IconAsset content hash unique and size ≤256 KiB; MetadataCache status/expiry; BulkOperation counts/status/expiry; unique BulkOperationItem pair/status/failure code
- [ ] T009 [P] Define shared domain types and stable error/result contracts for Bookmark, Tag, IconAsset, MetadataCache, BulkOperation, and BulkOperationItem in `lib/domain/types.ts` and `lib/domain/result.ts`
- [ ] T010 [P] Implement shared input schemas with the exact model constraints—title 1–300 characters, description ≤1,000, note ≤20,000, tag display name 1–80, search query ≤2,000, HTTP(S) URL ≤4,096—in `lib/validation/schemas.ts`
- [ ] T011 [P] Implement UTC timestamp/ID helpers and structured redacting diagnostics that never log full URL queries or upstream bodies in `lib/time.ts`, `lib/id.ts`, and `lib/logging.ts`
- [ ] T012 Implement Bookmark, Tag, and BookmarkTag repositories with parameterized SQL, deterministic reads, cascade behavior, and transaction hooks for FTS synchronization in `lib/db/repositories/bookmarks.ts` and `lib/db/repositories/tags.ts`
- [ ] T013 Implement FTS5 search-document creation, update, removal, rebuild, and reconciliation helpers using `unicode61 remove_diacritics 2` in `lib/db/repositories/search-index.ts`
- [ ] T014 [P] Build reusable accessible buttons, fields, dialogs, live announcements, empty states, loading states, and error summaries in `components/ui/`
- [ ] T015 [P] Create temporary-database, metadata-fixture-server, seeded-bookmark, accessibility, and application-page test utilities in `tests/helpers/`
- [ ] T016 Add foundational integration tests for migrations, FTS5 availability, foreign-key cascades, schema constraints, persistence after reopen, and FTS reconciliation in `tests/integration/database-foundation.test.ts`

**Checkpoint**: A real temporary database can migrate, persist base bookmarks/tags, keep FTS synchronized, reopen cleanly, and report domain-safe errors.

---

## Phase 3: User Story 1 — Save a bookmark with page details (Priority: P1) 🎯 MVP

**Goal**: Paste a safe public URL, preview editable title/description/icon, save and open it, fall back to manual details, and navigate to an existing duplicate.

**Independent Test**: Paste a fixture URL, edit retrieved details, save and reopen it; repeat with missing/failed metadata and a normalized duplicate.

### Tests for User Story 1

- [ ] T017 [P] [US1] Add unit and property tests for WHATWG URL admission/normalization, fragment removal, meaningful query preservation, credentials/port rejection, idempotence, and collision cases in `tests/unit/url-normalization.test.ts`
- [ ] T018 [P] [US1] Add metadata policy tests for private/loopback/link-local/reserved IPv4/IPv6, mapped IPv6, mixed DNS, DNS changes, redirect revalidation, HTTPS downgrade, time/byte/MIME limits, and icon validation in `tests/unit/metadata-policy.test.ts` and `tests/integration/metadata-fetch.test.ts`
- [ ] T019 [P] [US1] Add contract tests for every success/error response in `contracts/metadata-api.yaml` in `tests/contract/metadata-api.test.ts`
- [ ] T020 [P] [US1] Add end-to-end tests for preview/edit/save/open, manual fallback, stale-preview cancellation, keyboard use, persistence, and duplicate navigation in `tests/e2e/bookmark-capture.spec.ts`

### Implementation for User Story 1

- [ ] T021 [P] [US1] Implement URL parsing and normalization with HTTP(S), no credentials, admitted ports, fragment removal, and race-safe duplicate identity in `lib/bookmarks/url.ts`
- [ ] T022 [P] [US1] Implement public-address classification and DNS-pinned Undici connection policy with hop-by-hop redirect validation in `lib/metadata/network-policy.ts` and `lib/metadata/transport.ts`
- [ ] T023 [US1] Implement bounded HTML retrieval and Cheerio extraction using title priority `og:title → twitter:title → title`, description priority `og:description → twitter:description → meta description`, five redirects, 1 MiB HTML, and an 8-second hard deadline in `lib/metadata/fetch-page.ts` and `lib/metadata/extract.ts`
- [ ] T024 [US1] Implement SSRF-checked icon candidate ranking, three-candidate limit, 256 KiB cap, raster signature/MIME validation, content hashing, local persistence, and same-origin delivery in `lib/metadata/icons.ts`, `lib/db/repositories/icons.ts`, and `app/icons/[id]/route.ts`
- [ ] T025 [US1] Implement metadata cache and preview orchestration with 24-hour successful and 5-minute negative entries, bounded concurrency, refresh bypass, and safe error categories in `lib/db/repositories/metadata-cache.ts` and `lib/metadata/service.ts`
- [ ] T026 [US1] Implement `POST /api/metadata` exactly to `contracts/metadata-api.yaml`, including manual-continuation errors and no remote markup, in `app/api/metadata/route.ts`
- [ ] T027 [US1] Implement bookmark create/update/open services with required non-empty title, optional description/note/tags/icon, transactional FTS update, and duplicate result containing the existing bookmark destination in `lib/bookmarks/service.ts` and `app/actions.ts`
- [ ] T028 [US1] Build the add/edit form with debounced cancellable preview, editable suggestions, missing-field fallback, preserved failed submissions, and save-as-read/unread control in `components/bookmarks/bookmark-form.tsx` and `components/bookmarks/metadata-preview.tsx`
- [ ] T029 [US1] Build the active collection and bookmark detail routes with icon fallback, external-link opening that retains collection access, and duplicate navigation in `app/page.tsx`, `app/bookmarks/[id]/page.tsx`, and `components/bookmarks/`
- [ ] T030 [US1] Run the US1 unit, contract, integration, and end-to-end suites and record any fixture limitations in `tests/e2e/bookmark-capture.spec.ts`

**Checkpoint**: User Story 1 independently delivers a safe, durable, usable bookmark-capture MVP.

---

## Phase 4: User Story 2 — Find bookmarks with precise searches (Priority: P2)

**Goal**: Search title, URL, description, note, and tags with exact phrases, exact `tag:` conditions, `NOT`/`AND`/`OR`, parentheses, filters, and deterministic sorting.

**Independent Test**: Query deliberately overlapping fixtures and verify every valid grammar form, precedence, canonical interpretation, empty state, and position-aware syntax error.

### Tests for User Story 2

- [ ] T031 [P] [US2] Add lexer/parser tests for implicit AND, phrases, exact tags, precedence, parentheses, Unicode, embedded operators, token/query/depth limits, and every error code in `tests/unit/search-parser.test.ts`
- [ ] T032 [P] [US2] Add compiler truth-table and injection/escaping tests for FTS text plus relational tag set algebra in `tests/unit/search-compiler.test.ts`
- [ ] T033 [P] [US2] Add real-SQLite integration tests for every searchable field, exact tags, filters, sort tie-breakers, index synchronization, reconciliation, and empty results in `tests/integration/search.test.ts`
- [ ] T034 [P] [US2] Add end-to-end tests for visible query interpretation, correction guidance, URL-persisted state, filtering, sorting, clearing, and keyboard operation in `tests/e2e/search.spec.ts`

### Implementation for User Story 2

- [ ] T035 [P] [US2] Implement the bounded lexer and position-bearing tokens from `contracts/search-grammar.md` in `lib/search/lexer.ts`
- [ ] T036 [US2] Implement the recursive-descent AST parser and canonical formatter with primary/phrase/tag > NOT > AND > OR precedence in `lib/search/parser.ts` and `lib/search/format.ts`
- [ ] T037 [US2] Compile only validated AST nodes to parameterized FTS/tag set operations and combine scope/read/favorite/tag filters plus deterministic sorting in `lib/search/compiler.ts` and `lib/bookmarks/query-service.ts`
- [ ] T038 [US2] Build the URL-parameter-driven search editor, interpretation display, syntax feedback, tag/read/favorite filters, sort control, result count, and no-result recovery in `components/search/` and `app/page.tsx`
- [ ] T039 [US2] Run the complete US2 test slice against overlapping title/address/description/note/tag fixtures and record the search acceptance checkpoint in `tests/e2e/search.spec.ts`

**Checkpoint**: User Story 2 is independently usable on the saved collection and never passes raw user syntax to SQLite.

---

## Phase 5: User Story 3 — Keep a read-later queue (Priority: P2)

**Goal**: Mark bookmarks read/unread and use an unread-only view without affecting favorite or archive state.

**Independent Test**: Mark a favorite unread, view it in both lists, mark it read from unread, and confirm favorite/archive independence and persistence.

### Tests for User Story 3

- [ ] T040 [P] [US3] Add service/integration tests for idempotent read transitions and independence from favorite/archive state in `tests/integration/read-state.test.ts`
- [ ] T041 [P] [US3] Add end-to-end and keyboard tests for unread creation, unread-only view, mark-read removal, completed empty state, and persistence in `tests/e2e/read-later.spec.ts`

### Implementation for User Story 3

- [ ] T042 [US3] Implement idempotent read/unread actions and filtered unread queries without mutating favorite/archive state in `lib/bookmarks/status-service.ts` and `app/actions.ts`
- [ ] T043 [US3] Build unread controls, status indicators, unread route, result counts, and completed empty state in `components/bookmarks/read-status.tsx` and `app/unread/page.tsx`
- [ ] T044 [US3] Run the US3 service and end-to-end tests and verify state after application/database reopen in `tests/e2e/read-later.spec.ts`

**Checkpoint**: User Story 3 independently provides a persistent read-later queue distinct from favorites.

---

## Phase 6: User Story 4 — Add and review personal notes (Priority: P2)

**Goal**: Add, edit, display, remove, persist, and search personal notes separately from page descriptions.

**Independent Test**: Add and edit a note, reopen the bookmark, confirm visual separation, and find it using text present only in the note.

### Tests for User Story 4

- [ ] T045 [P] [US4] Add integration tests for note create/edit/remove, 20,000-character validation, FTS synchronization, and persistence in `tests/integration/notes.test.ts`
- [ ] T046 [P] [US4] Add end-to-end tests for visually distinct page description/personal note and note-only search discovery in `tests/e2e/notes.spec.ts`

### Implementation for User Story 4

- [ ] T047 [US4] Add note editing/display with plain-text semantics, accessible labeling, preserved failed edits, and distinct description styling in `components/bookmarks/bookmark-form.tsx`, `components/bookmarks/bookmark-detail.tsx`, and `app/bookmarks/[id]/page.tsx`
- [ ] T048 [US4] Run the US4 integration and end-to-end slice and verify note-only search after create/edit/remove in `tests/e2e/notes.spec.ts`

**Checkpoint**: User Story 4 independently preserves and retrieves personal context without conflating it with fetched metadata.

---

## Phase 7: User Story 5 — Organize individual and multiple bookmarks (Priority: P3)

**Goal**: Favorite, archive, restore, tag, read/unread, or delete individually and apply supported actions to explicit or all-matching snapshots with counts, confirmation, idempotence, and partial-success reporting.

**Independent Test**: Exercise every individual action, then each bulk action on explicit and all-matching selections—including more than one page, a changed query after preview, retry, and one injected item failure.

### Tests for User Story 5

- [ ] T049 [P] [US5] Add repository/service tests for snapshot immutability, action/payload validation, expiry, per-item savepoints, partial success, stored outcomes, and idempotent reconfirmation in `tests/integration/bulk-operations.test.ts`
- [ ] T050 [P] [US5] Add integration tests for favorite independence, archive/restore state retention, tag normalization `trim + NFKC + locale-independent lowercase`, orphan cleanup, and confirmed deletion in `tests/integration/organization.test.ts`
- [ ] T051 [P] [US5] Add end-to-end keyboard tests for explicit/all-matching selection, visible counts, tag/archive/read/delete actions, delete confirmation, focus restoration, partial failures, and archived/favorite views in `tests/e2e/bulk-organization.spec.ts`

### Implementation for User Story 5

- [ ] T052 [P] [US5] Implement idempotent favorite/archive/restore/delete operations and exact tag normalization/association services in `lib/bookmarks/status-service.ts`, `lib/bookmarks/tag-service.ts`, and `app/actions.ts`
- [ ] T053 [US5] Implement bulk preview snapshots for explicit IDs and all current matches with frozen counts, expiry, action payloads, and confirmation tokens in `lib/bulk/preview.ts` and `lib/db/repositories/bulk-operations.ts`
- [ ] T054 [US5] Implement bulk execution in one outer transaction with per-item savepoints, stored success/failure outcomes, safe item reasons, and idempotent retries in `lib/bulk/execute.ts`
- [ ] T055 [US5] Build accessible selection controls, select-all-matching escalation, action toolbar, count/confirmation dialogs, live outcome summaries, and partial-failure details in `components/bulk-actions/` and `components/bookmarks/bookmark-list.tsx`
- [ ] T056 [US5] Build favorites and archived routes plus individual favorite/archive/restore/delete controls in `app/favorites/page.tsx`, `app/archived/page.tsx`, and `components/bookmarks/bookmark-actions.tsx`
- [ ] T057 [US5] Run the US5 integration and end-to-end suites with cross-page matches, changed-query snapshots, expiry, retry, and injected partial failure in `tests/e2e/bulk-organization.spec.ts`

**Checkpoint**: User Story 5 independently supports safe, efficient collection maintenance at individual and bulk scale.

---

## Phase 8: Polish and Cross-Cutting Validation

**Purpose**: Prove the full approved product, performance, accessibility, security, and delivery behavior across stories.

- [ ] T058 [P] Add seeded 10,000-bookmark search/update and 1,000-target bulk benchmarks with recorded threshold assertions in `tests/performance/collection-scale.test.ts`
- [ ] T059 [P] Add full navigation, responsive-layout, empty/loading/error-state, reduced-motion, and automated accessibility checks in `tests/e2e/application-quality.spec.ts`
- [ ] T060 [P] Add metadata observability, rate/concurrency enforcement, cache cleanup, icon garbage collection, expired-operation cleanup, and database verification commands in `lib/maintenance/`, `scripts/verify-db.ts`, and `package.json`
- [ ] T061 Run the complete security fixture matrix from `quickstart.md`, resolve all failures, and preserve regression coverage in `tests/integration/metadata-security.test.ts`
- [ ] T062 Run lint, format check, strict type-check, unit, contract, integration, end-to-end, performance, production build, and database verification commands and resolve failures in `package.json` and affected source/test files
- [ ] T063 Validate every scenario in `specs/001-bookmark-manager/quickstart.md` against the production build and update only inaccurate run/validation instructions in that file
- [ ] T064 Create `/work/.harness/app.json` with the approved production start contract and add the ready marker only to the loaded valid UI/empty state in `app/layout.tsx`
- [ ] T065 Start the prepared application through the harness contract, inspect `/work/.harness/runtime/server.log`, and verify `http://127.0.0.1:4000/` plus the client path `http://maker:4000/` using `specs/001-bookmark-manager/quickstart.md`

**Checkpoint**: All specification outcomes pass against the production build and the application is ready for client review.

---

## Dependencies and Execution Order

### Phase dependencies

- **Phase 1 — Setup**: Starts immediately.
- **Phase 2 — Foundation**: Depends on Phase 1 and blocks every user story.
- **Phase 3 — US1**: Depends on Foundation; establishes persisted bookmarks and is the suggested MVP.
- **Phase 4 — US2**: Depends on Foundation and the base bookmark/FTS repository from US1.
- **Phase 5 — US3**: Depends on Foundation and the base bookmark collection from US1; may proceed alongside US2.
- **Phase 6 — US4**: Depends on Foundation and bookmark edit/detail from US1; its note-only search acceptance also uses US2.
- **Phase 7 — US5**: Depends on Foundation, US1 persistence, and US2 query compilation for all-matching snapshots; may begin its individual-action work earlier.
- **Phase 8 — Polish**: Depends on every story included in the release.

### User-story completion graph

```text
Setup → Foundation → US1 (MVP)
                         ├──→ US2 ──┬──→ US5
                         │          └──→ US4 note-search acceptance
                         ├──→ US3
                         └──→ US4 base note workflow

US1 + US2 + US3 + US4 + US5 → Polish/Release validation
```

### Within each story

1. Add the story's tests and confirm they fail for the intended missing behavior.
2. Implement domain/model and repository behavior.
3. Implement services and server interfaces.
4. Implement the UI integration.
5. Run the independent story checkpoint before advancing.

## Parallel Opportunities

- In Setup, T003–T005 can proceed after T001 while touching separate configuration/UI areas.
- In Foundation, T009–T011 and T014–T015 can proceed around the database chain T007–T008–T012–T013.
- Each story's `[P]` test tasks can be authored in parallel before its implementation.
- After US1, US2 search and US3 read-later can be implemented concurrently; US4's base notes UI can also begin.
- US5 repository tests and organization tests can proceed in parallel before bulk execution/UI integration.
- Performance, accessibility, and maintenance work T058–T060 can proceed in parallel once all story behavior exists.

## Parallel Examples by Story

### US1

Run T017 URL tests, T018 metadata-security tests, T019 API contract tests, and T020 capture E2E tests in parallel; then implement T021 URL identity alongside T022 network policy before joining at T023.

### US2

Run T031 parser tests, T032 compiler tests, T033 SQLite integration tests, and T034 UI E2E tests in parallel; then implement lexer → parser → compiler in dependency order.

### US3

Write T040 service tests and T041 E2E tests in parallel before implementing T042–T043.

### US4

Write T045 persistence/index tests and T046 UI/search tests in parallel before implementing T047.

### US5

Write T049 bulk, T050 organization, and T051 E2E suites in parallel; implement T052 individual operations while preparing T053 snapshot storage, then join at T054–T056.

## Implementation Strategy

### MVP first

1. Complete Setup and Foundation.
2. Complete US1 through T030.
3. Stop and validate safe automatic metadata, manual fallback, persistence, opening, and duplicate navigation.
4. Demonstrate this independently usable capture-and-revisit product before expanding organization features.

### Incremental delivery

1. US1: capture and revisit bookmarks.
2. US2: precise retrieval at collection scale.
3. US3: independent read-later workflow.
4. US4: durable personal context and note search.
5. US5: individual and bulk collection maintenance.
6. Polish: full security, performance, accessibility, and production validation.

## Notes

- `[P]` means safe file-level parallel work, not permission to ignore task dependencies.
- Story labels provide requirement traceability; Setup, Foundation, and Polish intentionally have none.
- Tests precede implementation within each story and must fail for the intended missing behavior before production code is added.
- Keep exact dependency versions and lockfile changes in Setup; do not upgrade opportunistically during story work.
- Stop at any checkpoint for independent review without needing later stories to make the completed story function.
