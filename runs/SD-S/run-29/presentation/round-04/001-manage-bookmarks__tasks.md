# Tasks: Bookmark Manager

**Input**: Approved design documents from `specs/001-manage-bookmarks/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/openapi.yaml`, `quickstart.md`

**Tests**: Test work is included because the approved plan makes unit, integration, contract, browser, accessibility, privacy, and performance verification part of delivery.

**Organization**: Tasks are grouped by user story so each journey can be implemented and validated as an independent increment.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel with adjacent tasks after its phase prerequisites are satisfied
- **[Story]**: Maps work to US1, US2, or US3 from `spec.md`
- Every task names the exact file or directory it changes

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish a reproducible application, quality toolchain, and local database environment.

- [x] T001 Initialize the Next.js 16 TypeScript application and locked npm dependencies in `package.json` and `package-lock.json`
- [x] T002 Configure Node.js 24, TypeScript, path aliases, and Next.js server settings in `.nvmrc`, `tsconfig.json`, and `next.config.ts`
- [x] T003 [P] Configure ESLint and shared formatting rules in `eslint.config.mjs` and `.editorconfig`
- [x] T004 [P] Configure Vitest projects and DOM setup in `vitest.config.ts` and `tests/setup/dom.ts`
- [x] T005 [P] Configure Playwright 1.61.0 to use `/opt/playwright-browsers` and port 4000 in `playwright.config.ts`
- [x] T006 [P] Define documented development, test, and production environment variables in `.env.example`
- [x] T007 Configure PostgreSQL 18 development and isolated test services with health checks in `compose.yaml`
- [x] T008 Create the planned application, component, library, style, and test directory skeleton with placeholder exports in `app/`, `components/`, `lib/`, `styles/`, and `tests/`

**Checkpoint**: Dependencies install reproducibly; lint, typecheck, unit, integration, contract, and browser test commands are discoverable.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Implement shared persistence, authentication, authorization, validation, error, and UI foundations required by every story.

**Critical**: No user-story implementation starts until this phase passes its checks.

- [x] T009 Define Better Auth User/Account/Session/Verification records plus Bookmark (`title` required, trimmed/collapsed, 1–200 characters; `url` required, WHATWG-serialized http/https, maximum 2,048 characters, no embedded credentials), Tag (`name` trimmed/collapsed, 1–50 characters), and BookmarkTag (0–20 distinct tags per bookmark) in `prisma/schema.prisma`
- [x] T010 Add owner-scoped unique constraints, foreign-key cascades, pagination/join indexes, `pg_trgm`, and GIN search indexes in `prisma/migrations/001_initial/migration.sql`
- [x] T011 [P] Implement URL/title/tag normalization and Zod input schemas shared by create and edit in `lib/domain/normalization.ts` and `lib/validation/bookmark.ts`
- [x] T012 [P] Write failing normalization and validation matrix tests covering limits, invalid schemes/credentials, default ports, path case, query order, and fragments in `tests/unit/normalization.test.ts` and `tests/unit/bookmark-validation.test.ts`
- [x] T013 Configure Prisma 7 connection lifecycle and transaction helpers in `lib/db/prisma.ts` and `lib/db/transaction.ts`
- [x] T014 Configure Better Auth email/password registration, login, logout, database sessions, production cookie attributes, and auth endpoint routing in `lib/auth/server.ts`, `lib/auth/client.ts`, and `app/api/auth/[...all]/route.ts`
- [x] T015 Implement session verification and owner-scoped data-access entry points that never accept owner IDs from clients in `lib/dal/session.ts` and `lib/dal/owned-resource.ts`
- [x] T016 [P] Implement stable Problem response codes, field errors, correlation IDs, and privacy-safe structured logging in `lib/http/problem.ts` and `lib/observability/logger.ts`
- [x] T017 [P] Implement private `Cache-Control: private, no-store` response helpers and authenticated-route protections in `lib/http/private-response.ts` and `proxy.ts`
- [x] T018 [P] Build semantic application shell, skip link, focus-visible styles, and persistent polite status region in `app/layout.tsx`, `components/ui/status-region.tsx`, and `styles/globals.css`
- [x] T019 Build keyboard-accessible registration/login/logout screens with generic credential errors in `app/(auth)/register/page.tsx`, `app/(auth)/login/page.tsx`, and `components/auth/auth-form.tsx`
- [x] T020 Write and pass authentication, session revocation, cache header, and cross-user DAL isolation integration tests in `tests/integration/auth.test.ts` and `tests/integration/owner-isolation.test.ts`

**Checkpoint**: Two accounts can authenticate independently, private responses are not publicly cached, and neither account can access an owned fixture belonging to the other.

---

## Phase 3: User Story 1 — Save and Revisit Bookmarks (Priority: P1) MVP

**Goal**: A signed-in user can save a valid titled web address, see it after reload, and open it; invalid and duplicate submissions preserve the collection and provide corrective feedback.

**Independent Test**: Save a valid web address and title, reload the application, verify the bookmark remains with its saved date, and open the destination. Invalid and normalized-duplicate submissions must create nothing and explain the correction.

### Tests for User Story 1

- [x] T021 [P] [US1] Write failing POST/GET bookmark contract tests for `201`, `401`, `409`, `422`, and pagination response shapes in `tests/contract/bookmarks-create-list.test.ts`
- [x] T022 [P] [US1] Write failing persistence, normalized duplicate-race, rollback, and reload integration tests in `tests/integration/bookmark-create.test.ts`
- [x] T023 [P] [US1] Write failing browser tests for save, validation focus, duplicate guidance, open destination, reload persistence, and empty collection in `tests/e2e/bookmark-save-open.spec.ts`

### Implementation for User Story 1

- [x] T024 [US1] Implement transactional bookmark creation, duplicate conflict mapping, and owner-scoped paginated listing in `lib/dal/bookmarks.ts`
- [x] T025 [US1] Implement the POST and GET operations from `contracts/openapi.yaml`, including `400/401/409/422/500` Problem responses, in `app/api/bookmarks/route.ts`
- [x] T026 [P] [US1] Build the save form with associated field errors, preserved values, submitting-state control, and first-invalid-field focus in `components/bookmarks/bookmark-form.tsx`
- [x] T027 [P] [US1] Build semantic bookmark cards with an actual external link, visible address, saved date, and tag-ready layout in `components/bookmarks/bookmark-card.tsx`
- [x] T028 [US1] Assemble the private collection page, save flow, paginated results, ready marker, and distinct empty-collection state in `app/bookmarks/page.tsx` and `components/bookmarks/bookmark-list.tsx`
- [x] T029 [US1] Announce save success/failure and duplicate guidance through the status region, with the duplicate action focusing the existing bookmark, in `components/bookmarks/bookmark-collection.tsx`
- [x] T030 [US1] Make the root route send authenticated users to the collection and anonymous users to login in `app/page.tsx`
- [x] T031 [US1] Run and make US1 unit, contract, integration, and browser suites pass using `tests/unit/`, `tests/contract/bookmarks-create-list.test.ts`, `tests/integration/bookmark-create.test.ts`, and `tests/e2e/bookmark-save-open.spec.ts`

**Checkpoint**: US1 is a deployable bookmark-saving MVP and passes its independent test without tags, search, editing, or deletion.

---

## Phase 4: User Story 2 — Find and Organize Bookmarks (Priority: P2)

**Goal**: Users can assign normalized tags and quickly retrieve bookmarks by case-insensitive partial search or one selected tag, including a recoverable no-results state.

**Independent Test**: Save several bookmarks with differently cased/whitespace-equivalent tags, then find the expected records by title, address, tag text, and a selected tag filter; clear the criteria to restore the full collection.

### Tests for User Story 2

- [x] T032 [P] [US2] Write failing GET bookmark search/filter and GET tag contract tests, including limit/cursor validation and owner isolation, in `tests/contract/bookmarks-search-tags.test.ts`
- [x] T033 [P] [US2] Write failing tag reuse, tag limit, partial-search, filter, pagination, and orphan-free transaction integration tests in `tests/integration/bookmark-search-tags.test.ts`
- [x] T034 [P] [US2] Write failing keyboard browser tests for tag entry, 250 ms search, filter selection, clear criteria, result announcements, and no-results recovery in `tests/e2e/bookmark-search-tags.spec.ts`

### Implementation for User Story 2

- [x] T035 [US2] Extend bookmark create transactions to reuse owner-normalized tags and enforce at most 20 distinct tags in `lib/dal/bookmarks.ts`
- [x] T036 [US2] Implement owner-scoped partial title/URL/tag search, selected-tag filtering, total count, and stable cursor pagination in `lib/dal/bookmark-query.ts`
- [x] T037 [US2] Implement the authenticated tag-list operation from `contracts/openapi.yaml` in `lib/dal/tags.ts` and `app/api/tags/route.ts`
- [x] T038 [P] [US2] Add accessible tag entry/removal controls and rendered tag links to `components/bookmarks/tag-input.tsx`, `components/bookmarks/bookmark-form.tsx`, and `components/bookmarks/bookmark-card.tsx`
- [x] T039 [P] [US2] Build URL-synchronized debounced search, tag filtering, clear criteria, and announced result counts in `components/bookmarks/bookmark-filters.tsx`
- [x] T040 [US2] Integrate query state, tag options, and distinct no-results recovery into `app/bookmarks/page.tsx` and `components/bookmarks/bookmark-list.tsx`
- [x] T041 [US2] Run and make US2 contract, integration, and browser suites pass using `tests/contract/bookmarks-search-tags.test.ts`, `tests/integration/bookmark-search-tags.test.ts`, and `tests/e2e/bookmark-search-tags.spec.ts`

**Checkpoint**: US2 independently demonstrates organization and retrieval over persisted bookmark fixtures, while US1 remains passing.

---

## Phase 5: User Story 3 — Maintain the Collection (Priority: P3)

**Goal**: Users can atomically edit owned bookmark details and delete a bookmark only after an accessible confirmation; cancel and failure paths preserve existing data.

**Independent Test**: Edit a bookmark's title, address, and tags and verify persistence; cancel a deletion and verify no change; confirm deletion and verify removal plus logical focus restoration.

### Tests for User Story 3

- [x] T042 [P] [US3] Write failing GET/PUT/DELETE contract tests for owned, absent/not-owned, duplicate, validation, and retryable failure outcomes in `tests/contract/bookmark-detail.test.ts`
- [x] T043 [P] [US3] Write failing edit/delete atomicity, ownership, duplicate-update, tag cleanup, and prior-state preservation integration tests in `tests/integration/bookmark-maintenance.test.ts`
- [x] T044 [P] [US3] Write failing keyboard browser tests for edit, validation focus, delete Cancel/Escape/confirm, dialog focus trap, and post-delete focus/status in `tests/e2e/bookmark-maintenance.spec.ts`

### Implementation for User Story 3

- [x] T045 [US3] Implement owner-scoped bookmark lookup, atomic edit with create-parity validation, atomic deletion, and orphan-tag cleanup in `lib/dal/bookmark-detail.ts`
- [x] T046 [US3] Implement GET, PUT, and DELETE operations from `contracts/openapi.yaml` with indistinguishable missing/not-owned responses in `app/api/bookmarks/[id]/route.ts`
- [x] T047 [P] [US3] Add edit mode with prefilled values, preserved failure input, Cancel behavior, and success focus/status handling in `components/bookmarks/bookmark-editor.tsx`
- [x] T048 [P] [US3] Build the labelled delete modal with initial focus on Cancel, contained Tab order, Escape cancellation, and invoker/logical-neighbor focus restoration in `components/bookmarks/delete-bookmark-dialog.tsx`
- [x] T049 [US3] Integrate edit and delete actions into each bookmark without changing open-link behavior in `components/bookmarks/bookmark-card.tsx` and `components/bookmarks/bookmark-collection.tsx`
- [x] T050 [US3] Run and make US3 contract, integration, and browser suites pass using `tests/contract/bookmark-detail.test.ts`, `tests/integration/bookmark-maintenance.test.ts`, and `tests/e2e/bookmark-maintenance.spec.ts`

**Checkpoint**: All three user stories work independently and together, including destructive-action safeguards.

---

## Phase 6: Polish and Cross-Cutting Verification

**Purpose**: Prove the complete approved experience, harden security/accessibility/performance, and prepare the runnable review application.

- [x] T051 [P] Add axe scans plus complete keyboard-only save/search/filter/edit/delete journey coverage in `tests/e2e/accessibility.spec.ts`
- [x] T052 [P] Add two-account direct-identifier privacy probes across every bookmark operation in `tests/integration/privacy-regression.test.ts`
- [x] T053 [P] Add a 10,000-bookmark seed and at least 20 measured search/filter samples with a 95% under-one-second assertion in `tests/performance/search-filter.test.ts` and `prisma/performance-seed.ts`
- [x] T054 [P] Add authentication throttling, security headers, and secret-safe logging assertions in `lib/auth/rate-limit.ts`, `next.config.ts`, and `tests/integration/security-hardening.test.ts`
- [x] T055 Verify responsive layout, 200% zoom/reflow, long URL/title/tag handling, unavailable destinations, empty states, and error recovery; record fixes in `styles/globals.css` and affected files under `components/`
- [x] T056 Run typecheck, lint, unit, integration, contract, E2E, accessibility, performance, and production-build gates and record results in `specs/001-manage-bookmarks/validation.md`
- [x] T057 Execute every scenario in `specs/001-manage-bookmarks/quickstart.md` against the production build and append observed outcomes to `specs/001-manage-bookmarks/validation.md`
- [x] T058 Configure the prepared foreground start command and review entry point in `.harness/app.json`, then verify `http://maker:4000` reaches a `data-harness-ready="true"` state
- [x] T059 Document setup, environment, migration, test, deployment, backup, and automatic-title follow-up boundaries in `README.md`

## Dependencies and Execution Order

### Phase dependencies

- **Phase 1 — Setup**: Starts immediately.
- **Phase 2 — Foundation**: Depends on Phase 1 and blocks all user stories.
- **Phase 3 — US1**: Depends on Phase 2; produces the suggested MVP.
- **Phase 4 — US2**: Depends on Phase 2 and the persisted Bookmark foundation. It can be developed with fixtures independently, but integrates after US1 for incremental delivery.
- **Phase 5 — US3**: Depends on Phase 2 and the persisted Bookmark foundation. It can be developed with fixtures independently, but integrates after US1 for incremental delivery.
- **Phase 6 — Polish**: Depends on every story selected for release; T056–T059 follow the relevant hardening and verification tasks.

### User-story dependency graph

```text
Setup → Foundation → US1 (MVP)
                   ├→ US2
                   └→ US3
US1 + US2 + US3 → Cross-cutting verification → Review application
```

US2 and US3 have no dependency on each other. Their tests can seed owned Bookmark records directly after the foundation exists.

### Within each user story

1. Add the story's failing contract, integration, and browser tests.
2. Implement data-access behavior and transactions.
3. Implement HTTP operations.
4. Implement accessible UI components and integration.
5. Run the story suite and all earlier story regression suites.

## Parallel Execution Examples

### User Story 1

```text
T021 contract tests || T022 integration tests || T023 browser tests
After T025: T026 save form || T027 bookmark card
```

### User Story 2

```text
T032 contract tests || T033 integration tests || T034 browser tests
After query/tag services: T038 tag UI || T039 filter UI
```

### User Story 3

```text
T042 contract tests || T043 integration tests || T044 browser tests
After detail endpoint: T047 editor || T048 delete dialog
```

### Cross-cutting verification

```text
T051 accessibility || T052 privacy || T053 performance || T054 security
```

## Implementation Strategy

### MVP first

1. Complete Setup and Foundation.
2. Complete US1 and prove save, persistence, open, validation, and duplicate behavior.
3. Stop for an internal MVP checkpoint before expanding the collection controls.

### Incremental delivery

1. US1: save and revisit links.
2. US2: add tags, search, filtering, and recoverable result states.
3. US3: add editing and deletion safeguards.
4. Complete privacy, keyboard, scale, production-build, and review-environment verification.

### Deferred follow-up

Automatic page-title retrieval is intentionally absent from implementation tasks. It remains the next requested feature and requires a new specification covering server-side fetch restrictions, SSRF defense, redirects, time/size limits, content-type handling, and user override behavior.

## Completion Rules

- A task is complete only when its affected tests pass and its changed behavior matches the approved contract.
- Test tasks are written and observed failing before their corresponding implementation tasks.
- Earlier user-story suites remain green as later stories are added.
- No user-supplied owner identifier is trusted; every data operation derives ownership from the verified session.
- No implementation task may add automatic title retrieval or another deferred feature to this MVP.
