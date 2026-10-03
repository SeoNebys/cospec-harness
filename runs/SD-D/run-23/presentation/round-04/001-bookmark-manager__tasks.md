# Tasks: Bookmark Manager

**Input**: Approved design documents from `specs/001-bookmark-manager/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/openapi.yaml`, `quickstart.md`

**Tests**: Automated tests are included because the specification defines independent acceptance tests and measurable outcomes, and the plan identifies security- and consistency-critical behavior that must be verified.

**Organization**: Tasks are grouped by user story so each approved journey can be implemented and demonstrated as an increment.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel with neighboring tasks after its prerequisites are complete because it targets different files.
- **[Story]**: Maps directly to the numbered user story in `spec.md`.
- Every task names its intended file path.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish the build, runtime, quality, and directory foundations without implementing product behavior.

- [ ] T001 Create the planned `src/client`, `src/server`, `src/shared`, `tests`, `public`, `scripts`, and `data` directory structure with tracked placeholders in `data/.gitkeep` and `tests/fixtures/.gitkeep`
- [ ] T002 Initialize the Node 24 ESM package with pinned runtime and development dependencies, scripts for dev/build/start/lint/typecheck/test/test:integration/test:e2e/db:migrate/db:seed:review, and Node engine constraints in `package.json` and `package-lock.json`
- [ ] T003 [P] Configure strict TypeScript project references for browser, server, shared code, and tests in `tsconfig.json`, `tsconfig.client.json`, `tsconfig.server.json`, and `tsconfig.test.json`
- [ ] T004 [P] Configure the Vite React build to emit `dist/client` and proxy `/api` only during development in `vite.config.ts`
- [ ] T005 [P] Configure ESLint, formatting, and ignored generated/runtime paths in `eslint.config.js`, `.prettierrc.json`, and `.gitignore`
- [ ] T006 [P] Configure Vitest projects, jsdom component tests, coverage thresholds, and Playwright 1.61.0 with the supplied browser path and production-like web server in `vitest.config.ts` and `playwright.config.ts`
- [ ] T007 [P] Define validated environment variables for `0.0.0.0:4000`, database path, media-cache path, session key, metadata limits, and review-account credentials in `.env.example` and `src/server/config.ts`
- [ ] T008 [P] Add base responsive tokens, typography, focus styles, reduced-motion behavior, and high-contrast color primitives in `src/client/styles/global.css`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Implement shared persistence, identity, contracts, application shell, and test harnesses required by every story.

**Critical**: No user-story implementation begins until this phase passes its tests.

- [ ] T009 Define Drizzle tables for users, bookmarks, tags, bookmark-tags, collections, saved views, and media-cache entries with internal integer keys, public UUIDs, owner columns, timestamps, and `users.library_revision` in `src/server/db/schema.ts`
- [ ] T010 Add the initial SQL migration with foreign keys, WAL-compatible indexes, unique `(user_id, normalized_url)`, unique normalized label/view keys, FTS5 `unicode61 remove_diacritics 2`, synchronization triggers, and rebuild support in `src/server/db/migrations/0001_initial.sql`
- [ ] T011 Implement database opening, foreign keys, WAL, busy timeout, migration execution, transactions, and disposable test databases in `src/server/db/client.ts` and `src/server/db/migrate.ts`
- [ ] T012 [P] Define shared Zod request/response schemas matching `contracts/openapi.yaml`, including RFC-style problem details and UUID/date/enum validation, in `src/shared/schemas/api.ts` and `src/shared/types/api.ts`
- [ ] T013 [P] Implement Unicode NFKC display-name normalization, trimmed/collapsed whitespace, locale-independent case folding, UUID creation, and UTC timestamp helpers in `src/shared/normalization.ts` and `src/shared/identifiers.ts`
- [ ] T014 Implement provisioned-user lookup, Argon2id credential verification, encrypted HTTP-only same-origin sessions, CSRF validation, login/logout/current-session routes, and user-scoped request context in `src/server/auth/service.ts`, `src/server/auth/plugin.ts`, and `src/server/api/session.ts`
- [ ] T015 [P] Implement problem-detail mapping, structured request logging with secret/query redaction, request IDs, rate-limit hooks, and success/failure response helpers in `src/server/api/errors.ts`, `src/server/logging.ts`, and `src/server/api/plugins.ts`
- [ ] T016 Assemble Fastify API registration, health handling, built-SPA static serving and fallback, shutdown, and `0.0.0.0:4000` startup in `src/server/app.ts` and `src/server/index.ts`
- [ ] T017 [P] Implement the typed same-origin client, CSRF propagation, session query, error decoding, and query-cache provider in `src/client/app/api-client.ts`, `src/client/app/session.tsx`, and `src/client/app/query-client.ts`
- [ ] T018 [P] Build accessible reusable buttons, inputs, dialogs, toast/status announcements, loading skeletons, empty states, and error boundaries in `src/client/components/`
- [ ] T019 Build sign-in, authenticated navigation, responsive application layout, initial-data readiness handling, and delayed `data-harness-ready="true"` marker in `src/client/app/App.tsx`, `src/client/routes/LoginRoute.tsx`, and `src/client/app/layout/`
- [ ] T020 [P] Create review-account seed tooling that reads explicit environment credentials and never commits a password in `scripts/seed-review-user.ts`
- [ ] T021 [P] Create database/API/component test factories, a second-user privacy fixture, CSRF/session helpers, and controlled metadata-site fixtures in `tests/helpers/` and `tests/fixtures/metadata-sites/`
- [ ] T022 Verify sign-in, CSRF rejection, session persistence, logout, and cross-user 404 isolation through Fastify injection tests in `tests/integration/session-and-tenancy.test.ts`

**Checkpoint**: The app starts, serves the sign-in shell, persists a provisioned session, and enforces tenant/CSRF boundaries before bookmark behavior exists.

---

## Phase 3: User Story 1 — Save a Rich Bookmark with Minimal Typing (Priority: P1) — MVP

**Goal**: Paste a public URL, receive safe automatic title/description/icon/preview details when available, override them, save manually through failures, and reopen the persisted bookmark without duplicates.

**Independent Test**: Paste controlled complete, partial, timeout, blocked-private, malformed, and duplicate URLs; verify fallback/manual save and persisted user-edited details.

### Tests for User Story 1

- [ ] T023 [P] [US1] Write failing URL normalization and duplicate tests covering missing schemes, host casing, trailing slashes, IDNs, query/fragment retention, invalid protocols, credentials, and duplicates across active/archive in `tests/unit/url-normalization.test.ts`
- [ ] T024 [P] [US1] Write failing guarded-fetch tests for mixed public/private DNS answers, IPv4-mapped IPv6, numeric hosts, DNS rebinding, public-to-private redirects, redirect loops, credentials, nonstandard ports, timeouts, 16 KiB headers, 2 MiB HTML, and non-HTML bodies in `tests/unit/metadata-fetcher.test.ts`
- [ ] T025 [P] [US1] Write failing metadata parsing tests for Open Graph/title/description/icon precedence, relative URLs, malformed markup, Unicode/control cleanup, first-value ordering, and hostname fallback in `tests/unit/metadata-parser.test.ts`
- [ ] T026 [P] [US1] Write failing contract/integration tests for `POST /api/metadata-preview`, bookmark create/get/list, duplicate conflict payloads, user scoping, and owned icon/preview responses in `tests/contract/bookmark-capture.test.ts` and `tests/integration/bookmark-capture.test.ts`

### Implementation for User Story 1

- [ ] T027 [P] [US1] Implement HTTP(S) URL recognition and the documented normalized duplicate key without substituting publisher canonical URLs in `src/server/services/url-normalizer.ts`
- [ ] T028 [P] [US1] Implement the DNS-pinned Undici client with public-address classification on every redirect, five-hop limit, shared 4.5-second deadline, 16 KiB header limit, 2 MiB HTML limit, no credentials/cookies/retries, and structured fallback reasons in `src/server/metadata/safe-fetch.ts`
- [ ] T029 [P] [US1] Implement non-executing Cheerio extraction for title, description, icon, and preview image with deterministic precedence and text/URL sanitization in `src/server/metadata/extract-metadata.ts`
- [ ] T030 [US1] Implement metadata preview orchestration, per-user/global concurrency limits, outcome logging, and `complete|partial|unavailable|blocked|timeout` responses in `src/server/metadata/service.ts` and `src/server/api/metadata.ts`
- [ ] T031 [P] [US1] Implement the owned bookmark-ID media proxy and evictable cache with revalidated redirects, raster sniffing, SVG rejection, icon ≤512 KiB, preview ≤5 MiB, bounded dimensions, `nosniff`, and neutral fallback in `src/server/metadata/media-proxy.ts`, `src/server/metadata/media-cache.ts`, and `src/server/api/assets.ts`
- [ ] T032 [US1] Implement user-scoped bookmark create/get/basic-list persistence with `title` required at 1–200 characters, `description` at most 2,000, `notes_markdown` at most 20,000 with raw HTML disabled, default `unread`, optional same-owner collection/tags, metadata fields, optimistic version 1, duplicate conflicts, and atomic revision increments in `src/server/db/repositories/bookmarks.ts`
- [ ] T033 [US1] Implement `POST /api/bookmarks`, `GET /api/bookmarks/{id}`, and the initial `GET /api/bookmarks` route schemas and service flow in `src/server/api/bookmarks.ts` and `src/server/services/bookmarks.ts`
- [ ] T034 [US1] Build the add-bookmark flow with debounced/cancellable metadata preview, untouched-field autofill, visible normalized URL, partial/failure messaging, manual continuation, unread default, and duplicate open/update/restore choices in `src/client/features/bookmarks/BookmarkForm.tsx` and `src/client/features/bookmarks/useMetadataPreview.ts`
- [ ] T035 [US1] Build the initial active-library cards/details with safe same-origin icon/preview endpoints, external links that retain library state, metadata fallbacks, dates, and empty-state capture action in `src/client/features/bookmarks/BookmarkCard.tsx`, `BookmarkDetails.tsx`, and `src/client/routes/LibraryRoute.tsx`
- [ ] T036 [US1] Add a passing browser journey for complete/partial/failed metadata, preserved user overrides, duplicate handling, reload persistence, and first-save completion under 45 seconds in `tests/e2e/bookmark-capture.spec.ts`

**Checkpoint**: A signed-in user can capture and reopen rich bookmarks safely; the feature remains useful when metadata retrieval fails.

---

## Phase 4: User Story 2 — Find Bookmarks with Precise Search (Priority: P2)

**Goal**: Browse, page, search, filter, and sort active bookmarks using words, phrases, exact tags, Boolean combinations, and actionable syntax feedback.

**Independent Test**: Seed varied bookmarks and verify text/notes matches, `tag:`, phrases, NOT/AND/OR/grouping, combined filters, three sorts, pagination, empty states, and invalid-query spans.

### Tests for User Story 2

- [ ] T037 [P] [US2] Write failing lexer/parser tests for bare text, quoted phrases, quoted multi-word tags, unary and infix NOT, AND/OR, adjacency-as-AND, parentheses, precedence, Unicode/punctuation, unmatched input, ≤1,000 characters, ≤100 tokens, ≤10 nesting levels, and exact error spans in `tests/unit/search-parser.test.ts`
- [ ] T038 [P] [US2] Write failing compiler tests proving bound values, FTS quote escaping, phrase behavior, exact tag IDs, ALL-semantics tag filters, tenant/location-bounded NOT, filter combinations, and whitelisted sorts/cursors in `tests/unit/search-compiler.test.ts`
- [ ] T039 [P] [US2] Write failing integration tests for FTS trigger synchronization, active-only search, count/list agreement, stable keyset pagination, and 10,000-record query timing in `tests/integration/search-repository.test.ts`

### Implementation for User Story 2

- [ ] T040 [P] [US2] Implement the source-positioned lexer, recursive-descent parser, versioned AST, and helpful syntax errors in `src/server/search/lexer.ts`, `src/server/search/parser.ts`, and `src/server/search/ast.ts`
- [ ] T041 [US2] Implement tag resolution and AST compilation through a user/location/filter-scoped universe using parameterized FTS5 leaves and `INTERSECT|UNION|EXCEPT` set algebra in `src/server/search/compiler.ts`
- [ ] T042 [US2] Extend bookmark repositories with shared count/list queries, newest/oldest/title keyset cursors, maximum page size 100, active/unread/archive structural scope, combined tag/collection/read filters, and FTS rebuild diagnostics in `src/server/db/repositories/bookmark-search.ts`
- [ ] T043 [US2] Complete `GET /api/bookmarks` query parsing and return canonical criteria, total, cursor, revision, warnings, and source-spanned problem details in `src/server/api/bookmarks.ts`
- [ ] T044 [P] [US2] Build URL-synchronized search input, operator help, quoted phrase/tag examples, filter chips, three sort choices, active criteria summary, and clear-all action in `src/client/features/search/SearchToolbar.tsx` and `src/client/features/search/search-state.ts`
- [ ] T045 [US2] Add paged result loading, no-match recovery, source-highlighted syntax errors that retain input, and library-position retention when external links open in `src/client/routes/LibraryRoute.tsx` and `src/client/features/search/SearchResults.tsx`
- [ ] T046 [US2] Add passing browser coverage for plain/notes text, phrases, `tag:`, Boolean/grouped queries, filters, sorts, invalid input, no results, and opening a result without changing read state in `tests/e2e/search-and-browse.spec.ts`

**Checkpoint**: Users can reliably find a known item in a large active library with simple or advanced criteria.

---

## Phase 5: User Story 3 — Keep a Read-Later Queue (Priority: P3)

**Goal**: Keep new bookmarks unread by default, explicitly mark read/unread, and browse only active unread items without link opening changing status.

**Independent Test**: Save unread, view Unread, mark read so it leaves, mark unread so it returns, open externally, and verify status persists.

### Tests and Implementation for User Story 3

- [ ] T047 [P] [US3] Write failing API/repository tests for unread default, explicit read initial state, user-scoped read transitions, unread active-only scope, revision/version increments, and link opening causing no mutation in `tests/integration/read-later.test.ts`
- [ ] T048 [P] [US3] Write failing component tests for read/unread controls, optimistic rollback, unread empty state, and accessible status announcements in `tests/component/read-later.test.tsx`
- [ ] T049 [US3] Implement read-state updates through optimistic version checks and expose them through `PATCH /api/bookmarks/{id}` in `src/server/services/bookmarks.ts` and `src/server/api/bookmarks.ts`
- [ ] T050 [US3] Build the Unread navigation/view and explicit card/detail read-state actions without attaching mutations to destination links in `src/client/routes/UnreadRoute.tsx` and `src/client/features/bookmarks/ReadStateButton.tsx`
- [ ] T051 [US3] Add the passing save-unread/mark-read/mark-unread/open-without-mutation journey in `tests/e2e/read-later.spec.ts`

**Checkpoint**: The unread queue works as an explicit, predictable workflow independent of ordinary browsing.

---

## Phase 6: User Story 4 — Organize and Annotate Bookmarks (Priority: P4)

**Goal**: Create, suggest, assign, rename, and safely remove tags/collections; write formatted personal notes and search their visible text.

**Independent Test**: Assign suggested/new tags and a collection, render/search formatted notes, rename labels globally, and delete labels after an exact impact confirmation without deleting bookmarks.

### Tests for User Story 4

- [ ] T052 [P] [US4] Write failing repository/contract tests for tag and collection CRUD, same-owner associations, affected counts, deletion without bookmark deletion, and names required at 1–50 characters and unique per user after normalization in `tests/integration/labels.test.ts`
- [ ] T053 [P] [US4] Write failing suggestion tests for case-insensitive prefix-before-substring ranking, Unicode normalized matching, deduplication, 20-result limit, and tenant isolation in `tests/unit/tag-suggestions.test.ts`
- [ ] T054 [P] [US4] Write failing Markdown tests allowing paragraphs/headings/lists/links/emphasis while blocking raw HTML, scripts, unsafe schemes, and unsafe link attributes and deriving visible FTS text in `tests/component/notes-markdown.test.tsx` and `tests/unit/notes-search-text.test.ts`

### Implementation for User Story 4

- [ ] T055 [P] [US4] Implement user-scoped tag and bookmark-tag repositories with normalized uniqueness, association ownership checks, ranked suggestions, usage counts, rename propagation, and confirmed detach-only deletion in `src/server/db/repositories/tags.ts`
- [ ] T056 [P] [US4] Implement user-scoped collection repository with normalized uniqueness, usage counts, rename propagation, and confirmed delete-to-null behavior in `src/server/db/repositories/collections.ts`
- [ ] T057 [US4] Implement tag and collection CRUD/suggestion endpoints, expected-count conflict handling, and bookmark assignment validation in `src/server/api/tags.ts`, `src/server/api/collections.ts`, and `src/server/services/labels.ts`
- [ ] T058 [P] [US4] Implement Markdown-to-visible-text derivation and sanitized React rendering with raw HTML disabled, safe schemes, and `noopener noreferrer` in `src/shared/notes.ts` and `src/client/components/SafeMarkdown.tsx`
- [ ] T059 [US4] Build accessible tag autocomplete with existing-tag selection/new-tag creation, collection selector, and personal-notes editor/preview in `src/client/features/tags/TagInput.tsx`, `src/client/features/collections/CollectionSelect.tsx`, and `src/client/features/bookmarks/NotesEditor.tsx`
- [ ] T060 [US4] Build tag/collection management with exact affected counts and non-destructive confirmation copy in `src/client/routes/OrganizationRoute.tsx` and `src/client/features/tags/DeleteLabelDialog.tsx`
- [ ] T061 [US4] Add passing browser coverage for suggestions, new labels, assignments, formatted/safe searchable notes, rename propagation, and non-destructive label deletion in `tests/e2e/organize-and-notes.spec.ts`

**Checkpoint**: The library supports safe personal context and reusable organization without label operations risking bookmarks.

---

## Phase 7: User Story 5 — Set Bookmarks Aside Without Deleting (Priority: P5)

**Goal**: Archive active bookmarks out of normal/unread results, browse a separate archive, and restore all details unchanged.

**Independent Test**: Archive, confirm absence from active/unread/search, search within Archive, restore, and compare every preserved field.

### Tests and Implementation for User Story 5

- [ ] T062 [P] [US5] Write failing repository/API tests for archive/restore transitions, structural active/unread exclusion, archive-only search/filter/sort, optimistic conflicts, and preservation of metadata/notes/tags/collection/read state in `tests/integration/archive.test.ts`
- [ ] T063 [P] [US5] Write failing component tests that distinguish Archive/Restore from permanent Delete and announce location changes in `tests/component/archive-controls.test.tsx`
- [ ] T064 [US5] Implement archive/restore transition validation and revision/version updates in `src/server/services/bookmarks.ts` and `src/server/db/repositories/bookmarks.ts`
- [ ] T065 [US5] Build archive actions, separate Archive route, restore controls, archive-specific empty state, and route-aware search in `src/client/features/bookmarks/ArchiveButton.tsx` and `src/client/routes/ArchiveRoute.tsx`
- [ ] T066 [US5] Add passing browser coverage proving archive is reversible, excluded elsewhere, searchable separately, and field-preserving in `tests/e2e/archive.spec.ts`

**Checkpoint**: “Set aside” is a safe reversible action clearly distinct from permanent deletion.

---

## Phase 8: User Story 6 — Update Many Bookmarks at Once (Priority: P6)

**Goal**: Select visible items or every matching result and safely apply tags, read state, archive, restore, or permanent deletion with exact, stable impact counts.

**Independent Test**: Across a multi-page result set, preview and execute every bulk action, force a stale revision, and verify exact success/failure reporting and zero unconfirmed changes.

### Tests for User Story 6

- [ ] T067 [P] [US6] Write failing bulk repository tests for explicit/all-matching scopes, tenant ownership, shared search compilation, `BEGIN IMMEDIATE`, temporary target materialization, criteria hash/revision/count validation, stale rejection with zero changes, and partial applicability reporting in `tests/integration/bulk-actions.test.ts`
- [ ] T068 [P] [US6] Write failing contract/component tests for matched/applicable/rejected counts, exact permanent-delete wording, archive/delete distinction, query-change selection clearing, and result announcements in `tests/contract/bulk-actions.test.ts` and `tests/component/bulk-actions.test.tsx`

### Implementation for User Story 6

- [ ] T069 [US6] Implement canonical selection serialization, SHA-256 criteria hashing, exact preview counts, per-user revision verification, transactional ID materialization, action applicability, atomic revision updates, and item-level outcomes in `src/server/db/repositories/bulk-actions.ts` and `src/server/services/bulk-actions.ts`
- [ ] T070 [US6] Implement `POST /api/bulk-actions/preview` and `/execute` for add/remove tags, read/unread, archive/restore, and confirmed permanent delete in `src/server/api/bulk-actions.ts`
- [ ] T071 [P] [US6] Build individual/page/all-matches selection state that records canonical criteria, distinguishes visible versus complete scope, and clears when criteria change in `src/client/features/bulk-actions/useSelection.ts`
- [ ] T072 [US6] Build the bulk action bar, tag/read/archive/restore actions, exact-impact preview dialog, destructive confirmation, stale-refresh flow, and item-level outcome report in `src/client/features/bulk-actions/BulkActionBar.tsx`, `BulkConfirmDialog.tsx`, and `BulkResultDialog.tsx`
- [ ] T073 [US6] Integrate bulk selection and post-action query refresh across active, unread, and archive result lists in `src/client/features/search/SearchResults.tsx`
- [ ] T074 [US6] Add passing multi-page browser coverage for every action, stale scope, partial result reporting, exact counts, and archive/delete distinction in `tests/e2e/bulk-actions.spec.ts`

**Checkpoint**: Large matching sets can be changed efficiently without the confirmed scope drifting invisibly.

---

## Phase 9: User Story 7 — Reuse a Frequent Search as a Named View (Priority: P7)

**Goal**: Save, reopen, rename, replace, and delete named live criteria while preserving stable tag references and surfacing deleted references.

**Independent Test**: Save combined criteria, add a new matching bookmark, reopen to see it, rename/delete a referenced tag, and verify stable behavior/warnings without bookmark changes.

### Tests and Implementation for User Story 7

- [ ] T075 [P] [US7] Write failing repository/API tests for names required at 1–50 characters and unique after normalization, raw query ≤1,000 characters, versioned canonical AST, structured filters/location/sort, live evaluation, conflict replace/cancel, stable renamed tag IDs, deleted-reference warnings, and tenant isolation in `tests/integration/saved-views.test.ts`
- [ ] T076 [P] [US7] Write failing component tests for save, conflict choice, open, rename, delete, current-data refresh, and unavailable-criterion warning in `tests/component/saved-views.test.tsx`
- [ ] T077 [US7] Implement saved-view repository serialization, parser-version validation, stable label resolution, conflict replacement, unresolved-reference detection, and revision updates in `src/server/db/repositories/saved-views.ts` and `src/server/services/saved-views.ts`
- [ ] T078 [US7] Implement list/create/update/delete saved-view endpoints and canonical criteria responses in `src/server/api/saved-views.ts`
- [ ] T079 [US7] Build save-current-view, saved-view navigation, rename/replace/delete dialogs, live criteria application, and unavailable-reference warnings in `src/client/features/saved-views/` and `src/client/routes/SavedViewRoute.tsx`
- [ ] T080 [US7] Add passing browser coverage for live results, name conflict choices, rename/delete, stable tag rename, and deleted-tag warnings in `tests/e2e/saved-views.spec.ts`

**Checkpoint**: Frequent searches become reusable live views rather than frozen bookmark copies.

---

## Phase 10: User Story 8 — Maintain Individual Bookmarks (Priority: P8)

**Goal**: Edit every user-managed field and permanently delete an individual active or archived bookmark only after clear confirmation.

**Independent Test**: Edit URL/title/description/notes/tags/collection/read state, reload to verify persistence, cancel deletion, then confirm deletion and verify removal from all locations/searches.

### Tests and Implementation for User Story 8

- [ ] T081 [P] [US8] Write failing repository/API tests for editing all fields, URL duplicate revalidation, same-owner label validation, FTS refresh, version conflicts, exact persistence, and permanent cascading removal from FTS/tag associations in `tests/integration/bookmark-maintenance.test.ts`
- [ ] T082 [P] [US8] Write failing component tests for preserved edit input on validation/failure, archive-versus-delete language, bookmark identity and exact impact in confirmation, cancellation, and failed-delete messaging in `tests/component/bookmark-maintenance.test.tsx`
- [ ] T083 [US8] Complete optimistic bookmark update and expected-version permanent-delete service/API behavior for active and archived records in `src/server/services/bookmarks.ts`, `src/server/db/repositories/bookmarks.ts`, and `src/server/api/bookmarks.ts`
- [ ] T084 [US8] Build edit and permanent-delete dialogs with all editable fields, documented limits, preserved corrections, explicit bookmark identity, and failure feedback in `src/client/features/bookmarks/EditBookmarkDialog.tsx` and `DeleteBookmarkDialog.tsx`
- [ ] T085 [US8] Add passing browser coverage for edit/reload, duplicate edit rejection, cancel delete, confirmed active/archive delete, and absence from all searches in `tests/e2e/bookmark-maintenance.spec.ts`

**Checkpoint**: Individual records remain accurate, and irreversible removal is deliberate and clearly separated from archive.

---

## Phase 11: Polish & Cross-Cutting Validation

**Purpose**: Verify the integrated product against measurable outcomes and prepare the review runtime.

- [ ] T086 [P] Add property/fuzz tests for search punctuation/operator injection and URL/IP encodings, plus tenant-isolation regression coverage for every endpoint in `tests/security/search-fuzz.test.ts`, `tests/security/url-safety-fuzz.test.ts`, and `tests/security/tenant-matrix.test.ts`
- [ ] T087 [P] Add media-cache size/expiry eviction, orphan cleanup, cache-path containment, and safe neutral fallback tests and implementation in `src/server/metadata/media-cache.ts` and `tests/integration/media-cache.test.ts`
- [ ] T088 [P] Add metadata outcome/duration/redirect/byte metrics, bulk audit summaries, and privacy-preserving structured logs without full destination query strings in `src/server/observability.ts` and `tests/unit/observability.test.ts`
- [ ] T089 Generate 10,000-bookmark and 500-bookmark fixtures, record search/view p95 and locate/open task timing, inspect query plans, and tune only measured indexes/queries in `scripts/seed-performance.ts`, `tests/performance/library-performance.test.ts`, and `specs/001-bookmark-manager/performance-results.md`
- [ ] T090 [P] Audit keyboard navigation, focus restoration, screen-reader announcements, contrast, responsive layouts, reduced motion, and mobile bulk dialogs across routes in `tests/e2e/accessibility-and-responsive.spec.ts`
- [ ] T091 Run and fix the complete lint, typecheck, unit, contract, integration, component, and Playwright suites through the scripts defined in `package.json`
- [ ] T092 Execute every scenario in `specs/001-bookmark-manager/quickstart.md`, record actual results and any unavailable external validation in `specs/001-bookmark-manager/validation-results.md`
- [ ] T093 [P] Document setup, configured review credentials, production secret/account differences, backup expectations, metadata egress policy, and the explicit exclusion of full-page snapshots in `README.md`
- [ ] T094 Build the production bundle, verify `npm start` binds `0.0.0.0:4000`, verify the readiness marker and health/session behavior, and write the final runtime descriptor to `.harness/app.json`

---

## Dependencies & Execution Order

### Phase dependencies

- Setup (Phase 1) starts immediately.
- Foundational (Phase 2) depends on Setup and blocks every user story.
- US1–US8 depend on Foundational. The recommended delivery order follows priority because later UI journeys reuse the bookmark shell, query compiler, and controls introduced earlier.
- Polish (Phase 11) depends on every story selected for the release.

### User-story dependencies

- **US1**: Starts after Foundation; establishes bookmark capture and the initial library.
- **US2**: Starts after Foundation and may use seeded bookmarks; integrates with US1 cards/list when both are complete.
- **US3**: Starts after Foundation; uses the shared bookmark patch contract and query location.
- **US4**: Starts after Foundation; its note search integration is validated with US2 when available.
- **US5**: Starts after Foundation; archive search reuses the US2 compiler when integrated.
- **US6**: Depends on the shared query compiler from US2 and action services from US3–US5 for the complete approved action set.
- **US7**: Depends on the versioned search AST from US2 and label identity from US4.
- **US8**: Uses bookmark persistence from US1 and label/note controls from US4; it can be backend-tested independently with fixtures.

### Within each story

1. Write the listed tests and confirm they fail for the intended missing behavior.
2. Implement repositories and pure services before routes.
3. Implement routes/contracts before the client flow.
4. Run focused unit/integration/component tests before the story browser journey.
5. Stop at the checkpoint and demonstrate the independent test before moving to the next priority.

## Parallel Opportunities

- Setup tasks T003–T008 can proceed in parallel after T002.
- Foundation schema/contracts/normalization/error/UI/test-helper tasks can proceed in parallel where marked, then converge in the server and app shell.
- Within US1, URL normalization, guarded fetching, parsing, media handling, and contract tests occupy different files.
- Within US2, parser, compiler tests, repository tests, and UI toolbar can proceed once their direct prerequisites exist.
- Each later story separates test, server, and component work with `[P]` markers where file ownership does not overlap.
- US3, US4, and US5 may be developed in parallel after Foundation if integration is deferred; US6/US7 then consume their stable contracts.

## Parallel Execution Examples

### User Story 1

```text
T023 URL normalization tests
T024 guarded metadata-fetch tests
T025 metadata parser tests
T026 capture contract/integration tests
```

After those fail as expected:

```text
T027 URL normalizer
T028 guarded metadata client
T029 metadata extractor
T031 owned media proxy/cache
```

### User Story 2

```text
T037 parser tests
T038 compiler tests
T039 search repository/performance tests
```

### User Stories 3–5 after Foundation

```text
US3 read-later tests and controls
US4 organization/notes tests and repositories
US5 archive tests and controls
```

## Implementation Strategy

### MVP first

1. Complete Setup and Foundation.
2. Complete US1 from failing focused tests through its browser journey.
3. Stop and validate safe automatic details, manual fallback, duplicates, persistence, and tenant isolation.
4. This is the smallest demonstrable capture product, not the full approved release.

### Incremental delivery

1. US1: rich capture and basic library.
2. US2: precise retrieval.
3. US3: read-later workflow.
4. US4: organization and notes.
5. US5: reversible archive.
6. US6: safe bulk management.
7. US7: live saved views.
8. US8: individual maintenance.
9. Cross-cutting validation and runtime handoff.

Each checkpoint must keep all earlier story tests passing. No later story may weaken tenant scoping, metadata network controls, explicit read behavior, archive/delete separation, or confirmation-count guarantees.

## Notes

- `[P]` means parallelizable only after stated prerequisites; it is not permission to ignore dependencies.
- Exact field limits and state values are copied from `data-model.md` into the tasks that enforce them.
- Tests precede the implementation they specify and must fail for the intended reason before code is added.
- Full-page snapshots, recurring metadata refresh, browser extensions, import/export, sharing, and collaborative annotations remain outside this task list.

