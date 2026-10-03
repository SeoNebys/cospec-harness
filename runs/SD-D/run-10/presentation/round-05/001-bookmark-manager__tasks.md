---

description: "Dependency-ordered implementation tasks for the Bookmark Manager"
---

# Tasks: Bookmark Manager

**Input**: Approved design documents from `specs/001-bookmark-manager/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`

**Tests**: Included because the approved plan explicitly defines unit, contract, integration, security, performance, and Playwright validation. Within each story, create the listed tests first and confirm they fail for the missing behavior before implementation.

**Organization**: Tasks are grouped by user story so each increment can be implemented and demonstrated against its independent acceptance test.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel with adjacent marked tasks because it targets different files and does not depend on their incomplete work.
- **[Story]**: Maps the task to a user story in `spec.md`.
- Every task names its implementation or validation path.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish the one-package TypeScript web application, repeatable commands, and repository layout.

- [X] T001 Create `package.json` and `package-lock.json` with Node 24 engines, production dependencies from `plan.md`, and pinned `@playwright/test@1.61.0`
- [X] T002 Add build, start, development, typecheck, lint, migration, seed, unit, integration, contract, end-to-end, and performance scripts to `package.json`
- [X] T003 [P] Configure strict TypeScript project references for browser, server, shared, and test code in `tsconfig.json`, `tsconfig.client.json`, `tsconfig.server.json`, and `tsconfig.test.json`
- [X] T004 [P] Configure Vite React production output and development API proxy in `vite.config.ts` and create the HTML entry in `index.html`
- [X] T005 [P] Configure ESLint and Prettier with TypeScript/React rules in `eslint.config.js`, `.prettierrc.json`, and `.prettierignore`
- [X] T006 [P] Configure Node/Vitest test projects and coverage boundaries in `vitest.config.ts` and `tests/setup/client.ts`
- [X] T007 [P] Configure Playwright 1.61.0 desktop and phone Chromium projects without browser download in `playwright.config.ts`
- [X] T008 [P] Create the planned source, migration, test, and runtime directory skeleton using tracked placeholders in `src/`, `migrations/`, `tests/`, and `data/.gitkeep`
- [X] T009 [P] Add database, asset, environment, mail-log, coverage, and browser-test outputs to `.gitignore`
- [X] T010 Document npm commands and the single-service development/build shape in `README.md`

**Checkpoint**: Dependencies install from the lockfile and empty typecheck, lint, build, and test commands execute predictably.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Provide configuration, persistence, authentication, API conventions, and the app shell required by every user journey.

**⚠️ CRITICAL**: No user-story implementation begins until this phase passes its checkpoint.

- [X] T011 Create the initial identity migration in `migrations/001_identity.sql` with User fields `email` “maximum 320 characters”, unique `email_normalized`, opaque unique `public_id`, required Argon2id `password_hash`, timestamps, and positive `version`; Session unique `token_hash`, `csrf_secret_hash`, timestamps and indexed `expires_at`; PasswordResetToken unique `token_hash`, required expiry, and nullable `consumed_at`
- [X] T012 Implement SQLite connection setup with foreign keys, WAL, busy timeout, prepared statements, and graceful close in `src/server/db/database.ts`
- [X] T013 Implement transactional ordered migration execution and migration history in `src/server/db/migrate.ts` and `src/server/db/migration-runner.ts`
- [X] T014 [P] Define validated environment configuration for host, port, database, asset directory, origins, secrets, session lifetimes, and mail transport in `src/server/config/schema.ts` and `.env.example`
- [X] T015 [P] Define shared problem documents, pagination, public-ID, timestamp, version, and API-envelope schemas in `src/shared/schemas/common.ts` and `src/shared/types/api.ts`
- [X] T016 [P] Implement structured logging, request IDs, redaction, and central problem-response mapping in `src/server/config/logger.ts` and `src/server/api/errors.ts`
- [X] T017 Implement User, Session, and PasswordResetToken repositories with owner-safe prepared statements in `src/server/repositories/auth-repository.ts`
- [X] T018 Implement Argon2id password hashing, opaque token hashing, session rotation/revocation, generic credential responses, and single-use reset transitions in `src/server/auth/auth-service.ts`
- [X] T019 [P] Implement production SMTP and development/test log-only mail-provider adapters in `src/server/auth/mail-provider.ts`
- [X] T020 Implement cookie flags, session authentication, CSRF binding, Origin/Fetch-Metadata enforcement, and authenticated-user decoration in `src/server/auth/auth-plugin.ts`
- [X] T021 Implement `/api/auth/session`, register, login, logout, reset request, and reset confirmation routes from the HTTP contract in `src/server/api/auth-routes.ts`
- [X] T022 [P] Implement typed same-origin API client, problem parsing, CSRF propagation, and session state in `src/client/app/api-client.ts` and `src/client/features/auth/session-context.tsx`
- [X] T023 [P] Implement accessible registration, login, logout, and generic recovery-request/confirmation views in `src/client/features/auth/AuthPages.tsx` and `src/client/features/auth/auth.css`
- [X] T024 Implement Fastify application composition, `/health/live`, `/health/ready`, Vite output serving, SPA fallback, and `0.0.0.0:4000` startup in `src/server/server.ts` and `src/server/app.ts`
- [X] T025 Implement the responsive authenticated application shell and navigation placeholders for Library, Read Later, Favorites, Archive, Tags, Collections, and Saved Searches in `src/client/app/App.tsx` and `src/client/app/AppShell.tsx`
- [X] T026 Add idempotent non-production review-account seeding for `review@example.test` in `migrations/fixtures/review-user.ts`
- [X] T027 [P] Add unit tests for password, token, session-expiry, and recovery transitions in `tests/unit/auth-service.test.ts`
- [X] T028 Add contract/integration tests for auth, CSRF, generic recovery responses, session rotation/revocation, readiness, and restart persistence in `tests/contract/auth-api.test.ts` and `tests/integration/auth-lifecycle.test.ts`

**Checkpoint**: A user can register, sign in, recover access through the configured provider, sign out, and return after restart; unauthenticated/cross-site state changes fail closed.

---

## Phase 3: User Story 1 — Save a Rich Bookmark with Minimal Typing (Priority: P1) 🎯 MVP

**Goal**: Paste a URL, receive editable title/description/icon/preview proposals, save despite retrieval failure, add a safe formatted note, and reopen/edit the bookmark.

**Independent Test**: Paste a controlled metadata-rich URL, edit every proposed field, save, restart, reopen the detail view, and verify the edited metadata/note; repeat with unreachable and incomplete pages and still save manually.

### Tests for User Story 1

- [X] T029 [P] [US1] Add failing URL normalization and duplicate-comparison cases from `data-model.md` in `tests/unit/url-normalization.test.ts`
- [X] T030 [P] [US1] Add failing metadata precedence, relative URL, partial metadata, redirect, timeout, and fallback tests using controlled fixtures in `tests/unit/metadata-extractor.test.ts` and `tests/fixtures/metadata-server.ts`
- [X] T031 [P] [US1] Add failing SSRF cases for IPv4/IPv6 private ranges, DNS rebinding, redirect hops, credentials, ports, sizes, compression, and MIME mismatch in `tests/unit/safe-fetch.test.ts`
- [X] T032 [P] [US1] Add failing bookmark/metadata/media API contract and rollback tests in `tests/contract/bookmark-capture-api.test.ts` and `tests/integration/bookmark-persistence.test.ts`
- [X] T033 [P] [US1] Add a failing desktop/phone rich-capture, note-rendering, edit, and retrieval-failure journey in `tests/e2e/rich-bookmark.spec.ts`

### Implementation for User Story 1

- [X] T034 [US1] Create Bookmark and MediaAsset tables in `migrations/002_bookmarks_media.sql`: Bookmark `url` “1–4096 characters”, unique-per-user `url_normalized`, `title` “1–300 characters”, `description` “maximum 1,000 characters”, `note_markdown` “maximum 100,000 characters”, derived `note_plain`, nullable owned asset/collection references, boolean favorite, `reading_state` constrained to `none|unread|read`, nullable `archived_at`, timestamps, and positive `version`; MediaAsset `purpose` constrained to `favicon|preview`, `status` to `draft|attached`, unique opaque `storage_key`, allowlisted `mime_type`, positive `byte_size`, digest, timestamps, and draft expiry
- [X] T035 [P] [US1] Implement the exact URL normalization algorithm and user-facing validation errors in `src/server/domain/url-normalization.ts`
- [X] T036 [P] [US1] Implement Markdown-to-plain-text derivation and shared safe note schema with raw HTML disabled in `src/shared/schemas/note.ts` and `src/server/domain/note-text.ts`
- [X] T037 [US1] Implement public-address resolution, per-hop validation, bounded manual redirects, response limits, and safe page/image fetches in `src/server/metadata/safe-fetch.ts`
- [X] T038 [US1] Implement Open Graph, Twitter-card, standard title/description, icon, fallback precedence, provenance, and warning extraction in `src/server/metadata/metadata-extractor.ts`
- [X] T039 [US1] Implement user-owned draft/attached media persistence, MIME sniffing, size limits (“Favicon maximum 1 MiB; preview maximum 5 MiB”), authenticated streaming, promotion, and cleanup bookkeeping in `src/server/media/media-service.ts` and `src/server/repositories/media-repository.ts`
- [X] T040 [US1] Implement Bookmark validation, repository create/get/update transactions, duplicate conflicts across active/archived rows, asset ownership/promotion, version checks, and restart persistence in `src/server/domain/bookmark-service.ts` and `src/server/repositories/bookmark-repository.ts`
- [X] T041 [US1] Implement metadata preview, replacement media capture, authenticated media delivery, and bookmark create/get/patch routes from the contract in `src/server/api/metadata-routes.ts`, `src/server/api/media-routes.ts`, and `src/server/api/bookmark-routes.ts`
- [X] T042 [P] [US1] Implement a toolbar-assisted Markdown editor and sanitized preview supporting only paragraphs, headings, bold, italics, bulleted/numbered lists, and safe links in `src/client/components/NoteEditor.tsx` and `src/client/components/FormattedNote.tsx`
- [X] T043 [P] [US1] Implement bookmark cards with stable visual fallbacks, destination opening, metadata states, and detail navigation in `src/client/features/bookmarks/BookmarkCard.tsx` and `src/client/features/bookmarks/bookmark-card.css`
- [X] T044 [US1] Implement the add/edit form with automatic preview, field-level provenance/warnings, retry, user-edit preservation, visual replacement/removal, note editing, and manual-save fallback in `src/client/features/bookmarks/BookmarkEditor.tsx`
- [X] T045 [US1] Implement active-library pagination, bookmark detail, edit flow, URL opening, loading, and valid empty state in `src/client/pages/LibraryPage.tsx` and `src/client/pages/BookmarkDetailPage.tsx`
- [X] T046 [US1] Make T029–T033 pass and record the representative metadata timing evidence for SC-001–SC-003 in `tests/results/us1-rich-capture.md`

**Checkpoint**: User Story 1 is deployable as the MVP and passes its independent test without any tag, archive, search, or bulk feature.

---

## Phase 4: User Story 2 — Keep a Read-Later Queue (Priority: P2)

**Goal**: Keep an unread queue independent from favorite state and remove items from it by marking them read without deleting them.

**Independent Test**: Add bookmarks to Read Later, favorite one, mark it read and unread again, and verify queue membership changes while library/favorite membership remains correct.

### Tests for User Story 2

- [ ] T047 [P] [US2] Add failing reading-state transition and favorite-independence unit/API tests in `tests/unit/reading-state.test.ts` and `tests/contract/read-later-api.test.ts`
- [ ] T048 [P] [US2] Add a failing desktop/phone Read Later journey and 20-second usability timing hooks in `tests/e2e/read-later.spec.ts`

### Implementation for User Story 2

- [ ] T049 [US2] Implement `none → unread`, `unread → read`, and `read → unread` transitions without changing favorite/archive state in `src/server/domain/bookmark-state-service.ts`
- [ ] T050 [US2] Extend bookmark listing/patch schemas and repository predicates for `reading=any|none|unread|read`, with Read Later fixed to active unread items, in `src/shared/contracts/bookmarks.ts` and `src/server/repositories/bookmark-repository.ts`
- [ ] T051 [US2] Implement Read Later navigation, counts, mark-read/unread controls, optimistic feedback, and empty state in `src/client/pages/ReadLaterPage.tsx` and `src/client/features/bookmarks/ReadingStateButton.tsx`
- [ ] T052 [US2] Make T047–T048 pass and document SC-004 evidence in `tests/results/us2-read-later.md`

**Checkpoint**: Read Later can be demonstrated independently on prepared bookmarks and never changes favorite status or deletes content.

---

## Phase 5: User Story 3 — Organize with Tags and Optional Collections (Priority: P2)

**Goal**: Make reusable many-to-many tags the primary organizer, offer existing-tag suggestions, keep collections optional/single-valued, and support favorites, merge, and safe deletion.

**Independent Test**: Apply multiple suggested tags without a collection, optionally add one collection, browse every tag, favorite the bookmark, and verify merge/delete/unfile behavior preserves bookmarks and unrelated state.

### Tests for User Story 3

- [ ] T053 [P] [US3] Add failing tag normalization, case/whitespace collision, merge, deletion-impact, and search-projection preparation tests in `tests/unit/tag-service.test.ts`
- [ ] T054 [P] [US3] Add failing tag/collection/favorite API ownership, version, count-change, and preservation tests in `tests/contract/organization-api.test.ts`
- [ ] T055 [P] [US3] Add a failing tag suggestions, multi-tag, optional-collection, favorite, merge, and unfile browser journey in `tests/e2e/organization.spec.ts`

### Implementation for User Story 3

- [ ] T056 [US3] Create Collection, Tag, and BookmarkTag tables in `migrations/003_organization.sql`: Collection `name` “1–120 characters” with unique `(user_id, name_normalized)` and positive `version`; Tag `name` “1–64 characters”, must not begin with `#`, unique `(user_id, name_normalized)`, and positive `version`; BookmarkTag composite primary key `(bookmark_id, tag_id)` with cascade deletes, required timestamp, matching-owner enforcement, and “at most 50 tags” per bookmark
- [ ] T057 [P] [US3] Implement Collection repository CRUD, deletion impact, version checks, and confirmed unfile transaction preserving tags in `src/server/repositories/collection-repository.ts`
- [ ] T058 [P] [US3] Implement Tag repository CRUD, case-insensitive prefix suggestions, recent-use/name ordering, join maintenance, and impact counts in `src/server/repositories/tag-repository.ts`
- [ ] T059 [US3] Implement tag reuse, 50-tag validation, confirmed merge/delete transactions, saved-search-compatible stable IDs, collection ownership, and favorite independence in `src/server/domain/organization-service.ts`
- [ ] T060 [US3] Implement tag list/suggest/create/rename/merge/impact/delete and collection list/create/rename/impact/delete endpoints in `src/server/api/tag-routes.ts` and `src/server/api/collection-routes.ts`
- [ ] T061 [P] [US3] Implement accessible multi-tag entry with debounced owned-tag suggestions, keyboard selection, duplicate prevention, and removable chips in `src/client/features/tags/TagInput.tsx`
- [ ] T062 [P] [US3] Implement optional collection picker and independent favorite toggle in `src/client/features/collections/CollectionPicker.tsx` and `src/client/features/bookmarks/FavoriteButton.tsx`
- [ ] T063 [US3] Implement Tags and Collections management pages with counts, merge/unfile impact confirmations, and bookmark-preserving outcomes in `src/client/pages/TagsPage.tsx` and `src/client/pages/CollectionsPage.tsx`
- [ ] T064 [US3] Make T053–T055 pass and document SC-008 timing/equivalence evidence in `tests/results/us3-organization.md`

**Checkpoint**: Multiple tags work everywhere in this story without a collection; adding/removing the optional collection never changes tags.

---

## Phase 6: User Story 4 — Archive Without Losing a Bookmark (Priority: P2)

**Goal**: Reversibly hide bookmarks from active views and provide separate permanent deletion with explicit confirmation.

**Independent Test**: Archive an unread favorite with metadata/note/tags/collection, verify active exclusion and archive inclusion, restore every field/state, then cancel and confirm permanent deletion on a separate item.

### Tests for User Story 4

- [ ] T065 [P] [US4] Add failing archive/restore/permanent-delete state, version, duplicate, and preservation tests in `tests/unit/archive-state.test.ts` and `tests/contract/archive-api.test.ts`
- [ ] T066 [P] [US4] Add a failing archive search, restore, cancellation, and irreversible-delete browser journey in `tests/e2e/archive.spec.ts`

### Implementation for User Story 4

- [ ] T067 [US4] Implement versioned archive/restore transitions that preserve metadata, notes, tags, optional collection, favorite, and reading state, plus confirmed permanent deletion/media dereference in `src/server/domain/archive-service.ts`
- [ ] T068 [US4] Implement archive/restore/delete endpoints and active-versus-archive listing predicates with archived rows retained in duplicate detection in `src/server/api/archive-routes.ts` and `src/server/repositories/bookmark-repository.ts`
- [ ] T069 [P] [US4] Implement archive/restore actions and an exact-language irreversible delete dialog with cancel path in `src/client/features/bookmarks/ArchiveActions.tsx` and `src/client/components/PermanentDeleteDialog.tsx`
- [ ] T070 [US4] Implement the separate searchable/filter-ready Archive page and ensure main, Favorites, and Read Later pages exclude archived rows in `src/client/pages/ArchivePage.tsx`, `src/client/pages/LibraryPage.tsx`, `src/client/pages/FavoritesPage.tsx`, and `src/client/pages/ReadLaterPage.tsx`
- [ ] T071 [US4] Make T065–T066 pass and document full-state round-trip evidence for SC-005 in `tests/results/us4-archive.md`

**Checkpoint**: Archive is visibly reversible and separate from permanent deletion; an archived unread item returns to Read Later only after restore.

---

## Phase 7: User Story 5 — Find Bookmarks with Precise Search (Priority: P3)

**Goal**: Search ordinary terms, exact tags, phrases, and Boolean expressions with agreed precedence, then combine them with filters and stable sorting in active or archive context.

**Independent Test**: Run the conformance table in `contracts/search-syntax.md` plus filters/sorts against a known dataset and verify exact results, preserved invalid input, and actionable errors.

### Tests for User Story 5

- [ ] T072 [P] [US5] Add failing lexer/parser/AST tests for words, phrases, `#tag`, quoted operator text, implicit AND, `NOT > AND > OR`, offsets, and every conformance example in `tests/unit/search-parser.test.ts`
- [ ] T073 [P] [US5] Add failing parameterization, owner/context, field, tag, include/exclude, collection, favorite, reading, sort, cursor, and projection-consistency tests in `tests/integration/search-repository.test.ts`
- [ ] T074 [P] [US5] Add failing API error-preservation and desktop/phone search/filter/sort journeys in `tests/contract/search-api.test.ts` and `tests/e2e/search.spec.ts`

### Implementation for User Story 5

- [ ] T075 [US5] Create the FTS5 BookmarkSearch projection in `migrations/004_search.sql` with `rowid = Bookmark.id` and indexed `title`, `url`, `description`, `note`, and aggregated `tags` columns plus rebuild metadata
- [ ] T076 [P] [US5] Implement the contract lexer and recursive-descent parser with maximum “2,000 Unicode characters”, exact offsets, no parentheses/wildcards, quoted operator literals, and `NOT > AND > OR` precedence in `src/server/search/lexer.ts` and `src/server/search/parser.ts`
- [ ] T077 [P] [US5] Define shared SearchCriteria validation for owned tag/collection filters, `active|archive` context, reading/favorite enums, stable sort enum, and cursor limits in `src/shared/contracts/search.ts`
- [ ] T078 [US5] Implement AST-to-parameterized-SQL compilation with FTS leaves, exact normalized tag leaves, recursive Boolean predicates, and no raw FTS forwarding in `src/server/search/sql-compiler.ts`
- [ ] T079 [US5] Implement transactional FTS create/update/tag-change/merge/delete/rebuild consistency in `src/server/search/search-index-service.ts` and integrate it into `src/server/domain/bookmark-service.ts` and `src/server/domain/organization-service.ts`
- [ ] T080 [US5] Implement owner/context-filtered search, included/excluded tags, collection/favorite/reading filters, stable sort tie-breakers, cursors, and totals in `src/server/repositories/search-repository.ts`
- [ ] T081 [US5] Extend `GET /api/bookmarks` with the complete search contract and structured `invalid-search` problems preserving query text in `src/server/api/bookmark-routes.ts`
- [ ] T082 [US5] Implement responsive search entry, direct-tag/operator help, error spans, filter controls, active chips, clear actions, sort, and no-match state in `src/client/features/search/SearchBar.tsx`, `src/client/features/search/SearchFilters.tsx`, and `src/client/pages/SearchResultsPage.tsx`
- [ ] T083 [US5] Make T072–T074 pass, seed 10,000 bookmarks, and record the 95%-within-1-second SC-006/SC-007 evidence in `tests/performance/search-performance.test.ts` and `tests/results/us5-search.md`

**Checkpoint**: The shared conformance suite produces identical membership for direct searches, restored searches, and later bulk all-matches selections.

---

## Phase 8: User Story 6 — Save and Reuse a Search (Priority: P3)

**Goal**: Persist a named live query/filter/context/sort configuration and reopen, rename, update, or delete it without changing bookmarks.

**Independent Test**: Save included/excluded tags plus search/filter/sort criteria, mutate the library, reopen the saved search, and verify the restored configuration evaluates current results.

### Tests for User Story 6

- [ ] T084 [P] [US6] Add failing saved-search normalization, unique-name, tag rename/delete, live-count, version, and ownership tests in `tests/unit/saved-search-service.test.ts` and `tests/contract/saved-search-api.test.ts`
- [ ] T085 [P] [US6] Add a failing create/open/update/rename/delete and current-results browser journey in `tests/e2e/saved-searches.spec.ts`

### Implementation for User Story 6

- [ ] T086 [US6] Create SavedSearch and SavedSearchTag tables in `migrations/005_saved_searches.sql`: SavedSearch `name` “1–120 characters” with unique `(user_id, name_normalized)`, `query_text` “maximum 2,000 characters; empty allowed”, owned nullable collection, favorite filter `any|favorite|not_favorite`, reading filter `any|none|unread|read`, context `active|archive`, sort `newest|oldest|title|updated`, timestamps and positive `version`; SavedSearchTag composite `(saved_search_id, tag_id)` with polarity `include|exclude` and no tag in both polarities
- [ ] T087 [P] [US6] Implement SavedSearch and SavedSearchTag persistence, stable tag identity, collection-null-on-delete, and live match counts in `src/server/repositories/saved-search-repository.ts`
- [ ] T088 [US6] Implement criteria validation through the shared parser, unique names, versioned rename/update, and bookmark-independent deletion in `src/server/domain/saved-search-service.ts`
- [ ] T089 [US6] Implement saved-search list/create/get/patch/delete routes from the contract in `src/server/api/saved-search-routes.ts`
- [ ] T090 [P] [US6] Implement save-current-search and edit dialogs with included/excluded tag summaries and unique-name errors in `src/client/features/saved-searches/SaveSearchDialog.tsx`
- [ ] T091 [US6] Implement Saved Searches navigation with live counts, open/restore, rename/update/delete actions, and empty state in `src/client/pages/SavedSearchesPage.tsx`
- [ ] T092 [US6] Make T084–T085 pass and document live-versus-frozen result evidence in `tests/results/us6-saved-searches.md`

**Checkpoint**: Reopening a saved search restores the exact configuration and evaluates current library state; changing it never mutates a bookmark.

---

## Phase 9: User Story 7 — Tidy Many Bookmarks at Once (Priority: P3)

**Goal**: Select explicit bookmarks or every current match, show exact counts, apply supported bulk actions, and reconfirm changed destructive/archive selections.

**Independent Test**: Select all results spanning pages, run every action, verify exact accounting, then change a dynamic match set after preview and confirm archive/delete performs no mutation until reconfirmed.

### Tests for User Story 7

- [ ] T093 [P] [US7] Add failing explicit/all-match resolution, eligibility, criteria digest, expiry, single-use, changed-count, rollback, and per-item-result tests in `tests/unit/bulk-service.test.ts`
- [ ] T094 [P] [US7] Add failing bulk preview/execute contract, ownership, CSRF, tag-index update, and 1,000-item accounting tests in `tests/contract/bulk-api.test.ts` and `tests/performance/bulk-performance.test.ts`
- [ ] T095 [P] [US7] Add a failing multi-page selection, all-matches count, action, result-summary, changed-count, and permanent-delete confirmation journey in `tests/e2e/bulk-actions.spec.ts`

### Implementation for User Story 7

- [ ] T096 [US7] Create BulkConfirmation in `migrations/006_bulk_confirmations.sql` with user ownership, unique `token_hash`, action `archive|restore|delete`, server-normalized `selection_json`, criteria digest, nonnegative `expected_count`, required timestamps/expiry, nullable `consumed_at`, and single-use semantics
- [ ] T097 [P] [US7] Define explicit-ID/expected-version and full SearchCriteria selection schemas plus tag/read/favorite/archive/restore/delete action unions in `src/shared/contracts/bulk.ts`
- [ ] T098 [US7] Implement owned selection resolution, exact eligible/ineligible counts, user/action/criteria-bound token hashing, transactional count recheck, single-use consumption, bounded updates, index refresh, and item-level outcomes in `src/server/domain/bulk-service.ts` and `src/server/repositories/bulk-repository.ts`
- [ ] T099 [US7] Implement `/api/bookmarks/bulk/preview` and `/execute` with `selection_changed` no-mutation conflicts and exact response accounting in `src/server/api/bulk-routes.ts`
- [ ] T100 [P] [US7] Implement explicit row/card selection, page selection, all-current-matches promotion, persistent exact count, and clear-selection behavior in `src/client/features/bulk-actions/SelectionController.tsx`
- [ ] T101 [US7] Implement responsive bulk toolbar, tag/read/favorite/archive/restore actions, exact-count irreversible-delete confirmation, changed-count reconfirmation, and outcome summary in `src/client/features/bulk-actions/BulkActionBar.tsx` and `src/client/features/bulk-actions/BulkResultDialog.tsx`
- [ ] T102 [US7] Make T093–T095 pass and record complete 1,000-item accounting and reconfirmation evidence for SC-009 in `tests/results/us7-bulk.md`

**Checkpoint**: Bulk actions affect exactly the reported owned selection; a stale dynamic archive/delete preview changes nothing until the user confirms the refreshed count.

---

## Phase 10: User Story 8 — Access a Private Library Across Sessions (Priority: P4)

**Goal**: Complete account recovery, cross-session persistence, resource privacy, and visible stale-edit handling across every resource added by earlier stories.

**Independent Test**: Create disjoint data in two accounts, restart/sign out/sign in, verify every resource remains correct and cross-account access fails uniformly, then submit a stale edit from a second session and recover an account once.

### Tests for User Story 8

- [ ] T103 [P] [US8] Add a failing cross-account matrix for bookmark, media, tag, collection, saved search, bulk selection, and enumeration-safe `404` behavior in `tests/integration/ownership-matrix.test.ts`
- [ ] T104 [P] [US8] Add failing restart/sign-out persistence, reset-token single use, all-session revocation, and generic existing/nonexistent recovery behavior in `tests/integration/account-persistence.test.ts`
- [ ] T105 [P] [US8] Add failing two-session stale bookmark/tag/collection/saved-search update scenarios in `tests/integration/optimistic-concurrency.test.ts`
- [ ] T106 [P] [US8] Add a failing two-account, restart, recovery, and browser-visible conflict journey in `tests/e2e/privacy-persistence.spec.ts`

### Implementation for User Story 8

- [ ] T107 [US8] Audit and enforce authenticated `user_id` in every resource lookup/mutation and normalize foreign/not-found behavior in `src/server/repositories/` and `src/server/api/`
- [ ] T108 [US8] Complete version increments and `stale_version` current-representation responses for Bookmark, Tag, Collection, and SavedSearch mutations in `src/server/domain/` and `src/shared/contracts/`
- [ ] T109 [P] [US8] Implement reusable stale-edit conflict UI that preserves unsaved input and offers reload/current comparison in `src/client/components/StaleVersionDialog.tsx`
- [ ] T110 [US8] Complete authenticated-route restoration, sign-out clearing, recovery completion, and current-user-only caches in `src/client/features/auth/session-context.tsx` and `src/client/app/api-client.ts`
- [ ] T111 [US8] Make T103–T106 pass and document 100% privacy denial plus sign-out/sign-in persistence evidence for SC-010–SC-011 in `tests/results/us8-privacy.md`

**Checkpoint**: Every v1 resource is private, persistent, revocable, and protected from silent stale-session overwrites.

---

## Phase 11: Polish and Cross-Cutting Validation

**Purpose**: Finish security, accessibility, responsive behavior, observability, cleanup, performance evidence, and runtime presentation across the complete v1.

- [ ] T112 [P] Add distinct actionable Library, Archive, Read Later, no-match, metadata-failure, invalid-input, partial-bulk, offline-request, and fatal-startup states in `src/client/components/StatePanel.tsx` and each page under `src/client/pages/`
- [ ] T113 [P] Complete responsive layouts, touch targets, overflow handling, and phone/desktop visual consistency in `src/client/styles/responsive.css` and feature CSS files under `src/client/`
- [ ] T114 [P] Complete keyboard navigation, focus restoration, dialog trapping, labels, landmarks, and live error/status announcements in components under `src/client/`
- [ ] T115 Add metadata/login/recovery throttling, security headers, request/body limits, safe outbound user agent, and sensitive-log redaction in `src/server/config/security.ts` and `src/server/app.ts`
- [ ] T116 Implement idempotent periodic cleanup for expired sessions, reset tokens, bulk confirmations, draft media, and grace-period unreferenced assets in `src/server/domain/cleanup-service.ts`
- [ ] T117 [P] Add database/search-index integrity, asset-directory, cleanup, and structured operational event checks in `src/server/domain/maintenance-service.ts` and `src/server/config/logger.ts`
- [ ] T118 Add the complete controlled SSRF, malicious Markdown/link, CSRF, session fixation/replay, media ownership, and SQL/FTS injection regression suite in `tests/integration/security-regression.test.ts`
- [ ] T119 Add deterministic 10,000-bookmark/1,000-bulk benchmark fixtures and percentile reporting in `tests/performance/fixtures.ts` and `tests/performance/report.ts`
- [ ] T120 [P] Add accessible phone/desktop visual snapshots for all primary pages, dialogs, and valid empty states in `tests/e2e/visual-regression.spec.ts`
- [ ] T121 Add application-wide Playwright coverage for all eight quickstart acceptance walkthroughs in `tests/e2e/full-acceptance.spec.ts`
- [ ] T122 Configure production environment validation, migration-before-ready behavior, graceful shutdown, and database-plus-assets backup guidance in `src/server/config/production.ts` and `docs/operations.md`
- [ ] T123 Verify clean `npm ci`, typecheck, lint, unit, integration, contract, security, performance, Playwright, build, and foreground `npm start` execution and record results in `tests/results/final-validation.md`
- [ ] T124 Verify `http://maker:4000/` and VM capture at `http://127.0.0.1:4000/`, adding `data-harness-ready="true"` only after session plus initial valid UI/data load in `src/client/app/App.tsx`
- [ ] T125 Write the verified application runtime manifest with `npm start`, `/work`, port 4000, and `/` entry path in `.harness/app.json`
- [ ] T126 Reconcile implemented behavior and documentation against every FR/SC and execute every step in `specs/001-bookmark-manager/quickstart.md`, recording any approved deviations in `specs/001-bookmark-manager/implementation-notes.md`

**Checkpoint**: The full first release satisfies the approved specification, starts through the harness contract, and has reproducible evidence for functional, privacy, security, responsiveness, and scale outcomes.

---

## Dependencies and Execution Order

### Phase Dependencies

```text
Phase 1 Setup
    ↓
Phase 2 Foundation (blocks every story)
    ↓
US1 Rich Capture (MVP bookmark core)
    ├──→ US2 Read Later ───────────────┐
    ├──→ US3 Tags/Collections ─────────┤
    └──→ US4 Archive/Delete ───────────┤
                                       ↓
                              US5 Precise Search
                                       ↓
                              US6 Saved Searches
                                       ↓
                              US7 Bulk Actions
                                       ↓
                              US8 Privacy Completion
                                       ↓
                              Phase 11 Polish/Validation
```

- **Setup** has no prerequisite.
- **Foundation** requires Setup and blocks user-story work.
- **US1** requires Foundation and establishes the Bookmark/Media core.
- **US2**, **US3**, and **US4** require US1; their isolated domain/UI work can proceed in parallel after it.
- **US5** requires US1–US4 so its filters, tag terms, archive context, and search projection cover the complete bookmark state.
- **US6** requires US5 because saved searches persist and rerun its exact criteria.
- **US7** requires US2–US5 because every approved action and all-matches selection must be available.
- **US8** has an early authentication slice in Foundation but completes after US7 so its privacy/concurrency matrix covers every v1 resource.
- **Polish** requires all selected stories; T112–T120 may begin once the affected components/services stabilize, while T121–T126 require the full release.

### Within Each User Story

1. Create the story's tests and verify failure for missing behavior.
2. Apply migrations/models before repositories.
3. Implement domain services before routes.
4. Implement routes/shared contracts before final client integration.
5. Make the story tests pass and record its acceptance evidence.

## Parallel Opportunities by User Story

### User Story 1

```text
Parallel tests: T029, T030, T031, T032, T033
Parallel implementation after migration: T035 + T036; T042 + T043
Sequential spine: T034 → T037 → T038/T039 → T040 → T041 → T044/T045 → T046
```

### User Story 2

```text
Parallel tests: T047, T048
Sequential implementation: T049 → T050 → T051 → T052
```

### User Story 3

```text
Parallel tests: T053, T054, T055
Parallel repositories after migration: T057, T058
Parallel client components after API: T061, T062
Sequential integration: T056 → T059 → T060 → T063 → T064
```

### User Story 4

```text
Parallel tests: T065, T066
Parallel UI after API: T069 while T070 page shell begins
Sequential domain spine: T067 → T068 → T070 → T071
```

### User Story 5

```text
Parallel tests: T072, T073, T074
Parallel foundations after migration: T076, T077
Sequential search spine: T075 → T078 → T079 → T080 → T081 → T082 → T083
```

### User Story 6

```text
Parallel tests: T084, T085
Parallel repository/UI-dialog work after migration and contract stabilization: T087, T090
Sequential spine: T086 → T088 → T089 → T091 → T092
```

### User Story 7

```text
Parallel tests: T093, T094, T095
Parallel shared contract and UI selection work after migration: T097, T100
Sequential safety spine: T096 → T098 → T099 → T101 → T102
```

### User Story 8

```text
Parallel tests: T103, T104, T105, T106
Parallel implementation after the audit: T109 while T108 completes server conflict payloads
Sequential completion: T107 → T108/T109 → T110 → T111
```

## Implementation Strategy

### MVP First

1. Complete Phase 1 Setup.
2. Complete Phase 2 Foundation.
3. Complete Phase 3 User Story 1.
4. Stop and demonstrate rich capture, manual fallback, notes, persistence, opening, and editing.

This MVP is intentionally narrower than the approved v1 but delivers the core save/revisit value independently.

### Incremental Delivery

1. Add US2, US3, and US4 as independently reviewable state/organization increments.
2. Add US5 only after all searchable fields and states exist.
3. Add US6 on top of the shared search criteria.
4. Add US7 after every supported bulk action exists individually.
5. Complete US8's cross-resource privacy/concurrency verification.
6. Run the final cross-cutting phase and publish only after T123–T126 pass.

### Scope Guard

Browser bookmark import/export, browser extensions, offline access, full-page content snapshots, sharing, public profiles, and collaboration are intentionally absent. Do not introduce their schemas, routes, UI, or tasks without returning through the specification and plan gates.

## Task Summary

- Setup: 10 tasks
- Foundation: 18 tasks
- US1 Rich Capture: 18 tasks
- US2 Read Later: 6 tasks
- US3 Tags and Collections: 12 tasks
- US4 Archive and Delete: 7 tasks
- US5 Precise Search: 12 tasks
- US6 Saved Searches: 9 tasks
- US7 Bulk Actions: 10 tasks
- US8 Privacy and Persistence: 9 tasks
- Polish and Cross-Cutting Validation: 15 tasks
- **Total: 126 tasks**
