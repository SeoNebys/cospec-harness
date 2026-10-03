---

description: "Dependency-ordered implementation tasks for bookmark management"
---

# Tasks: Bookmark Management

**Input**: Approved design documents from `specs/001-bookmark-management/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`

**Tests**: Included because the approved plan defines contract, integration, browser, security, accessibility, and performance evidence for the specification's measurable outcomes. Story tests are written first and observed failing before implementation.

**Organization**: Tasks are grouped by user story so each story can be implemented and validated as an incremental slice.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it uses different files and does not depend on an incomplete task in the same phase.
- **[Story]**: Maps the task to a user story in `spec.md`.
- Every task names the file or directory it changes.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create the application skeleton, pinned toolchain, commands, and shared configuration without implementing product behavior.

- [ ] T001 Scaffold the Next.js 16 App Router TypeScript application and base npm scripts (`dev`, `build`, `start` binding `0.0.0.0:4000`, `lint`, `typecheck`) in package.json and src/app/layout.tsx
- [ ] T002 Pin runtime dependencies from plan.md and generate package-lock.json, including React 19, Better Auth, Drizzle, better-sqlite3, Zod, Cheerio, react-markdown, remark-gfm, rehype-sanitize, Sharp, and the guarded HTTP-client dependencies in package.json
- [ ] T003 [P] Configure strict TypeScript, Next.js, path aliases, and server-only module boundaries in tsconfig.json and next.config.ts
- [ ] T004 [P] Configure ESLint and formatting rules for TypeScript, React, imports, accessibility, and generated artifacts in eslint.config.mjs and .prettierrc.json
- [ ] T005 [P] Pin Playwright 1.61.0 and configure Vitest, React Testing Library, browser projects, test web server, and coverage thresholds in vitest.config.ts, playwright.config.ts, and tests/setup.ts
- [ ] T006 [P] Define validated environment settings for trusted base URL, auth secret, SQLite path, icon path, email transport, and metadata limits in .env.example and src/lib/config.ts
- [ ] T007 [P] Create the planned feature-oriented source/test directories with module entry points in src/features/bookmarks/index.ts, src/lib/db/index.ts, src/lib/auth/index.ts, and tests/README.md
- [ ] T008 [P] Establish mobile-first design tokens, global focus styles, typography, layout primitives, and reduced-motion behavior in src/styles/tokens.css, src/app/globals.css, and src/components/ui/index.ts

**Checkpoint**: The empty project installs, lints, type-checks, tests, and builds with pinned dependencies.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Implement shared persistence, identity, security, error, and shell infrastructure required by every user story.

**Critical**: No user-story implementation begins until this phase passes its checkpoint.

- [ ] T009 Configure the SQLite connection with `foreign_keys=ON`, WAL mode, a nonzero busy timeout, safe close behavior, and test database injection in src/lib/db/client.ts
- [ ] T010 [P] Define Better Auth-owned User, Session, Account, and Verification tables through the Drizzle adapter without application-side mutation of auth records in src/lib/db/auth-schema.ts
- [ ] T011 Define Bookmark, Tag, BookmarkTag, BookmarkSearch, and IconAsset schema in src/lib/db/schema.ts with the data-model constraints verbatim: URL max 4,096 HTTP(S) characters and no credentials; title 1–500; description max 2,000; note max 50,000; tag 1–64; at most 50 tags per bookmark; reading state `none|unread|read`; metadata status `complete|partial|failed|not_requested`; unique `(user_id, normalized_url)` across active and archived items; unique `(user_id, normalized_name)`; and owner/view/sort indexes
- [ ] T012 Create the initial checked-in migrations for auth/domain tables, foreign keys, uniqueness/indexes, FTS5 BookmarkSearch, and transactional index rebuild support in src/lib/db/migrations/0001_initial.sql and scripts/migrate.ts
- [ ] T013 [P] Implement deterministic review-data and two-account seed tooling without production credentials in scripts/seed-review.ts and src/lib/db/seed.ts
- [ ] T014 Configure Better Auth email/password registration, verified accounts, Argon2id password hooks, opaque database sessions, session rotation/revocation, and generic recovery responses in src/lib/auth/server.ts and src/lib/auth/client.ts
- [ ] T015 [P] Implement the `EmailSender` boundary with production SMTP/provider configuration and local/test capture that is disabled in production in src/lib/email/email-sender.ts, src/lib/email/smtp-sender.ts, and src/lib/email/test-sender.ts
- [ ] T016 Expose Better Auth handlers and trusted reset URLs in src/app/api/auth/[...all]/route.ts and src/lib/auth/recovery.ts
- [ ] T017 [P] Build accessible sign-up, sign-in, sign-out, forgot-password, reset-password, and verification screens with generic recovery feedback in src/app/(auth)/ and src/components/forms/auth-form.tsx
- [ ] T018 Centralize session verification and owner-scoped data access so bookmark/tag repositories cannot query by resource ID without `userId` in src/lib/auth/session.ts and src/lib/db/repositories/owned-repository.ts
- [ ] T019 Implement session-bound CSRF issuance/validation plus exact-origin and Fetch Metadata checks for every unsafe application route in src/lib/security/csrf.ts and src/lib/http/guard-request.ts
- [ ] T020 [P] Define RFC 9457-style problem responses, field-error preservation, request IDs, and privacy-safe structured logging in src/lib/http/problem.ts and src/lib/observability/logger.ts
- [ ] T021 [P] Configure CSP, production HSTS, `nosniff`, frame denial, referrer policy, and private/no-store behavior for authenticated responses in next.config.ts and src/lib/security/headers.ts
- [ ] T022 Build the authenticated responsive application shell with navigation for Bookmarks, Unread, Archive, and Sign out in src/app/(bookmarks)/layout.tsx and src/components/layout/app-shell.tsx
- [ ] T023 [P] Create reusable loading, error, retry, confirmation-dialog, toast/status-announcement, and actionable empty-state primitives in src/components/ui/async-state.tsx, src/components/ui/confirm-dialog.tsx, and src/components/ui/empty-state.tsx
- [ ] T024 [P] Create isolated migrated SQLite, authenticated request, CSRF, two-user, email-capture, and hostile metadata-server fixtures in tests/fixtures/database.ts, tests/fixtures/auth.ts, tests/fixtures/email.ts, and tests/fixtures/metadata-sites/server.ts
- [ ] T025 Verify foundation behavior with failing-first integration tests for registration, verification, login/logout, generic single-use password recovery, session revocation, CSRF, security headers, and cross-user denial in tests/integration/auth.test.ts and tests/integration/security-boundary.test.ts

**Checkpoint**: Accounts, sessions, recovery, migrations, owner scoping, CSRF, headers, reusable page states, and test fixtures work; all story phases are unblocked.

---

## Phase 3: User Story 1 - Save a Bookmark with Page Details (Priority: P1) — MVP

**Goal**: A user pastes a public web address, receives editable title/description/icon proposals without being blocked by slow or inaccessible pages, saves the bookmark, returns later, opens it safely, and is redirected to an existing active or archived duplicate.

**Independent Test**: Enter one fixture URL, review fetched details, edit title/description, save, sign out/in, open it, change its address without overwriting edited text, test a blocked/slow page fallback, and try saving the same normalized URL while active and archived.

### Tests for User Story 1

- [ ] T026 [P] [US1] Write failing unit tests for conservative URL normalization, scheme completion, credentials/scheme rejection, fragment/query preservation, fallback titles, and normalization-version stability in tests/unit/url-normalizer.test.ts
- [ ] T027 [P] [US1] Write failing security tests for private/reserved IPv4/IPv6, mixed DNS answers, DNS rebinding, redirect revalidation/cycles, timeout, two-MiB decompressed HTML limit, invalid MIME, and no forwarded credentials in tests/integration/metadata-security.test.ts
- [ ] T028 [P] [US1] Write failing unit/integration tests for metadata precedence, missing/blocked/slow-page partial results, five-second bounded fallback, icon 256-KiB and 512×512 limits, raster re-encoding, and generic-icon fallback in tests/unit/metadata-parser.test.ts and tests/integration/icon-service.test.ts
- [ ] T029 [P] [US1] Write failing contract tests for POST `/api/metadata/preview`, POST `/api/bookmarks`, GET/PATCH `/api/bookmarks/{id}`, GET `/api/bookmarks/{id}/icon`, 422 validation, and duplicate 409 shapes in tests/contract/bookmark-capture.test.ts
- [ ] T030 [P] [US1] Write the failing browser scenario for URL-only capture, editable proposals, graceful non-blocking retrieval failure, persistence, safe new-tab opening, edited-text preservation, duplicate navigation, and the friendly new-collection state in tests/e2e/bookmark-capture.spec.ts

### Implementation for User Story 1

- [ ] T031 [P] [US1] Implement shared URL/title/description/tag validation with URL 4,096, title 1–500, description 2,000, tag 1–64, and 50-tag limits in src/features/bookmarks/validation.ts
- [ ] T032 [P] [US1] Implement versioned conservative URL normalization while preserving meaningful path case, trailing slash, query order/content, and fragments in src/features/bookmarks/url-normalizer.ts
- [ ] T033 [US1] Implement the pinned-DNS guarded HTTP client with public-address validation, manual five-hop redirects, five-second wall time, streaming byte limits, fixed headers, rate/concurrency limits, and no credential forwarding in src/lib/http/safe-fetch.ts
- [ ] T034 [US1] Parse bounded static HTML without executing page code and produce Open Graph/standard metadata with deterministic fallback title and partial warnings in src/features/bookmarks/metadata-service.ts
- [ ] T035 [US1] Fetch icons through the guarded client, validate raster signatures, reject SVG/XML, re-encode a static 64×64 PNG, content-address files, and supply a generic domain icon in src/features/bookmarks/icon-service.ts and src/app/api/bookmarks/[bookmarkId]/icon/route.ts
- [ ] T036 [US1] Implement owner-scoped create/get/update repository methods, unique-conflict resolution across active/archive, editable-source flags, and persisted metadata/icon references in src/lib/db/repositories/bookmark-repository.ts
- [ ] T037 [US1] Implement bookmark capture/update orchestration so retrieval failure never blocks saving, address changes preserve user-edited text unless explicitly accepted, and duplicate conflicts return the existing bookmark/view in src/features/bookmarks/bookmark-service.ts
- [ ] T038 [US1] Implement metadata preview and create/get/update API handlers exactly matching contracts/openapi.yaml with authentication, CSRF, validation, problem responses, and safe logging in src/app/api/metadata/preview/route.ts, src/app/api/bookmarks/route.ts, and src/app/api/bookmarks/[bookmarkId]/route.ts
- [ ] T039 [P] [US1] Build bookmark summary/detail cards with safe direct HTTP(S) anchors using new-tab `noopener noreferrer` and no-referrer behavior in src/components/bookmarks/bookmark-card.tsx and src/components/bookmarks/bookmark-detail.tsx
- [ ] T040 [US1] Build the URL-first capture/edit dialog with bounded progress, an immediate fallback/save path after retrieval failure, editable title/description, icon preview, field-error preservation, and retry in src/components/bookmarks/bookmark-editor.tsx
- [ ] T041 [US1] Build the authenticated default collection page with newest-first cards, loading/error/retry states, and a friendly actionable new-collection empty message in src/app/(bookmarks)/bookmarks/page.tsx
- [ ] T042 [US1] Make tests T026–T030 pass and document MVP acceptance evidence against SC-001, SC-002, SC-004, SC-006, and SC-008 in specs/001-bookmark-management/evidence/us1.md

**Checkpoint**: User Story 1 is deployable and independently demonstrates fast URL-only capture with graceful failure, persistence, safe opening, editing, and duplicate handling.

---

## Phase 4: User Story 2 - Find Bookmarks with Precise Search (Priority: P2)

**Goal**: Users can tag bookmarks and find them with ordinary terms, exact phrases, `tag:` qualifiers, `NOT`/`AND`/`OR`, parentheses, filters, and stable sorting, with useful corrections and no-results messages.

**Independent Test**: Seed overlapping searchable fields/tags and verify every search form, malformed input, active/archive boundary, tag filter, all sorts, pagination, and friendly no-results recovery.

### Tests for User Story 2

- [ ] T043 [P] [US2] Write failing exhaustive lexer/parser tests for contracts/search-query.md, including quoted operators, escapes, implicit AND, precedence, unary/nested NOT, `tag:` phrases, offsets, and 1,000-character/100-token/10-depth limits in tests/unit/search-parser.test.ts
- [ ] T044 [P] [US2] Write failing integration tests for FTS synchronization, case-insensitive fields, within-field exact phrases, relational exact tags, owner/view boundaries around OR/NOT, pure-negative queries, stable cursor pagination, and newest/oldest/title sorts in tests/integration/search.test.ts
- [ ] T045 [P] [US2] Write failing contract tests for GET `/api/bookmarks` and GET `/api/tags`, including query-error offsets/hints and no raw SQL/FTS details in tests/contract/bookmark-search.test.ts
- [ ] T046 [P] [US2] Write the failing browser scenario for tag assignment, tag filter, term/phrase/Boolean searches, correction of malformed input, sorting, clearing criteria, and a friendly actionable no-results state in tests/e2e/bookmark-search.spec.ts

### Implementation for User Story 2

- [ ] T047 [P] [US2] Implement shared Unicode tag normalization, owner uniqueness, same-owner bookmark relationships, and orphan cleanup in src/lib/db/repositories/tag-repository.ts and src/features/bookmarks/tag-service.ts
- [ ] T048 [P] [US2] Implement the bounded search lexer/parser and typed AST with the exact grammar and error contract from contracts/search-query.md in src/features/bookmarks/search-parser.ts
- [ ] T049 [US2] Implement safe AST-to-parameterized-query compilation using FTS5 text predicates, relational exact-tag predicates, unary exclusion, view constraints, and stable sort/cursor keys in src/features/bookmarks/search-compiler.ts
- [ ] T050 [US2] Implement transactional BookmarkSearch projection updates/rebuilds for title, normalized URL, page description, note plain text, and aggregated tags in src/lib/db/repositories/search-repository.ts
- [ ] T051 [US2] Extend bookmark list/create/update and tag routes for tags, `view`, `q`, `tag`, `readingState`, `sort`, cursor, 50/100 page limits, and documented 422 query problems in src/app/api/bookmarks/route.ts, src/app/api/bookmarks/[bookmarkId]/route.ts, and src/app/api/tags/route.ts
- [ ] T052 [P] [US2] Build accessible search help, query input, tag/reading filters, sort controls, active-criteria chips, and clear actions with URL-backed state in src/components/bookmarks/search-bar.tsx and src/components/bookmarks/collection-controls.tsx
- [ ] T053 [US2] Integrate searchable/tagged paginated results plus distinct no-match guidance into src/app/(bookmarks)/bookmarks/page.tsx and src/components/bookmarks/bookmark-list.tsx
- [ ] T054 [US2] Make tests T043–T046 pass and document search correctness/performance evidence against SC-003 and SC-004 in specs/001-bookmark-management/evidence/us2.md

**Checkpoint**: User Story 2 independently supports precise, explainable retrieval and never presents an empty result as a blank screen.

---

## Phase 5: User Story 3 - Manage a Read-Later Queue (Priority: P2)

**Goal**: Users can add bookmarks to read later, see active unread items, mark them read/unread, and remove tracking while preserving the bookmark.

**Independent Test**: Move a bookmark through `none → unread → read → unread → none`, verify unread membership at each step, archive/restore it, and verify the reading state persists.

### Tests for User Story 3

- [ ] T055 [P] [US3] Write failing unit/integration tests for all idempotent reading transitions, persistence, active-only unread derivation, and archive/restore state preservation in tests/integration/reading-state.test.ts
- [ ] T056 [P] [US3] Write failing contract tests for reading-state PATCH operations and unread list filtering without cross-user disclosure in tests/contract/read-later.test.ts
- [ ] T057 [P] [US3] Write the failing browser scenario for add-to-read-later, unread view, mark read/unread, remove tracking, persistence, and a friendly actionable empty unread message in tests/e2e/read-later.spec.ts

### Implementation for User Story 3

- [ ] T058 [P] [US3] Implement the `none|unread|read` transition rules and idempotent commands without changing archive state in src/features/bookmarks/reading-state.ts
- [ ] T059 [US3] Add owner-scoped reading-state persistence and unread-view querying to src/lib/db/repositories/bookmark-repository.ts and src/features/bookmarks/bookmark-service.ts
- [ ] T060 [P] [US3] Add accessible per-bookmark read-later, mark-read, mark-unread, and remove-tracking controls with announced outcomes in src/components/bookmarks/reading-controls.tsx
- [ ] T061 [US3] Build the unread collection page with search/filter/sort reuse and distinct loading, retry, and friendly empty states in src/app/(bookmarks)/unread/page.tsx
- [ ] T062 [US3] Make tests T055–T057 pass and document the independent read-later acceptance evidence in specs/001-bookmark-management/evidence/us3.md

**Checkpoint**: User Story 3 independently provides a persistent, understandable read-later queue.

---

## Phase 6: User Story 4 - Add Rich Personal Notes (Priority: P3)

**Goal**: Users can author, preview, persist, edit, and search safe formatted personal notes separately from fetched page descriptions.

**Independent Test**: Save all supported formatting, reload/edit it, search note-only text, and verify hostile markup/links never execute or load.

### Tests for User Story 4

- [ ] T063 [P] [US4] Write failing unit tests for Markdown parsing, the 50,000-character limit, approved headings/emphasis/lists/quotes/links/code nodes, stable plain-text projection, and raw-HTML exclusion in tests/unit/note-service.test.ts
- [ ] T064 [P] [US4] Write failing security/component tests for scripts, event handlers, unsafe/obfuscated protocols, SVG/MathML, DOM clobbering, tags in code fences, safe link attributes, and readable unsafe labels in tests/component/note-renderer.test.tsx
- [ ] T065 [P] [US4] Write the failing browser scenario for edit/preview, persistence, later editing, separation from page description, and note-only search in tests/e2e/bookmark-notes.spec.ts

### Implementation for User Story 4

- [ ] T066 [P] [US4] Implement canonical Markdown validation, AST parsing, approved-node allowlist, safe HTTP(S) link transformation, and plain-text extraction in src/features/bookmarks/note-service.ts
- [ ] T067 [P] [US4] Build an accessible Markdown editor/preview with formatting guidance, character count, raw-HTML treatment, and safe external links in src/components/bookmarks/note-editor.tsx and src/components/bookmarks/note-renderer.tsx
- [ ] T068 [US4] Persist `note_markdown` and derived `note_plain_text` transactionally and refresh BookmarkSearch in src/lib/db/repositories/bookmark-repository.ts and src/lib/db/repositories/search-repository.ts
- [ ] T069 [US4] Integrate personal-note edit/read views separately from page description in src/components/bookmarks/bookmark-detail.tsx and src/components/bookmarks/bookmark-editor.tsx
- [ ] T070 [US4] Make tests T063–T065 pass and document formatted-note safety/search acceptance evidence in specs/001-bookmark-management/evidence/us4.md

**Checkpoint**: User Story 4 independently provides persistent searchable formatting without executing authored content.

---

## Phase 7: User Story 5 - Maintain Many Bookmarks Safely (Priority: P3)

**Goal**: Users select explicit bookmarks, bulk-tag/read/archive/restore them, browse a friendly archive, undo archiving, and permanently delete only after count-and-irreversibility confirmation.

**Independent Test**: Select visible bookmarks, apply every bulk operation, include stale/mixed-owner IDs, archive and restore while preserving state, cancel deletion once, then confirm and prove restoration is impossible.

### Tests for User Story 5

- [ ] T071 [P] [US5] Write failing integration tests for explicit-ID selection, the 100-ID cap, owner scoping, idempotent state changes, tag/search-index transaction consistency, safe item failures, and full rollback on storage error in tests/integration/bulk-actions.test.ts
- [ ] T072 [P] [US5] Write failing contract tests for POST `/api/bookmarks/bulk` and single permanent delete, including `confirmPermanent:true`, matching `expectedCount`, per-ID outcomes, and no owner disclosure in tests/contract/bulk-actions.test.ts
- [ ] T073 [P] [US5] Write failing component tests for selection counts, all-visible selection, hidden-selection disclosure/clearing, action availability, partial outcomes, retry, and deletion dialog focus/copy in tests/component/bulk-toolbar.test.tsx and tests/component/delete-confirmation.test.tsx
- [ ] T074 [P] [US5] Write the failing browser scenario for bulk tags/read state, archive/restore state preservation, friendly empty archive, cancellation, confirmed permanent deletion, and no restore path in tests/e2e/bulk-archive-delete.spec.ts

### Implementation for User Story 5

- [ ] T075 [P] [US5] Implement client selection as up to 100 explicit IDs plus originating view/query signature, with visible clear/retain behavior when criteria change, in src/features/bookmarks/selection.ts
- [ ] T076 [US5] Implement owner-scoped set-based bulk add/remove tags, mark read/unread, archive/restore, and permanent delete with transaction, idempotency, per-item safe outcomes, and storage-error rollback in src/features/bookmarks/bulk-service.ts and src/lib/db/repositories/bookmark-repository.ts
- [ ] T077 [US5] Implement bulk and single permanent-delete handlers exactly matching contracts/openapi.yaml, rejecting count mismatch or absent confirmation before mutation, in src/app/api/bookmarks/bulk/route.ts and src/app/api/bookmarks/[bookmarkId]/permanent-delete/route.ts
- [ ] T078 [P] [US5] Build selectable bookmark rows/cards, select-all-visible behavior, count, clear action, and keyboard-accessible selection in src/components/bookmarks/selectable-bookmark.tsx and src/components/bookmarks/selection-controller.tsx
- [ ] T079 [US5] Build the contextual bulk toolbar for tag, read/unread, archive/restore, retryable outcomes, and explicit hidden-selection messaging in src/components/bookmarks/bulk-toolbar.tsx
- [ ] T080 [US5] Build permanent-delete confirmation that states exact count and irreversibility, requires explicit confirmation, announces outcomes, and preserves items on cancel in src/components/bookmarks/delete-confirmation.tsx
- [ ] T081 [US5] Build the separate searchable/sortable archive page with restore controls and a friendly actionable empty archive message in src/app/(bookmarks)/archive/page.tsx
- [ ] T082 [US5] Make tests T071–T074 pass and document bulk timing, archive restoration, and destructive-action evidence against SC-005 and SC-009 in specs/001-bookmark-management/evidence/us5.md

**Checkpoint**: User Story 5 independently supports efficient reversible cleanup and unmistakably confirmed irreversible deletion.

---

## Phase 8: Polish and Cross-Cutting Verification

**Purpose**: Prove the complete product, harden operations, and prepare the approved application for review without adding out-of-scope features.

- [ ] T083 [P] Add complete two-account IDOR coverage for every list/detail/icon/create/update/search/tag/reading/archive/bulk/delete route in tests/integration/owner-isolation.test.ts
- [ ] T084 [P] Add automated accessibility scans plus manual keyboard/focus/responsive check records for authentication and all five story flows in tests/e2e/accessibility.spec.ts and specs/001-bookmark-management/evidence/accessibility.md
- [ ] T085 [P] Add failure-injection browser coverage proving preserved input, honest success/failure messaging, actionable retry, and distinct loading/error/empty states in tests/e2e/failure-states.spec.ts
- [ ] T086 Build the 10,000-bookmark fixture and release-mode timing harness for list/search/filter/sort p95 under two seconds and 100-item bulk under 30 seconds in tests/performance/seed.ts and tests/performance/bookmarks.perf.ts
- [ ] T087 Review query plans, indexes, bounded cursors, pure-negative search, FTS rebuilds, and write-transaction duration; record measured optimizations without weakening semantics in specs/001-bookmark-management/evidence/performance.md and src/lib/db/migrations/
- [ ] T088 [P] Implement consistent SQLite-plus-WAL and icon-store backup/restore verification in scripts/backup.ts, scripts/verify-backup.ts, and docs/operations.md
- [ ] T089 [P] Document production environment, HTTPS/cookie/email requirements, migration-before-start, data persistence, secret handling, and metadata egress controls in README.md and docs/deployment.md
- [ ] T090 Run every command and acceptance walkthrough in specs/001-bookmark-management/quickstart.md, fix only fidelity defects against the approved spec/plan, and record results in specs/001-bookmark-management/evidence/final-validation.md
- [ ] T091 Create `/work/.harness/app.json` only after install, migration, tests, and production build succeed; set the application command to `npm start` on port 4000 and add `data-harness-ready="true"` only to valid loaded states in .harness/app.json and src/app/layout.tsx
- [ ] T092 Perform final scope audit confirming import/export remain documented follow-on work and that sharing, folders, extensions, previews, automatic categorization, and broken-link checking were not accidentally implemented in specs/001-bookmark-management/evidence/scope-audit.md

**Checkpoint**: All functional, security, accessibility, performance, recovery, backup, and runtime-review evidence is complete.

---

## Dependencies and Execution Order

### Phase dependencies

- **Phase 1 — Setup**: Starts immediately.
- **Phase 2 — Foundation**: Depends on Phase 1 and blocks every user story.
- **Phase 3 — US1**: Starts after Foundation and is the MVP.
- **Phase 4 — US2**: Starts after Foundation; integrates collection records created by US1 but can use fixtures independently.
- **Phase 5 — US3**: Starts after Foundation; reuses collection list APIs and components, so sequential delivery after US2 minimizes file conflicts.
- **Phase 6 — US4**: Starts after Foundation; search integration uses the US2 index boundary, but note authoring/persistence is independently testable.
- **Phase 7 — US5**: Starts after Foundation; reuses tags, reading state, search views, and collection components, so it is integrated after US2–US4 in the single-developer path.
- **Phase 8 — Polish**: Depends on every story selected for release.

### User-story dependency graph

```text
Setup → Foundation → US1 (MVP)
                   ├→ US2 Search/Tags ─┬→ US4 Notes + search integration
                   │                   └→ US5 Bulk/Archive integration
                   └→ US3 Read Later ─────→ US5 Bulk reading actions

All delivered stories → Polish/Release verification
```

Each story remains independently testable through fixtures even where final UI integration benefits from earlier components.

### Within each story

1. Add the story's tests and confirm they fail for the missing behavior.
2. Implement validation/domain rules and persistence.
3. Implement services and HTTP contracts.
4. Implement accessible UI and explicit empty/error states.
5. Make the story tests pass and capture acceptance evidence.

## Parallel Opportunities

- Setup tasks T003–T008 can run concurrently after T001/T002 boundaries are settled.
- Foundation schema, email, auth UI, error/logging, security headers, and fixture tasks marked `[P]` use distinct files.
- Within US1, normalization, metadata/parser/icon tests, contracts, and browser scenarios can be authored concurrently before implementation.
- Within US2, parser, database-search, contract, and browser tests are independent; tag service and parser implementation use distinct modules.
- US3 and US4 can proceed in parallel after Foundation when separate owners coordinate their later shared repository/search integrations.
- Within US5, integration/contract/component/browser tests and selection-state implementation are parallelizable.
- Cross-cutting isolation, accessibility, failure-state, backup, and deployment documentation tasks can run concurrently after stories stabilize.

## Parallel Execution Examples

### User Story 1

```text
T026 URL-normalizer tests
T027 metadata SSRF/security tests
T028 metadata/icon behavior tests
T029 capture contract tests
T030 capture browser scenario
```

### User Story 2

```text
T043 parser tests
T044 FTS/search integration tests
T045 list/tag contract tests
T046 search browser scenario
```

### User Stories 3 and 4

```text
US3 owner: T055–T062 read-later slice
US4 owner: T063–T070 rich-note slice
Coordinate only T068 search projection after T050 is complete.
```

### User Story 5

```text
T071 bulk integration tests
T072 bulk contract tests
T073 selection/deletion component tests
T074 bulk/archive browser scenario
T075 selection state
```

## Independent Test Criteria by Story

- **US1**: URL-only capture returns editable metadata or a bounded fallback, saves despite retrieval failure, persists, opens safely, preserves edited text, and navigates duplicate attempts to the existing active/archived record.
- **US2**: Seeded content produces exact results for terms, phrases, tags, Boolean grammar, filters, and sorts; malformed/no-result queries show helpful corrective states.
- **US3**: One bookmark completes every reading-state transition, remains stable through archive/restore, and appears only in the correct unread view.
- **US4**: Supported formatting survives edit/reload and is searchable, while hostile markup/protocols never execute or load.
- **US5**: Explicit selections receive each bulk action with accurate outcomes; archive is reversible; deletion cancellation preserves items and confirmed deletion is irreversible.

## Implementation Strategy

### MVP first

1. Complete Setup and Foundation.
2. Complete US1 only.
3. Stop and validate the complete capture/revisit journey, especially slow/blocked-page fallback and the friendly new-collection state.
4. Demonstrate the MVP before expanding scope if staged delivery is desired.

### Incremental release sequence

1. US1: capture, fetched details, persistence, duplicate handling.
2. US2: tags and precise retrieval, including friendly no-results state.
3. US3: read-later queue and friendly empty unread state.
4. US4: safe formatted personal notes and note search.
5. US5: selection, bulk actions, archive/restore, friendly empty archive, confirmed permanent deletion.
6. Cross-cutting verification and runtime handoff.

## Notes

- `[P]` marks genuine file-level concurrency, not merely conceptually separate work.
- Tests in each story precede implementation and must be seen failing for the intended missing behavior.
- All mutation paths require authentication, CSRF, owner scoping, validation, and honest outcome reporting.
- Do not implement planned follow-on import/export or other explicitly excluded features in this task set.
- Any later behavior change routes back through `spec.md` and a revised plan/tasks gate; fidelity defects are corrected against the approved artifacts.
