# Tasks: Bookmark Manager

**Input**: Approved design documents from specs/001-bookmark-manager/

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Required by the approved plan and validation guide. Story test tasks are ordered before their corresponding implementation tasks.

**Organization**: Tasks are grouped by user story so each story can be implemented and demonstrated as an independently testable increment.

## Format: [ID] [P?] [Story] Description

- **[P]**: Can run in parallel because it changes different files and has no dependency on another incomplete task in the same group.
- **[Story]**: Maps the task to an approved user story.
- Every task names the exact file or directory it creates or changes.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish the project, toolchain, and planned source layout without implementing product behavior.

- [ ] T001 Create the single-package directory structure from plan.md under src/client/, src/server/, src/shared/, migrations/, tests/unit/, tests/integration/, tests/contract/, tests/component/, tests/e2e/, tests/fixtures/, and data/.gitkeep
- [ ] T002 Initialize package.json and package-lock.json with Node 24, TypeScript 6, React 19.3, React Router 8.3, Vite 8.3, Fastify 5.12, TypeBox, Undici, parse5, Sharp, Fastify plugins, Vitest 5, React Testing Library, and exact @playwright/test 1.61.0 dependencies plus planned build/start/test scripts
- [ ] T003 [P] Configure strict ESM TypeScript builds and shared path aliases in tsconfig.json, tsconfig.server.json, and tsconfig.client.json
- [ ] T004 [P] Configure the React client build and production asset output in vite.config.ts and src/client/index.html
- [ ] T005 [P] Configure separate Node and DOM test projects plus coverage/report paths in vitest.config.ts and tests/setup/dom.ts
- [ ] T006 [P] Configure Playwright 1.61.0 to exercise the built app on desktop and mobile viewports in playwright.config.ts
- [ ] T007 [P] Configure formatting, linting, generated artifacts, local database files, secrets, and test output exclusions in eslint.config.js, .prettierrc.json, and .gitignore

**Checkpoint**: Tooling and paths match the approved plan; no user-facing functionality exists yet.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Create the database, private-account boundary, API shell, and accessible application shell required by every user story.

**CRITICAL**: No user-story implementation begins until this phase passes its tests.

### Foundational Tests

- [ ] T008 [P] Write migration and transaction tests for foreign keys, WAL configuration, rollback, defensive mode, and temporary databases in tests/integration/db.test.ts
- [ ] T009 [P] Write authentication contract tests for register, login, logout, current-user, cookie rotation, expiry, same-origin mutation checks, and generic invalid-credential errors in tests/contract/auth.test.ts
- [ ] T010 [P] Write two-account isolation tests proving unscoped IDs reveal no bookmark, tag, icon, import, or count data in tests/integration/account-isolation.test.ts
- [ ] T011 [P] Write keyboard and accessible-name tests for the login form, authenticated shell, loading/error/empty regions, and focus management in tests/component/app-shell.test.tsx

### Foundational Implementation

- [ ] T012 Create the core schema in migrations/001_initial.sql with User constraints “email 3–254 characters; email_key trimmed, case-normalized, unique”, Session constraints “token_hash SHA-256 and unique; created_at, last_seen_at, expires_at required”, Bookmark constraints “url absolute HTTP/HTTPS max 4,096 characters; title 1–300 Unicode code points; description max 1,000; notes max 5,000; read_later_state none/unread/read; unique (user_id, canonical_key) including archived rows”, BookmarkIcon constraints “image/png, maximum 256 KiB, width/height 1–512”, Tag constraints “name 1–60 code points; unique (user_id, name_key)”, and unique BookmarkTag pairs with cascading foreign keys
- [ ] T013 Implement the node:sqlite connection, PRAGMA configuration, ordered migration runner, prepared-statement helpers, and transaction wrapper in src/server/db/database.ts, src/server/db/migrate.ts, and src/server/db/transaction.ts
- [ ] T014 [P] Implement environment parsing for database path, cookie settings, session lifetime, upload limits, metadata budgets, host 0.0.0.0, and port 4000 in src/server/config/env.ts
- [ ] T015 [P] Define shared TypeBox schemas for credentials, current user, errors, identifiers, timestamps, pagination, and health responses in src/shared/contracts/common.ts and src/shared/contracts/auth.ts
- [ ] T016 Implement User and Session repositories with account-scoped lookups, expiry cleanup, and token-hash storage in src/server/repositories/user-repository.ts and src/server/repositories/session-repository.ts
- [ ] T017 Implement asynchronous scrypt password handling, opaque token generation/hashing, session rotation, and current-user authentication in src/server/services/auth/auth-service.ts and src/server/security/session.ts
- [ ] T018 Implement Fastify registration, login, logout, current-user, health, request-id, normalized error, cookie, origin-check, security-header, and rate-limit behavior in src/server/routes/auth.ts, src/server/routes/health.ts, src/server/app.ts, and src/server/security/origin.ts
- [ ] T019 [P] Implement the typed same-origin API client and authentication context in src/client/app/api.ts and src/client/app/auth-context.tsx
- [ ] T020 Implement responsive authenticated routing, navigation placeholders for active/read-later/archive/settings, error boundaries, live status regions, and data-harness-ready timing in src/client/app/App.tsx, src/client/app/router.tsx, and src/client/styles/global.css
- [ ] T021 Implement accessible registration/login/logout screens with preserved safe input and field-associated errors in src/client/features/auth/AuthPage.tsx and src/client/features/auth/AuthForm.tsx
- [ ] T022 Implement the review-account seed command without production default credentials in src/server/db/seed-review.ts and wire npm run seed:review in package.json
- [ ] T023 Run the foundational suites in tests/integration/db.test.ts, tests/contract/auth.test.ts, tests/integration/account-isolation.test.ts, and tests/component/app-shell.test.tsx and make them pass via npm test and npm run test:contract

**Checkpoint**: Users can create private accounts, sign in/out, and reach an accessible empty application shell; the database and authorization boundary are tested.

---

## Phase 3: User Story 1 — Save Bookmarks with Page Details (Priority: P1) MVP

**Goal**: Let a signed-in user paste a URL, safely retrieve title/description/icon, edit the preview, save with fallbacks and tags/notes, view the private collection, and open the destination without losing collection state.

**Independent Test**: Paste a valid public fixture URL, review retrieved details, edit them, save, verify the app-owned icon and dates in the collection, open the destination, then verify invalid, unavailable, partial-metadata, and duplicate cases.

### Tests for User Story 1

- [ ] T024 [P] [US1] Write URL validation and canonicalization tests covering schemes, credentials, IDNs, fragments, default ports, host case, root trailing slash, query preservation, and equivalent-destination duplicates in tests/unit/url-policy.test.ts
- [ ] T025 [P] [US1] Write deterministic safe-fetch tests for A/AAAA public-address validation, mixed/private/special ranges, DNS pinning/rebinding, TLS hostname preservation, manual relative redirects, cycles, downgrade rejection, five-hop limit, timeouts, header/body/decompression caps, MIME checks, and cancellation in tests/unit/safe-fetch.test.ts
- [ ] T026 [P] [US1] Write metadata parser tests for Open Graph → Twitter → HTML → fallback precedence, first non-empty duplicate handling, entities, control/whitespace normalization, malformed HTML, title 300-code-point cap, and description 1,000-code-point cap in tests/unit/metadata-parser.test.ts
- [ ] T027 [P] [US1] Write icon tests for base URL resolution, candidate ordering, safe redirects, MIME/magic mismatch, SVG/data rejection, 256 KiB limit, 512×512/pixel limit, animated first-frame conversion, and app-owned PNG output in tests/unit/icon-normalizer.test.ts
- [ ] T028 [P] [US1] Write metadata-preview and bookmark create/list/get contract tests against contracts/openapi.yaml, including fallback success, duplicate conflict with existing ID, owned icon response, validation errors, and not-found isolation in tests/contract/bookmarks.test.ts
- [ ] T029 [P] [US1] Write repository/service integration tests for bookmark creation and listing constraints, timestamps, user-edited preview precedence, tag attachment, duplicate uniqueness across active/archived rows, icon ownership, and rollback in tests/integration/bookmarks.test.ts
- [ ] T030 [P] [US1] Write keyboard-first component tests for paste → loading → editable preview → save, fallback warning, duplicate navigation, error input preservation, generic icon, bookmark card details, and external open behavior in tests/component/bookmark-save.test.tsx
- [ ] T031 [US1] Write the built-app P1 acceptance flow at desktop and mobile sizes using deterministic metadata transport fixtures in tests/e2e/bookmark-save.spec.ts

### Implementation for User Story 1

- [ ] T032 [P] [US1] Implement absolute HTTP/HTTPS validation and conservative canonical keys in src/shared/url/url-policy.ts, preserving submitted URLs while lowercasing scheme/host, removing fragments/default ports, normalizing empty path to /, and treating only the sole root trailing slash as equivalent
- [ ] T033 [P] [US1] Define metadata preview, bookmark create/update/read, tag, icon, and page-response TypeBox contracts matching contracts/openapi.yaml in src/shared/contracts/metadata.ts and src/shared/contracts/bookmarks.ts
- [ ] T034 [US1] Implement the SSRF-safe resolver and Undici transport with validated-address pinning, default ports only, no IP literals/credentials/local names, IANA special-range denial, manual redirects, no sensitive forwarded headers, and configured resource budgets in src/server/security/ip-policy.ts and src/server/services/metadata/safe-fetch.ts
- [ ] T035 [P] [US1] Implement non-executing HTML head parsing and deterministic title/description/icon candidate extraction in src/server/services/metadata/metadata-parser.ts
- [ ] T036 [US1] Implement safe icon retrieval and Sharp normalization to first-frame app-owned PNG within “maximum 256 KiB after normalization” and “width/height 1–512” in src/server/services/metadata/icon-normalizer.ts
- [ ] T037 [US1] Implement bounded short-lived metadata preview tokens and the fallback-producing preview/refresh orchestration in src/server/services/metadata/preview-store.ts and src/server/services/metadata/metadata-service.ts
- [ ] T038 [US1] Implement account-scoped Bookmark, BookmarkIcon, Tag, and BookmarkTag repositories with transactional create/update/delete, orphan-tag cleanup, timestamps, and duplicate mapping in src/server/repositories/bookmark-repository.ts and src/server/repositories/tag-repository.ts
- [ ] T039 [US1] Implement bookmark validation and create/read/list services that preserve user-edited previews, consume optional preview icons safely, and never require metadata success in src/server/services/bookmarks/bookmark-service.ts
- [ ] T040 [US1] Implement metadata preview, bookmark create/list/get, and owned PNG icon routes with full request/response schemas in src/server/routes/metadata.ts and src/server/routes/bookmarks.ts
- [ ] T041 [P] [US1] Implement the URL paste and editable metadata form, notes/tags entry, fallback messaging, and retry-safe form state in src/client/features/bookmarks/BookmarkForm.tsx and src/client/features/bookmarks/MetadataPreview.tsx
- [ ] T042 [P] [US1] Implement active collection loading, actionable empty state, bookmark cards with dates/states/tags/app-owned icons, pagination, and destination opening without losing SPA state in src/client/features/collection/CollectionPage.tsx and src/client/features/bookmarks/BookmarkCard.tsx
- [ ] T043 [US1] Connect metadata preview, create, list/get, duplicate redirect, and optimistic status announcements in src/client/features/bookmarks/bookmark-api.ts and src/client/features/bookmarks/use-bookmarks.ts
- [ ] T044 [US1] Run the US1 suites in tests/unit/url-policy.test.ts, tests/unit/safe-fetch.test.ts, tests/unit/metadata-parser.test.ts, tests/unit/icon-normalizer.test.ts, tests/contract/bookmarks.test.ts, tests/integration/bookmarks.test.ts, tests/component/bookmark-save.test.tsx, and tests/e2e/bookmark-save.spec.ts and verify the P1 targets with no live-site dependency

**Checkpoint**: User Story 1 is a complete deployable MVP after Setup and Foundation.

---

## Phase 4: User Story 2 — Keep a Read-Later List (Priority: P2)

**Goal**: Let users add/remove bookmarks from read later, view unread items, mark them read, and mark them unread without changing favorite or archive state.

**Independent Test**: Mark new and existing bookmarks for later, view only unread queue items, mark one read so it leaves that view but remains saved, mark it unread so it returns, and remove it from the queue.

### Tests for User Story 2

- [ ] T045 [P] [US2] Write state-transition unit tests for none → unread → read → unread/none with required timestamps and independent favorite/archive fields in tests/unit/read-later-state.test.ts
- [ ] T046 [P] [US2] Write read-later route/repository tests for account scope, unread queue exclusion, read persistence, and the rules “none requires both reading timestamps null; unread requires read_later_added_at and read_at null; read requires both timestamps” in tests/integration/read-later.test.ts
- [ ] T047 [P] [US2] Write accessible component and built-app tests for add, mark read, mark unread, remove, focused empty state, and persistent favorite state in tests/component/read-later.test.tsx and tests/e2e/read-later.spec.ts

### Implementation for User Story 2

- [ ] T048 [P] [US2] Implement pure read-later transitions and timestamp invariants in src/server/services/bookmarks/read-later-state.ts
- [ ] T049 [US2] Extend account-scoped bookmark update/list queries and contracts for none/unread/read changes and the unread read-later scope in src/server/repositories/bookmark-repository.ts, src/server/services/bookmarks/bookmark-service.ts, and src/shared/contracts/bookmarks.ts
- [ ] T050 [US2] Implement the create-form read-later choice, read-later navigation, unread queue, mark-read/mark-unread/remove actions, and accessible empty/status states in src/client/features/collection/ReadLaterPage.tsx and src/client/features/bookmarks/ReadLaterActions.tsx
- [ ] T051 [US2] Run tests/unit/read-later-state.test.ts, tests/integration/read-later.test.ts, tests/component/read-later.test.tsx, and tests/e2e/read-later.spec.ts and confirm User Stories 1 and 2 remain independently functional

**Checkpoint**: The reading queue works without conflating read, favorite, archive, or deletion states.

---

## Phase 5: User Story 3 — Find and Order Bookmarks (Priority: P3)

**Goal**: Provide all-word and exact-phrase search, multi-tag AND/state filtering, and title/date sorting while preserving combined controls.

**Independent Test**: In a varied 1,000-bookmark collection, verify unquoted all-word matching, quoted phrase matching, combined tag/favorite/read-later filters, all four title/date directions, no-match guidance, and one-action reset.

### Tests for User Story 3

- [ ] T052 [P] [US3] Write query-parser tests for escaped AND-only FTS atoms, exact phrases within one field, case/Unicode/punctuation behavior, blank input, and unmatched-quote correction in tests/unit/search-query.test.ts
- [ ] T053 [P] [US3] Write search repository tests for user isolation, searchable title/url/description/notes/tags, multi-tag HAVING COUNT(DISTINCT) semantics, state/scope combination, deterministic ID tie-breakers, pagination, and transactional FTS updates in tests/integration/search.test.ts
- [ ] T054 [P] [US3] Write list endpoint contract tests for q/tag/favorite/readLaterState/scope/sort/direction/limit/offset validation and combined results in tests/contract/search.test.ts
- [ ] T055 [P] [US3] Write component tests for URL-backed controls, exact-phrase help, unmatched-quote error, selected-tag chips, combined filters, sorting, no results, and clear-all in tests/component/search-controls.test.tsx
- [ ] T056 [US3] Write a 1,000-item desktop/mobile acceptance and timing scenario for phrase search, two-tag intersection, states, sorting, navigation restoration, and reset in tests/e2e/search.spec.ts

### Implementation for User Story 3

- [ ] T057 [P] [US3] Add the external-content FTS5 table, supporting triggers/indexes, and rebuild migration in migrations/002_search.sql
- [ ] T058 [P] [US3] Implement the approved word/quoted-phrase parser that quotes every atom, joins with explicit AND, rejects unmatched quotes, and never passes raw operators through in src/server/services/bookmarks/search-query.ts
- [ ] T059 [US3] Implement account-scoped FTS synchronization and the composed FTS/tag-intersection/state/scope/sort/pagination query with ID tie-breakers in src/server/repositories/search-repository.ts
- [ ] T060 [US3] Extend bookmark list schemas/routes/services for all approved query parameters and predictable empty results in src/shared/contracts/bookmarks.ts, src/server/routes/bookmarks.ts, and src/server/services/bookmarks/bookmark-service.ts
- [ ] T061 [US3] Implement URL-query-backed text, exact-phrase guidance, multi-tag chips, favorite/read-later filters, title/date direction controls, result count, and clear-all UI in src/client/features/collection/SearchControls.tsx and src/client/features/collection/use-collection-query.ts
- [ ] T062 [US3] Run tests/unit/search-query.test.ts, tests/integration/search.test.ts, tests/contract/search.test.ts, tests/component/search-controls.test.tsx, and tests/e2e/search.spec.ts, rebuild FTS, and confirm the 1,000-item target without breaking Stories 1–2

**Checkpoint**: Users can precisely retrieve and order bookmarks with composable, persistent controls.

---

## Phase 6: User Story 4 — Organize, Archive, and Maintain Bookmarks (Priority: P4)

**Goal**: Let users edit all bookmark details, reuse suggested tags, favorite items, archive/restore reversibly, and permanently delete only after confirmation.

**Independent Test**: Edit a bookmark, select an as-you-type existing tag, create a truly new tag, toggle favorite, archive and restore an unread favorite with state intact, cancel deletion, then confirm deletion.

### Tests for User Story 4

- [ ] T063 [P] [US4] Write tag normalization/suggestion tests for case-insensitive containment, prefix-first ranking, 10-result default/20 maximum, 1–60-code-point names, exact-match reuse, user isolation, and orphan cleanup in tests/integration/tag-suggestions.test.ts
- [ ] T064 [P] [US4] Write edit/refresh, favorite, archive/restore, and delete route/service integration tests proving no refresh overwrite without confirmation, archived exclusion from active/read-later views, duplicate inclusion, preserved reading/favorite state, updated timestamps, cross-account denial, and terminal cascade deletion in tests/integration/bookmark-maintenance.test.ts
- [ ] T065 [P] [US4] Write component tests for editable URL/title/description/notes, refresh-without-overwrite confirmation, keyboard tag combobox, favorite control, archive/restore, focus-safe delete confirmation/cancel, and error input preservation in tests/component/bookmark-maintenance.test.tsx
- [ ] T066 [US4] Write the complete edit → suggested tag → favorite → archive → restore → cancel delete → confirm delete desktop/mobile flow in tests/e2e/bookmark-maintenance.spec.ts

### Implementation for User Story 4

- [ ] T067 [P] [US4] Implement prefix-first case-insensitive suggestion queries, exact normalized-name reuse, safe new-tag creation, and orphan deletion in src/server/repositories/tag-repository.ts and src/server/services/bookmarks/tag-service.ts
- [ ] T068 [US4] Implement GET /tags suggestion contracts/routes with user scope and bounded results in src/shared/contracts/bookmarks.ts and src/server/routes/tags.ts
- [ ] T069 [US4] Implement edit, refresh preview without automatic overwrite, favorite, archive, restore, and confirmed-delete service/route behavior with updated-at handling while preserving independent read-later state in src/server/services/bookmarks/bookmark-service.ts, src/server/routes/bookmarks.ts, and src/server/routes/metadata.ts
- [ ] T070 [P] [US4] Implement the accessible as-you-type tag combobox with case-insensitive suggestions, keyboard selection, exact-match reuse, and deliberate new-tag creation in src/client/features/bookmarks/TagCombobox.tsx
- [ ] T071 [P] [US4] Implement the full edit dialog and metadata refresh comparison that never overwrites user fields without confirmation in src/client/features/bookmarks/EditBookmarkDialog.tsx
- [ ] T072 [P] [US4] Implement archive view/restore controls, favorite control, and focus-restoring permanent-delete confirmation in src/client/features/collection/ArchivePage.tsx and src/client/features/bookmarks/BookmarkActions.tsx
- [ ] T073 [US4] Connect tag suggestions and maintenance mutations with retry-safe optimistic feedback in src/client/features/bookmarks/bookmark-api.ts and src/client/features/bookmarks/use-bookmarks.ts
- [ ] T074 [US4] Run tests/integration/tag-suggestions.test.ts, tests/integration/bookmark-maintenance.test.ts, tests/component/bookmark-maintenance.test.tsx, and tests/e2e/bookmark-maintenance.spec.ts and confirm Stories 1–4 remain functional across active, read-later, and archive views

**Checkpoint**: Collection maintenance is safe, reversible where promised, and efficient for repeated tags.

---

## Phase 7: User Story 5 — Bring Bookmarks In and Take Them Out (Priority: P5)

**Goal**: Preview and import browser bookmarks without duplicate loss, export browser-compatible HTML, create a lossless complete backup, and restore that backup into an empty collection.

**Independent Test**: Preview and commit mixed browser files, verify folder tags and partial outcomes/retry idempotency, export both formats, validate complete JSON, restore it into an empty account, and compare every visible detail/state.

### Tests for User Story 5

- [ ] T075 [P] [US5] Write inert browser HTML parser tests for Chrome/Edge/Firefox/Safari variants, malformed nesting, 10 MiB size, 20,000-entry and depth-100 limits, HTTP/HTTPS-only URLs, title/date/DD extraction, generic-root exclusion, folder tags, icon validation, and Safari com.apple.ReadingList mapping in tests/unit/browser-import-parser.test.ts
- [ ] T076 [P] [US5] Write complete backup schema/projection tests for format bookmark-manager-backup, schemaVersion 1, RFC 3339 dates, max 20,000 bookmarks, field/state/icon round trip, unknown-field tolerance policy, higher-version rejection, and exclusion of user/password/session/canonical/local IDs in tests/unit/backup-format.test.ts
- [ ] T077 [P] [US5] Write import/export contract tests for multipart preview, format/size errors, owned status, commit conflicts/expiry, browser HTML download, and complete JSON download in tests/contract/portability.test.ts
- [ ] T078 [P] [US5] Write import repository/service tests for short-lived user-scoped snapshots, file hash, preview counts, exact-snapshot commit, database duplicate authority, per-entry partial browser success, interrupted retry idempotency, and atomic empty-collection native restore in tests/integration/import-export.test.ts
- [ ] T079 [US5] Write desktop/mobile acceptance tests covering representative browser preview/commit, result reporting, both downloads, schema validation, full restore comparison, and non-empty restore rejection in tests/e2e/portability.spec.ts

### Implementation for User Story 5

- [ ] T080 [P] [US5] Add ImportBatch constraints “format browser-html/complete-json; status previewed/committing/completed/partial/failed/expired; all counts non-negative; expires_at required” and ImportEntry constraints “ordinal unique within batch; classification new/duplicate/invalid; outcome pending/imported/skipped_duplicate/failed” in migrations/003_imports.sql
- [ ] T081 [P] [US5] Define import preview/status and export TypeBox contracts aligned with contracts/openapi.yaml and contracts/backup.schema.json in src/shared/contracts/portability.ts
- [ ] T082 [P] [US5] Implement the tolerant, non-executing browser HTML parser, folder-to-tag rules, supported browser roots, Safari Reading List mapping, and bounded raster-icon handoff in src/server/services/imports/browser-bookmarks-parser.ts
- [ ] T083 [P] [US5] Implement versioned complete JSON validation and portable projection/restore mapping in src/server/services/exports/backup-format.ts
- [ ] T084 [US5] Implement user-scoped ImportBatch/ImportEntry persistence, expiry, exact-snapshot storage, per-entry outcome recording, and resumable browser commit primitives in src/server/repositories/import-repository.ts
- [ ] T085 [US5] Implement preview classification and browser commit orchestration with no bulk metadata crawl, folder tags, partial outcomes, duplicate safety, and retry idempotency in src/server/services/imports/import-service.ts
- [ ] T086 [US5] Implement browser HTML export and complete JSON export/atomic empty-collection restore including active/archived bookmarks, descriptions, notes, tags, PNG icons, favorite/read-later/read/archive states, and dates in src/server/services/exports/export-service.ts and src/server/services/imports/restore-service.ts
- [ ] T087 [US5] Implement multipart preview, owned import status/commit, browser export, and complete export routes with 10 MiB upload enforcement in src/server/routes/imports.ts and src/server/routes/exports.ts
- [ ] T088 [P] [US5] Implement the settings data page with format explanation, upload/preview counts and issue samples, confirm/retry/status UI, both download actions, expiry/non-empty restore guidance, and keyboard-accessible feedback in src/client/features/settings/DataPortabilityPage.tsx and src/client/features/imports/ImportPreview.tsx
- [ ] T089 [US5] Implement portability API calls, file/download handling, and state preservation on partial/failure outcomes in src/client/features/imports/import-api.ts and src/client/features/settings/export-api.ts
- [ ] T090 [US5] Run tests/unit/browser-import-parser.test.ts, tests/unit/backup-format.test.ts, tests/contract/portability.test.ts, tests/integration/import-export.test.ts, and tests/e2e/portability.spec.ts including the 1,000-entry import and lossless backup comparison

**Checkpoint**: Existing users can adopt the app and retain verifiable ownership of all collection data.

---

## Phase 8: Polish & Cross-Cutting Validation

**Purpose**: Prove the complete approved feature as one secure, accessible, responsive application and prepare the review runtime.

- [ ] T091 [P] Add deterministic hostile metadata, icon, malformed browser-export, complete-backup, and 1,000-item performance fixtures under tests/fixtures/metadata/, tests/fixtures/icons/, tests/fixtures/imports/, and tests/fixtures/performance/
- [ ] T092 [P] Add shared Content Security Policy, nosniff/referrer/permissions headers, safe download headers, sensitive log redaction, request/upload concurrency limits, and graceful shutdown in src/server/security/headers.ts, src/server/security/redaction.ts, and src/server/index.ts
- [ ] T093 Expand the two-account suite to cover every bookmark, icon, tag suggestion, import preview/status/commit, and export route with no private field/count leakage in tests/integration/account-isolation.test.ts
- [ ] T094 Run keyboard-only and accessibility checks for save, search, read-later, edit, tag suggestions, archive, delete, import, and export; fix findings in src/client/ and record automated coverage in tests/e2e/accessibility.spec.ts
- [ ] T095 Run responsive desktop/mobile acceptance and visual overflow checks for every defined scenario; fix layout findings in src/client/styles/global.css and tests/e2e/responsive.spec.ts
- [ ] T096 Add README setup, review-account, security-boundary, backup, validation, and saved-page-follow-up documentation in README.md without claiming snapshots are implemented
- [ ] T097 Run npm ci, migrations, typecheck, lint, all Vitest/contract suites, production build, and Playwright tests exactly as specs/001-bookmark-manager/quickstart.md specifies; resolve every failure without weakening tests
- [ ] T098 Create /work/.harness/app.json with kind application, port 4000, path /, start_command ["npm","start"], and start_cwd /work after the production build is prepared
- [ ] T099 Start the prepared build through /work/.harness/app.json, verify /api/v1/health, login/review entry, data-harness-ready timing, /work/.harness/runtime/server.log, and the interactions claimed for client review at http://maker:4000/

**Checkpoint**: The complete approved specification is implemented, verified, and ready for client review.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 — Setup**: No dependencies.
- **Phase 2 — Foundation**: Depends on Phase 1 and blocks every user story.
- **Phase 3 — US1**: Depends on Foundation and produces the MVP bookmark collection.
- **Phase 4 — US2**: Depends on Foundation and shared bookmark persistence; can use direct fixtures independently, but follows US1 in the recommended sequence.
- **Phase 5 — US3**: Depends on Foundation and bookmark/tag persistence; it does not require the US2 UI.
- **Phase 6 — US4**: Depends on bookmark CRUD from US1; archive-state preservation integrates with US2.
- **Phase 7 — US5**: Depends on account-scoped bookmark/tag/icon persistence; import can be tested independently with repository fixtures.
- **Phase 8 — Polish**: Depends on every story selected for release.

### User Story Dependency Graph

    Setup → Foundation → US1 (MVP)
                     ├─→ US2
                     ├─→ US3
                     └─→ US5
    US1 + US2 ─────────→ US4
    US1 + US2 + US3 + US4 + US5 → Polish

### Within Each Story

1. Write the story's tests and confirm they fail for the intended missing behavior.
2. Add story-specific schemas/migrations.
3. Implement pure utilities and repositories.
4. Implement services and routes.
5. Implement UI and connect it to the API.
6. Run the story's independent acceptance test before moving on.

## Parallel Opportunities

- T003–T007 can run in parallel after T002 establishes dependencies.
- T008–T011 can be authored in parallel; T014–T015 can proceed alongside database work.
- Within US1, T024–T030 are separable test files; T032–T033 and T035 can proceed in parallel before orchestration.
- US2 and US3 can begin in parallel after Foundation and the bookmark persistence contract are stable.
- Within US4, tag work (T063/T067/T068/T070) and archive UI work (T064/T069/T072) can proceed in parallel.
- Within US5, parser, backup-format, contract, and UI test files can proceed in parallel; T082 and T083 can proceed in parallel before persistence orchestration.
- T091–T092 can proceed in parallel before the final integrated runs.

## Parallel Examples

### User Story 1

    Task T024: URL policy tests
    Task T025: Safe-fetch security tests
    Task T026: Metadata parser tests
    Task T027: Icon normalization tests
    Task T028: API contract tests
    Task T029: Repository integration tests
    Task T030: Save-flow component tests

### User Story 2

    Task T045: Pure state-transition tests
    Task T046: Repository/route tests
    Task T047: Component and acceptance tests

### User Story 3

    Task T052: Query grammar tests
    Task T053: Search repository tests
    Task T054: List contract tests
    Task T055: Search component tests

### User Story 4

    Task T063: Tag-suggestion tests
    Task T064: Maintenance integration tests
    Task T065: Maintenance component tests

### User Story 5

    Task T075: Browser parser tests
    Task T076: Backup format tests
    Task T077: Portability contract tests
    Task T078: Import/export integration tests

## Implementation Strategy

### MVP First

1. Complete Setup.
2. Complete Foundation.
3. Complete User Story 1.
4. Stop and validate the metadata-assisted save MVP independently.

### Incremental Delivery

1. Add US2 and validate the read-later queue.
2. Add US3 and validate retrieval at 1,000 items.
3. Add US4 and validate long-term collection maintenance.
4. Add US5 and validate adoption and data ownership.
5. Complete cross-cutting security, accessibility, responsive, clean-install, and runtime checks.

### Scope Guard

- Saved page snapshots are not included in these tasks.
- Do not add collaboration, teams, browser extensions, live browser synchronization, offline mode, folders, custom sort rules, broken-link monitoring, or page-content full-text indexing.
- Any newly requested behavior must return through the specification and plan gates before implementation.

## Notes

- Every [P] task changes distinct files or is otherwise safe to execute concurrently after its stated prerequisites.
- Every user-story task has a matching [USn] label for traceability.
- Each checkpoint is a valid stopping point for independent verification.
- Implementers should use the contracts and data model rather than inventing new request fields or state meanings.
- All file paths are repository-relative except the required harness file in T098.
