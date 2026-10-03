---
description: "Dependency-ordered implementation tasks for bookmark management"
---

# Tasks: Bookmark Management

**Input**: Design documents from `specs/001-manage-bookmarks/`

**Prerequisites**: Approved `plan.md` and `spec.md`; supporting `research.md`, `data-model.md`, `contracts/openapi.yaml`, and `quickstart.md`

**Tests**: Included because the approved plan and client expectations require executable verification of the agreed behavior. Story tests are written first and confirmed failing before implementation.

**Organization**: Tasks are grouped by user story so each story can be implemented and verified as a distinct increment.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel with adjacent tasks after its prerequisites are complete
- **[Story]**: Maps the task to a user story in `spec.md`
- Every task names the files it creates or changes

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish the application, quality tooling, and runtime conventions.

- [ ] T001 Initialize the Next.js 16 and React 19 TypeScript application with production and development scripts in `package.json`, `package-lock.json`, `next.config.ts`, `tsconfig.json`, `app/layout.tsx`, and `app/page.tsx`
- [ ] T002 Add Zod, Cheerio, Vitest, Testing Library, and Playwright 1.61.0 dependencies and test scripts in `package.json` and `package-lock.json`
- [ ] T003 [P] Configure linting, formatting, type checking, and Vitest environments in `eslint.config.mjs`, `.prettierrc.json`, `vitest.config.ts`, and `tests/setup.ts`
- [ ] T004 [P] Configure Playwright desktop/mobile projects and deterministic web-server startup in `playwright.config.ts`
- [ ] T005 [P] Add environment validation, database-path configuration, and documented safe defaults in `lib/config.ts` and `.env.example`
- [ ] T006 Create the responsive application shell, design tokens, navigation placeholders, and `data-harness-ready` handling in `app/layout.tsx`, `app/globals.css`, and `components/ui/app-shell.tsx`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Create shared storage, validation, error, and test infrastructure required by every story.

**⚠️ CRITICAL**: No user story work starts until this phase is complete.

- [ ] T007 Implement idempotent SQLite schema initialization with foreign keys, transactions, and indexes in `lib/db/schema.ts` and `scripts/initialize-database.ts`
- [ ] T008 Implement database connection lifecycle and isolated temporary-test database support in `lib/db/client.ts` and `tests/helpers/test-database.ts`
- [ ] T009 Define shared bookmark, tag, metadata-preview, query, and problem types in `lib/bookmarks/types.ts` and `lib/http/problem.ts`
- [ ] T010 Implement input schemas in `lib/validation/bookmark.ts` with these fixed constraints: title `1–300` characters, description at most `1,000`, notes at most `10,000`, tag name `1–50`, at most `30` tags, HTTP/HTTPS bookmark URLs, and reading status limited to `to_read` or `read`
- [ ] T011 [P] Implement URL normalization and comparison rules in `lib/bookmarks/normalize-url.ts`, preserving path/query semantics while lowercasing scheme/host, removing default ports/fragments, and normalizing an empty path to `/`
- [ ] T012 [P] Implement case-folded tag normalization and whitespace handling in `lib/bookmarks/normalize-tag.ts`
- [ ] T013 [P] Implement consistent application/problem+json responses and route error mapping in `lib/http/responses.ts`
- [ ] T014 [P] Build reusable accessible button, field, dialog, status-message, icon-fallback, and empty-state components in `components/ui/`
- [ ] T015 [P] Create deterministic metadata fixture routes and shared API/browser test utilities in `tests/fixtures/metadata-server.ts`, `tests/helpers/api.ts`, and `tests/helpers/browser.ts`

**Checkpoint**: Database, types, validation, error conventions, reusable UI, and isolated test support are ready.

---

## Phase 3: User Story 1 — Save Enriched Bookmarks (Priority: P1) 🎯 MVP

**Goal**: Save, review, edit, open, and permanently delete bookmarks with automatically gathered page details and resilient fallbacks.

**Independent Test**: Save a public fixture URL, review and edit gathered title/description/icon/image, reload to prove persistence, edit the bookmark, open its destination, and exercise both canceled and confirmed deletion; repeat with partial and failed metadata.

### Tests for User Story 1

- [ ] T016 [P] [US1] Write failing unit tests for metadata precedence, relative asset resolution, partial metadata, timeout, response-size limits, redirects, and private-network rejection in `tests/unit/metadata.test.ts` and `tests/unit/network-safety.test.ts`
- [ ] T017 [P] [US1] Write failing integration tests for bookmark create/get/update/delete, duplicate detection across active and archived records, intentional duplicates, persistence, and validation contract responses in `tests/integration/bookmarks-api.test.ts`
- [ ] T018 [P] [US1] Write a failing Playwright journey for metadata review, manual fallback, editing, duplicate warning, reload persistence, external opening, canceled deletion, and confirmed deletion in `tests/e2e/save-bookmark.spec.ts`

### Implementation for User Story 1

- [ ] T019 [US1] Implement the Bookmark repository and mappings in `lib/bookmarks/repository.ts` with required immutable unique `id`, required `url` and indexed `normalized_url`, required trimmed title `1–300`, nullable trimmed description at most `1,000`, nullable trimmed notes at most `10,000`, nullable HTTP/HTTPS imagery URLs, default `favorite=false`, default `reading_status=to_read`, nullable `archived_at`, and maintained creation/update timestamps
- [ ] T020 [P] [US1] Implement DNS/IP classification, redirect-by-redirect validation, five-redirect limit, 2 MB body limit, eight-second timeout, and HTML content checks in `lib/metadata/network-safety.ts` and `lib/metadata/fetch-page.ts`
- [ ] T021 [P] [US1] Implement deterministic page metadata extraction and warning generation in `lib/metadata/extract.ts`
- [ ] T022 [US1] Implement bookmark create/read/update/delete services, metadata-field persistence, normalized duplicate lookup, and intentional-duplicate override in `lib/bookmarks/service.ts`
- [ ] T023 [US1] Implement the metadata preview contract with actionable partial/failure responses in `app/api/metadata/preview/route.ts`
- [ ] T024 [US1] Implement bookmark collection create and item get/patch/delete endpoints in `app/api/bookmarks/route.ts` and `app/api/bookmarks/[id]/route.ts`
- [ ] T025 [US1] Build the two-step URL-to-metadata review and save form, retaining valid input after errors, in `components/bookmarks/bookmark-form.tsx` and `components/bookmarks/metadata-preview.tsx`
- [ ] T026 [P] [US1] Build scannable bookmark cards with image/icon fallbacks, safe external links, descriptions, status labels, and action menus in `components/bookmarks/bookmark-card.tsx`
- [ ] T027 [US1] Build the initial active-library page and add/edit experiences in `app/page.tsx`, `app/bookmarks/new/page.tsx`, and `app/bookmarks/[id]/edit/page.tsx`
- [ ] T028 [US1] Add accessible permanent-delete confirmation, cancel behavior, mutation feedback, and library refresh in `components/bookmarks/delete-bookmark-dialog.tsx` and `components/bookmarks/bookmark-actions.tsx`

**Checkpoint**: The enriched save-and-maintain flow is a persistent, independently usable MVP.

---

## Phase 4: User Story 2 — Manage a Read-Later List (Priority: P2)

**Goal**: Default new bookmarks to to-read, show a dedicated To Read view, and switch between to-read and read without affecting favorite state.

**Independent Test**: Save mixed reading states, show only active to-read bookmarks, mark one read and back to to-read, and verify favorite state remains unchanged.

### Tests for User Story 2

- [ ] T029 [P] [US2] Write failing service and endpoint tests for default `to_read`, state toggles, active-only to-read queries, and favorite-state preservation in `tests/integration/read-later.test.ts`
- [ ] T030 [P] [US2] Write a failing Playwright read-later journey covering default state, dedicated view membership, both transitions, reload persistence, and independent favorite state in `tests/e2e/read-later.spec.ts`

### Implementation for User Story 2

- [ ] T031 [US2] Add reading-state mutation and active to-read scoped query behavior in `lib/bookmarks/service.ts` and `lib/bookmarks/repository.ts`
- [ ] T032 [US2] Expose reading-state updates through `app/api/bookmarks/[id]/route.ts` and scoped results through `app/api/bookmarks/route.ts`
- [ ] T033 [P] [US2] Build reusable reading-state controls with accessible labels and announced results in `components/bookmarks/reading-status-control.tsx`
- [ ] T034 [US2] Build the To Read page and integrate reading-state controls into cards and forms in `app/to-read/page.tsx`, `components/bookmarks/bookmark-card.tsx`, and `components/bookmarks/bookmark-form.tsx`

**Checkpoint**: Read-later works independently while enriched saving continues to work.

---

## Phase 5: User Story 3 — Archive Without Deleting (Priority: P2)

**Goal**: Move bookmarks out of active views without data loss, browse the archive separately, restore intact records, and keep permanent deletion distinct.

**Independent Test**: Archive a tagged favorite to-read bookmark, verify active-view exclusion and archived-view inclusion, restore all details/statuses intact, then separately verify confirmed permanent deletion from archive.

### Tests for User Story 3

- [ ] T035 [P] [US3] Write failing integration tests for archive/restore transitions, active-scope exclusion, archived-scope queries, retained metadata/statuses/tags, invalid transition errors, and archive deletion in `tests/integration/archive.test.ts`
- [ ] T036 [P] [US3] Write a failing Playwright archive journey covering archive, separate browse, restore, canceled deletion, and confirmed deletion in `tests/e2e/archive.spec.ts`

### Implementation for User Story 3

- [ ] T037 [US3] Implement archive and restore state transitions while retaining all bookmark fields and relationships in `lib/bookmarks/service.ts` and `lib/bookmarks/repository.ts`
- [ ] T038 [US3] Implement archive and restore endpoints plus archived collection scope in `app/api/bookmarks/[id]/archive/route.ts`, `app/api/bookmarks/[id]/restore/route.ts`, and `app/api/bookmarks/route.ts`
- [ ] T039 [P] [US3] Build archive/restore controls and state-aware destructive actions in `components/bookmarks/archive-control.tsx` and `components/bookmarks/bookmark-actions.tsx`
- [ ] T040 [US3] Build the separate archived-bookmark page with archive-specific empty state and permanent deletion flow in `app/archive/page.tsx`

**Checkpoint**: Archiving is fully reversible and visibly distinct from permanent deletion.

---

## Phase 6: User Story 4 — Find a Saved Bookmark (Priority: P2)

**Goal**: Search, filter, sort, and paginate active or archived bookmarks with view state represented in the URL.

**Independent Test**: Find bookmarks using every searchable field, combine search with each filter, verify every sort and stable ties, test active/archive separation, and reset a no-results state.

### Tests for User Story 4

- [ ] T041 [P] [US4] Write failing query tests for case-insensitive title/URL/description/notes/tag search, combined tag/favorite/reading filters, scoped active/archive results, stable sorts, and pagination in `tests/integration/bookmark-query.test.ts`
- [ ] T042 [P] [US4] Write a failing Playwright discovery journey for URL-backed search, filters, sorting, pagination, browser navigation, and actionable no-results states in `tests/e2e/find-bookmarks.spec.ts`

### Implementation for User Story 4

- [ ] T043 [US4] Implement parameterized scoped search, combined filters, total counts, stable sorting by `created_desc`, `title_asc`, or `updated_desc`, and bounded pagination in `lib/bookmarks/query.ts` and `lib/bookmarks/repository.ts`
- [ ] T044 [US4] Complete list-query validation and paginated response contract in `app/api/bookmarks/route.ts`
- [ ] T045 [P] [US4] Build debounced URL-backed search, filter, sort, active-criteria, reset, and pagination controls in `components/filters/bookmark-search.tsx`, `components/filters/bookmark-filters.tsx`, and `components/filters/bookmark-sort.tsx`
- [ ] T046 [US4] Integrate query controls, result counts, loading feedback, scoped empty states, and browser-navigation restoration across `app/page.tsx`, `app/to-read/page.tsx`, `app/favorites/page.tsx`, and `app/archive/page.tsx`

**Checkpoint**: Users can quickly retrieve bookmarks from growing active and archived libraries.

---

## Phase 7: User Story 5 — Organize with Tags and Favorites (Priority: P3)

**Goal**: Add canonical reusable tags, clean up unused tags, and toggle independent favorite status with a dedicated Favorites view.

**Independent Test**: Add equivalent mixed-case/whitespace tags without duplication, filter using them, remove their final use and observe cleanup, and toggle favorite status without changing reading or archive state.

### Tests for User Story 5

- [ ] T047 [P] [US5] Write failing integration tests for canonical unique tag names, unique bookmark/tag pairs, transactional relationship replacement, orphan cleanup, usage counts, and independent favorite updates in `tests/integration/tags-favorites.test.ts`
- [ ] T048 [P] [US5] Write a failing Playwright organization journey covering tag creation/reuse/removal/filtering and favorite toggles/view membership in `tests/e2e/organize.spec.ts`

### Implementation for User Story 5

- [ ] T049 [US5] Implement Tag and BookmarkTag persistence in `lib/bookmarks/tag-repository.ts` with immutable unique tag `id`, trimmed display name `1–50`, unique case-folded `normalized_name`, creation timestamp, unique (`bookmark_id`, `tag_id`) pairs, cascading bookmark links, and orphan cleanup
- [ ] T050 [US5] Add transactional tag replacement, tag usage counts, and favorite mutations without altering reading/archive state in `lib/bookmarks/service.ts` and `lib/bookmarks/tag-repository.ts`
- [ ] T051 [US5] Implement the canonical tag-list contract in `app/api/tags/route.ts` and complete favorite scope in `app/api/bookmarks/route.ts`
- [ ] T052 [P] [US5] Build tag entry/autocomplete, removable tag chips, and accessible favorite controls in `components/bookmarks/tag-input.tsx`, `components/bookmarks/tag-chip.tsx`, and `components/bookmarks/favorite-control.tsx`
- [ ] T053 [US5] Integrate tags and favorites into forms, cards, filters, and the dedicated Favorites page in `components/bookmarks/bookmark-form.tsx`, `components/bookmarks/bookmark-card.tsx`, `components/filters/bookmark-filters.tsx`, and `app/favorites/page.tsx`

**Checkpoint**: All five approved user stories are independently functional and integrated.

---

## Phase 8: Polish & Cross-Cutting Verification

**Purpose**: Validate whole-product quality, safety, performance, accessibility, and runtime delivery.

- [ ] T054 [P] Add 10,000-bookmark deterministic seed and performance measurement utilities in `scripts/seed-performance-data.ts` and `tests/performance/library-performance.test.ts`
- [ ] T055 [P] Add responsive visual and keyboard accessibility checks for desktop/mobile primary flows in `tests/e2e/responsive-accessibility.spec.ts`
- [ ] T056 Harden response headers, external-image handling, sensitive logging, metadata-fetch audit messages, and production error disclosure in `next.config.ts`, `lib/metadata/fetch-page.ts`, and `lib/http/responses.ts`
- [ ] T057 Verify the OpenAPI implementation matches `specs/001-manage-bookmarks/contracts/openapi.yaml` and update contract tests in `tests/integration/contract-conformance.test.ts`
- [ ] T058 Run lint, formatting check, typecheck, unit/integration tests, production build, and the full Playwright suite using scripts defined in `package.json`; record any environment limitations in `specs/001-manage-bookmarks/quickstart.md`
- [ ] T059 Execute every acceptance walkthrough in `specs/001-manage-bookmarks/quickstart.md` and correct any implementation divergence in the affected `app/`, `components/`, `lib/`, or `tests/` files
- [ ] T060 Create the production runtime declaration with `kind: application`, port `4000`, path `/`, and foreground start command in `.harness/app.json`, then verify `data-harness-ready="true"` appears only after valid initial UI/data load in `components/ui/app-shell.tsx`

---

## Dependencies & Execution Order

### Phase dependencies

- **Setup (Phase 1)** starts immediately.
- **Foundational (Phase 2)** depends on Setup and blocks all user stories.
- **US1 (Phase 3)** starts after Foundation and establishes bookmark creation/maintenance used by later integrated views.
- **US2 (Phase 4)** and **US3 (Phase 5)** start after US1; their service work can proceed in parallel because reading and archive transitions are independent.
- **US4 (Phase 6)** starts after US2 and US3 so all scopes and statuses can be queried and exercised.
- **US5 (Phase 7)** starts after US1 and may proceed alongside US2/US3; its final filter integration joins US4 after both are complete.
- **Polish (Phase 8)** starts after all selected stories are complete.

### User story dependency graph

```text
Setup → Foundation → US1 ─┬→ US2 ─┐
                          ├→ US3 ─┼→ US4 ─┐
                          └→ US5 ─────────┴→ Polish
```

### Within each user story

- Write the story's tests first and confirm they fail for the expected missing behavior.
- Implement repository/domain behavior before endpoints.
- Implement endpoints before connecting UI flows.
- Complete and pass the independent story test before advancing the sequential path.

## Parallel Opportunities

- T003–T005 can run concurrently after dependency installation is defined.
- T011–T015 touch separate foundational modules and can run concurrently after T007–T010 establish schema/types.
- Each story's unit/integration and browser test files can be authored concurrently.
- T020 and T021 can run concurrently; T026 can be built while service and routes are completed.
- After US1, US2, US3, and the first portion of US5 can be developed concurrently.
- T054 and T055 can run concurrently once all stories are present.

## Parallel Execution Examples

### User Story 1

```text
T016: Metadata and network-safety unit tests
T017: Bookmark API integration tests
T018: Enriched-save browser journey

After T019:
T020: Safe page retrieval
T021: Metadata extraction
T026: Bookmark card presentation
```

### User Stories 2, 3, and 5

```text
After US1 is complete:
Developer A: T029–T034 (read later)
Developer B: T035–T040 (archive)
Developer C: T047–T052 (tags and favorites, holding final filter integration for US4)
```

## Implementation Strategy

### MVP first

1. Complete Setup and Foundation.
2. Complete US1 through T028.
3. Run US1 unit, integration, and browser tests.
4. Demonstrate persistent enriched bookmark saving and maintenance as the MVP checkpoint.

### Incremental delivery

1. Add read-later and independently validate it.
2. Add archive/restore and independently validate it.
3. Add full discovery across every completed state.
4. Complete tags/favorites and their discovery integration.
5. Run cross-cutting safety, performance, responsiveness, accessibility, and runtime checks.

## Notes

- `[P]` marks tasks that operate in separate files or can be coordinated without relying on incomplete adjacent tasks.
- Tests are part of the approved verification approach and precede the corresponding implementation.
- No task changes the approved product scope; any newly discovered behavior question returns to the specification gate.
- Commit after each task or coherent task group and preserve the isolated test database boundary.
