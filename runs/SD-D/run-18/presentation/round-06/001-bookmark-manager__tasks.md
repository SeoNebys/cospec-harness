# Tasks: Bookmark Manager

**Input**: Approved design documents from `specs/001-bookmark-manager/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`

**Tests**: Included because the approved specification defines acceptance scenarios and measurable outcomes, and the approved plan requires unit, contract, integration, security, performance, and end-to-end verification. Within each user story, write the listed tests first and confirm they fail before implementing that story.

**Organization**: Tasks are grouped by user story so each story can be implemented and verified as an independently useful increment.

**Completion note**: The release implementation consolidated several planned path-level modules into the shared repository, Fastify app factory, capture service, and React application shell. Checked tasks indicate that the required behavior and verification outcome is complete; equivalent implementation substitutions are recorded in `plan.md` and `docs/validation-report.md`.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel with adjacent tasks because it targets different files and does not depend on unfinished work.
- **[Story]**: Maps the task to the numbered user story in `spec.md`.
- Every task names the concrete file or directory it changes.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish the workspace, pinned toolchain, and empty runnable entry points without implementing product behavior.

- [X] T001 Create npm workspace manifests for `apps/server`, `apps/web`, `apps/worker`, and every planned `packages/*` module in `package.json` and the workspace package manifests
- [X] T002 Pin Node 24, TypeScript 5.9, React 19.3, Vite 8.3, Fastify 5.12, better-sqlite3 13, Vitest 5, and both Playwright packages at 1.61.0 in `package.json` and `package-lock.json`
- [X] T003 [P] Configure shared strict TypeScript builds and project references in `tsconfig.base.json`, `apps/*/tsconfig.json`, and `packages/*/tsconfig.json`
- [X] T004 [P] Configure linting, formatting, and repository-wide typecheck scripts in `eslint.config.js`, `.prettierrc.json`, and `package.json`
- [X] T005 [P] Scaffold the React/Vite entry point and test environment in `apps/web/index.html`, `apps/web/src/main.tsx`, `apps/web/vite.config.ts`, and `apps/web/src/test/setup.ts`
- [X] T006 [P] Scaffold Fastify and worker entry points in `apps/server/src/main.ts`, `apps/worker/src/main.ts`, and their package manifests
- [X] T007 [P] Configure Vitest projects and Playwright 1.61.0 browser tests in `vitest.workspace.ts`, `playwright.config.ts`, and `tests/e2e/fixtures.ts`
- [X] T008 [P] Document runtime variables and exclude persistent/runtime artifacts in `.env.example`, `.gitignore`, and `data/README.md`
- [X] T009 Add pinned Monolith acquisition with release checksum verification and license notice in `scripts/install-monolith.mjs`, `third_party/monolith/NOTICE`, and root build scripts

**Checkpoint**: The workspace installs, typechecks, and builds empty server, web, and worker entry points with the pinned toolchain.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Implement shared contracts, persistence, storage, runtime shells, and deterministic test infrastructure required by every user story.

**⚠️ CRITICAL**: No user-story implementation begins until this phase passes.

- [X] T010 Implement validated environment configuration for `HOST=0.0.0.0`, `PORT=4000`, data paths, capture concurrency, quotas, and capture limits in `packages/domain/src/config.ts` and `apps/server/src/bootstrap/config.ts`
- [X] T011 [P] Define shared problem-detail, pagination, identifier, timestamp, and API envelope schemas in `packages/contracts/src/common.ts` and export them from `packages/contracts/src/index.ts`
- [X] T012 Implement SQLite connection policy, WAL/foreign-key/busy-timeout setup, and versioned migration runner in `packages/persistence/src/database.ts` and `packages/persistence/src/migrate.ts`
- [X] T013 Create core bookmark/tag/media schema in `migrations/0001_bookmarks.sql`, enforcing verbatim model constraints: title `1–500` Unicode characters after trimming, description up to `4,000`, note Markdown up to `100,000` with raw HTML disabled, read status `unread|read`, copy status `pending|available|failed`, normalized URL unique across active and archived rows, tag display name `1–100`, and immutable created timestamps
- [X] T014 Create blob, capture-attempt, saved-copy, saved-copy-asset, and durable-job schema in `migrations/0002_capture.sql`, enforcing `html|pdf` kinds; `queued|running|available|failed|cancelled` attempt states; `staged|published|delete_pending` blob states; non-negative byte/warning counts; immutable source URL, URL revision, hashes, and capture timestamps
- [X] T015 Create saved-view, preference, import-run, and import-issue schema in `migrations/0003_organization.sql`, enforcing saved-view name `1–100` and unique case-insensitively, query text up to `2 KiB`, preference enums `title|created_at|updated_at`, `asc|desc`, `small|medium|large`, and import status `parsing|committed|failed`
- [X] T016 Create regular FTS5 bookmark/tag indexes plus required partial sort and tag-reverse indexes in `migrations/0004_search.sql`, using `unicode61` with diacritic folding and deterministic bookmark-ID tie breakers
- [X] T017 Implement transaction helpers, UUID/time adapters, typed row mapping, and optimistic-version primitives in `packages/persistence/src/transactions.ts`, `packages/persistence/src/types.ts`, and `packages/domain/src/identity.ts`
- [X] T018 Implement content-addressed SHA-256 staging, fsync, atomic publication, manifest-authorized lookup, reference counting, and idempotent orphan cleanup in `packages/blob-store/src/blob-store.ts` and `packages/blob-store/src/gc.ts`
- [X] T019 Implement the Fastify app factory with TypeBox validation, multipart limits, problem-detail errors, request logging, static-client mounting, and `/api/health` readiness in `apps/server/src/app.ts`, `apps/server/src/api/errors.ts`, and `apps/server/src/api/health.ts`
- [X] T020 [P] Implement the React application shell, routes, shared API client, loading/error boundaries, navigation, and initial-ready state in `apps/web/src/App.tsx`, `apps/web/src/routes.tsx`, `apps/web/src/lib/api.ts`, and `apps/web/src/components/AppShell.tsx`
- [X] T021 [P] Implement accessible design tokens, responsive layout primitives, form controls, dialogs, notices, and empty-state components in `apps/web/src/styles/tokens.css`, `apps/web/src/styles/global.css`, and `apps/web/src/components/ui/`
- [X] T022 Implement server supervision and graceful shutdown for the capture child process in `apps/server/src/bootstrap/worker-supervisor.ts` and `apps/server/src/main.ts`
- [X] T023 [P] Build isolated temporary SQLite/blob-store test harnesses and migration assertions in `packages/test-fixtures/src/app-harness.ts` and `tests/integration/migrations.test.ts`
- [X] T024 [P] Build a deterministic fixture origin with metadata, redirects, delayed/lazy assets, hostile HTML/CSS/SVG, missing resources, and a known PDF in `packages/test-fixtures/src/capture-origin.ts` and `packages/test-fixtures/fixtures/`
- [X] T025 Add foundational contract and startup tests for schemas, problem responses, readiness, worker recovery, and clean shutdown in `tests/contract/common.contract.test.ts` and `tests/integration/bootstrap.test.ts`

**Checkpoint**: Migrations are repeatable, shared schemas validate, blobs publish atomically, the empty app starts on port 4000, and deterministic tests require no public internet.

---

## Phase 3: User Story 1 — Save a Bookmark with Automatic Details (Priority: P1) 🎯 MVP

**Goal**: Paste a URL, automatically propose page details, let the user correct them, and save/edit a durable bookmark without silent duplicates.

**Independent Test**: Paste the metadata fixture URL, receive title/description/icon/preview, override proposed values, save an unread bookmark with tags, restart, edit it, and verify a duplicate URL points to the existing item; repeat with partial/failed metadata and save manually.

### Tests for User Story 1

- [X] T026 [P] [US1] Write failing URL normalization, validation, duplicate, Unicode, length, and tag-canonicalization tests in `packages/domain/src/bookmarks/url.test.ts` and `packages/domain/src/tags/tag.test.ts`
- [X] T027 [P] [US1] Write failing fetch-policy tests for HTTP/HTTPS-only URLs, allowed ports, redirect bounds, public-address checks, and blocked loopback/private/link-local/reserved IPv4/IPv6 in `tests/security/fetch-policy.test.ts`
- [X] T028 [P] [US1] Write failing metadata extraction tests for full, partial, missing, malformed, slow, redirected, and PDF resources in `tests/integration/metadata-preview.test.ts`
- [X] T029 [P] [US1] Write failing API contract tests for `/metadata-preview`, `/media`, `/bookmarks`, and `/bookmarks/{bookmarkId}` including 409 duplicate and 422 field errors in `tests/contract/bookmarks.contract.test.ts`
- [X] T030 [P] [US1] Write the failing automatic-details/save/edit/restart browser journey in `tests/e2e/bookmark-save.spec.ts`

### Implementation for User Story 1

- [X] T031 [P] [US1] Implement WHATWG-based HTTP/HTTPS validation and normalization—lowercase/canonical host, remove default port and fragment, normalize empty path to `/`, preserve path/query semantics—in `packages/domain/src/bookmarks/url.ts`
- [X] T032 [P] [US1] Implement Unicode-normalized case-insensitive tags with one consistent display spelling and `1–100` character validation in `packages/domain/src/tags/tag.ts`
- [X] T033 [US1] Implement the policy-enforcing bounded fetch broker with manual redirect validation and pinned public connection addresses in `apps/worker/src/fetch-policy/safe-fetch.ts` and `apps/worker/src/fetch-policy/network-policy.ts`
- [X] T034 [US1] Implement safe title, description, icon, preview-image, final-URL, and warning extraction in `apps/worker/src/capture/metadata.ts` and `packages/domain/src/bookmarks/metadata.ts`
- [X] T035 [P] [US1] Implement allowlisted image validation/re-encoding and temporary media references for `site_icon|preview_image` in `packages/blob-store/src/media.ts` and `apps/server/src/api/media.ts`
- [X] T036 [US1] Implement tag repository create/resolve/list behavior and active/archive counts in `packages/persistence/src/tags-repository.ts`
- [X] T037 [US1] Implement bookmark create/get/update transactions, `1–500` title, `4,000` description, `100,000` note limit, duplicate normalization, immutable saved date, updated date, URL revision, metadata blob references, default unread state, and initial pending capture/job insertion in `packages/persistence/src/bookmarks-repository.ts`
- [X] T038 [US1] Implement metadata-preview and tag routes from the API contract in `apps/server/src/api/metadata-preview.ts` and `apps/server/src/api/tags.ts`
- [X] T039 [US1] Implement bookmark create/detail/update routes with field-specific errors, preserved valid input, optimistic conflict handling, and existing-bookmark links in `apps/server/src/api/bookmarks.ts`
- [X] T040 [P] [US1] Implement typed bookmark/metadata/tag/media client calls and query invalidation in `apps/web/src/features/bookmarks/api.ts`
- [X] T041 [US1] Implement the add-bookmark flow with debounced retrieval status, editable proposed metadata, image replace/remove, manual fallback, tags, read-status choice, and validation in `apps/web/src/features/bookmarks/BookmarkEditor.tsx`
- [X] T042 [US1] Implement bookmark cards and detail/edit experience showing title, description, address, tags, dates, images, live-link action, and persisted user overrides in `apps/web/src/features/bookmarks/BookmarkCard.tsx` and `apps/web/src/features/bookmarks/BookmarkDetail.tsx`
- [X] T043 [US1] Implement the main-library route and first-bookmark/error/duplicate empty states with `data-harness-ready="true"` only after initial data resolves in `apps/web/src/routes/LibraryRoute.tsx`

**Checkpoint**: User Story 1 passes independently; a useful metadata-assisted bookmark library exists even if capture jobs remain pending until US4.

---

## Phase 4: User Story 2 — Find Bookmarks with Smart Search (Priority: P1)

**Goal**: Browse, search, filter, and sort a large active collection with the approved query language and actionable syntax errors.

**Independent Test**: Seed known records and verify plain terms, `#tag`, quoted phrases, implicit/explicit AND, OR, NOT/minus, nested groups, match-all tag chips, all six sort directions, pagination, and invalid-query hints against expected result sets.

### Tests for User Story 2

- [X] T044 [P] [US2] Write failing lexer/parser golden, malformed-input, Unicode, punctuation, lowercase-operator, 2 KiB, 64-atom, and depth-16 tests in `packages/search/src/parser.test.ts`
- [X] T045 [P] [US2] Write failing AST-to-parameterized-set-query truth-table and injection/fuzz tests across text and tag fields in `packages/search/src/compiler.test.ts` and `tests/security/search-injection.test.ts`
- [X] T046 [P] [US2] Write failing FTS synchronization, tag matching, scope, filter, sort, and stable-pagination integration tests in `tests/integration/search-repository.test.ts`
- [X] T047 [P] [US2] Write failing `/bookmarks` search contract tests including error offset/length/hint preservation in `tests/contract/search.contract.test.ts`
- [X] T048 [P] [US2] Write failing 10,000-record search/sort performance and known-item browser acceptance tests in `tests/performance/search.perf.test.ts` and `tests/e2e/search.spec.ts`

### Implementation for User Story 2

- [X] T049 [US2] Implement the bounded lexer and recursive-descent AST parser with precedence parentheses > unary NOT/minus > AND/adjacency > OR in `packages/search/src/lexer.ts`, `packages/search/src/parser.ts`, and `packages/search/src/errors.ts`
- [X] T050 [US2] Implement parameterized FTS/tag atom resolution and `UNION|INTERSECT|EXCEPT` AST compilation without exposing raw FTS syntax in `packages/search/src/compiler.ts`
- [X] T051 [US2] Implement same-transaction bookmark/tag FTS synchronization, rebuild/integrity checks, scoped universes, match-all filter chips, six sorts, and keyset pagination in `packages/persistence/src/search-repository.ts`
- [X] T052 [US2] Extend `GET /api/bookmarks` with query, active scope, repeated tag IDs, sort/direction, cursor, totals, and invalid-search problem responses in `apps/server/src/api/bookmarks.ts`
- [X] T053 [P] [US2] Implement debounced search, URL-synchronized query state, cancellable requests, and preserved invalid input in `apps/web/src/features/search/useBookmarkSearch.ts`
- [X] T054 [US2] Implement search box, syntax help, tag chips, sort controls, active-criteria summary, and clear actions in `apps/web/src/features/search/SearchToolbar.tsx` and `apps/web/src/features/search/SearchHelp.tsx`
- [X] T055 [US2] Integrate searched/paginated results and no-match recovery into `apps/web/src/routes/LibraryRoute.tsx` and `apps/web/src/features/bookmarks/BookmarkGrid.tsx`

**Checkpoint**: User Story 2 passes independently against seeded data and meets the 10,000-item visible-response and known-item outcomes.

---

## Phase 5: User Story 3 — Manage a Read-Later Queue (Priority: P1)

**Goal**: Treat bookmarks as unread by default, expose a dedicated active-unread view, and change status only through explicit user action.

**Independent Test**: Save unread/read items, open live links without changing status, switch individual items both directions, and verify only active unread items appear and update immediately in the unread view.

### Tests for User Story 3

- [X] T056 [P] [US3] Write failing repository/API tests for default unread, explicit save status, read/unread transitions, archived exclusion, and unchanged status on open in `tests/integration/reading-status.test.ts` and `tests/contract/reading-status.contract.test.ts`
- [X] T057 [P] [US3] Write the failing unread-view and explicit-toggle browser journey in `tests/e2e/read-later.spec.ts`

### Implementation for User Story 3

- [X] T058 [US3] Implement transactional read-status changes and active-unread scoped listing without modifying saved-copy/archive state in `packages/persistence/src/reading-repository.ts`
- [X] T059 [US3] Implement `PUT /api/bookmarks/{bookmarkId}/reading-status` and unread-scope responses in `apps/server/src/api/reading-status.ts` and `apps/server/src/api/bookmarks.ts`
- [X] T060 [P] [US3] Implement optimistic read/unread mutations with rollback/error notices in `apps/web/src/features/reading/api.ts`
- [X] T061 [US3] Implement the dedicated unread route, count, empty state, and normal search/filter/sort controls in `apps/web/src/routes/UnreadRoute.tsx`
- [X] T062 [US3] Add explicit accessible read/unread controls to cards and details without coupling them to live-link navigation in `apps/web/src/features/reading/ReadingStatusButton.tsx`
- [X] T063 [US3] Verify the live-link action opens in the browsing context with safe external-link attributes and no status mutation in `apps/web/src/features/bookmarks/OpenOriginalLink.tsx`

**Checkpoint**: User Story 3 passes independently; saving, finding, opening, and explicitly completing an unread item is usable end to end.

---

## Phase 6: User Story 4 — Keep a Readable Offline Copy (Priority: P1)

**Goal**: Preserve an immutable safe offline page or byte-identical PDF, expose progress/failures/retry, and never silently replace or delete it.

**Independent Test**: Capture the representative HTML and PDF fixtures, disable their origin, read both copies, verify the PDF digest, prove hostile content cannot act or network, exercise failure/retry, recapture confirmation, restart recovery, archive preservation, and deletion warning.

### Tests for User Story 4

- [X] T064 [P] [US4] Write failing job lease, heartbeat, expiry recovery, idempotency, cancellation, backoff, and late-publication tests in `tests/integration/capture-jobs.test.ts`
- [X] T065 [P] [US4] Expand failing SSRF tests across redirects/subresources, DNS rebinding doubles, all blocked IPv4/IPv6 categories, ports, WebSocket/service-worker attempts, and resource limits in `tests/security/capture-network.test.ts`
- [X] T066 [P] [US4] Write failing HTML capture/sanitization tests for scripts, events, forms, frames, SVG, CSS imports/URLs, refresh, popups, downloads, lazy assets, Unicode, missing assets, and zero offline requests in `tests/security/html-capture.test.ts`
- [X] T067 [P] [US4] Write failing PDF tests for exact bytes/hash, content-length mismatch, invalid/password-protected/oversized files, first-page rendering, disabled actions, and explicit download in `tests/integration/pdf-capture.test.ts`
- [X] T068 [P] [US4] Write failing capture lifecycle/API contract tests for pending/available/failed, stable error codes, retry, recapture candidate, confirmation, URL revision mismatch, and summary counts in `tests/contract/capture.contract.test.ts`
- [X] T069 [P] [US4] Write failing browser acceptance for offline HTML/PDF reading, archive preservation, restart recovery, recapture, and saved-copy deletion disclosure in `tests/e2e/saved-copy.spec.ts`

### Implementation for User Story 4

- [X] T070 [US4] Implement atomic job enqueue/claim/heartbeat/retry/dead/cancel/recovery operations with `BEGIN IMMEDIATE` leases in `packages/persistence/src/jobs-repository.ts`
- [X] T071 [US4] Implement context-wide Playwright request mediation through the safe-fetch policy, blocking direct network, service workers, WebSockets, downloads, popups, permissions, credentials, and excess resources in `apps/worker/src/capture/browser-context.ts`
- [X] T072 [US4] Implement bounded worker polling, concurrency, progress phases, heartbeat, retry classification, idempotent completion, and graceful cancellation in `apps/worker/src/jobs/capture-runner.ts`
- [X] T073 [US4] Implement deterministic HTML rendering with fixed viewport/locale/theme, DOM readiness, bounded quiet wait/scroll, and no clicks/submissions in `apps/worker/src/capture/render-html.ts`
- [X] T074 [US4] Integrate the pinned Monolith bundler and content-addressed local resource rewriting in `apps/worker/src/capture/package-html.ts`
- [X] T075 [US4] Implement parsed HTML/CSS sanitization and publication validation—no scripts, events, forms, frames, embeds, active SVG, refresh, remote URLs, imports, or unresolved assets—in `apps/worker/src/capture/sanitize-html.ts` and `apps/worker/src/capture/validate-html.ts`
- [X] T076 [P] [US4] Implement streamed PDF classification, SHA-256/length checks, structural parsing, first-page render validation, and unchanged-byte staging in `apps/worker/src/capture/capture-pdf.ts`
- [X] T077 [US4] Implement canonical capture manifests, asset relations, hash/size verification, warning thresholds, atomic blob publication, and partial-artifact rejection in `apps/worker/src/capture/publish-copy.ts`
- [X] T078 [US4] Implement initial/retry capture orchestration and stable actionable failure mapping in `apps/worker/src/capture/capture-service.ts` and `packages/domain/src/capture/errors.ts`
- [X] T079 [US4] Implement immutable saved-copy publication, candidate recapture, explicit swap confirmation, URL-revision checks, old-copy retention on failure, and deferred orphan GC in `packages/persistence/src/capture-repository.ts`
- [X] T080 [US4] Implement retry, recapture, confirm-replacement, saved-copy launch, and capture-summary API endpoints in `apps/server/src/api/captures.ts`
- [X] T081 [US4] Implement manifest-authorized snapshot HTML/asset responses with empty iframe sandbox compatibility, strict CSP, `nosniff`, no-referrer, private immutable caching, and path-traversal rejection in `apps/server/src/api/snapshots.ts`
- [X] T082 [P] [US4] Integrate a pinned network-disabled PDF.js viewer with actions, attachments, forms, and external navigation disabled plus explicit original download in `apps/web/src/features/saved-copy/PdfViewer.tsx` and `apps/server/src/api/pdf-viewer.ts`
- [X] T083 [P] [US4] Implement capture status polling, aggregate import/capture progress, retry eligibility, safe error details, and replacement state client hooks in `apps/web/src/features/saved-copy/api.ts`
- [X] T084 [US4] Implement pending/available/failed indicators, phase/warning details, retry, source mismatch, and capture date/type UI in `apps/web/src/features/saved-copy/CaptureStatus.tsx`
- [X] T085 [US4] Implement the sandboxed saved-HTML reader and PDF viewer launch experience without injecting snapshot markup into the app DOM in `apps/web/src/features/saved-copy/SavedCopyReader.tsx`
- [X] T086 [US4] Implement recapture initiation, candidate comparison/status, and explicit replacement confirmation while the current copy stays readable in `apps/web/src/features/saved-copy/RecaptureDialog.tsx`
- [X] T087 [US4] Implement startup lease recovery, stale-stage cleanup, cancellation on delete, worker health reporting, and idempotent blob garbage collection scheduling in `apps/worker/src/jobs/recovery.ts` and `apps/server/src/bootstrap/worker-supervisor.ts`

**Checkpoint**: All P1 stories work together, including offline reading after the fixture origin is stopped; this is the first core release matching the client's highest-priority use.

---

## Phase 7: User Story 5 — Archive and Restore Bookmarks (Priority: P2)

**Goal**: Hide bookmarks reversibly from ordinary views while retaining content, tags, read status, and saved copies in a separate searchable archive.

**Independent Test**: Archive an unread bookmark with a copy, verify exclusion from ordinary/unread/tag/search views, search and open it in archive, restore it unchanged, then permanently delete an archived item through confirmation.

### Tests for User Story 5

- [X] T088 [P] [US5] Write failing archive/restore repository and API tests for visibility scopes, unchanged read/tags/copy, and confirmed permanent deletion in `tests/integration/archive.test.ts` and `tests/contract/archive.contract.test.ts`
- [X] T089 [P] [US5] Write the failing searchable-archive/restore/delete browser journey in `tests/e2e/archive.spec.ts`

### Implementation for User Story 5

- [X] T090 [US5] Implement transactional archive/restore and permanent-delete coordination without changing read status, tags, or saved-copy pointers in `packages/persistence/src/archive-repository.ts`
- [X] T091 [US5] Implement archive, restore, and stale-safe permanent-delete routes from the API contract in `apps/server/src/api/archive.ts`
- [X] T092 [P] [US5] Implement optimistic archive/restore client mutations with safe rollback in `apps/web/src/features/archive/api.ts`
- [X] T093 [US5] Implement the archive route with the same search grammar, tag filters, sorts, pagination, empty states, saved-copy access, and restore actions in `apps/web/src/routes/ArchiveRoute.tsx`
- [X] T094 [US5] Add archive/restore actions and archive state to bookmark cards/details without exposing archived items in ordinary routes in `apps/web/src/features/archive/ArchiveButton.tsx`
- [X] T095 [US5] Implement permanent-delete confirmation that shows bookmark and saved-copy impact and preserves everything on cancel in `apps/web/src/features/bookmarks/PermanentDeleteDialog.tsx`

**Checkpoint**: User Story 5 passes independently; archive is clearly reversible and distinct from permanent deletion.

---

## Phase 8: User Story 6 — Maintain Bookmarks Individually or in Bulk (Priority: P2)

**Goal**: Select up to 500 visible bookmarks and tag, mark read/unread, archive/restore, or permanently delete them with accurate partial outcomes.

**Independent Test**: Select a mixed 500-item set, apply every action, verify unrelated tags remain, ineligible/missing items are identified, and cancelling stale-safe deletion leaves all items unchanged.

### Tests for User Story 6

- [X] T096 [P] [US6] Write failing bulk transaction tests for add/remove tags, read/unread, archive/restore, missing/ineligible items, cancellation, saved-copy counts, and per-item partial results in `tests/integration/bulk-actions.test.ts`
- [X] T097 [P] [US6] Write failing `/bookmarks/bulk` contract tests for unique `1–500` IDs, action schemas, stale saved-copy count, and accurate result totals in `tests/contract/bulk-actions.contract.test.ts`
- [X] T098 [P] [US6] Write failing 500-item timing and full selection/action/confirmation browser tests in `tests/performance/bulk.perf.test.ts` and `tests/e2e/bulk-actions.spec.ts`

### Implementation for User Story 6

- [X] T099 [US6] Implement per-item eligible bulk mutations in bounded transactions, preserving unrelated tags and returning requested/succeeded/failed details in `packages/persistence/src/bulk-repository.ts`
- [X] T100 [US6] Implement the bulk API endpoint with `1–500` unique-ID validation, action-specific fields, deletion copy-count conflict, and honest partial results in `apps/server/src/api/bulk-actions.ts`
- [X] T101 [P] [US6] Implement selection state, select-visible, individual toggle, count, and clear behavior in `apps/web/src/features/bulk/useBookmarkSelection.ts`
- [X] T102 [US6] Implement the context-aware bulk action bar for tags, read/unread, archive/restore, and deletion in `apps/web/src/features/bulk/BulkActionBar.tsx`
- [X] T103 [US6] Implement bulk tag add/remove dialog that never replaces unrelated tags in `apps/web/src/features/bulk/BulkTagDialog.tsx`
- [X] T104 [US6] Implement stale-safe bulk permanent-delete confirmation showing affected bookmark and saved-copy counts in `apps/web/src/features/bulk/BulkDeleteDialog.tsx`
- [X] T105 [US6] Implement complete/partial outcome notices with failed-item recovery links and refresh affected views in `apps/web/src/features/bulk/BulkResultNotice.tsx`

**Checkpoint**: User Story 6 passes independently and the 500-item outcome completes within the approved five-second budget.

---

## Phase 9: User Story 7 — Add Rich Notes and Reuse Searches (Priority: P3)

**Goal**: Store safe formatted notes and named reusable combinations of validated search plus match-all tag filters.

**Independent Test**: Save and render headings/lists/emphasis/links without active HTML, find note text through search, then create/open/rename/edit/delete a saved view and prove it re-evaluates current bookmarks without mutating them.

### Tests for User Story 7

- [X] T106 [P] [US7] Write failing Markdown subset, raw-HTML rejection, sanitization, safe-link, plain-text extraction, and FTS update tests in `packages/domain/src/notes/markdown.test.ts` and `tests/security/rich-notes.test.ts`
- [X] T107 [P] [US7] Write failing saved-view model/repository/API tests for unique case-insensitive `1–100` names, query up to `2 KiB`, stable tag IDs, match-all filters, current-data evaluation, and missing-tag empty state in `tests/integration/saved-views.test.ts` and `tests/contract/saved-views.contract.test.ts`
- [X] T108 [P] [US7] Write the failing formatted-note and saved-view lifecycle browser journey in `tests/e2e/notes-saved-views.spec.ts`

### Implementation for User Story 7

- [X] T109 [P] [US7] Implement the approved Markdown subset, sanitized rendering, safe links, and derived plain text with raw HTML disabled in `packages/domain/src/notes/markdown.ts`
- [X] T110 [US7] Integrate Markdown/plain-text persistence and transactional FTS updates into `packages/persistence/src/bookmarks-repository.ts`
- [X] T111 [US7] Implement saved-view create/list/update/delete and current-data resolution by verbatim query plus ordered tag IDs in `packages/persistence/src/saved-views-repository.ts`
- [X] T112 [US7] Implement saved-view API routes and validate query syntax at create/edit time in `apps/server/src/api/saved-views.ts`
- [X] T113 [US7] Implement accessible write/preview rich-note editing and sanitized display in `apps/web/src/features/notes/RichNoteEditor.tsx` and `apps/web/src/features/notes/RichNoteView.tsx`
- [X] T114 [P] [US7] Implement saved-view API hooks and current-query capture in `apps/web/src/features/saved-views/api.ts`
- [X] T115 [US7] Implement save/rename/edit/delete dialogs with unique-name and invalid-query feedback in `apps/web/src/features/saved-views/SavedViewDialog.tsx`
- [X] T116 [US7] Implement saved-view navigation and result route, including an editable empty state for removed tags, in `apps/web/src/routes/SavedViewRoute.tsx` and `apps/web/src/features/saved-views/SavedViewList.tsx`

**Checkpoint**: User Story 7 passes independently; notes are safe/searchable and saved views remain reusable dynamic criteria rather than snapshots.

---

## Phase 10: User Story 8 — Move Data and Set Display Preferences (Priority: P4)

**Goal**: Import common browser bookmark files, export selected scopes with clear loss disclosure, and persist default sort/text-size preferences.

**Independent Test**: Import Chrome/Firefox/Safari-shaped fixtures including duplicates and invalid entries, inspect the summary and background capture progress, export each scope and smoke-import it in browsers, then restart after changing sort and three text sizes.

### Tests for User Story 8

- [X] T117 [P] [US8] Write failing tolerant streaming import tests for nested/repeated/empty folders, entities, charset/BOM, optional/malformed tags, non-Latin text, favicon data, invalid dates, blank titles, unsupported schemes, duplicates, and parser limits in `packages/bookmark-html/src/import.test.ts`
- [X] T118 [P] [US8] Write failing atomic import/repository tests for fatal zero-write, valid partial summary, folder-path tags, duplicate nonmutation, post-commit capture jobs, rollback, 100 MiB/50,000-entry/depth-128 limits, and 10,000-entry retention in `tests/integration/import.test.ts`
- [X] T119 [P] [US8] Write failing export golden/escaping/Unicode/date/scope/10,000-streaming/round-trip tests in `packages/bookmark-html/src/export.test.ts` and `tests/integration/export.test.ts`
- [X] T120 [P] [US8] Write failing import/export API contracts and display-preference persistence/default tests in `tests/contract/portability-preferences.contract.test.ts`
- [X] T121 [P] [US8] Write failing browser import/export/progress/loss-disclosure and restart-preference journeys in `tests/e2e/portability-preferences.spec.ts`

### Implementation for User Story 8

- [X] T122 [P] [US8] Implement inert tolerant streaming Netscape HTML parsing with bounded charset decoding, folder stack, HTML entity decoding, safe field limits, and no rendering/script execution in `packages/bookmark-html/src/import.ts`
- [X] T123 [P] [US8] Implement escaped deterministic UTF-8 flat Netscape HTML streaming with Unix saved dates and one link per bookmark in `packages/bookmark-html/src/export.ts`
- [X] T124 [US8] Implement atomic import staging, URL normalization/deduplication, blank-title URL fallback, enclosing-folder tags, per-entry issues, summary counts, and capture job insertion after successful commit in `packages/persistence/src/import-repository.ts`
- [X] T125 [US8] Implement import upload/status and aggregate follow-on capture progress APIs in `apps/server/src/api/imports.ts`
- [X] T126 [US8] Implement scope-selected streaming export with explicit acknowledged loss of tags, notes, read/archive state, metadata images, saved copies, saved views, and preferences in `apps/server/src/api/exports.ts`
- [X] T127 [US8] Implement the import upload, limit/fatal/partial results, issue list, immediate-bookmark access, and capture-progress experience in `apps/web/src/features/portability/ImportBookmarks.tsx`
- [X] T128 [US8] Implement active/archived/all export selection and required loss-disclosure acknowledgement in `apps/web/src/features/portability/ExportBookmarks.tsx`
- [X] T129 [US8] Implement preference repository defaults and persistence—`created_at desc`, `medium`; allowed sorts `title|created_at|updated_at`, directions `asc|desc`, sizes `small|medium|large`—in `packages/persistence/src/preferences-repository.ts`
- [X] T130 [US8] Implement preferences GET/PATCH routes from the API contract in `apps/server/src/api/preferences.ts`
- [X] T131 [P] [US8] Implement preference API state and pre-render text-size application to avoid layout flash in `apps/web/src/features/preferences/api.ts` and `apps/web/src/features/preferences/applyPreferences.ts`
- [X] T132 [US8] Implement display settings for default sort/direction and three distinguishable text sizes and apply them across collection views in `apps/web/src/features/preferences/DisplayPreferences.tsx` and `apps/web/src/styles/text-size.css`

**Checkpoint**: User Story 8 passes independently; browser data moves safely and declared display choices survive restart.

---

## Phase 11: Polish and Cross-Cutting Verification

**Purpose**: Validate the complete approved scope, harden operational behavior, and prepare the review runtime without adding product features.

- [X] T133 [P] Add keyboard, focus-order, dialog, screen-reader-name, contrast, reduced-motion, and three-text-size accessibility tests across all routes in `tests/e2e/accessibility.spec.ts`
- [X] T134 [P] Add responsive desktop/narrow-screen visual regression coverage for library, editor, unread, archive, reader, saved views, import, and preferences in `tests/e2e/visual.spec.ts`
- [X] T135 Run and tune 10,000-bookmark search/sort, 500-item bulk, 10,000 import/export, capture concurrency, and memory benchmarks without weakening acceptance thresholds in `tests/performance/` and `docs/performance-baseline.md`
- [X] T136 Expand the versioned representative capture corpus and score primary-text/essential-image retention for the 95% outcome in `packages/test-fixtures/capture-corpus/` and `tests/performance/capture-fidelity.test.ts`
- [X] T137 Complete the adversarial capture/import/upload/query corpus, storage quota enforcement, CSP/sandbox header checks, and zero-network saved-copy checks in `tests/security/`
- [X] T138 Implement FTS rebuild/integrity, blob audit/GC, staging cleanup, and consistent SQLite-plus-blob backup/restore commands in `apps/server/src/maintenance/` and `scripts/backup.mjs`
- [X] T139 [P] Add structured operational logs and bounded metrics for requests, jobs, captures, imports, storage, and failures without logging private note/page content in `apps/server/src/bootstrap/observability.ts` and `apps/worker/src/observability.ts`
- [X] T140 Harden process signals, crash recovery, worker restart bounds, temp-directory permissions, non-root execution, read-only app files, and persistent `/data` volume in `Dockerfile` and `apps/server/src/main.ts`
- [X] T141 Create production scripts that migrate, build, and start the prepared foreground server/worker on `0.0.0.0:4000` in `package.json` and `scripts/start.mjs`
- [X] T142 Run every command and acceptance walkthrough in `specs/001-bookmark-manager/quickstart.md`, recording only verified results and unresolved limitations in `docs/validation-report.md`
- [X] T143 Create `/work/.harness/app.json` with `{"kind":"application","port":4000,"path":"/","start_command":["npm","start"],"start_cwd":"/work"}` after successful dependency installation and build
- [X] T144 Start the prepared application through the declared harness command, verify readiness at `http://127.0.0.1:4000/`, and save any requested post-action review screenshots under `prototypes/`
- [X] T145 Run final lint, typecheck, unit, contract, integration, security, performance, and Playwright suites and reconcile every failed approved requirement in `docs/validation-report.md`

**Checkpoint**: The complete approved application is built, verified, and available for client review at `http://maker:4000/`.

---

## Dependencies and Execution Order

### Phase Dependencies

- **Phase 1 — Setup**: No dependencies.
- **Phase 2 — Foundational**: Depends on Phase 1 and blocks all user stories.
- **US1 — Automatic details/save**: Starts after Foundation; supplies normal bookmark creation for later end-to-end flows.
- **US2 — Smart search**: Starts after Foundation using seeded records; integrates with US1 when both are ready.
- **US3 — Read later**: Starts after Foundation using seeded records; integrates with US1 cards/routes.
- **US4 — Offline copies**: Worker/security core can start after Foundation; end-to-end completion depends on US1's atomic bookmark/capture-job creation.
- **US5 — Archive**: Starts after Foundation; searchable archive integration uses US2 query infrastructure.
- **US6 — Bulk maintenance**: Core selection/tag logic starts after Foundation; complete action coverage depends on US3 read status and US5 archive behavior.
- **US7 — Rich notes/saved views**: Markdown starts after Foundation; full saved-view behavior depends on US2 search and US1 editing.
- **US8 — Portability/preferences**: Parser/export/preferences can start after Foundation; complete import capture behavior depends on US1 bookmark creation and US4 jobs.
- **Phase 11 — Polish**: Depends on all user stories intended for the release.

### Recommended Story Completion Order

```text
Setup -> Foundation -> US1
                       ├── US2 ──┬── US5 ──┐
                       ├── US3 ──┤         ├── US6
                       └── US4 ──┘         │
                            │              │
                            ├── US8        │
                 US2 + US1 ─└── US7        │
                                           └── Polish
```

US2, US3, and the worker portion of US4 can progress in parallel after Foundation while US1 integration settles. US7 and US8 are later priorities but can also progress in parallel once their named dependencies exist.

### Within Each User Story

1. Write the story's tests and confirm they fail for the expected missing behavior.
2. Implement domain/model rules before persistence.
3. Implement persistence/services before API routes.
4. Implement typed client access before UI integration.
5. Run the independent story test before entering the next checkpoint.

## Parallel Opportunities

- Setup: T003–T008 target independent configuration/entry files after T001–T002.
- Foundation: T011, T020–T021, and T023–T024 can progress beside the sequential database/runtime core.
- US1: T026–T030 tests can be authored in parallel; T031–T032 and T035 target separate modules.
- US2: T044–T048 tests can be authored in parallel; client state T053 can progress beside server query work once the contract is fixed.
- US3: T056–T057 tests and client API T060 can progress independently.
- US4: T064–T069 tests can be authored in parallel; PDF T076, client API T083, and PDF viewer T082 are separable from HTML packaging.
- US5: T088–T089 tests and client API T092 can progress independently.
- US6: T096–T098 tests and selection state T101 can progress independently.
- US7: T106–T108 tests, Markdown T109, and client API T114 can progress independently.
- US8: T117–T121 tests, import parser T122, export writer T123, and preference client T131 can progress independently.
- Polish: accessibility T133, visual coverage T134, fidelity corpus T136, security T137, and observability T139 target separate areas.

## Parallel Execution Examples

### US1

```text
T026 URL/tag domain tests
T027 fetch-policy security tests
T028 metadata integration tests
T029 API contract tests
T030 browser journey
```

### US2

```text
T044 parser tests
T045 compiler/injection tests
T046 repository integration tests
T047 API contract tests
T048 performance/browser tests
```

### US3

```text
T056 reading repository/API tests
T057 unread browser journey
```

### US4

```text
T064 durable-job tests
T065 SSRF/network security tests
T066 HTML safety/fidelity tests
T067 PDF preservation tests
T068 lifecycle/API tests
T069 offline browser journey
```

### US5

```text
T088 archive repository/API tests
T089 archive browser journey
```

### US6

```text
T096 bulk transaction tests
T097 bulk contract tests
T098 bulk performance/browser tests
```

### US7

```text
T106 rich-note safety/search tests
T107 saved-view repository/API tests
T108 notes/saved-view browser journey
```

### US8

```text
T117 import parser fixtures
T118 atomic import integration
T119 export/round-trip tests
T120 API/preference contracts
T121 browser journey
```

## Implementation Strategy

### Thin MVP

1. Complete Setup and Foundation.
2. Complete US1.
3. Stop and verify the metadata-assisted save/edit/library experience independently.

This is the smallest demonstrable slice, but it is not yet the client's desired core product.

### First Core Release

1. Complete US1 through US4 in priority order, parallelizing US2/US3/US4 where safe.
2. Validate automatic capture, smart retrieval, read-later, and offline HTML/PDF preservation together.
3. Stop for an integrated review before P2 work.

### Full Approved Release

1. Add US5 and US6 for archive and bulk maintenance.
2. Add US7 for rich notes and saved views.
3. Add US8 for import/export and preferences.
4. Complete cross-cutting hardening and the entire quickstart validation.

## Task Counts

| Phase | Tasks |
|---|---:|
| Setup | 9 |
| Foundation | 16 |
| US1 — Automatic details/save | 18 |
| US2 — Smart search | 12 |
| US3 — Read later | 8 |
| US4 — Offline copies | 24 |
| US5 — Archive | 8 |
| US6 — Bulk maintenance | 10 |
| US7 — Rich notes/saved views | 11 |
| US8 — Import/export/preferences | 16 |
| Polish and cross-cutting | 13 |
| **Total** | **145** |

## Notes

- `[P]` means the marked task can run concurrently without editing the same file or depending on unfinished adjacent work.
- Every user-story task carries its `[US#]` label; setup, foundation, and polish tasks intentionally do not.
- Do not mark a task complete until its referenced test or checkpoint passes.
- Capture/network safety tasks are release blockers, not optional polish.
- Preserve user data and unrelated worktree changes throughout implementation.
