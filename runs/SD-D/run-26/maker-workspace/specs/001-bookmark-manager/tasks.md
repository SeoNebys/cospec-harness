---

description: "Dependency-ordered implementation tasks for the Bookmark Manager"
---

# Tasks: Bookmark Manager

**Input**: Approved design documents from `specs/001-bookmark-manager/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`, and `quickstart.md`

**Tests**: Required by the approved plan and measurable success criteria. Within every user-story phase, create the listed tests first and verify that they fail for the missing behavior before implementing that story.

**Organization**: Tasks are grouped by user story so each approved journey remains independently testable and can be demonstrated at its checkpoint.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can proceed in parallel after its phase prerequisites because it uses different files and has no dependency on another incomplete parallel task.
- **[Story]**: Maps the task to the numbered user story in `spec.md`.
- Every task names its target file or directory.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Initialize the approved Node/TypeScript/React project, reproducible dependencies, and verification tooling.

- [X] T001 Create `package.json` and `package-lock.json` with Node 24, TypeScript 7, Express 5, React 19, React Router 8, Vite 8, Zod 4, better-sqlite3 13, Undici, ipaddr.js, Sharp, parse5 SAX, HTML encoding sniffing, react-markdown, rehype-sanitize, Pino, Vitest 5, Testing Library, fast-check, Playwright 1.61.0, and axe dependencies pinned to compatible versions
- [X] T002 [P] Configure strict ESM TypeScript builds and shared path aliases in `tsconfig.json`, `tsconfig.server.json`, and `tsconfig.client.json`
- [X] T003 [P] Configure Vite, Vitest projects, and pinned Chromium execution in `vite.config.ts`, `vitest.config.ts`, and `playwright.config.ts`
- [X] T004 [P] Create the planned source roots and minimal entry modules in `client/index.html`, `client/src/main.tsx`, `server/src/index.ts`, and `shared/src/index.ts`
- [X] T005 [P] Configure linting, formatting, and type-aware npm scripts in `eslint.config.js`, `.prettierrc.json`, and `package.json`
- [X] T006 [P] Define documented non-secret configuration and ignored runtime/build outputs in `.env.example` and `.gitignore`, including `HOST`, `PORT`, `BOOKMARKS_DATA_DIR`, `BOOKMARKS_PASSWORD_HASH`, `COOKIE_SECURE`, `TRUST_PROXY`, and `LOG_LEVEL`

**Checkpoint**: Dependency installation, type checking, unit-test discovery, client build, and server compilation can run from npm scripts.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish persistence, private-owner access, shared contracts, error handling, and the application shell required by every user story.

**Critical**: No user-story implementation begins until this phase passes its tests.

- [X] T007 [P] Encode shared API enums, DTOs, Zod request/response schemas, and stable error codes from `specs/001-bookmark-manager/contracts/openapi.yaml` in `shared/src/contracts.ts` and `shared/src/errors.ts`
- [X] T008 [P] Build reusable temporary-database, fake-clock, authenticated-request, controlled-network, and React rendering helpers in `tests/helpers/database.ts`, `tests/helpers/http.ts`, `tests/helpers/network.ts`, and `tests/helpers/render.tsx`
- [X] T009 [P] Write failing foundation tests for migration repeatability, database constraints, password verification, session expiry, CSRF/origin rejection, security headers, health readiness, and redacted logging in `tests/integration/foundation.test.ts` and `tests/unit/auth.test.ts`
- [X] T010 Implement typed environment parsing, production/review cookie separation, secret validation, and safe defaults in `server/src/config/index.ts`
- [X] T011 Implement SQLite opening, foreign keys, WAL, busy timeout, integrity checks, append-only checksum migrations, transaction helpers, and test database creation in `server/src/db/database.ts` and `server/src/db/migrate.ts`
- [X] T012 [P] Create the `IconAsset` migration in `migrations/001_icon_assets.sql` with `hash` as lowercase SHA-256 primary key, server-owned raster `mime_type`, re-encoded metadata-stripped bounded `bytes`, matching bounded `byte_count`, positive bounded `width` and `height`, and required `created_at`
- [X] T013 [P] Create the `Bookmark` migration and indexes in `migrations/002_bookmarks.sql` with UUID text `id`; required `url`; binary-unique required `url_key`; nullable title limited to 300 Unicode scalar values; nullable description limited to 2,000; note default empty and limited to 50,000; icon foreign key using `ON DELETE SET NULL`; constrained icon/origin/status enums; `is_read` constrained to 0/1 and default 0; nullable `archived_at`; required immutable `created_at`; required `updated_at`; and required normalized search shadows
- [X] T014 [P] Create `Tag` and `BookmarkTag` migrations and indexes in `migrations/003_tags.sql` with UUID text tag IDs, trimmed `display_name` of 1–100 scalar values, nonempty unique NFKC/case-folded `normalized_name`, required `created_at`, a composite bookmark/tag primary key, cascading foreign keys, and a reverse tag/bookmark index
- [X] T015 [P] Create the `MetadataJob` migration in `migrations/004_metadata_jobs.sql` with UUID ID, cascading bookmark foreign key, `import_missing` kind, constrained queued/running/terminal status, zero-or-one normal attempt rule, redacted nullable error code, lifecycle timestamps, and at most one queued/running job per bookmark and kind
- [X] T016 [P] Create `ImportBatch` and `ImportEntry` migrations in `migrations/005_imports.sql` with constrained preview/terminal states, nonnegative counts, expiry and commit timestamps, unique per-batch ordinal, new/duplicate/invalid classification, bounded parsed fields, validated JSON tags/app state, optional safe icon fields, and cascading staged-entry cleanup
- [X] T017 [P] Create `OwnerSession` persistence in `migrations/006_sessions.sql` with SHA-256 token digest primary key, required CSRF digest, created/last-seen timestamps, required idle/absolute expiries, and no raw cookie or CSRF token storage
- [X] T018 [P] Implement WHATWG HTTP(S) serialization, Unicode NFKC/case normalization, tag identity, scalar-length validation, note-to-visible-text extraction, and UTC timestamp helpers in `shared/src/normalize.ts`, `shared/src/url.ts`, and `shared/src/time.ts`
- [X] T019 Implement versioned asynchronous-scrypt password verification, opaque session issuance/digest lookup, expiry/revocation, and CSRF token binding in `server/src/auth/password.ts`, `server/src/auth/session-repository.ts`, and `server/src/auth/session-service.ts`
- [X] T020 Implement owner-session enforcement, login throttling, SameSite/HttpOnly/Secure cookie policy, origin/fetch-metadata and CSRF validation, CSP, no-referrer, frame denial, and nosniff middleware in `server/src/auth/middleware.ts` and `server/src/app/security.ts`
- [X] T021 Implement the Express application assembly, JSON/body limits, stable error mapping, request IDs, redacted structured logging, `/health/ready`, and production static-client fallback in `server/src/app.ts`, `server/src/observability/logger.ts`, and `server/src/routes/health.ts`
- [X] T022 [P] Implement the typed same-origin session client and mutation CSRF header handling in `client/src/services/api.ts` and `client/src/features/auth/session.ts`
- [X] T023 Implement login, logout, protected routing, session-expiry recovery, error boundaries, responsive shell navigation, and valid-state `data-harness-ready="true"` placement in `client/src/app/router.tsx`, `client/src/app/AppShell.tsx`, and `client/src/routes/LoginPage.tsx`
- [X] T024 Implement non-echoing password-hash generation, migration, build, and foreground production-start scripts in `scripts/hash-password.ts`, `scripts/migrate.ts`, `package.json`, and `server/src/index.ts`, binding the final server to `0.0.0.0:4000`

**Checkpoint**: An authenticated empty application starts, survives restart, enforces the private boundary, exposes no user-story behavior, and passes foundation tests.

---

## Phase 3: User Story 1 — Save an Enriched Bookmark (Priority: P1) MVP

**Goal**: Paste a valid address, receive safe editable title/description/icon proposals, save manually when enrichment is unavailable, prevent exact duplicates, reopen destinations, and retain saved data across sessions.

**Independent Test**: Save a reachable URL with proposed metadata after editing/removing proposals, reload the app and open it; repeat with unavailable metadata and an exact duplicate.

### Tests for User Story 1

- [X] T025 [P] [US1] Write failing OpenAPI contract tests for metadata preview, bookmark create/list/detail, duplicate responses, and authenticated icon delivery in `tests/contract/bookmarks.contract.test.ts`
- [X] T026 [P] [US1] Write failing unit tests for head metadata priority, whitespace/control cleanup, missing fields, malformed HTML, redirects-as-diagnostics, and favicon ranking in `tests/unit/metadata-parser.test.ts`
- [X] T027 [P] [US1] Write failing hostile-network integration tests covering all special IPv4/IPv6 forms, mixed DNS answers, rebinding, pinned socket addresses, public-to-private redirects, downgrade, alternate ports, credentials, timeouts, compression/body limits, wrong MIME, and the rule that rejected targets open no unsafe socket in `tests/integration/metadata-security.test.ts`
- [X] T028 [P] [US1] Write failing repository/service tests for required HTTP(S) URL validation, binary exact-address uniqueness across active/archive, title 300, description 2,000, note 50,000 limits, URL display fallback, tags, timestamps, and leave/reopen persistence in `tests/integration/bookmark-create.test.ts`
- [X] T029 [P] [US1] Write failing component tests for debounced/cancellable preview, dirty-field protection, editable proposals, icon removal, preserved typing after errors, manual fallback, and actionable duplicate navigation in `tests/unit/SaveBookmarkForm.test.tsx`
- [X] T030 [P] [US1] Write the failing complete enriched-save, unreachable-save, duplicate, reload, and external-open browser journey in `tests/e2e/enriched-save.spec.ts`

### Implementation for User Story 1

- [X] T031 [P] [US1] Implement bounded HTTP(S) address validation and shared exact `url_key` generation, preserving path/query/fragment while excluding canonical/redirect rewriting, in `shared/src/url.ts`
- [X] T032 [US1] Implement bookmark create/get/list persistence, atomic tag attachment, duplicate lookup, search-shadow maintenance, timestamp handling, and URL-label fallback in `server/src/bookmarks/bookmark-repository.ts`
- [X] T033 [P] [US1] Implement inert bounded head parsing and deterministic Open Graph, Twitter, HTML title/description, base URL, and favicon candidate extraction in `server/src/metadata/metadata-parser.ts`
- [X] T034 [P] [US1] Implement the SSRF-safe requester with scheme/userinfo/port checks, all-answer public-IP classification, DNS-to-socket pinning, remote-address verification, manually revalidated redirects, deadlines, header/wire/decoded caps, no credentials/retries, and redacted diagnostics in `server/src/metadata/safe-fetch.ts` and `server/src/metadata/ip-policy.ts`
- [X] T035 [P] [US1] Implement favicon MIME/signature validation, decoded-pixel and input limits, animation/metadata stripping, fixed safe raster re-encoding, SHA-256 deduplication, and orphan-safe storage in `server/src/icons/icon-normalizer.ts` and `server/src/icons/icon-repository.ts`
- [X] T036 [US1] Implement expiring metadata proposal/icon tokens, positive/negative exact-URL cache rules, and request-ID correlation in `server/src/metadata/proposal-store.ts`
- [X] T037 [US1] Implement five-second metadata orchestration, deterministic field provenance, partial/blocked outcomes, declared-icon then same-origin-favicon fallback, and no page-JavaScript/subresource loading in `server/src/metadata/metadata-service.ts`
- [X] T038 [US1] Implement authenticated metadata-preview routes with duplicate short-circuiting and stable safety/error categories in `server/src/metadata/metadata-routes.ts`
- [X] T039 [US1] Implement bookmark creation validation, accepted proposal application, default unread state, user-versus-metadata origins, and duplicate-to-existing responses in `server/src/bookmarks/bookmark-service.ts`
- [X] T040 [US1] Implement bookmark create/list/detail plus authenticated same-origin icon routes from the OpenAPI contract in `server/src/bookmarks/bookmark-routes.ts` and `server/src/icons/icon-routes.ts`
- [X] T041 [P] [US1] Implement typed bookmark/metadata/icon API functions and response error mapping in `client/src/services/bookmarks-api.ts`
- [X] T042 [US1] Implement the accessible save form with URL paste debounce, abort/request-ID races, per-field dirty flags, metadata progress/outcomes, title/description editing, icon acceptance/removal, note/tags, initial read choice, validation preservation, and duplicate navigation in `client/src/features/bookmarks/SaveBookmarkForm.tsx`
- [X] T043 [US1] Implement the active-library route, recent/title sorting, distinguishable cards, safe external open without losing state, empty state, reload persistence, and responsive loading/error states in `client/src/routes/LibraryPage.tsx`, `client/src/features/bookmarks/BookmarkCard.tsx`, and `client/src/styles/library.css`

**Checkpoint**: User Story 1 works end-to-end as the independently deployable MVP and all US1 tests pass.

---

## Phase 4: User Story 2 — Find and Organize Bookmarks (Priority: P2)

**Goal**: Find bookmarks by case-insensitive substrings, exact phrases, exact `tag:` criteria, Boolean expressions, tag filters, and sorting, with helpful query errors and clear empty results.

**Independent Test**: Seed overlapping titles, URLs, descriptions, notes, and tags; verify plain, phrase, tag, `AND`, implicit `AND`, `OR`, and unary `NOT` behavior plus errors and clearing.

### Tests for User Story 2

- [X] T044 [P] [US2] Write failing example and fast-check tests for the exact EBNF, uppercase standalone operators, source spans, implicit `AND`, `NOT > AND > OR`, left folding, query/token/depth limits, and all documented invalid cases in `tests/unit/search-parser.test.ts`
- [X] T045 [P] [US2] Write failing real-SQL integration tests for case-insensitive substring matching across title/URL/description/visible-note/tag text, exact phrase and exact `tag:` behavior, collection scoping outside the AST, parameterization, cursors, and sorting in `tests/integration/search.test.ts`
- [X] T046 [P] [US2] Write failing component tests for query preservation, help disclosure, source-span errors, tag filter state, sort state, clearing, and no-results recovery in `tests/unit/SearchControls.test.tsx`
- [X] T047 [P] [US2] Write the failing browser journey covering plain, phrase, tag, Boolean, invalid-query, filter, sort, and clear behavior in `tests/e2e/search-organize.spec.ts`

### Implementation for User Story 2

- [X] T048 [P] [US2] Implement the bounded handwritten tokenizer, recursive-descent parser, AST types, source spans, implicit `AND`, uppercase operator recognition, and actionable syntax errors from `contracts/search-query.ebnf` in `server/src/search/query-parser.ts` and `shared/src/search.ts`
- [X] T049 [P] [US2] Implement searchable-document generation from normalized bookmark fields, visible CommonMark note text, and normalized tag display names in `server/src/search/search-document.ts`
- [X] T050 [US2] Compile query AST leaves and Boolean nodes to parameterized SQLite substring/EXISTS predicates with collection scope outside the AST in `server/src/search/query-compiler.ts`
- [X] T051 [US2] Extend bookmark persistence with stable cursor pagination, recent/title sorts, single-tag filtering, total counts, query fingerprints, and case-insensitive text/tag evaluation in `server/src/bookmarks/bookmark-query-repository.ts`
- [X] T052 [US2] Implement searched bookmark and collection-tag responses, query-span errors, and clearable filter semantics in `server/src/bookmarks/bookmark-routes.ts` and `server/src/tags/tag-routes.ts`
- [X] T053 [P] [US2] Implement typed search/tag parameters, URL-state serialization, cancellation, and query error decoding in `client/src/features/search/search-api.ts` and `client/src/features/search/search-state.ts`
- [X] T054 [US2] Implement the accessible search bar, syntax-help examples, tag filter, sort controls, active criteria, invalid-query guidance, paged results, clear actions, and no-match state in `client/src/features/search/SearchControls.tsx`, `client/src/features/search/SearchHelp.tsx`, and `client/src/routes/LibraryPage.tsx`

**Checkpoint**: User Story 2 can be demonstrated against seeded bookmarks without relying on later read/archive, bulk, or import work.

---

## Phase 5: User Story 3 — Read-Later and Archive Workflows (Priority: P3)

**Goal**: Toggle read status explicitly, view active unread bookmarks, archive without data loss, search the separate archive, and restore with read status intact.

**Independent Test**: Move one bookmark through unread, read, archived, and restored states and verify opening it never changes status.

### Tests for User Story 3

- [X] T055 [P] [US3] Write failing repository/API tests for default unread, idempotent read/unread changes, archive/restore transitions, preserved metadata/tags/dates/read state, collection scoping, and unchanged state on destination open in `tests/integration/read-archive.test.ts`
- [X] T056 [P] [US3] Write failing component tests for collection navigation, count/badge changes, keyboard controls, status announcements, and focus retention after card removal/restoration in `tests/unit/ReadArchiveControls.test.tsx`
- [X] T057 [P] [US3] Write the failing unread-to-read, archive search, restore, and external-open browser journey in `tests/e2e/read-archive.spec.ts`

### Implementation for User Story 3

- [X] T058 [US3] Implement atomic idempotent read/unread/archive/restore transitions that preserve every unrelated field and update only the appropriate lifecycle timestamp in `server/src/bookmarks/bookmark-state-service.ts` and `server/src/bookmarks/bookmark-repository.ts`
- [X] T059 [P] [US3] Extend bookmark PATCH contracts, server handlers, and typed client mutations for read and archive state in `server/src/bookmarks/bookmark-routes.ts`, `shared/src/contracts.ts`, and `client/src/services/bookmarks-api.ts`
- [X] T060 [US3] Implement active, unread, and archive route scoping with persistent query/filter/sort state and accessible navigation counts in `client/src/app/router.tsx`, `client/src/app/AppShell.tsx`, and `client/src/routes/LibraryPage.tsx`
- [X] T061 [US3] Add explicit mark-read/unread, archive, and restore controls with status announcements, safe focus recovery, and unchanged state on external open in `client/src/features/bookmarks/BookmarkCard.tsx`

**Checkpoint**: User Story 3 is independently testable on seeded bookmarks and does not depend on editing, bulk actions, or import/export.

---

## Phase 6: User Story 4 — Maintain Individual Bookmarks (Priority: P4)

**Goal**: Display safe readable formatted notes, edit every user-controlled field, approve metadata refresh changes field by field, and permanently delete only after explicit confirmation.

**Independent Test**: Save and view formatted notes, edit all fields, preview/approve a refresh without surprise overwrites, reload, cancel one delete, then confirm permanent deletion.

### Tests for User Story 4

- [X] T062 [P] [US4] Write failing unit/property tests for CommonMark paragraphs, bold, italic, ordered/unordered lists, safe HTTP(S)/mailto links, unsupported readable text, raw HTML/image suppression, malicious protocols, malformed input, and no executable surrounding-app changes in `tests/unit/NoteRenderer.test.tsx`
- [X] T063 [P] [US4] Write failing integration tests for edit limits, URL duplicate conflicts, search-shadow updates, provenance, metadata refresh proposals, selective acceptance, icon removal, permanent deletion/cascade cleanup, and persistence in `tests/integration/bookmark-maintenance.test.ts`
- [X] T064 [P] [US4] Write failing component tests for syntax help/preview, edit form preservation, refresh diff selection, cancel/confirm deletion wording, and dialog focus restoration in `tests/unit/BookmarkEditor.test.tsx`
- [X] T065 [P] [US4] Write the failing formatted-note, edit, refresh, reload, cancelled-delete, and permanent-delete browser journey in `tests/e2e/bookmark-maintenance.spec.ts`

### Implementation for User Story 4

- [X] T066 [P] [US4] Implement the restricted CommonMark editor/preview/renderer allowlist, safe link transform, unsupported-node text fallback, no raw HTML/images, and discoverable formatting help in `client/src/features/bookmarks/NoteEditor.tsx` and `client/src/features/bookmarks/NoteRenderer.tsx`
- [X] T067 [US4] Implement atomic editable-field updates, URL revalidation/uniqueness, metadata provenance preservation, search-shadow regeneration, icon reference changes, and permanent cascade deletion in `server/src/bookmarks/bookmark-service.ts` and `server/src/bookmarks/bookmark-repository.ts`
- [X] T068 [US4] Implement explicit refresh proposal diffs that preselect only missing/auto-managed values and never apply title, description, or icon changes until approved in `server/src/metadata/metadata-service.ts`
- [X] T069 [US4] Implement bookmark update, metadata-refresh preview, and `confirm=permanent` delete handlers with stable errors in `server/src/bookmarks/bookmark-routes.ts`
- [X] T070 [P] [US4] Add typed update, refresh-diff, icon-choice, and permanent-delete operations in `client/src/services/bookmarks-api.ts`
- [X] T071 [US4] Implement bookmark detail/edit routes with formatted note display, original-source editing, field validation, refresh comparison, selective apply, and persisted success/error states in `client/src/routes/BookmarkDetailPage.tsx` and `client/src/features/bookmarks/BookmarkEditor.tsx`
- [X] T072 [US4] Implement a clearly permanent delete confirmation distinct from archive, including cancel behavior, focus restoration, and post-delete navigation in `client/src/features/bookmarks/DeleteBookmarkDialog.tsx`

**Checkpoint**: User Story 4 proves readable notes and safe individual maintenance without requiring bulk or portability features.

---

## Phase 7: User Story 5 — Manage Multiple Bookmarks Together (Priority: P5)

**Goal**: Select individuals or every matching result and atomically add/remove tags, change read status, archive/restore, or permanently delete with counts and safe confirmations.

**Independent Test**: Apply each bulk action to a mixed-state filtered selection, verify unrelated fields remain unchanged, confirm/cancel deletion, and verify selection clearing.

### Tests for User Story 5

- [X] T073 [P] [US5] Write failing integration/property tests for explicit-ID and query-fingerprint selection, exclusions, stale fingerprints, atomic 1,000-item actions, idempotent states, tag preservation, archive/restore, confirmed delete, exact changed counts, and rollback in `tests/integration/bulk-actions.test.ts`
- [X] T074 [P] [US5] Write failing component and browser tests for individual/select-all-matching behavior, selection count, hidden-selection clearing, action availability by collection, tag dialogs, permanent count wording, cancellation, focus, and completion announcements in `tests/unit/BulkToolbar.test.tsx` and `tests/e2e/bulk-actions.spec.ts`

### Implementation for User Story 5

- [X] T075 [P] [US5] Implement server-side selection resolution for explicit IDs or collection/query/tag/sort fingerprint plus exclusions, rejecting stale or mismatched scopes, in `server/src/bookmarks/selection-service.ts`
- [X] T076 [US5] Implement transactional bulk add/remove tags, mark read/unread, archive/restore, and confirmed delete with matched/changed/unchanged counts and no unrelated-field changes in `server/src/bookmarks/bulk-service.ts` and `server/src/bookmarks/bookmark-repository.ts`
- [X] T077 [US5] Implement the OpenAPI bulk endpoint and contextual action validation in `server/src/bookmarks/bookmark-routes.ts` and `shared/src/contracts.ts`
- [X] T078 [P] [US5] Implement client selection state bound to `queryFingerprint`, individual/all-matching modes, exclusions, and automatic clearing on scope changes in `client/src/features/selection/selection-store.ts`
- [X] T079 [US5] Implement the keyboard-accessible bulk toolbar, add/remove tag controls, read/archive/restore actions, counted permanent-delete dialog, progress, result announcement, and post-action clearing in `client/src/features/selection/BulkToolbar.tsx` and `client/src/features/selection/BulkDialogs.tsx`
- [X] T080 [US5] Add and enforce the 1,000-bookmark under-five-second bulk benchmark with unintended-field diff checks in `tests/performance/bulk-actions.perf.test.ts`

**Checkpoint**: User Story 5 is independently demonstrable on seeded bookmarks and all bulk outcomes are atomic and measured.

---

## Phase 8: User Story 6 — Import and Export the Collection (Priority: P6)

**Goal**: Preview and confirm standard browser bookmark HTML imports with folder-to-tag conversion, skip/report invalid and duplicate records, enrich missing fields later, and export every active/archived bookmark once with lossless direct round-trip state.

**Independent Test**: Import mixed Chrome/Firefox-style fixtures, verify preview/cancel/confirm/folder tags, export the collection, read it generically, then import into an empty database and compare all required fields.

### Tests for User Story 6

- [X] T081 [P] [US6] Write failing unit/property tests and Chrome/Firefox/Safari/Edge/malformed fixtures for charset handling, tolerant folder stacks, HTML escaping, limits, HTTP(S)-only anchors, folder-plus-`TAGS` normalization, first-valid duplicate behavior, strict versioned app metadata, and inert parsing in `tests/unit/bookmark-html.test.ts` and `tests/fixtures/bookmark-html/`
- [X] T082 [P] [US6] Write failing integration tests for durable preview counts/details, zero mutation before confirmation, cancellation/expiry, confirmation-time duplicate recheck, atomic commit, generic unread/active defaults, app-state restoration, and queued missing-field enrichment in `tests/integration/import.test.ts`
- [X] T083 [P] [US6] Write failing export and full empty-database round-trip tests proving every bookmark appears exactly once, generic title/URL readability, and 100% restoration of descriptions, notes, tags, icon availability, read/archive states, and saved/updated dates in `tests/integration/export-roundtrip.test.ts`
- [X] T084 [P] [US6] Write failing worker tests for post-commit availability, global/per-host limits, fill-missing-only ownership, no normal retries, interrupted-job startup recovery, and bookmark-delete cancellation in `tests/integration/enrichment-worker.test.ts`
- [X] T085 [P] [US6] Write the failing import preview/cancel/confirm/folder-tags/background-enrichment/export/download/round-trip browser journey in `tests/e2e/import-export.spec.ts`

### Implementation for User Story 6

- [X] T086 [P] [US6] Implement bounded BOM/meta charset decoding and inert parse5 SAX folder-stack parsing for Netscape/browser HTML, including text extraction, app-extension validation, folder tags, `TAGS`, dates, safe data icons, duplicate classification, and limit errors in `server/src/import-export/bookmark-html-parser.ts`
- [X] T087 [US6] Implement expiring import batch/entry staging, bounded issue details, raw-input disposal, cancellation, and idempotent status transitions in `server/src/import-export/import-repository.ts`
- [X] T088 [US6] Implement preview and atomic confirmation services that recheck unique URL keys, create tags/bookmarks/icons, update final counts, preserve valid imported fields, and enqueue missing metadata only after commit in `server/src/import-export/import-service.ts`
- [X] T089 [US6] Implement raw `text/html` upload, preview retrieval, cancel, and idempotent commit routes with filename/body/count limits in `server/src/import-export/import-routes.ts`
- [X] T090 [US6] Implement the durable in-process enrichment worker with startup recovery, four-global/one-per-host concurrency, no periodic refresh, missing-field-only application, and redacted progress in `server/src/metadata/enrichment-worker.ts`
- [X] T091 [P] [US6] Implement streaming UTF-8 Netscape HTML export with escaped standard fields, Active/Archive folders, one anchor per bookmark, safe local data icons, and versioned base64url `data-bookmark-manager-meta` state in `server/src/import-export/bookmark-html-writer.ts`
- [X] T092 [US6] Implement authenticated streaming download and cleanup-safe export routes in `server/src/import-export/export-routes.ts`
- [X] T093 [US6] Implement typed import/export client calls plus accessible file selection, preview counts/issues, cancel/confirm, background enrichment status, export download, and empty/error states in `client/src/services/import-export-api.ts` and `client/src/routes/ImportExportPage.tsx`
- [X] T094 [US6] Add and enforce the 10,000-bookmark under-60-second import benchmark with exact counts and immediate post-commit availability in `tests/performance/import.perf.test.ts`

**Checkpoint**: All six user stories are independently functional and the collection is portable without lock-in.

---

## Phase 9: Polish and Cross-Cutting Verification

**Purpose**: Prove whole-product accessibility, security, performance, durability, contractual consistency, and review readiness without expanding scope.

- [X] T095 [P] Run keyboard-only and axe coverage across login, save, active/unread/archive, search, edit, bulk, import, export, dialogs, error, and empty states; fix shared issues in `client/src/components/`, `client/src/styles/`, and `tests/e2e/accessibility.spec.ts`
- [X] T096 [P] Complete adversarial security regression coverage for SSRF, imported HTML, note XSS, unsafe links, session/CSRF, upload limits, icon serving, CSP, and log redaction in `tests/integration/security-regression.test.ts`
- [X] T097 [P] Add representative 95%-within-five-second metadata metrics and 10,000-bookmark under-two-second search/filter/sort/view gates with semantic equivalence coverage for any FTS5 fallback in `tests/performance/metadata.perf.test.ts` and `tests/performance/search.perf.test.ts`
- [X] T098 [P] Add 100 leave/restart-cycle durability tests, SQLite integrity checks, interrupted-job recovery, and confirmed-change equality for 10,000 bookmarks in `tests/integration/durability.test.ts`
- [X] T099 [P] Validate every implemented route/response against `specs/001-bookmark-manager/contracts/openapi.yaml` and keep the contract lint clean in `tests/contract/openapi.test.ts`
- [X] T100 Run the complete desktop/mobile Chromium journey suite and add any missing cross-story regression scenarios in `tests/e2e/full-product.spec.ts`
- [X] T101 Create the final review launcher with `kind: application`, port 4000, `/`, `npm start`, and `/work` plus verified readiness behavior in `.harness/app.json`
- [X] T102 Update setup, private deployment, review credentials, backup/restore, metadata privacy disclosure, import/export limits, formatting help, and validation commands in `README.md` and `.env.example`, then reconcile `specs/001-bookmark-manager/quickstart.md`
- [X] T103 Run `npm ci`, lint, formatting check, typecheck, unit, integration, contract, end-to-end, performance, production build, migration, and quickstart smoke commands from `package.json`; record any unavailable external validation honestly in `specs/001-bookmark-manager/verification.md`

**Checkpoint**: The production build is prepared, all available gates pass, and the shared review application can be started deterministically.

---

## Dependencies and Execution Order

### Phase Dependencies

- **Phase 1 — Setup**: Starts immediately.
- **Phase 2 — Foundation**: Depends on Phase 1 and blocks every user story.
- **Phase 3 — US1**: Starts after Foundation and is the MVP.
- **Phase 4 — US2**: Starts after Foundation; tests may use seeded bookmark fixtures, while product integration reuses the US1 bookmark repository.
- **Phase 5 — US3**: Starts after Foundation; tests may use seeded bookmark fixtures, while product integration reuses the US1 library.
- **Phase 6 — US4**: Depends on US1 because it edits and deletes saved bookmarks.
- **Phase 7 — US5**: Depends on US1 for saved records, US2 for query selections, and US3 for read/archive actions.
- **Phase 8 — US6**: Depends on the US1 persistence contract; it can otherwise proceed independently of US2–US5 and must restore their fields when present.
- **Phase 9 — Polish**: Depends on all six stories selected for the complete release.

### User Story Dependency Graph

```text
Setup → Foundation ─┬→ US1 (MVP) ─┬→ US4
                    │             ├→ US6
                    │             └→ US5
                    ├→ US2 ─────────→ US5
                    └→ US3 ─────────→ US5

US1 + US2 + US3 + US4 + US5 + US6 → Polish
```

### Within Each User Story

1. Create all listed story tests and confirm failure for missing behavior.
2. Implement low-level parsers/models/repositories before services.
3. Implement services before HTTP endpoints.
4. Implement typed client calls before route-level UI integration.
5. Pass the independent story test before continuing to the next priority.

## Parallel Execution Examples

### User Story 1

```text
Parallel test work: T025, T026, T027, T028, T029, T030
After those fail, parallel primitives: T031, T033, T034, T035, T041
Then sequence: T032 → T036 → T037 → T038/T039 → T040 → T042 → T043
```

### User Story 2

```text
Parallel test work: T044, T045, T046, T047
After those fail, parallel primitives: T048, T049, T053
Then sequence: T050 → T051 → T052 → T054
```

### User Story 3

```text
Parallel test work: T055, T056, T057
Then T058; T059 may proceed while T060 builds routing; finish with T061 integration.
```

### User Story 4

```text
Parallel test work: T062, T063, T064, T065
After those fail, T066 and T070 can proceed while T067/T068 implement server behavior.
Then T069 → T071/T072.
```

### User Story 5

```text
Parallel test work: T073, T074
After those fail, T075 and T078 proceed in parallel; then T076 → T077 and T079 → T080.
```

### User Story 6

```text
Parallel test work: T081, T082, T083, T084, T085
After those fail, T086 and T091 proceed in parallel.
Import path: T087 → T088 → T089 → T090.
Export path: T091 → T092.
Finish with T093 → T094.
```

## Implementation Strategy

### MVP First

1. Complete Setup and Foundation.
2. Complete US1, including its tests and checkpoint.
3. Stop and demonstrate enriched/manual saving, duplicates, persistence, privacy, and reopening as a complete MVP.

### Incremental Delivery

1. Add US2 for precise retrieval and organization.
2. Add US3 for read-later and archive workflows.
3. Add US4 for formatted notes and individual maintenance.
4. Add US5 for collection-scale bulk work.
5. Add US6 for adoption and portability.
6. Run the cross-cutting release gates only after all desired stories are present.

### Scope Guard

- Do not add saved searches, collaboration, multiple accounts, browser extensions, offline snapshots, reader mode, semantic search, automated broken-link monitoring, or periodic metadata refresh.
- Route any behavior change through `spec.md` and re-plan/re-task before code changes.
- Treat exact product outcomes in the approved spec as authoritative when a technical task description is ambiguous.
