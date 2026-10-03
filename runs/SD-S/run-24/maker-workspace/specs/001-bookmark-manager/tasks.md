# Tasks: Personal Bookmark Manager

**Input**: Design documents from `specs/001-bookmark-manager/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/openapi.yaml`, `quickstart.md`

**Tests**: The approved plan requires unit, component, HTTP integration, browser acceptance, accessibility, persistence, and performance validation. Test tasks appear before their corresponding implementation tasks and must fail for the expected reason before implementation begins.

**Organization**: Tasks are grouped by user story so each story can be implemented and validated as a distinct increment.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it uses different files and has no dependency on another incomplete task in the same group.
- **[Story]**: Maps the task to an approved user story.
- Every task includes the exact file path or paths it changes.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish the build, test, and source structure selected in the approved plan.

- [x] T001 Initialize the Node 24/TypeScript npm project with pinned React 19.3, Vite 8, Express 5.2, Zod 4, better-sqlite3 13, Vitest 5, Testing Library, Supertest, Playwright 1.61.0, axe, lint, format, build, test, and start scripts in `package.json` and `package-lock.json`
- [x] T002 [P] Configure strict shared, browser, and server TypeScript plus Vite client/server production output in `tsconfig.json`, `tsconfig.client.json`, `tsconfig.server.json`, `vite.config.ts`, and `index.html`
- [x] T003 [P] Configure linting and formatting checks for TypeScript, React, tests, and configuration files in `eslint.config.js`, `.prettierrc.json`, and `.prettierignore`
- [x] T004 [P] Configure Vitest/jsdom, coverage thresholds, Playwright 1.61.0 Chromium reuse, isolated web-server startup, traces, and failure screenshots in `vitest.config.ts`, `playwright.config.ts`, and `src/client/test-setup.ts`
- [x] T005 Create the planned directory skeleton and ignore runtime SQLite/WAL/shared-memory and test artifacts while retaining the data directory in `.gitignore` and `data/.gitkeep`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Implement the contracts, integrity rules, database bootstrapping, and test isolation required by every user story.

**⚠️ CRITICAL**: No user-story implementation begins until this phase is complete.

- [x] T006 Define shared API/domain types and Zod schemas in `src/shared/bookmark-types.ts` and `src/shared/bookmark-schema.ts`, applying verbatim Bookmark constraints: `id` is “Database-generated positive primary key; immutable”; `title` is “Trimmed; 1–200 Unicode characters”; `url` is “Trimmed submitted value; 1–2,048 characters; valid HTTP(S) URL”; `normalized_url` is “Deterministic comparison key; unique and immutable except when URL changes”; `notes` is “Trimmed; empty string allowed; maximum 5,000 characters”; favorite/archive values are “0 or 1” and default to `0`; `created_at` is “Set once at creation; ISO 8601 format”; and `updated_at` is “Set at creation and changed after each successful mutation”
- [x] T007 [P] Write failing normalization and schema-boundary tests covering whitespace, protocols, default ports, root/trailing slashes, preserved path/query/fragment, Unicode tags, duplicate tag collapse, and every field limit in `src/shared/normalize-url.test.ts`, `src/shared/normalize-tag.test.ts`, and `src/shared/bookmark-schema.test.ts`
- [x] T008 Implement URL and tag normalization in `src/shared/normalize-url.ts` and `src/shared/normalize-tag.ts`, applying verbatim Tag constraints: `name` is “First retained display spelling; 1–40 characters”; `normalized_name` is “Trimmed, Unicode-normalized, internal whitespace collapsed, lowercase comparison key; unique”; and each bookmark has “0–20 distinct normalized tags”
- [x] T009 Create strict `bookmarks`, `tags`, `bookmark_tags`, and `schema_migrations` tables with unique normalized keys, `0/1` checks, composite relationship primary key, cascade foreign keys, and planned indexes in `migrations/001_initial.sql`
- [x] T010 Implement database creation, foreign-key enforcement, WAL mode, numbered transactional migrations, clean shutdown, and configurable database path in `src/server/db/database.ts` and `src/server/db/migrate.ts`
- [x] T011 [P] Implement typed domain errors and the OpenAPI error envelope for validation, invalid query, duplicate URL with existing bookmark ID, not found, and safe internal failures in `src/server/errors.ts` and `src/server/middleware/error-handler.ts`
- [x] T012 Create the Express application shell with JSON limits, `/api` routing, production static serving, SPA fallback, and dependency injection for the database in `src/server/app.ts` and `src/server/routes/index.ts`
- [x] T013 [P] Build deterministic clocks/IDs, isolated temporary SQLite databases, HTTP test-app creation, factories, and teardown helpers without a production reset endpoint in `tests/helpers/test-app.ts`, `tests/helpers/factories.ts`, and `tests/helpers/database.ts`

**Checkpoint**: Schemas, normalization, database migration, server shell, and isolated test infrastructure are ready.

---

## Phase 3: User Story 1 - Save and Revisit Bookmarks (Priority: P1) 🎯 MVP

**Goal**: Save a valid titled web address with optional notes, reject invalid/duplicate links with corrective feedback, list saved bookmarks, open destinations separately, and preserve data across sessions.

**Independent Test**: Save a valid web address, confirm it appears with its entered details and creation date, open it without losing the collection view, restart the application and confirm it remains, then verify invalid and normalized-duplicate submissions are blocked and lead to the existing item.

### Tests for User Story 1

- [x] T014 [P] [US1] Write failing repository tests for transactional create/list/get, exact normalized-URL uniqueness, default states, stable timestamps, and persistence after reopening the database in `src/server/repositories/bookmark-repository.test.ts`
- [x] T015 [P] [US1] Write failing OpenAPI integration tests for `GET /api/bookmarks`, `GET /api/bookmarks/{id}`, and `POST /api/bookmarks`, including validation envelopes, HTTP(S)-only URLs, HTTP 409 duplicate responses, and not-found behavior in `tests/integration/bookmarks-create-list.test.ts`
- [x] T016 [P] [US1] Write failing component tests for the add form, retained values and field errors, duplicate notice/focus, populated list, initial empty guidance, loading/error states, and accessible success/failure announcements in `src/client/components/BookmarkForm.test.tsx` and `src/client/components/BookmarkList.test.tsx`
- [x] T017 [US1] Write failing browser acceptance tests for save/revisit, separate-context outbound opening, invalid/duplicate submission, first-bookmark empty state, and persistence after server restart in `tests/e2e/bookmarks.spec.ts` and `tests/e2e/persistence.spec.ts`

### Implementation for User Story 1

- [x] T018 [US1] Implement transactional bookmark creation plus get/default-list mapping and database duplicate-race handling in `src/server/repositories/bookmark-repository.ts`
- [x] T019 [US1] Implement validated `GET /api/bookmarks`, `GET /api/bookmarks/:bookmarkId`, and `POST /api/bookmarks` routes matching `contracts/openapi.yaml` in `src/server/routes/bookmarks.ts`
- [x] T020 [P] [US1] Implement the typed fetch client, response validation, and API error mapping for list/get/create in `src/client/api.ts`
- [x] T021 [US1] Implement the accessible add-bookmark dialog/form with required manual title, URL, optional notes, retained values, field-linked errors, pending state, and duplicate navigation in `src/client/components/BookmarkForm.tsx`
- [x] T022 [P] [US1] Implement bookmark cards/list, initial empty guidance, loaded-error retry, dates/status display, notes access, and safe separate-context destination links in `src/client/components/BookmarkCard.tsx`, `src/client/components/BookmarkList.tsx`, and `src/client/components/EmptyState.tsx`
- [x] T023 [US1] Orchestrate initial loading, add flow, duplicate reveal/focus, live status messages, and `data-harness-ready="true"` only after a loaded or valid empty result in `src/client/App.tsx` and `src/client/main.tsx`
- [x] T024 [US1] Add the responsive semantic shell, visible focus, labeled form layout, dialog treatment, cards, empty/error states, and status region styling needed for the MVP in `src/client/styles/base.css` and `src/client/styles/bookmarks.css`

**Checkpoint**: User Story 1 is a persistent, independently runnable bookmark-saving MVP.

---

## Phase 4: User Story 2 - Find and Organize Bookmarks (Priority: P2)

**Goal**: Assign case-insensitive reusable tags and find bookmarks through literal search, match-all tags, favorite/archive filters, deterministic sorting, and one-action reset.

**Independent Test**: Seed or create bookmarks with distinct titles, URLs, notes, tags, favorite states, and archive states; verify every search field, multi-tag match-all behavior, status filters, all four sorts, no-results guidance, and reset without relying on maintenance controls.

### Tests for User Story 2

- [x] T025 [P] [US2] Write failing repository and HTTP integration tests for literal case-insensitive search across four fields, escaped punctuation, match-all tag filtering, favorite true/false, active/archived selection, deterministic sort tie-breakers, tag counts, query validation, and no hidden 5,000-item cap in `src/server/repositories/bookmark-query.test.ts` and `tests/integration/bookmarks-query.test.ts`
- [x] T026 [P] [US2] Write failing component tests for tag entry/deduplication, URL-backed search/filter/sort controls, multi-tag selection, filter badges, no-results state, one-action reset, and browser back/forward restoration in `src/client/components/CollectionControls.test.tsx` and `src/client/hooks/useCollectionState.test.tsx`
- [x] T027 [US2] Write failing browser tests for title/URL/notes/tag search, mixed case and punctuation, match-all tags, favorite/archive filters, all sort modes, no-results, and reset on desktop and narrow viewports in `tests/e2e/collection-view.spec.ts`

### Implementation for User Story 2

- [x] T028 [US2] Add safe literal search, tag joins/HAVING match-all logic, favorite/archive filters, deterministic newest/oldest/title/updated ordering, and tag summaries to `src/server/repositories/bookmark-repository.ts`
- [x] T029 [US2] Implement validated collection query parsing plus `GET /api/tags` behavior from the OpenAPI contract in `src/server/routes/bookmarks.ts` and `src/server/routes/tags.ts`
- [x] T030 [P] [US2] Implement URL query-string serialization, defaults, browser navigation, and one-action reset for `q`, `tags`, `favorite`, `archived`, and `sort` in `src/client/hooks/useCollectionState.ts`
- [x] T031 [US2] Implement labeled search, reusable tag selection, favorite/archive filters, four-way sorting, active-filter summary, and reset controls in `src/client/components/CollectionControls.tsx` and extend tag assignment in `src/client/components/BookmarkForm.tsx`
- [x] T032 [US2] Integrate current-query fetching, tag summaries, results counts, distinct no-results content, and one-second-visible-update behavior without resetting collection state in `src/client/App.tsx`, `src/client/api.ts`, and `src/client/components/EmptyState.tsx`

**Checkpoint**: User Story 2 can be tested with fixtures independently and adds complete organization/retrieval to the MVP.

---

## Phase 5: User Story 3 - Maintain the Collection (Priority: P3)

**Goal**: Edit bookmark details, favorite/unfavorite, archive/restore, and permanently delete only after accessible confirmation while preserving the current collection view.

**Independent Test**: Seed one bookmark, edit all editable fields, toggle favorite, archive and restore, cancel a deletion, then confirm deletion; verify timestamps/state and collection query remain correct after every action.

### Tests for User Story 3

- [x] T033 [P] [US3] Write failing repository and HTTP integration tests for atomic detail/tag replacement, duplicate-on-update exclusion of self, updated timestamps, favorite/archive independence, restore, cascade/orphan cleanup, confirmed API deletion, and not-found/error envelopes in `src/server/repositories/bookmark-mutations.test.ts` and `tests/integration/bookmarks-mutations.test.ts`
- [x] T034 [P] [US3] Write failing component tests for prefilled edit validation, favorite/archive/restore actions, pending/error rollback, delete cancel/confirm, native modal focus containment/Escape/return, and current-view preservation in `src/client/components/BookmarkActions.test.tsx` and `src/client/components/DeleteBookmarkDialog.test.tsx`
- [x] T035 [US3] Write failing browser tests for edit, duplicate edit, favorite/unfavorite, archive/restore, cancel/confirm delete, mutation announcements, focus restoration, and unchanged query/filter/sort state in `tests/e2e/maintenance.spec.ts`

### Implementation for User Story 3

- [x] T036 [US3] Implement transactional edit/tag replacement, duplicate ownership checks, favorite/archive mutations, restore, permanent deletion, cascade cleanup, orphan-tag cleanup, and timestamp updates in `src/server/repositories/bookmark-repository.ts`
- [x] T037 [US3] Implement validated `PATCH /api/bookmarks/:bookmarkId` and `DELETE /api/bookmarks/:bookmarkId` routes exactly matching the OpenAPI success/error contract in `src/server/routes/bookmarks.ts`
- [x] T038 [P] [US3] Extend the typed API client with update, state-change, and delete operations plus field/duplicate/not-found error mapping in `src/client/api.ts`
- [x] T039 [US3] Reuse and extend the bookmark form for prefilled editing, tag replacement, validation retention, duplicate navigation, and edit success announcements in `src/client/components/BookmarkForm.tsx`
- [x] T040 [P] [US3] Implement keyboard-accessible edit, favorite/unfavorite, archive/restore, and delete action controls with pending states in `src/client/components/BookmarkActions.tsx` and integrate them into `src/client/components/BookmarkCard.tsx`
- [x] T041 [P] [US3] Implement explicit permanent-delete confirmation with the least-destructive initial focus, Escape/cancel behavior, modal focus containment, background inertness, and focus restoration in `src/client/components/DeleteBookmarkDialog.tsx`
- [x] T042 [US3] Orchestrate edit/state/delete mutations, current-query refetch without state reset, logical focus when an item leaves the view, and accessible outcome announcements in `src/client/App.tsx`

**Checkpoint**: All three approved user stories are functional and independently covered.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Verify accessibility, scale, operational startup, and complete delivery across all stories.

- [x] T043 [P] Add axe scans for empty, populated, add/edit, validation, duplicate, favorites, archived, no-results, and open-delete-dialog states plus keyboard dialog checks in `tests/e2e/accessibility.spec.ts`
- [x] T044 [P] Add the non-production 5,000-bookmark seed fixture and browser performance assertions for under-one-second visible query updates and no omitted older entries in `tests/helpers/seed-performance.ts` and `tests/e2e/performance.spec.ts`
- [x] T045 [P] Finish WCAG 2.2 AA-oriented 320 CSS-pixel reflow, 200% zoom resilience, 24px target spacing, contrast, reduced-motion, and forced-colors behavior in `src/client/styles/base.css` and `src/client/styles/bookmarks.css`
- [x] T046 Configure the production entry point to migrate before listening, bind `0.0.0.0:${PORT:-4000}`, shut down cleanly, and serve the built client; verify `npm run build` and `npm start` in `src/server/index.ts`, `package.json`, and `vite.config.ts`
- [x] T047 [P] Write project operation, data-file/backup, validation-command, scope, and deferred automatic-title notes in `README.md`
- [x] T048 Run every automated command and manual accessibility/acceptance step from `specs/001-bookmark-manager/quickstart.md`, then record measured results, coverage, performance, and any honest limitations in `specs/001-bookmark-manager/validation.md`
- [x] T049 After T048 passes, declare the prepared app start contract with `kind: application`, port `4000`, path `/`, command `["npm", "start"]`, and cwd `/work` in `.harness/app.json`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Starts immediately. T001 establishes dependency metadata; T002–T004 can then proceed in parallel, while T005 is independent.
- **Foundational (Phase 2)**: Depends on Setup. T006 precedes T007/T008; tests in T007 must fail before T008. T009 and T011 can proceed in parallel after shared types are settled. T010 depends on T009. T012 depends on T010 and T011. T013 depends on T010 and T012. This phase blocks every user story.
- **User Story 1 (Phase 3)**: Depends on Foundational. Tests T014–T016 can be authored in parallel; T017 follows enough browser shell/test configuration to express the journey. Implement T018–T024 until all US1 tests pass.
- **User Story 2 (Phase 4)**: Depends on Foundational and reuses shared Bookmark/Tag entities. It can be developed against seeded fixtures without completed US1 UI, but the recommended product sequence is after US1. Implement T028–T032 after failing tests T025–T027.
- **User Story 3 (Phase 5)**: Depends on Foundational and the bookmark repository/card surfaces introduced for US1. It does not require US2 query controls for functional testing, though FR-017 browser coverage uses the completed US2 view. Implement T036–T042 after failing tests T033–T035.
- **Polish (Phase 6)**: T043–T047 depend on the relevant completed story surfaces and can run in parallel. T048 depends on all desired stories and T043–T047. T049 depends on a successful T048.

### User Story Dependency Graph

```text
Setup → Foundation → US1 (save/revisit) ───────────────┐
                   ├→ US2 (find/organize) ─────────────┼→ Polish → Validation → Harness
                   └→ US3 (maintain; uses US1 surface) ─┘
```

- **US1 (P1)**: First deployable MVP; no dependency on another user story.
- **US2 (P2)**: Independently testable after Foundation using fixtures; integrates with US1 form/list for the delivered product.
- **US3 (P3)**: Independently testable after Foundation plus the US1 bookmark surface; its collection-state preservation acceptance check integrates with US2.

### Within Each User Story

- Write tests first and confirm they fail for the expected missing behavior.
- Implement repository behavior before routes.
- Implement the typed client before UI integration.
- Complete the core story before cross-story polish.
- Do not advance a checkpoint while that story's unit, component, integration, or browser tests fail.

## Parallel Execution Examples

### User Story 1

```text
T014 repository tests || T015 HTTP tests || T016 component tests
T020 API client || T022 card/list/empty components
```

### User Story 2

```text
T025 query/API tests || T026 control/hook tests
T030 URL state hook (after its tests) || server-side T028/T029 sequence
```

### User Story 3

```text
T033 mutation/API tests || T034 component tests
T038 API client || T040 action controls || T041 delete dialog
```

Parallel markers exclude tasks that edit the same file or consume behavior not yet implemented.

## Implementation Strategy

### MVP First

1. Complete Setup and Foundation.
2. Complete User Story 1 tests and implementation.
3. Stop and validate the save/revisit, invalid/duplicate, new-tab, and restart-persistence flows.
4. Demonstrate the persistent MVP before adding organization and maintenance.

### Incremental Delivery

1. **US1** delivers persistent save/revisit and duplicate protection.
2. **US2** adds tags, search, filters, sorting, no-results, and reset.
3. **US3** adds editing, favorites, archive/restore, and confirmed deletion.
4. **Polish** closes accessibility, 5,000-item performance, production startup, documentation, and runtime presentation.

Each checkpoint must keep all previously completed story tests green. Automatic title retrieval remains deferred and must not be introduced by any task in this list.

## Notes

- `[P]` means the task is safe to execute concurrently with other marked tasks in its example group; it does not waive explicit phase dependencies.
- `[US1]`, `[US2]`, and `[US3]` provide traceability back to the approved user stories.
- Test data uses temporary databases; no production data-reset endpoint is permitted.
- Exact package versions are preserved by `package-lock.json`, and Playwright remains pinned to 1.61.0 for the installed browser revision.
- Commit after each task or cohesive task group, and stop at each checkpoint for verification.
