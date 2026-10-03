# Tasks: Bookmark Manager

**Input**: Approved design documents from `specs/001-manage-bookmarks/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/openapi.yaml`, `quickstart.md`

**Tests**: Included because the approved plan requires unit, integration, contract, browser, security, responsive, and performance validation. Within each story, write the listed tests first and confirm they fail for the missing behavior before implementing it.

**Organization**: Tasks are grouped by user story so each increment can be completed and validated independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it targets different files and has no dependency on another incomplete task in the same group.
- **[Story]**: Maps the task to an approved user story.
- Every task names its implementation or validation path.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Initialize the single-package TypeScript web application and its quality tooling.

- [ ] T001 Create the planned `src/client/`, `src/server/`, `src/shared/`, `migrations/`, `data/`, `tests/unit/`, `tests/integration/`, `tests/contract/`, and `tests/e2e/` directories with `data/.gitkeep`
- [ ] T002 Initialize the npm package and lock React 19, Vite 7, Fastify 5, `@fastify/static`, Zod 4, Cheerio 1, Undici 7, `ipaddr.js`, TypeScript 5, Vitest, ESLint, and `@playwright/test` 1.61.0 in `package.json` and `package-lock.json`
- [ ] T003 [P] Configure strict TypeScript compilation and client/server build outputs in `tsconfig.json`, `tsconfig.client.json`, and `tsconfig.server.json`
- [ ] T004 [P] Configure the Vite client build and development `/api` proxy in `vite.config.ts` and create the root mount document in `index.html`
- [ ] T005 [P] Configure unit/integration test projects and pinned Chromium desktop/mobile projects in `vitest.config.ts` and `playwright.config.ts`
- [ ] T006 [P] Configure linting, formatting, generated output exclusions, local database exclusions, and npm scripts in `eslint.config.js`, `.prettierignore`, `.gitignore`, and `package.json`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish the contracts, persistence, server shell, client shell, and reusable test support required by every story.

**Critical gate**: No user-story implementation begins until this phase is complete.

- [ ] T007 Define shared Zod schemas and inferred types in `src/shared/schemas.ts` and `src/shared/types.ts`, preserving these approved field constraints: `url` is a normalized absolute HTTP(S) URL, maximum 2,048 characters, and a public destination when metadata is retrieved; `title` is trimmed, non-empty, maximum 200 characters; `description` is trimmed plain text or null, maximum 500 characters; `notes` is trimmed user-authored text or null, maximum 2,000 characters; `is_favorite` is boolean and defaults to false; a bookmark has 0–20 distinct tags; query is 0–200 characters; sort is `newest`, `oldest`, or `title`
- [ ] T008 Create the initial transactional SQLite schema in `migrations/001_initial.sql` with these approved entity constraints: bookmark `id` is a generated immutable UUID, `normalized_url` is the indexed canonical comparison form, `created_at` is immutable, and `updated_at` advances on successful edits; tag `id` is generated, `name` is trimmed/non-empty/maximum 40 characters, and `normalized_name` is case-folded and unique; bookmark-tag `(bookmark_id, tag_id)` is the composite key with cascading foreign keys; migration `version` is the filename-prefix primary key with required `name` and `applied_at`; include every index listed in `data-model.md`
- [ ] T009 Implement file-backed and temporary-database creation, defensive settings, migration execution, transaction helpers, and graceful close behavior in `src/server/db/database.ts` and `src/server/db/migrations.ts`
- [ ] T010 [P] Implement environment parsing for host `0.0.0.0`, default port `4000`, database path, production asset path, and metadata-fetch limits in `src/server/config.ts`
- [ ] T011 Implement the Fastify application factory, `/api/health`, stable error envelope, request logging with private-field redaction, static production assets, and client navigation fallback in `src/server/app.ts` and `src/server/routes/health.ts`
- [ ] T012 Implement process startup, migration-before-listen, `0.0.0.0:4000` binding, signal handling, and graceful shutdown in `src/server/index.ts`
- [ ] T013 [P] Create the React root, global error boundary, accessible application shell, initial loading/error states, and delayed `data-harness-ready="true"` readiness marker in `src/client/main.tsx`, `src/client/App.tsx`, and `src/client/components/AppShell.tsx`
- [ ] T014 [P] Create reusable typed HTTP/error handling in `src/client/api/http.ts` and test database, Fastify injection, network-transport, and bookmark factories in `tests/helpers/database.ts`, `tests/helpers/server.ts`, `tests/helpers/metadataTransport.ts`, and `tests/helpers/bookmarks.ts`

**Checkpoint**: The database migrates, the server and client shells build, shared contracts compile, `/api/health` responds, and isolated tests can create app instances.

---

## Phase 3: User Story 1 — Save and revisit a bookmark (Priority: P1) MVP

**Goal**: Let the user paste an address, receive editable retrieved or fallback page details, save durably, see the bookmark after reload, and open its destination.

**Independent Test**: Paste a controlled public page URL, verify title and description retrieval, edit and save it, reload and find it, then open it; repeat with missing/unreachable metadata and verify a savable fallback within 10 seconds.

### Tests for User Story 1

- [ ] T015 [P] [US1] Write failing URL normalization, public-IP classification, redirect validation, HTML metadata extraction, plain-text normalization, 200/500-character truncation, and fallback-title tests in `tests/unit/urlPolicy.test.ts` and `tests/unit/metadataParser.test.ts`
- [ ] T016 [P] [US1] Write failing OpenAPI-aligned tests for `POST /api/page-metadata`, `POST /api/bookmarks`, duplicate confirmation, and baseline `GET /api/bookmarks` responses in `tests/contract/us1-api.test.ts`
- [ ] T017 [P] [US1] Write failing integration tests for durable create/list behavior, normalized duplicate detection, public-address enforcement, validated redirect hops, DNS-rebinding-resistant connection selection, 8-second deadline, 1 MiB cap, 5-redirect cap, HTML-only parsing, and fallback warnings in `tests/integration/us1-save.test.ts` and `tests/integration/metadataSafety.test.ts`
- [ ] T018 [P] [US1] Write the failing desktop and mobile fast-save, user-edit preservation, failure fallback, persistence-after-reload, duplicate confirmation, and destination-opening journeys in `tests/e2e/us1-save.spec.ts`

### Implementation for User Story 1

- [ ] T019 [P] [US1] Implement scheme completion, WHATWG URL normalization, credential rejection, hostname fallback titles, IPv4/IPv6 public-range classification, DNS resolution, and redirect-hop validation in `src/server/services/urlPolicy.ts`
- [ ] T020 [P] [US1] Implement deterministic `og:title`/document-title and meta/OG-description extraction, entity decoding, whitespace collapse, plain-text handling, and field limits in `src/server/services/metadataParser.ts`
- [ ] T021 [US1] Implement bounded Undici retrieval with injected DNS/transport seams, approved-address connection pinning, TLS hostname verification, no automatic redirects/retries, per-hop validation, 8-second total deadline, 1 MiB body cap, 5-redirect cap, HTML/XHTML checking, and typed fallbacks in `src/server/services/metadataFetcher.ts`
- [ ] T022 [P] [US1] Implement transactional bookmark creation, normalized duplicate lookup with explicit override, baseline newest-first listing, timestamp mapping, and persistence across repository reopen in `src/server/db/bookmarkRepository.ts`
- [ ] T023 [US1] Implement `POST /api/page-metadata` with 400 validation, 403 unsafe-destination rejection, 200 retrieved/fallback results, and user-safe warnings in `src/server/routes/pageMetadata.ts`
- [ ] T024 [US1] Implement OpenAPI-aligned `POST /api/bookmarks` and baseline `GET /api/bookmarks`, including 201 creation, 409 duplicate identification, validation errors that retain client input, and route registration in `src/server/routes/bookmarks.ts` and `src/server/app.ts`
- [ ] T025 [P] [US1] Implement typed list/create/metadata API calls, cancellation, and stable error mapping in `src/client/api/bookmarks.ts`
- [ ] T026 [US1] Build the accessible create-bookmark dialog with address-only entry, 400 ms automatic retrieval, explicit retry, visible status announcements, editable title/description, dirty-field protection, stale-result rejection, fallback explanation, duplicate confirmation, and value preservation after errors in `src/client/features/bookmarks/BookmarkEditor.tsx` and `src/client/hooks/usePageMetadata.ts`
- [ ] T027 [US1] Build the initial library list/card and valid empty state showing title, URL, optional description, creation date, and an external destination action in `src/client/features/bookmarks/BookmarkList.tsx`, `src/client/features/bookmarks/BookmarkCard.tsx`, and `src/client/features/bookmarks/EmptyLibrary.tsx`
- [ ] T028 [US1] Integrate initial loading, creation, refresh, persistence, error recovery, and harness readiness in `src/client/App.tsx` and style the responsive MVP in `src/client/styles/base.css` and `src/client/styles/bookmarks.css`

**Checkpoint**: User Story 1 works independently as a durable fast-save MVP, including safe metadata retrieval and graceful fallback.

---

## Phase 4: User Story 2 — Find and organize bookmarks (Priority: P2)

**Goal**: Add notes, case-insensitive distinct tags, favorites, search across all approved fields, composable tag/favorite filters, and actionable no-result handling.

**Independent Test**: Create bookmarks with varied titles, URLs, descriptions, notes, tags, and favorite states; verify every search field, tag/favorite filtering separately and together, and reset from the no-results state.

### Tests for User Story 2

- [ ] T029 [P] [US2] Write failing tag trimming, case-folding, duplicate collapse, 20-tag/40-character constraints, query normalization, and filter-state tests in `tests/unit/tagNormalization.test.ts` and `tests/unit/libraryFilters.test.ts`
- [ ] T030 [P] [US2] Write failing list-contract tests for `query` up to 200 characters, one `tag` up to 40 characters, optional `favorite`, tag counts, validation errors, and combined filters in `tests/contract/us2-api.test.ts`
- [ ] T031 [P] [US2] Write failing temporary-database integration tests for transactional tag creation/reuse, orphan cleanup, notes/favorite persistence, case-insensitive partial matching across title/URL/description/notes/tags, logical-AND filters, and stable results in `tests/integration/us2-organize.test.ts`
- [ ] T032 [P] [US2] Write failing desktop and mobile journeys for notes, tag entry/removal, favorites, debounced search, tag/favorite filters, combined filters, cancellation of stale results, and resettable no-results state in `tests/e2e/us2-organize.spec.ts`

### Implementation for User Story 2

- [ ] T033 [P] [US2] Implement tag display/normalized forms, case-insensitive deduplication, blank rejection, and the approved 20-tag and 40-character limits in `src/shared/tagNormalization.ts`
- [ ] T034 [US2] Extend transactional bookmark writes and list queries with notes, favorites, tag reuse/orphan cleanup, tag counts, case-insensitive substring search across title/URL/description/notes/tags, one-tag and favorite filters composed with AND, and stable result IDs in `src/server/db/bookmarkRepository.ts`
- [ ] T035 [US2] Extend `GET /api/bookmarks` query validation and response mapping for search, tag, favorite, and aggregate tag options in `src/server/routes/bookmarks.ts`
- [ ] T036 [P] [US2] Add accessible notes, tag creation/removal, tag-limit feedback, and favorite controls to create flow without disrupting address metadata state in `src/client/features/bookmarks/BookmarkEditor.tsx` and `src/client/features/bookmarks/TagInput.tsx`
- [ ] T037 [P] [US2] Build the 250 ms debounced search, tag selector, favorites toggle, active-filter summary, request cancellation, and clear-all behavior in `src/client/features/bookmarks/LibraryControls.tsx` and `src/client/hooks/useBookmarkQuery.ts`
- [ ] T038 [US2] Display notes, tags, and favorite state on bookmark cards and implement the actionable no-results state in `src/client/features/bookmarks/BookmarkCard.tsx`, `src/client/features/bookmarks/BookmarkList.tsx`, and `src/client/features/bookmarks/NoResults.tsx`
- [ ] T039 [US2] Integrate filtered library state and tag counts in `src/client/App.tsx` and complete responsive control/tag/favorite styling in `src/client/styles/bookmarks.css`

**Checkpoint**: User Stories 1 and 2 each pass independently; the app now saves quickly and remains usable as the library grows.

---

## Phase 5: User Story 3 — Maintain the library (Priority: P3)

**Goal**: Let the user edit all bookmark fields, explicitly refresh details after address changes, permanently delete only after confirmation, and sort newest, oldest, or alphabetically.

**Independent Test**: Edit every bookmark field and persist it, change an address and exercise stale-detail replacement, verify each sort order, cancel deletion once, then confirm and verify permanent removal.

### Tests for User Story 3

- [ ] T040 [P] [US3] Write failing OpenAPI-aligned update/delete tests for success, invalid UUID/input, missing bookmark, normalized URL conflict, and 204 deletion in `tests/contract/us3-api.test.ts`
- [ ] T041 [P] [US3] Write failing integration tests for transactional full-field updates, unchanged creation time/advanced update time, explicit metadata replacement, newest/oldest/title ordering with ID tie-breakers, cascading junction deletion, and orphan-tag cleanup in `tests/integration/us3-maintain.test.ts`
- [ ] T042 [P] [US3] Write failing desktop and mobile journeys for opening prefilled edit state, preserving edited details after address change, explicit replacement, each sort option, delete-dialog cancel/confirm, focus return, and persistence after reload in `tests/e2e/us3-maintain.spec.ts`

### Implementation for User Story 3

- [ ] T043 [US3] Implement transactional full-field update, cross-record URL conflict detection, stable newest/oldest/title ordering with ID tie-breakers, deletion cascades, orphan-tag cleanup, and not-found outcomes in `src/server/db/bookmarkRepository.ts`
- [ ] T044 [US3] Implement OpenAPI-aligned `PUT /api/bookmarks/{bookmarkId}` and `DELETE /api/bookmarks/{bookmarkId}` with validation, 404/409 mapping, 200 updated bookmark, and 204 deletion in `src/server/routes/bookmarks.ts`
- [ ] T045 [US3] Reuse the editor for prefilled update state and implement address-change staleness, explicit retrieve/replace choice, user-edit protection, and save-error preservation in `src/client/features/bookmarks/BookmarkEditor.tsx` and `src/client/hooks/usePageMetadata.ts`
- [ ] T046 [P] [US3] Build an accessible destructive-action confirmation dialog with focus containment, cancel, confirm, and trigger-focus return in `src/client/components/ConfirmDialog.tsx`
- [ ] T047 [P] [US3] Add newest, oldest, and alphabetical sort selection with visible current state in `src/client/features/bookmarks/LibraryControls.tsx`
- [ ] T048 [US3] Integrate edit/delete mutations, confirmation flow, sorting, refresh, and actionable failure states in `src/client/App.tsx`, `src/client/features/bookmarks/BookmarkCard.tsx`, and `src/client/styles/bookmarks.css`

**Checkpoint**: All three approved user stories are independently functional and their automated checks pass.

---

## Phase 6: Polish & Cross-Cutting Validation

**Purpose**: Verify whole-product accessibility, security, performance, packaging, and review readiness without expanding scope.

- [ ] T049 [P] Add focused keyboard, visible-focus, label, live-region, dialog-focus, touch-target, and horizontal-overflow assertions across desktop and mobile in `tests/e2e/accessibility-responsive.spec.ts`
- [ ] T050 [P] Add a 10,000-bookmark fixture generator and measure 95th-percentile search/filter/sort visible updates against the 1-second goal in `tests/helpers/seedLargeLibrary.ts` and `tests/e2e/performance.spec.ts`
- [ ] T051 [P] Add startup migration, persistence-after-restart, graceful-shutdown, safe-log-redaction, static-asset, and client-fallback integration checks in `tests/integration/runtime.test.ts`
- [ ] T052 Audit URL parsing, DNS resolution, redirect validation, connection pinning, body/time bounds, output text handling, database parameterization, and error redaction; record verified threat cases in `specs/001-manage-bookmarks/security-validation.md` and add any missing regression cases under `tests/unit/` or `tests/integration/`
- [ ] T053 Finalize production build/start scripts and deployment metadata for `0.0.0.0:4000` in `package.json` and `.harness/app.json`, ensuring `npm start` only starts already prepared output from `/work`
- [ ] T054 Execute every command and scenario in `specs/001-manage-bookmarks/quickstart.md`, record actual results and any environment limitations in `specs/001-manage-bookmarks/validation-results.md`, and leave the built app ready at `http://maker:4000/`

---

## Dependencies & Execution Order

### Phase dependencies

- **Setup (Phase 1)** has no dependencies.
- **Foundational (Phase 2)** depends on Setup and blocks all user stories.
- **User Story 1 (Phase 3)** depends only on Foundational and is the deployable MVP.
- **User Story 2 (Phase 4)** depends on Foundational at the architecture level, but its final integration extends the US1 editor, card, list, and repository; implement sequentially after US1 in a single-developer workflow.
- **User Story 3 (Phase 5)** depends on the shared foundation and edits existing bookmarks; implement after US1. Its tag cleanup and complete UI integration also reuse US2 behavior.
- **Polish (Phase 6)** depends on all stories selected for the release.

### User-story completion graph

```text
Setup → Foundation → US1 (MVP) → US2 → US3 → Polish/Release
                         └────────→ US3 API work may begin after US1
```

### Within each user story

1. Write the story's tests and verify they fail for the missing behavior.
2. Implement pure validation/model services before dependent data or network services.
3. Implement repository behavior before HTTP routes.
4. Implement typed client calls before UI integration.
5. Run the story-specific unit, contract, integration, desktop, and mobile checks at its checkpoint.

## Parallel Opportunities

- After T002, T003–T006 target separate configuration files and can proceed in parallel.
- In Foundation, T010, T013, and T014 can proceed alongside database work after their inputs exist.
- US1 test authoring T015–T018 can run in parallel; implementation T019, T020, T022, and T025 targets separate modules before dependent integration.
- US2 test authoring T029–T032 can run in parallel; T033, T036, and T037 target distinct modules before repository/UI integration.
- US3 test authoring T040–T042 can run in parallel; T046 and T047 target separate UI components while server work proceeds.
- T049–T051 are independent final validation suites.

## Parallel Example: User Story 1

```text
Task T019: Implement URL and network-destination policy in src/server/services/urlPolicy.ts
Task T020: Implement metadata parsing in src/server/services/metadataParser.ts
Task T022: Implement create/list persistence in src/server/db/bookmarkRepository.ts
Task T025: Implement typed browser API calls in src/client/api/bookmarks.ts
```

## Parallel Example: User Story 2

```text
Task T033: Implement tag normalization in src/shared/tagNormalization.ts
Task T036: Add notes/tags/favorite editor controls in src/client/features/bookmarks/BookmarkEditor.tsx and TagInput.tsx
Task T037: Build search/filter controls in src/client/features/bookmarks/LibraryControls.tsx and useBookmarkQuery.ts
```

## Parallel Example: User Story 3

```text
Task T040: Write update/delete contract tests in tests/contract/us3-api.test.ts
Task T041: Write maintenance integration tests in tests/integration/us3-maintain.test.ts
Task T042: Write maintenance browser journeys in tests/e2e/us3-maintain.spec.ts
```

## Implementation Strategy

### MVP first

1. Complete Setup and Foundation.
2. Complete User Story 1 through T028.
3. Stop and run the US1 checkpoint: safe automatic details, editable fallback, durable save/reload, duplicate handling, and opening destinations.
4. Present the functional MVP before adding organization and maintenance if an intermediate review is useful.

### Incremental delivery

1. **US1** delivers the core reason for the app: fast, durable saving by URL.
2. **US2** adds organization and retrieval without changing the core save contract.
3. **US3** adds ongoing maintenance and ordering.
4. **Polish** verifies the integrated release against accessibility, security, runtime, and scale goals.

## Notes

- `[P]` marks tasks that can be started concurrently when their prerequisite phase is complete.
- `[US1]`, `[US2]`, and `[US3]` provide traceability to the approved specification.
- Keep page metadata and personal notes out of logs.
- Use isolated temporary databases and injected network seams in tests; never probe private addresses to test SSRF protection.
- Do not implement excluded v1 features such as accounts, sharing, import/export, browser extensions, page snapshots, generated summaries, or link monitoring.
