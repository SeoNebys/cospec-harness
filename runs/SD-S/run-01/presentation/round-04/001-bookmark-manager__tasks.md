---

description: "Dependency-ordered implementation tasks for the personal bookmark manager"
---

# Tasks: Personal Bookmark Manager

**Input**: Approved design documents from `specs/001-bookmark-manager/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`, and `quickstart.md`

**Tests**: Included because the approved plan requires unit, integration, component, API-contract, accessibility, responsive, performance, persistence, and end-to-end validation.

**Organization**: Tasks are grouped by user story so each story can be implemented and verified as an independent increment.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel with adjacent tasks because it touches different files and has no dependency on their incomplete work.
- **[Story]**: Maps the task to User Story 1, 2, or 3 from `spec.md`.
- Every task names the exact files it creates or changes.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish the one-package TypeScript project and reproducible toolchain without implementing bookmark behavior.

- [X] T001 Create the npm project, pin application/test dependencies including Playwright 1.61.0, add build/typecheck/test/start scripts, and generate the lockfile in `package.json` and `package-lock.json`
- [X] T002 [P] Configure strict shared/client/server TypeScript compilation and path aliases in `tsconfig.json`, `tsconfig.client.json`, and `tsconfig.server.json`
- [X] T003 [P] Configure the React build, Vitest projects, and browser test environment in `vite.config.ts`, `vitest.config.ts`, and `tests/setup.ts`
- [X] T004 [P] Configure Chromium end-to-end projects for 375px and 1440px viewports without browser downloads in `playwright.config.ts`
- [X] T005 Create the planned source/test/data directory skeleton and ignore generated output, SQLite runtime files, logs, and test artifacts in `.gitignore` and `data/.gitkeep`

**Checkpoint**: Dependencies install from the lockfile and empty build, typecheck, unit-test, and Playwright commands resolve their configurations.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Implement the shared contracts, database bootstrap, server shell, client shell, and test harness required by every story.

**⚠️ CRITICAL**: No user-story implementation starts until this phase is complete.

- [X] T006 [P] Define the shared Bookmark schemas and API projections in `src/shared/bookmark-schemas.ts` with these exact constraints: `id` is “Generated on creation; immutable”; `url` is an “Absolute http: or https: address; 1–2048 characters after trimming”; `normalizedUrl` is “Server-generated canonical value used for duplicate comparison; not user-editable”; `title` is “Trimmed; 1–300 characters”; `notes` is “Trimmed; empty string permitted; maximum 10,000 characters”; `isFavorite` “Defaults to false”; `status` is “active or archived; defaults to active”; `createdAt` is “Generated once; immutable”; `updatedAt` is “Refreshed after any content, tag, favorite, or lifecycle mutation”; and `archivedAt` is “Set when archived; cleared when restored”
- [X] T007 [P] Define Tag, BookmarkTag, CollectionViewState, list-criteria, create/update input, and structured-error schemas in `src/shared/api-types.ts` with these exact constraints: tag `id` is “Generated when the normalized tag is first used; immutable”; tag `name` is “Trimmed display value; 1–40 characters”; tag `normalizedName` is “Case-folded comparison value; unique”; tag `createdAt` is “Generated once; immutable”; BookmarkTag uses required foreign keys and a composite `(bookmarkId, tagId)` key; view `scope` is `active` or `archived` defaulting to `active`; `query` is “Trimmed; maximum 200 characters”; `tag` is “One normalized tag filter at a time”; `favorite` uses `true` or null; and `sort` allows `newest`, `oldest`, `updated`, or `title` defaulting to `newest`
- [X] T008 [P] Implement environment parsing, default `data/bookmarks.db` selection, directory creation, SQLite connection setup, WAL mode, busy timeout, and per-connection foreign-key enforcement in `src/server/config.ts` and `src/server/db/connection.ts`
- [X] T009 Create the initial transactional migration with `bookmarks`, `tags`, `bookmark_tags`, `schema_migrations`, archive-consistency checks, cascade foreign keys, and every index specified by `data-model.md` in `src/server/db/migrations/001_initial.sql`
- [X] T010 Implement ordered atomic migration discovery and recording, including startup failure on a bad migration, in `src/server/db/migrate.ts`
- [X] T011 [P] Implement typed API error classes and the `{ error: { code, message, fieldErrors?, details? } }` Express error mapper without leaking internal details in `src/server/errors.ts` and `src/server/middleware/error-handler.ts`
- [X] T012 Assemble JSON parsing, request validation hooks, `/api/health`, API routing mount, production static serving, SPA fallback, and `0.0.0.0:4000` startup in `src/server/app.ts` and `src/server/index.ts`
- [X] T013 [P] Implement the typed fetch wrapper, query serialization, response parsing, and structured error conversion in `src/client/api.ts`
- [X] T014 [P] Create the React entry point and global application shell with loading, initial-load failure/retry, status announcement region, active/archive navigation placeholders, and readiness-marker gating in `index.html`, `src/client/main.tsx`, and `src/client/App.tsx`
- [X] T015 [P] Create isolated temporary-database, migration, Express/Supertest, React render, and deterministic clock helpers in `tests/helpers/database.ts`, `tests/helpers/server.ts`, `tests/helpers/render.tsx`, and `tests/helpers/clock.ts`
- [X] T016 Verify foundation behavior with automated tests for migrations, foreign-key enforcement, migration rollback, error envelopes, health readiness, and harness-marker gating in `tests/integration/foundation.test.ts` and `tests/component/app-readiness.test.tsx`

**Checkpoint**: The application starts with an empty migrated database, health succeeds, failures are structured, and the client distinguishes loading, loaded-empty, and initial-error readiness.

---

## Phase 3: User Story 1 — Save and Revisit Bookmarks (Priority: P1) 🎯 MVP

**Goal**: Let a user save a valid address with a manually entered title, optional notes/tags, see it in the active collection, survive reload/restart, and open it without losing collection context.

**Independent Test**: With no User Story 2 or 3 features present, save a valid bookmark, reload and restart the server, find the bookmark in the active collection, open it in a new browser context, reject an invalid address with preserved input, and explicitly resolve a duplicate warning.

### Tests for User Story 1

- [X] T017 [P] [US1] Add failing unit tests for HTTP/HTTPS URL parsing and normalization, default-port removal, fragment/query preservation, trimming, tag whitespace/case de-duplication, and all shared field limits in `tests/unit/bookmark-schemas.test.ts`
- [X] T018 [P] [US1] Add failing repository/service/API contract tests for create/list persistence, timestamps, tag associations, validation errors, active-only duplicate detection, archived-match allowance, `allowDuplicate`, and internal-failure responses in `tests/integration/bookmark-create-api.test.ts`
- [X] T019 [P] [US1] Add failing component tests for new-collection guidance, labeled create fields, manual-title requirement, field error focus, input preservation, duplicate choices, success/failure announcements, and safe external-link behavior in `tests/component/save-revisit.test.tsx`
- [X] T020 [P] [US1] Add a failing Playwright journey for save, reload, persistence, open-in-new-context, invalid input, duplicate cancel, and explicit duplicate creation in `tests/e2e/save-revisit.spec.ts`

### Implementation for User Story 1

- [X] T021 [P] [US1] Implement standards-based address normalization plus tag trimming, internal-whitespace collapse, case-insensitive comparison, first-casing preservation, 20-tag limit, and orphan-safe tag helpers in `src/server/services/normalization.ts`
- [X] T022 [US1] Implement transactional bookmark creation, tag reuse/association, active collection listing, public projection, and active duplicate lookup with parameterized SQL in `src/server/repositories/bookmark-repository.ts`
- [X] T023 [US1] Implement create/list orchestration, UUID/timestamp generation, duplicate override semantics, and user-safe failures in `src/server/services/bookmark-service.ts`
- [X] T024 [US1] Implement `GET /api/bookmarks` defaults and `POST /api/bookmarks` success/validation/duplicate responses from `contracts/openapi.yaml` in `src/server/routes/bookmarks.ts`
- [X] T025 [P] [US1] Build the keyboard-usable create form with Web address, manually entered Title, Notes, removable Tags, inline constraints, busy state, cancel behavior, and preserved values after failure in `src/client/features/bookmarks/BookmarkForm.tsx` and `src/client/features/bookmarks/TagInput.tsx`
- [X] T026 [P] [US1] Build the active collection, bookmark card, new-collection, no-results-ready placeholder, and recoverable load-error components with safe external opening in `src/client/features/bookmarks/BookmarkList.tsx`, `src/client/features/bookmarks/BookmarkCard.tsx`, and `src/client/features/bookmarks/CollectionState.tsx`
- [X] T027 [US1] Implement the duplicate decision dialog that identifies the existing item and resubmits only after explicit `allowDuplicate: true` consent in `src/client/features/bookmarks/DuplicateDialog.tsx`
- [X] T028 [US1] Integrate initial list loading, create/refetch state, duplicate flow, readiness marker, status announcements, and collection-context preservation in `src/client/App.tsx` and `src/client/features/bookmarks/useBookmarks.ts`
- [X] T029 [US1] Run and make all User Story 1 unit, integration, component, and end-to-end tests pass using `tests/unit/bookmark-schemas.test.ts`, `tests/integration/bookmark-create-api.test.ts`, `tests/component/save-revisit.test.tsx`, and `tests/e2e/save-revisit.spec.ts`

**Checkpoint**: User Story 1 is a deployable MVP that saves and revisits durable bookmarks without organization or maintenance controls.

---

## Phase 4: User Story 2 — Find and Organize Bookmarks (Priority: P2)

**Goal**: Let a user search title/address/notes/tags, filter by tag and favorite, sort the current result set, and favorite/unfavorite items while keeping criteria visible and clearable.

**Independent Test**: Seed bookmarks with different text, tags, dates, and favorite states; verify every search field, combined criteria, four sort orders, criteria visibility/clearing, favorite mutation, and the no-results state without using edit/archive/delete features.

### Tests for User Story 2

- [X] T030 [P] [US2] Add failing repository/API tests for literal escaped case-insensitive substring search, AND-combined query/tag/favorite criteria, scope-aware `availableTags`, favorite updates, and `newest`/`oldest`/`updated`/`title` ordering in `tests/integration/bookmark-query-api.test.ts`
- [X] T031 [P] [US2] Add failing component tests for labeled search/filter/sort controls, visible criteria, one-action clearing, favorite accessible names/busy rollback, no-results guidance, and criteria retention across sorting in `tests/component/find-organize.test.tsx`
- [X] T032 [P] [US2] Add a failing Playwright journey covering search by each field, combined filters, favorite-only behavior, all sort orders, and clearing criteria in `tests/e2e/find-organize.spec.ts`

### Implementation for User Story 2

- [X] T033 [US2] Extend parameterized list queries with escaped case-insensitive title/URL/notes/tag substring matching, AND-combined filters, scope-aware tags, deterministic tie-breakers, and allow-listed sort clauses in `src/server/repositories/bookmark-repository.ts`
- [X] T034 [US2] Implement criteria normalization plus favorite mutation that refreshes `updatedAt` and rejects missing records without partial change in `src/server/services/bookmark-service.ts`
- [X] T035 [US2] Complete list-query validation and favorite-capable `PATCH /api/bookmarks/{bookmarkId}` responses in `src/server/routes/bookmarks.ts`
- [X] T036 [P] [US2] Build debounced labeled search, tag/favorite filters, sort selection, active-criteria summary, responsive filter disclosure, and one-action clear in `src/client/features/bookmarks/CollectionControls.tsx` and `src/client/features/bookmarks/ActiveCriteria.tsx`
- [X] T037 [P] [US2] Add accessible favorite/unfavorite controls, pending protection, rollback-on-failure, and criteria-consistent item removal to `src/client/features/bookmarks/BookmarkCard.tsx`
- [X] T038 [US2] Integrate URL-safe view criteria, list refetching, stale-request protection, sort/filter persistence, and no-results recovery in `src/client/features/bookmarks/useBookmarks.ts` and `src/client/App.tsx`
- [X] T039 [US2] Run and make all User Story 2 integration, component, and end-to-end tests pass using `tests/integration/bookmark-query-api.test.ts`, `tests/component/find-organize.test.tsx`, and `tests/e2e/find-organize.spec.ts`

**Checkpoint**: User Stories 1 and 2 work independently; a 1,000-item collection is navigable without any maintenance features.

---

## Phase 5: User Story 3 — Maintain the Collection (Priority: P3)

**Goal**: Let a user edit details, archive active bookmarks, restore archived bookmarks, and permanently delete only an archived bookmark after explicit accessible confirmation.

**Independent Test**: Edit all mutable details, archive the bookmark, restore it with details intact, archive it again, cancel deletion once, then confirm deletion and verify the item is permanently removed with accurate status feedback.

### Tests for User Story 3

- [X] T040 [P] [US3] Add failing repository/service/API tests for transactional content/tag replacement, URL-update duplicate rejection, timestamp rules, archive/restore invariants, invalid transitions, archived-only deletion, cascading joins, orphan-tag cleanup, and missing-record errors in `tests/integration/bookmark-maintenance-api.test.ts`
- [X] T041 [P] [US3] Add failing component tests for edit-mode labels/input preservation, active/archive view distinction, action busy states, restore, delete-dialog naming, focus trap/restoration, Escape/cancel safety, and success/failure announcements in `tests/component/maintain-collection.test.tsx`
- [X] T042 [P] [US3] Add a failing Playwright journey for edit, archive, restore, cancel delete, confirmed delete, and direct active-delete rejection in `tests/e2e/maintain-collection.spec.ts`

### Implementation for User Story 3

- [X] T043 [US3] Extend repository transactions for content/tag replacement, archive timestamp consistency, restore, archived-only permanent deletion, cascading join deletion, and orphan-tag cleanup in `src/server/repositories/bookmark-repository.ts`
- [X] T044 [US3] Implement edit duplicate checks and the exact active → archived → active/removed state rules with `updatedAt` changes and typed conflicts in `src/server/services/bookmark-service.ts`
- [X] T045 [US3] Complete generic update and implement `POST /api/bookmarks/{bookmarkId}/archive`, `POST /api/bookmarks/{bookmarkId}/restore`, and archived-only `DELETE /api/bookmarks/{bookmarkId}` in `src/server/routes/bookmarks.ts`
- [X] T046 [P] [US3] Extend the shared form into edit mode with populated values, action-specific heading/submit labels, cancel-without-change, and failed-update preservation in `src/client/features/bookmarks/BookmarkForm.tsx`
- [X] T047 [P] [US3] Build the visually distinct archive collection and restore/delete actions without an add control in `src/client/features/bookmarks/ArchiveView.tsx` and `src/client/features/bookmarks/ArchiveCard.tsx`
- [X] T048 [P] [US3] Build the modal permanent-delete confirmation with bookmark name, irreversible warning, safe cancel default, Escape handling, focus containment/restoration, and pending protection in `src/client/features/bookmarks/DeleteBookmarkDialog.tsx`
- [X] T049 [US3] Integrate edit, archive navigation, restore, delete confirmation, refetching, mutation rollback, and status announcements in `src/client/features/bookmarks/useBookmarks.ts` and `src/client/App.tsx`
- [X] T050 [US3] Run and make all User Story 3 integration, component, and end-to-end tests pass using `tests/integration/bookmark-maintenance-api.test.ts`, `tests/component/maintain-collection.test.tsx`, and `tests/e2e/maintain-collection.spec.ts`

**Checkpoint**: All three stories are independently functional, and no bookmark can be permanently deleted from the active collection or without the UI's distinct confirmation action.

---

## Phase 6: Polish & Cross-Cutting Validation

**Purpose**: Finish responsive presentation, accessibility, performance, delivery packaging, and full approved-spec verification across all stories.

- [X] T051 [P] Implement the cohesive responsive visual system, visible focus, touch-sized targets, reduced-motion handling, and long-content wrapping with no page-level overflow at 375px or 1440px in `src/client/styles/tokens.css`, `src/client/styles/global.css`, and `src/client/styles/bookmarks.css`
- [X] T052 [P] Add automated WCAG A/AA scans plus keyboard, semantic heading/label, status-region, focus, and reduced-motion checks across loaded-empty and populated states in `tests/e2e/accessibility.spec.ts`
- [X] T053 [P] Add a deterministic 1,000-bookmark fixture and assert initial load plus representative combined search/filter/sort results settle within 1 second in `tests/fixtures/bookmarks.ts` and `tests/e2e/performance.spec.ts`
- [X] T054 [P] Add restart persistence, destination-unavailable retention, mutation-failure preservation, long-title/address/notes/20-tag wrapping, and 375px/1440px overflow regression coverage in `tests/e2e/resilience-responsive.spec.ts`
- [X] T055 Add production build orchestration, prepared-only `npm start`, source maps, graceful shutdown/database close, and startup migration behavior in `package.json`, `vite.config.ts`, `tsconfig.server.json`, and `src/server/index.ts`
- [X] T056 [P] Document setup, database location/override, manual-title behavior, scripts, validation commands, and deferred metadata scope in `README.md`
- [X] T057 Run `npm ci`, typecheck, all Vitest suites, production build, all Playwright suites, and the smoke scenarios from `specs/001-bookmark-manager/quickstart.md`; record command results and any justified environmental limitations in `specs/001-bookmark-manager/validation.md`
- [X] T058 Create and validate the review declaration with `kind: application`, port 4000, path `/`, `start_command: ["npm", "start"]`, and `start_cwd: "/work"` in `.harness/app.json`
- [X] T059 Start the prepared app through the declared command, verify `http://127.0.0.1:4000/api/health`, `/`, and `data-harness-ready="true"` in a loaded state, then record the review entry point `http://maker:4000/` in `specs/001-bookmark-manager/validation.md`

**Checkpoint**: The production application is built, fully validated against the approved specification, and available for client review through the harness.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 — Setup**: No dependencies; starts immediately.
- **Phase 2 — Foundational**: Depends on Phase 1 and blocks every user story.
- **Phase 3 — User Story 1**: Depends on Phase 2 and delivers the suggested MVP.
- **Phase 4 — User Story 2**: Depends on Phase 2's contracts and storage. It can be developed beside User Story 1 after the foundation, but priority delivery should integrate it after the MVP.
- **Phase 5 — User Story 3**: Depends on Phase 2's contracts and storage. It can be developed beside the other stories after the foundation, but its shared repository/service/UI files require coordinated integration.
- **Phase 6 — Polish**: Depends on every story selected for the release; final build, harness, and validation tasks run after all three approved stories.

### User Story Dependency Graph

```text
Setup → Foundation ┬→ US1 Save & Revisit (MVP) ─┐
                   ├→ US2 Find & Organize ──────┼→ Polish & Release Validation
                   └→ US3 Maintain Collection ──┘
```

The stories are behaviorally independent after the foundation. Sequential delivery remains recommended because later stories extend shared bookmark repository, service, card, hook, route, and app-shell files.

### Within Each User Story

1. Add the story's failing tests and confirm they exercise the documented contract.
2. Implement normalization/model/repository behavior before service orchestration.
3. Implement services before HTTP routes.
4. Implement isolated UI components before app-level integration.
5. Run that story's complete tests and satisfy its checkpoint before advancing.

### Parallel Opportunities

- In Setup, T002–T004 can run concurrently after T001 because they own separate configuration files.
- In Foundation, shared schemas, database connection, error infrastructure, API client, app shell, and test helpers have separate file ownership where marked `[P]`.
- After Foundation, US1, US2, and US3 test authoring can proceed in parallel; implementation against shared files must be integrated in priority order or coordinated carefully.
- Within each story, unit/integration/component/end-to-end test files can be authored together, and UI components marked `[P]` can be built alongside isolated server work.
- In Polish, styling, accessibility, performance, resilience, and documentation tasks can run concurrently before final build validation.

## Parallel Example: User Story 1

```text
T017 tests/unit/bookmark-schemas.test.ts
T018 tests/integration/bookmark-create-api.test.ts
T019 tests/component/save-revisit.test.tsx
T020 tests/e2e/save-revisit.spec.ts

After server prerequisites:
T025 src/client/features/bookmarks/BookmarkForm.tsx + TagInput.tsx
T026 src/client/features/bookmarks/BookmarkList.tsx + BookmarkCard.tsx + CollectionState.tsx
```

## Parallel Example: User Story 2

```text
T030 tests/integration/bookmark-query-api.test.ts
T031 tests/component/find-organize.test.tsx
T032 tests/e2e/find-organize.spec.ts

After service/API prerequisites:
T036 src/client/features/bookmarks/CollectionControls.tsx + ActiveCriteria.tsx
T037 src/client/features/bookmarks/BookmarkCard.tsx
```

## Parallel Example: User Story 3

```text
T040 tests/integration/bookmark-maintenance-api.test.ts
T041 tests/component/maintain-collection.test.tsx
T042 tests/e2e/maintain-collection.spec.ts

After service/API prerequisites:
T046 src/client/features/bookmarks/BookmarkForm.tsx
T047 src/client/features/bookmarks/ArchiveView.tsx + ArchiveCard.tsx
T048 src/client/features/bookmarks/DeleteBookmarkDialog.tsx
```

## Implementation Strategy

### MVP First

1. Complete Phase 1 and Phase 2.
2. Complete User Story 1 through T029.
3. Stop and validate the independent MVP: save, persist, list, open, validate, and resolve duplicates.
4. Demonstrate the MVP if early feedback is useful, without representing organization or maintenance as complete.

### Incremental Delivery

1. **Foundation**: Reproducible project, durable schema, contracts, shells, and test harness.
2. **US1**: A useful bookmark saver and revisiting experience.
3. **US2**: Retrieval and organization for a growing collection.
4. **US3**: Safe ongoing maintenance and archive-before-delete lifecycle.
5. **Polish**: Responsive/accessibility/performance hardening, full validation, and harness delivery.

### Scope Discipline

- Do not add authentication, sharing, folders, import/export, extensions, offline synchronization, external-service syncing, link-health checks, or automatic page title/metadata retrieval.
- The Title field remains required and manually entered throughout this task set.
- Route behavior stays aligned with `contracts/openapi.yaml`; UI behavior stays aligned with `contracts/ui-behavior.md`; data constraints and transitions stay aligned with `data-model.md`.

## Notes

- `[P]` means different file ownership and no dependency on an adjacent incomplete task; it does not waive phase prerequisites.
- `[US1]`, `[US2]`, and `[US3]` provide traceability to the approved user stories.
- Tests are written before the behavior they cover and should initially fail for the expected reason.
- Keep unrelated user changes intact and commit only logical groups if version-control commits are requested later.
- Stop at each story checkpoint to verify independent value before extending shared implementation.
