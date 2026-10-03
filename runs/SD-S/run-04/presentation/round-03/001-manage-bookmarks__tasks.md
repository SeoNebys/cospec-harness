---

description: "Dependency-ordered implementation tasks for the personal bookmark manager"
---

# Tasks: Personal Bookmark Manager

**Input**: Approved design documents from `/specs/001-manage-bookmarks/`

**Prerequisites**: `spec.md`, `plan.md`, `research.md`, `data-model.md`, `contracts/`, and `quickstart.md`

**Tests**: Included because the approved plan makes contract, integration, component, security, performance, and end-to-end verification part of delivery.

**Organization**: Tasks are grouped by user story so each increment can be implemented and validated independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel with adjacent tasks because it targets separate files and has no incomplete dependency
- **[Story]**: Maps the task to User Story 1, 2, or 3 from the approved specification
- Every task names the file or directory it changes

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create the single-package TypeScript web application and repeatable toolchain.

- [ ] T001 Initialize Node 24 TypeScript package metadata, runtime scripts, React/Express dependencies, and pinned Playwright 1.61.0 development dependency in `package.json` and `package-lock.json`
- [ ] T002 [P] Configure server/client TypeScript compilation and Vite React builds in `tsconfig.json`, `tsconfig.server.json`, `vite.config.ts`, and `index.html`
- [ ] T003 [P] Configure ESLint, Prettier, Vitest, React Testing Library, and Playwright in `eslint.config.js`, `.prettierrc.json`, `vitest.config.ts`, `tests/setup.ts`, and `playwright.config.ts`
- [ ] T004 [P] Define safe runtime defaults and ignored generated data in `.env.example`, `.gitignore`, and `src/server/config.ts`

**Checkpoint**: Dependencies install reproducibly and empty typecheck, test, lint, and build commands execute.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish contracts, persistence, authentication, server middleware, and the authenticated application shell required by every story.

**⚠️ CRITICAL**: No user story implementation begins until this phase is complete.

- [ ] T005 Define shared Zod schemas and API types in `src/shared/validation/common.ts`, `src/shared/contracts/auth.ts`, and `src/shared/contracts/problems.ts`, including account email 3–254 characters after normalization and password 12–128 characters
- [ ] T006 Implement SQLite bootstrap schema in `src/server/db/migrations/001_initial.sql` with User, Session, Bookmark, Tag, BookmarkTag, and SchemaMigration fields and indexes from `data-model.md`; enforce URL maximum 2,048 characters, title 1–300 Unicode characters after trimming, notes 0–5,000 Unicode characters, tag 1–40 characters after trimming, maximum 20 distinct tags per bookmark in service validation, bookmark status `active` or `archived`, and unique `(user_id, normalized_name)` tags
- [ ] T007 Implement pinned `node:sqlite` connection, transactional migration runner, foreign-key/defensive settings, test database factory, and graceful close behavior in `src/server/db/database.ts`, `src/server/db/migrate.ts`, and `src/server/db/index.ts`
- [ ] T008 [P] Implement asynchronous scrypt password hashing, opaque session token creation/digests, expiry, and cookie policy in `src/server/auth/password.ts`, `src/server/auth/sessions.ts`, and `src/server/auth/auth-repository.ts`
- [ ] T009 Implement register, login, logout, current-user routes, generic credential failures, and owner authentication middleware in `src/server/auth/auth-routes.ts`, `src/server/middleware/require-user.ts`, and `src/shared/contracts/auth.ts`
- [ ] T010 [P] Implement structured problem responses, input parsing, same-origin mutation checks, login/title-preview rate-limit primitives, request logging, and not-found handling in `src/server/middleware/errors.ts`, `src/server/middleware/origin.ts`, `src/server/middleware/rate-limit.ts`, and `src/server/middleware/request-log.ts`
- [ ] T011 Assemble Express API routing, readiness endpoint, production static serving, startup, and graceful shutdown on `0.0.0.0:4000` in `src/server/app.ts` and `src/server/index.ts`
- [ ] T012 [P] Create deterministic user/session factories, isolated SQLite fixtures, and HTTP test application helpers in `tests/helpers/database.ts`, `tests/helpers/auth.ts`, and `tests/helpers/app.ts`
- [ ] T013 Create the accessible React application shell, auth bootstrap, sign-in/create-account forms, API client/problem mapping, route-state boundary, and ready marker behavior in `src/client/main.tsx`, `src/client/App.tsx`, `src/client/api/client.ts`, and `src/client/features/auth/AuthScreen.tsx`

**Checkpoint**: Two authenticated users have isolated sessions; the health route reports readiness; the built empty collection shell loads without feature-specific bookmark behavior.

---

## Phase 3: User Story 1 — Save a Bookmark (Priority: P1) 🎯 MVP

**Goal**: Save a validated link with automatically suggested, editable title; preserve input on failure; warn before likely duplicates.

**Independent Test**: Paste a valid fixture URL into an untouched form, observe title retrieval start automatically, edit or accept the suggestion, save notes/tags/favorite state, reload, and see the bookmark persisted. Exercise preview failure and duplicate continuation without losing the draft.

### Tests for User Story 1

- [ ] T014 [P] [US1] Add create-bookmark, duplicate-warning/continuation, title-preview, validation, and ownership contract tests from `contracts/openapi.yaml` in `tests/contract/bookmark-create.contract.test.ts` and `tests/contract/title-preview.contract.test.ts`
- [ ] T015 [P] [US1] Add URL normalization, duplicate comparison, tag normalization, and all Bookmark/Tag boundary-value unit tests in `tests/unit/url-normalization.test.ts`, `tests/unit/tag-normalization.test.ts`, and `tests/unit/bookmark-validation.test.ts`
- [ ] T016 [P] [US1] Add controlled DNS/HTTP title fixtures and integration coverage for success, missing title, timeout, private/special IPv4 and IPv6, DNS rebinding, redirects, non-HTML, oversized response, malformed HTML, and response cleanup in `tests/helpers/title-fixture.ts` and `tests/integration/title-preview.test.ts`
- [ ] T017 [P] [US1] Add component tests proving paste-triggered lookup, blur-triggered lookup, editable suggestion, stale-response cancellation, no overwrite after manual typing, and non-blocking fallback in `tests/integration/BookmarkForm.test.tsx`
- [ ] T018 [US1] Add the independent save/title/duplicate browser journey in `tests/e2e/save-bookmark.spec.ts`

### Implementation for User Story 1

- [ ] T019 [P] [US1] Define bookmark/title-preview shared schemas in `src/shared/contracts/bookmarks.ts`, including URL maximum 2,048 characters, title 1–300 Unicode characters after trimming, notes 0–5,000 Unicode characters, tag 1–40 characters after trimming, maximum 20 distinct tags per bookmark, and explicit `allowDuplicate` consent
- [ ] T020 [P] [US1] Implement URL canonicalization, tag normalization, and bookmark creation persistence transactions in `src/server/bookmarks/url-normalization.ts`, `src/server/bookmarks/tag-normalization.ts`, and `src/server/bookmarks/bookmark-repository.ts`
- [ ] T021 [US1] Implement SSRF-resistant streamed title retrieval with HTTP(S)-only validation, public A/AAAA resolution and connection pinning, manual revalidation of at most three redirects, five-second timeout, one-MiB limit, HTML-only parsing, and 300-character normalized title output in `src/server/title-preview/title-fetcher.ts`
- [ ] T022 [US1] Implement authenticated, rate-limited `POST /api/title-previews` result mapping without persisting fetched content in `src/server/title-preview/title-preview-routes.ts`
- [ ] T023 [US1] Implement create-bookmark validation, duplicate discovery, `409 DUPLICATE_BOOKMARK`, explicit continuation, and transactional tag association in `src/server/bookmarks/bookmark-service.ts`
- [ ] T024 [US1] Implement authenticated `POST /api/bookmarks` and ownership-safe response mapping in `src/server/bookmarks/bookmark-routes.ts` and register the routes in `src/server/app.ts`
- [ ] T025 [US1] Implement create/edit form primitives with automatic paste/blur title lookup, untouched-field tracking, abort/stale guards, preserved input, tag entry, favorite input, validation errors, and duplicate decision UI in `src/client/features/bookmarks/BookmarkForm.tsx`, `src/client/features/bookmarks/useTitlePreview.ts`, and `src/client/features/bookmarks/DuplicateDialog.tsx`
- [ ] T026 [US1] Render the persisted active collection newest-first with title, safe destination link/domain, tags, favorite state, date, initial empty state, and create action in `src/client/features/bookmarks/BookmarkCollection.tsx`, `src/client/features/bookmarks/BookmarkCard.tsx`, and `src/client/features/bookmarks/bookmark-api.ts`

**Checkpoint**: User Story 1 passes independently and forms a deployable save/retrieve MVP, including automatic-title safety and duplicate consent.

---

## Phase 4: User Story 2 — Find and Open Bookmarks (Priority: P2)

**Goal**: Browse, search, filter, clear criteria, paginate, and safely open bookmarks while preserving collection context.

**Independent Test**: With varied saved data, locate a known item by partial title, address, notes, and tag matches; combine multiple tags with favorite state; clear everything; exercise no results; open the destination without leaving the collection context.

### Tests for User Story 2

- [ ] T027 [P] [US2] Add list, cursor, query, multi-tag intersection, favorite, lifecycle, tag-count, wildcard escaping, and ownership contract tests in `tests/contract/bookmark-list.contract.test.ts` and `tests/contract/tags.contract.test.ts`
- [ ] T028 [P] [US2] Add collection search repository tests using 10,000 deterministic records and stable cursor boundaries in `tests/integration/bookmark-search.test.ts` and `tests/helpers/bookmark-fixture.ts`
- [ ] T029 [P] [US2] Add collection route-state, debounced search, combined-filter, clear-filter, pagination, and empty-state component tests in `tests/integration/BookmarkCollection.test.tsx`
- [ ] T030 [US2] Add the independent search/filter/open browser journey in `tests/e2e/find-bookmarks.spec.ts`

### Implementation for User Story 2

- [ ] T031 [US2] Implement owner/lifecycle-scoped newest-first cursor queries with literal case-insensitive partial matching across title, URL, notes, and tags plus tag intersection and favorite filters in `src/server/bookmarks/bookmark-query-repository.ts`
- [ ] T032 [US2] Implement validated `GET /api/bookmarks` and `GET /api/tags` endpoints with default page size 50, maximum 100, opaque cursors, stable ordering, and lifecycle-specific tag counts in `src/server/bookmarks/bookmark-query-service.ts` and `src/server/bookmarks/bookmark-routes.ts`
- [ ] T033 [US2] Implement URL-backed active/archived view state, debounced search, multi-tag and favorite filters, one-action clearing, progressive page loading, no-results recovery, and safe new-context links in `src/client/features/bookmarks/CollectionToolbar.tsx`, `src/client/features/bookmarks/useCollectionQuery.ts`, and `src/client/features/bookmarks/BookmarkCollection.tsx`

**Checkpoint**: User Story 2 passes independently against pre-seeded bookmarks and does not require edit/archive/delete behavior.

---

## Phase 5: User Story 3 — Organize and Maintain a Collection (Priority: P3)

**Goal**: Edit details and tags, toggle favorites, archive/restore, and permanently delete only after explicit confirmation.

**Independent Test**: Modify every bookmark field, observe filters reflect the change, archive and restore with details intact, cancel deletion once, then confirm and verify permanent removal.

### Tests for User Story 3

- [ ] T034 [P] [US3] Add edit, favorite, archive, restore, permanent-delete, idempotency, validation, duplicate-edit, and cross-user not-found contract tests in `tests/contract/bookmark-mutations.contract.test.ts`
- [ ] T035 [P] [US3] Add transactional tag replacement and active/archived state-invariant integration tests in `tests/integration/bookmark-mutations.test.ts`
- [ ] T036 [P] [US3] Add edit-form, optimistic-favorite rollback, archive/restore feedback, focus recovery, and mandatory destructive-confirmation component tests in `tests/integration/BookmarkActions.test.tsx`
- [ ] T037 [US3] Add the independent edit/archive/restore/delete browser journey, including canceled deletion, in `tests/e2e/manage-bookmarks.spec.ts`

### Implementation for User Story 3

- [ ] T038 [US3] Implement transactional edit/tag replacement, duplicate-edit warning/continuation, idempotent favorite/archive/restore transitions, and owner-scoped permanent deletion in `src/server/bookmarks/bookmark-service.ts` and `src/server/bookmarks/bookmark-repository.ts`
- [ ] T039 [US3] Implement `PATCH /api/bookmarks/{id}`, favorite, archive, restore, and delete operations with indistinguishable cross-owner not-found responses in `src/server/bookmarks/bookmark-routes.ts`
- [ ] T040 [US3] Integrate edit mode without unintended title replacement, optimistic favorite with rollback, archive/restore actions, archived view, announced status, and focus recovery in `src/client/features/bookmarks/BookmarkForm.tsx`, `src/client/features/bookmarks/BookmarkActions.tsx`, and `src/client/features/bookmarks/BookmarkCollection.tsx`
- [ ] T041 [US3] Implement an accessible permanent-delete confirmation that names the bookmark, states irreversibility, traps/restores focus, and performs no mutation on cancellation in `src/client/features/bookmarks/DeleteBookmarkDialog.tsx`

**Checkpoint**: All three user stories pass independently and together.

---

## Phase 6: Polish and Cross-Cutting Verification

**Purpose**: Complete responsive presentation, accessibility, operational safety, documentation, and release validation.

- [ ] T042 [P] Add cohesive responsive styling for 320px-through-desktop layouts, visible focus, dialogs, toolbar, cards, feedback, and loading/empty states in `src/client/styles/tokens.css`, `src/client/styles/global.css`, and `src/client/styles/components.css`
- [ ] T043 [P] Add automated keyboard/accessibility smoke coverage and responsive viewport checks in `tests/e2e/accessibility.spec.ts` and `tests/e2e/responsive.spec.ts`
- [ ] T044 [P] Add two-user isolation, CSRF/origin, session-expiry, login/title-preview rate-limit, and production-cookie security tests in `tests/integration/security.test.ts`
- [ ] T045 Measure and tune 10,000-bookmark search/filter behavior to the one-second target, recording the deterministic results in `tests/performance/bookmark-search.perf.test.ts` and `specs/001-manage-bookmarks/quickstart.md`
- [ ] T046 [P] Document installation, environment, migrations, validation commands, runtime data, and title-fetch security boundaries in `README.md` and finalize `.env.example`
- [ ] T047 Run formatting, linting, typecheck, unit/integration/contract tests, Playwright journeys, production build, and every applicable scenario in `specs/001-manage-bookmarks/quickstart.md`; record any environment-limited validation in that file
- [ ] T048 Create the review runtime descriptor with `npm start`, port 4000, `/`, and `/work` in `.harness/app.json`, start the prepared app, verify `/api/health`, load `http://127.0.0.1:4000/`, and confirm a valid `data-harness-ready="true"` state

**Checkpoint**: The production-shaped application is built, verified, and available for client review at `http://maker:4000/`.

---

## Dependencies and Execution Order

### Phase dependencies

```text
Phase 1 Setup
    ↓
Phase 2 Foundation
    ↓
Phase 3 US1 (MVP)
    ├──────────────→ Phase 4 US2
    └──────────────→ Phase 5 US3
                         ↓
                 Phase 6 Polish/Release
```

- Phase 1 has no dependencies.
- Phase 2 depends on Phase 1 and blocks all stories.
- US1 is first because it establishes persisted bookmarks, tags, the base collection, and title preview.
- US2 and US3 both depend on US1's bookmark records and base UI; after US1, their server tests/services can proceed in parallel while shared client files are coordinated.
- Phase 6 depends on all requested stories.

### Within each story

- Test contracts and fixtures are written before the behavior they verify.
- Shared schemas and repositories precede services; services precede route/UI integration.
- A story's checkpoint requires its contract, integration, component, and browser tests to pass.
- Tasks sharing `src/server/bookmarks/bookmark-routes.ts`, `bookmark-service.ts`, `BookmarkForm.tsx`, or `BookmarkCollection.tsx` execute in task order to avoid conflicting edits.

### Parallel opportunities

- Setup T002–T004 can proceed in parallel after T001 establishes package scripts.
- Foundation T008, T010, and T012 target independent modules after T005–T007 define common types/storage.
- US1 test tasks T014–T017 can proceed in parallel; implementation T019 and T020 can proceed in parallel.
- US2 test tasks T027–T029 can proceed in parallel.
- US3 test tasks T034–T036 can proceed in parallel.
- Polish T042–T044 and T046 can proceed in parallel after story completion.

## Parallel Examples

### User Story 1

```text
T014 Contract tests: create and preview
T015 Unit tests: URL/tag/field normalization
T016 Integration tests: controlled remote-title safety
T017 Component tests: automatic-title race behavior
```

After those test contracts exist:

```text
T019 Shared bookmark schemas
T020 URL/tag/repository primitives
```

### User Story 2

```text
T027 HTTP list/filter contracts
T028 Repository scale/cursor tests
T029 Collection interaction tests
```

### User Story 3

```text
T034 Mutation HTTP contracts
T035 Transaction/state integration tests
T036 Action/dialog component tests
```

## Implementation Strategy

### MVP first

1. Complete Setup and Foundation.
2. Complete US1 from failing test contracts through browser validation.
3. Stop and validate automatic title suggestion, fallback, persistence, and duplicate consent as an independent MVP.
4. Continue to US2 and US3 only after the MVP checkpoint passes.

### Incremental delivery

1. **US1**: Save and retrieve bookmarks with automatic title suggestion.
2. **US2**: Make a growing collection quickly searchable and filterable.
3. **US3**: Add ongoing organization, lifecycle, and safe permanent deletion.
4. **Polish**: Prove security, accessibility, responsive behavior, performance, build, and runtime readiness.

## Task Summary

- Total tasks: 48
- Setup: 4 tasks
- Foundation: 9 tasks
- User Story 1: 13 tasks
- User Story 2: 7 tasks
- User Story 3: 8 tasks
- Polish and release: 7 tasks
- Suggested MVP: Phases 1–3, ending with User Story 1
