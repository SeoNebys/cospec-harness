# Tasks: Personal Bookmark Manager

**Input**: Design documents from `specs/001-manage-bookmarks/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/openapi.yaml](contracts/openapi.yaml), [quickstart.md](quickstart.md)

**Tests**: Included because the approved implementation plan defines unit, component, integration, end-to-end, accessibility, security, persistence, and performance verification.

**Organization**: Tasks are grouped by user story so each increment has its own goal and independent acceptance test.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can be performed in parallel with other marked tasks in the same stage because it targets different files and has no dependency on unfinished work.
- **[Story]**: Maps the task to an approved user story (`US1`–`US4`).
- Every task names the file or directory it changes.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Initialize the single-package TypeScript application and verification toolchain.

- [X] T001 Create `package.json` and `package-lock.json` with Node `>=24.15 <25`, exact initial runtime dependencies from `plan.md`, `@playwright/test` pinned to `1.61.0`, and scripts for `dev`, `build`, `start`, `typecheck`, `lint`, `test`, and `test:e2e`
- [X] T002 [P] Configure strict ESM TypeScript builds for shared, server, and client code in `tsconfig.json`, `tsconfig.server.json`, and `tsconfig.client.json`
- [X] T003 [P] Configure the React build, `/api` development proxy, and server/client output directories in `vite.config.ts`
- [X] T004 [P] Configure Vitest projects for Node and jsdom plus Testing Library setup in `vitest.config.ts` and `tests/setup-dom.ts`
- [X] T005 [P] Configure Chromium-only Playwright 1.61.0 runs, the production web server, desktop/mobile projects, and `/opt/playwright-browsers` reuse in `playwright.config.ts`
- [X] T006 [P] Configure TypeScript-aware linting and ignore generated/runtime data in `eslint.config.js` and `.gitignore`
- [X] T007 Create the planned source/test directory skeleton and the Vite HTML entry point in `src/client/index.html`, `src/shared/`, `src/server/`, `src/client/`, `migrations/`, `tests/`, and `data/.gitkeep`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish contracts, validation, storage, server lifecycle, and test fixtures used by every story.

**Critical**: User-story implementation starts only after this phase passes its checks.

- [X] T008 [P] Define the OpenAPI-aligned Bookmark, Tag, ReadingState, SortOrder, list/query, metadata-preview, and error TypeScript contracts in `src/shared/contracts.ts`
- [X] T009 [P] Implement shared Zod request schemas in `src/shared/schemas.ts` with these exact constraints: URL is a “Trimmed absolute HTTP(S) URL, at most 4,096 characters; no embedded username/password”; title is “Trimmed, 1–300 Unicode code points”; description is “Empty string or trimmed text up to 2,000 Unicode code points”; reading state is `untracked`, `to_read`, or `read`; every tag is 1–40 Unicode code points; and one bookmark has at most 20 tags
- [X] T010 [P] Implement URL canonicalization/fragment-free duplicate keys and tag trim + Unicode NFKC + lowercase normalization in `src/shared/normalization.ts`
- [X] T011 Create `STRICT` bookmarks, tags, bookmark_tags, and schema_migrations tables plus planned indexes and checks in `migrations/001_initial.sql`, enforcing the field constraints from `data-model.md`, cascading association deletes, unique `normalized_name`, and non-unique indexed `url_key`
- [X] T012 Implement environment parsing for `HOST`, `PORT`, and `DATABASE_PATH`, defaulting to `0.0.0.0`, `4000`, and `data/bookmarks.sqlite`, in `src/server/config.ts`
- [X] T013 Implement SQLite opening with WAL, foreign keys, prepared-statement safety, injectable test paths, and graceful close behavior in `src/server/db/connection.ts`
- [X] T014 Implement ordered, transactional schema migration execution before readiness in `src/server/db/migrations.ts`
- [X] T015 Implement the exported Express application with JSON limits, Helmet defaults, shared validation-error conversion, not-found/error envelopes, and `GET /api/health` in `src/server/app.ts`
- [X] T016 Implement production startup, shutdown, compiled SPA static serving/fallback, and `0.0.0.0:4000` listening in `src/server/server.ts`
- [X] T017 [P] Create the React entry point, initial loading/error/empty shell, and top-level error boundary in `src/client/main.tsx` and `src/client/App.tsx`
- [X] T018 Create isolated temporary-database helpers, deterministic clock/UUID factories, metadata DNS/transport fakes, and representative bookmark builders in `tests/fixtures/database.ts`, `tests/fixtures/metadata.ts`, and `tests/fixtures/bookmarks.ts`
- [X] T019 Add foundational unit/integration coverage for every schema boundary, URL/tag normalization, migration-from-empty behavior, foreign-key enforcement, and database reopen behavior in `tests/unit/normalization.test.ts`, `tests/unit/schemas.test.ts`, and `tests/integration/database.test.ts`

**Checkpoint**: Configuration, shared contracts, database migrations, health endpoint, client shell, and deterministic test fixtures are ready.

---

## Phase 3: User Story 1 — Quickly Save and Revisit Bookmarks (Priority: P1) 🎯 MVP

**Goal**: Paste a URL, safely obtain editable page information when possible, save manually when not, persist the bookmark, handle duplicates explicitly, list it, and open its destination without losing the library.

**Independent Test**: Paste a controlled public-page URL that supplies a title and description, edit the suggestion, save, reload/restart, and open the destination; repeat with unavailable metadata and manual title entry, and verify duplicate open-existing/save-anyway choices.

### Tests for User Story 1

- [X] T020 [P] [US1] Write failing repository/service tests for atomic create/list/get, UTC timestamps, tag reuse, duplicate `409` and `allowDuplicate`, validation rollback, and reopen persistence in `tests/integration/bookmark-create.test.ts`
- [X] T021 [P] [US1] Write failing metadata parser tests for title/description precedence, entity decoding, whitespace/control cleanup, partial/absent/malformed metadata, legacy encodings, 300/1,000-code-point output caps, and escaped markup-like text in `tests/unit/metadata-parser.test.ts`
- [X] T022 [P] [US1] Write failing metadata security tests for alternate-form IPv4, IPv6, IPv4-mapped IPv6, all planned non-public/reserved ranges, mixed DNS answers, rebinding pinning, credentialed/custom-port URLs, redirects, four-second deadline, concurrency, headers/content types, decompression, and 512 KiB body cap in `tests/integration/metadata-security.test.ts`
- [X] T023 [P] [US1] Write failing component tests for metadata loading/success/partial/unavailable announcements, manual fallback, editable suggestions, URL A/URL B response races, type-then-clear edit versions, validation, and duplicate choices in `tests/component/bookmark-form.test.tsx`
- [X] T024 [P] [US1] Write the failing Playwright MVP journey for automatic and manual save, duplicate decisions, new-tab destination opening, reload persistence, empty state, and keyboard completion in `tests/e2e/save-bookmark.spec.ts`

### Implementation for User Story 1

- [X] T025 [US1] Implement transactional bookmark create/list/get and tag upsert/association mapping with prepared statements and orphan cleanup in `src/server/db/bookmark-repository.ts`
- [X] T026 [US1] Implement create validation, canonical URL duplicate detection, explicit duplicate override, stable response mapping, and mutation error handling in `src/server/services/bookmark-service.ts`
- [X] T027 [P] [US1] Implement globally routable IPv4/IPv6 classification, full DNS-answer validation, and validated-address connection pinning primitives in `src/server/services/metadata-network-policy.ts`
- [X] T028 [P] [US1] Implement non-executing HTML byte parsing and normalized title/description extraction using standard elements before Open Graph/Twitter fallbacks in `src/server/services/metadata-parser.ts`
- [X] T029 [US1] Implement the metadata fetch pipeline with HTTP(S)-only validation, ports 80/443, no credentials/ambient headers, three manually revalidated redirects, four-second total deadline, four-request concurrency cap, HTML/XHTML-only responses, bounded headers, and 512 KiB decompressed-body cap in `src/server/services/metadata-service.ts`
- [X] T030 [US1] Implement `GET/POST /api/bookmarks`, `GET /api/bookmarks/:bookmarkId`, and `POST /api/page-metadata` exactly as documented in `src/server/routes/bookmarks.ts` and `src/server/routes/metadata.ts`, then mount them in `src/server/app.ts`
- [X] T031 [P] [US1] Implement typed same-origin API calls and structured error/duplicate handling in `src/client/api/bookmarks.ts` and `src/client/api/metadata.ts`
- [X] T032 [US1] Implement abortable metadata form state with URL request generations and per-field empty/automatic/user origin plus edit versions in `src/client/features/bookmarks/useBookmarkForm.ts`
- [X] T033 [US1] Implement the labelled create form, tag entry, metadata live-status feedback, manual fallback, validation messages, and duplicate open-existing/save-anyway actions in `src/client/features/bookmarks/BookmarkForm.tsx`
- [X] T034 [P] [US1] Implement semantic bookmark cards/list, saved dates, tags, reading-state label, and destination links using `target="_blank"` plus `rel="noopener noreferrer"` in `src/client/features/bookmarks/BookmarkCard.tsx` and `src/client/features/bookmarks/BookmarkList.tsx`
- [X] T035 [US1] Integrate initial loading, valid empty state, add/save flow, last-successful-list retention on refresh failure, and readiness marker behavior in `src/client/App.tsx`
- [X] T036 [US1] Run and make the US1 unit, integration, component, and Playwright tests pass without weakening the assertions in `tests/unit/metadata-parser.test.ts`, `tests/integration/bookmark-create.test.ts`, `tests/integration/metadata-security.test.ts`, `tests/component/bookmark-form.test.tsx`, and `tests/e2e/save-bookmark.spec.ts`

**Checkpoint**: The save-and-revisit MVP works independently, including metadata safety, manual fallback, duplicate acknowledgement, persistence, and keyboard operation.

---

## Phase 4: User Story 2 — Manage a Read-Later Queue (Priority: P2)

**Goal**: Set Untracked/To Read/Read states, view only pending items, mark them Read without deletion, and return them to the queue later.

**Independent Test**: Mark several bookmarks To Read, confirm only they appear in Read Later, mark one Read and verify it remains in Library, then mark it To Read again and confirm all changes survive reload.

### Tests for User Story 2

- [X] T037 [P] [US2] Write failing repository/API tests for every reading-state transition, `view=read-later` membership, invalid values, last-item empty state data, and persistence after database reopen in `tests/integration/read-later.test.ts`
- [X] T038 [P] [US2] Write failing component and Playwright tests for accessible Library/Read Later tabs, create/edit/card state actions, mark-Read removal without deletion, re-queueing, empty Read Later feedback, keyboard use, and reload persistence in `tests/component/read-later.test.tsx` and `tests/e2e/read-later.spec.ts`

### Implementation for User Story 2

- [X] T039 [US2] Add transactional reading-state updates and `to_read`-only candidate selection with deterministic newest ordering in `src/server/db/bookmark-repository.ts` and `src/server/services/bookmark-service.ts`
- [X] T040 [US2] Implement `PATCH /api/bookmarks/:bookmarkId/reading-state` and `view=read-later` list behavior from the OpenAPI contract in `src/server/routes/bookmarks.ts`
- [X] T041 [US2] Implement URL-backed Library/Read Later tabs with the documented ARIA tab keyboard behavior in `src/client/features/bookmarks/LibraryTabs.tsx` and `src/client/features/bookmarks/useLibraryView.ts`
- [X] T042 [US2] Add reading-state controls to create/edit/card flows, direct Mark Read behavior, re-queue actions, and the purposeful last-item Read Later empty state in `src/client/features/bookmarks/BookmarkForm.tsx`, `src/client/features/bookmarks/BookmarkCard.tsx`, and `src/client/App.tsx`
- [X] T043 [US2] Run and make the US2 integration, component, and Playwright tests pass without weakening the assertions in `tests/integration/read-later.test.ts`, `tests/component/read-later.test.tsx`, and `tests/e2e/read-later.spec.ts`

**Checkpoint**: Reading states and the dedicated Read Later queue work independently and preserve the full library.

---

## Phase 5: User Story 3 — Find and Organize Bookmarks (Priority: P3)

**Goal**: Search every approved field, filter by all selected tags, sort deterministically, preserve controls in the URL, and show actionable no-result states in both views.

**Independent Test**: Seed bookmarks with distinct titles, URLs, descriptions, tags, dates, and reading states; verify case-insensitive matches, multi-tag AND filtering, all sort modes, Read Later scoping, URL-state retention, and clearable no-results feedback.

### Tests for User Story 3

- [X] T044 [P] [US3] Write failing repository/API tests for title/URL/description/tag search, case insensitivity, escaped wildcard input, multi-tag AND semantics, newest/oldest/title ordering with ID tie-breakers, current tag counts, and Read Later scoping in `tests/integration/bookmark-query.test.ts`
- [X] T045 [P] [US3] Write failing component and Playwright tests for query-parameter restoration, search, tag selection/removal, sort, active-criteria retention after save, actionable no-results state, and identical controls in Read Later in `tests/component/library-controls.test.tsx` and `tests/e2e/find-bookmarks.spec.ts`

### Implementation for User Story 3

- [X] T046 [US3] Implement server-side case-insensitive field search, escaped matching, all-selected-tag intersection, stable newest/oldest/title sorts, and combined Read Later criteria in `src/server/db/bookmark-repository.ts` and `src/server/services/bookmark-service.ts`
- [X] T047 [US3] Implement `GET /api/tags` with only associated tags, display spelling, normalized name, counts, and alphabetical order in `src/server/routes/tags.ts` and mount it in `src/server/app.ts`
- [X] T048 [P] [US3] Add typed bookmark-query and tag-list calls in `src/client/api/bookmarks.ts` and `src/client/api/tags.ts`
- [X] T049 [US3] Implement debounced search, multi-tag filters, sort selection, active-filter summary, and URL query synchronization in `src/client/features/bookmarks/LibraryControls.tsx` and `src/client/features/bookmarks/useLibraryView.ts`
- [X] T050 [US3] Integrate controls with both views, preserve criteria after mutations, retain the last valid list on errors, and implement clearable no-result feedback in `src/client/App.tsx` and `src/client/features/bookmarks/BookmarkList.tsx`
- [X] T051 [US3] Run and make the US3 integration, component, and Playwright tests pass without weakening the assertions in `tests/integration/bookmark-query.test.ts`, `tests/component/library-controls.test.tsx`, and `tests/e2e/find-bookmarks.spec.ts`

**Checkpoint**: A growing library is searchable, tag-filterable, sortable, and predictable in both Library and Read Later.

---

## Phase 6: User Story 4 — Maintain Bookmark Details (Priority: P4)

**Goal**: Edit every bookmark field atomically and permanently delete only after explicit confirmation while keeping views and tags consistent.

**Independent Test**: Edit URL, title, description, tags, and reading state; reload to verify persistence; cancel a delete; then confirm deletion and verify the bookmark and unused tags disappear everywhere.

### Tests for User Story 4

- [X] T052 [P] [US4] Write failing repository/API tests for atomic full replacement, unchanged `created_at`, changed `updated_at`, current-row exclusion during duplicate checks, duplicate override, tag reuse/orphan cleanup, rollback, not-found errors, and cascading deletion in `tests/integration/bookmark-maintenance.test.ts`
- [X] T053 [P] [US4] Write failing component and Playwright tests for prefilled edit form, validation/manual metadata behavior after URL edits, saved changes with active criteria preserved, inline delete Cancel/Delete focus flow, and removal from all views in `tests/component/bookmark-maintenance.test.tsx` and `tests/e2e/maintain-bookmarks.spec.ts`

### Implementation for User Story 4

- [X] T054 [US4] Implement transactional full bookmark replacement and deletion with tag association replacement, unused-tag cleanup, timestamp invariants, duplicate exclusion/override, and rollback in `src/server/db/bookmark-repository.ts`
- [X] T055 [US4] Implement update/delete service validation and `PUT/DELETE /api/bookmarks/:bookmarkId` responses exactly as documented in `src/server/services/bookmark-service.ts` and `src/server/routes/bookmarks.ts`
- [X] T056 [US4] Reuse the controlled bookmark form for editing, including URL-triggered metadata suggestions that never overwrite populated/user-edited fields, in `src/client/features/bookmarks/BookmarkForm.tsx`
- [X] T057 [US4] Implement semantic Edit actions and inline deletion confirmation with Cancel first, logical focus restoration, and clear success/failure feedback in `src/client/features/bookmarks/BookmarkCard.tsx` and `src/client/features/bookmarks/DeleteConfirmation.tsx`
- [X] T058 [US4] Integrate edit/delete mutations with list/tag refresh, active query retention, and last-successful-data preservation in `src/client/App.tsx`
- [X] T059 [US4] Run and make the US4 integration, component, and Playwright tests pass without weakening the assertions in `tests/integration/bookmark-maintenance.test.ts`, `tests/component/bookmark-maintenance.test.tsx`, and `tests/e2e/maintain-bookmarks.spec.ts`

**Checkpoint**: All four approved user stories are independently testable and work together without data loss.

---

## Phase 7: Polish and Cross-Cutting Verification

**Purpose**: Complete accessibility, responsive presentation, hardening, measurable outcomes, and review delivery across all stories.

- [X] T060 [P] Build the responsive visual system, readable long-text behavior, mobile layout, empty/error/status treatments, visible focus, reduced-motion support, and reusable tokens in `src/client/styles/tokens.css`, `src/client/styles/base.css`, and `src/client/styles/components.css`
- [X] T061 [P] Add ARIA snapshots and focused WCAG 2.2 AA assertions for labels, landmarks, tabs, live regions, focus order, contrast-critical states, and keyboard-only flows in `tests/e2e/accessibility.spec.ts`
- [X] T062 [P] Add a deterministic 1,000-bookmark seed path and `@performance` Playwright scenario proving one-second search/filter/sort updates and under-ten-second known-item retrieval in `tests/fixtures/seed.ts` and `tests/e2e/performance.spec.ts`
- [X] T063 [P] Add process-restart persistence coverage using a temporary file-backed database and the production server command in `tests/e2e/persistence.spec.ts`
- [X] T064 Harden cross-cutting server behavior with bounded JSON bodies, no CORS, non-sensitive structured errors/logs, safe production static caching, and clean shutdown under failed writes in `src/server/app.ts` and `src/server/server.ts`
- [X] T065 Verify every OpenAPI operation and error envelope against Supertest coverage, adding any missing contract cases to `tests/integration/api-contract.test.ts`
- [X] T066 Run the complete verification scripts from `package.json` (`npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, and `npm run test:e2e`) and fix failures in their reported source/test paths without reducing approved coverage
- [X] T067 Execute every scenario in `specs/001-manage-bookmarks/quickstart.md` against the production build and record verified results or honest limitations in `specs/001-manage-bookmarks/validation.md`
- [X] T068 Create `/work/.harness/app.json` with the verified `npm start` command, port 4000, `/` entry path, and application kind only after the production build and dependencies are ready

---

## Dependencies and Execution Order

### Phase Dependencies

- **Phase 1 — Setup**: No dependency; begins immediately.
- **Phase 2 — Foundational**: Depends on Phase 1 and blocks user-story implementation.
- **Phase 3 — US1**: Depends on Phase 2 and delivers the first usable bookmark manager.
- **Phase 4 — US2**: Server state-transition work can begin after Phase 2, but its complete UI journey depends on US1's bookmark list/card/create surfaces.
- **Phase 5 — US3**: Query work can begin after Phase 2, but complete integration depends on US1's list and tag persistence surfaces; Read Later query coverage additionally depends on US2.
- **Phase 6 — US4**: Repository work can begin after Phase 2, but complete edit/delete journeys depend on US1's form, list, and card surfaces.
- **Phase 7 — Polish**: Depends on every user story selected for release; T068 additionally depends on the successful production build and validation.

### User Story Completion Graph

```text
Setup → Foundation → US1 (Save/Revisit MVP)
                          ├──→ US2 (Read Later)
                          ├──→ US3 (Find/Organize)
                          └──→ US4 (Maintain)
US2 + US3 + US4 ─────────────→ Polish and Release Validation
```

### Within Each User Story

1. Write the story's tests and confirm they fail for the missing behavior.
2. Implement repository/service behavior before HTTP routes.
3. Implement typed client access before UI integration.
4. Complete the UI journey and accessibility behavior.
5. Run the entire story test set and preserve its assertions.

## Parallel Opportunities

- In Setup, T002–T006 target independent configuration files after package choices are known.
- In Foundation, shared contracts/schemas/normalization (T008–T010) and the initial client shell (T017) can proceed independently; database tasks remain ordered T011 → T013 → T014.
- US1 test specifications T020–T024 can be authored in parallel; network policy T027, parser T028, client API T031, and list/card UI T034 also target separate modules.
- US2 test tasks T037–T038 can run in parallel before the implementation sequence T039–T042.
- US3 test tasks T044–T045 and client API T048 can be separated from server query implementation.
- US4 test tasks T052–T053 can run in parallel before repository/service/UI implementation.
- Polish tasks T060–T063 target distinct CSS and test files and can proceed in parallel once the relevant stories exist.

## Parallel Examples

### User Story 1

```text
T020 repository/service create tests
T021 metadata parser tests
T022 metadata security tests
T023 form component tests
T024 Playwright MVP journey

Then, in parallel after interfaces are stable:
T027 metadata network policy
T028 metadata parser
T031 client API
T034 bookmark list/card UI
```

### User Story 2

```text
T037 reading-state repository/API tests
T038 Read Later component/Playwright tests
```

### User Story 3

```text
T044 query repository/API tests
T045 controls component/Playwright tests
T048 typed query/tag client calls
```

### User Story 4

```text
T052 maintenance repository/API tests
T053 maintenance component/Playwright tests
```

## Implementation Strategy

### MVP First

1. Complete Setup and Foundation.
2. Complete US1 through T036.
3. Stop and validate the independent save/revisit journey.
4. The resulting MVP already provides safe metadata suggestions, manual fallback, durable bookmarks, duplicate handling, and destination opening.

### Incremental Delivery

1. **US1**: Save and revisit bookmarks.
2. **US2**: Add the actionable Read Later queue.
3. **US3**: Add retrieval and organization for a growing library.
4. **US4**: Add long-term maintenance through editing and deletion.
5. **Polish**: Prove accessibility, security, scale, restart persistence, and review readiness.

## Notes

- `[P]` means the task targets separate files and has no dependency on another unfinished task in that parallel set.
- Story labels provide traceability to `spec.md`; setup, foundation, and polish tasks intentionally have no story label.
- Exact behaviors and response shapes come from `contracts/openapi.yaml`; data constraints and invariants come from `data-model.md`.
- Tests are written before their story implementation and must initially fail for the intended missing behavior.
- Stop at any checkpoint to validate the increment independently.
