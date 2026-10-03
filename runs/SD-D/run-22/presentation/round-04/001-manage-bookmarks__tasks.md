# Tasks: Personal Bookmark Manager

**Input**: Approved design documents from `specs/001-manage-bookmarks/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`

**Tests**: Automated tests are included because the approved plan defines unit, integration, component, end-to-end, accessibility, security, persistence, and performance validation for measurable acceptance outcomes.

**Organization**: Tasks are grouped by user story so each story can be implemented and validated as a coherent increment.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel with adjacent eligible work because it targets different files and has no unmet dependency
- **[Story]**: Maps the task to its approved user story
- Every task names the exact file or directory it changes

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Initialize the single-package TypeScript application and its quality toolchain.

- [ ] T001 Create `package.json` and `package-lock.json` with Node 24 engine, production dependencies for React 19.3, Fastify 5, Zod and Cheerio, and development dependencies for TypeScript, Vite 8, Vitest, React Testing Library, axe-core, ESLint, Prettier, and `@playwright/test` pinned to 1.61.0
- [ ] T002 [P] Configure TypeScript and shared client/server path aliases in `tsconfig.json`, `tsconfig.client.json`, and `tsconfig.server.json`
- [ ] T003 [P] Configure the React client build, development API proxy, and production output in `vite.config.ts` and `index.html`
- [ ] T004 [P] Configure linting, formatting, unit test projects, and ignored runtime/build artifacts in `eslint.config.js`, `.prettierrc.json`, `vitest.config.ts`, and `.gitignore`
- [ ] T005 Create the planned source and test directory skeleton with entry barrels in `src/client/`, `src/server/`, `src/shared/`, `tests/unit/`, `tests/integration/`, `tests/e2e/`, and `tests/fixtures/`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish persistence, shared boundary contracts, application bootstrapping, and deterministic test infrastructure required by every story.

**Critical**: No user-story implementation starts until this phase passes.

- [ ] T006 Implement numbered migration execution, foreign-key enforcement, write-ahead logging, transaction helpers, database path configuration, and clean shutdown in `src/server/db/database.ts` and `src/server/db/migrate.ts`
- [ ] T007 Create the initial SQLite schema and indexes in `src/server/db/migrations/001_initial.sql`: Bookmark `id` is UUID text primary key; `url` is required; `normalized_url` is required and unique; `title` is required and 1–300 normalized characters; `description` is nullable and at most 2,000 normalized characters; `icon_path` is nullable; `notes` is nullable plain text and at most 10,000 characters; `read_later` and `is_read` default false with `is_read=false` whenever `read_later=false`; `created_at` is required immutable UTC text; `updated_at` is required UTC text; Tag `display_name` is required trimmed text of 1–100 characters and `normalized_name` is required unique text; BookmarkTag uses `(bookmark_id, tag_id)` as its primary key with cascading foreign keys; add indexes for normalized URL, created time, normalized title, reading state, and association lookups
- [ ] T008 [P] Define shared Zod schemas and TypeScript types for success envelopes, stable error envelopes, URL limits, Bookmark, BookmarkInput, BookmarkPatch, MetadataPreview, reading-state input, query summary, and tag summary in `src/shared/contracts/api.ts`, matching `specs/001-manage-bookmarks/contracts/openapi.yaml`
- [ ] T009 [P] Implement UTC clock and UUID injection points plus application configuration validation for host `0.0.0.0`, port `4000`, database location, metadata budgets, and icon-cache location in `src/server/config.ts` and `src/server/runtime.ts`
- [ ] T010 Implement Fastify construction, request validation, centralized error mapping, structured non-sensitive logging, `/api` registration, static-client serving, and graceful start/stop in `src/server/app.ts` and `src/server/server.ts`
- [ ] T011 [P] Implement the accessible React application shell, route/view state, global operation-status region, error boundary, and `data-harness-ready="true"` readiness contract in `src/client/App.tsx`, `src/client/main.tsx`, and `src/client/styles/global.css`
- [ ] T012 [P] Implement the typed HTTP client and stable error decoding in `src/client/api/client.ts`
- [ ] T013 [P] Configure temporary SQLite databases, deterministic clock/UUID helpers, Fastify injection, mocked DNS/fetch adapters, and local HTML/icon fixtures in `tests/helpers/`, `tests/setup.ts`, and `tests/fixtures/metadata/`

**Checkpoint**: The app boots with an empty migrated database, the client shell loads, boundary types compile, and isolated tests can run without public-network access.

---

## Phase 3: User Story 1 — Save a Bookmark with Page Details (Priority: P1) MVP

**Goal**: Paste a URL, retrieve editable title/description/icon suggestions safely, save despite partial retrieval failure, reopen the bookmark, and redirect duplicate attempts to the existing entry.

**Independent Test**: Paste complete, partial, and timed-out fixture URLs; edit suggestions; save and reload; open the destination; reject unsafe/invalid URLs; and verify a normalized duplicate creates no second record and identifies the existing bookmark.

### Tests for User Story 1

- [ ] T014 [P] [US1] Write failing unit tests for absolute HTTP/HTTPS validation, credential/default-port rules, normalized duplicate keys, fragments, IDNs, and meaningful title fallback in `tests/unit/url-normalization.test.ts`
- [ ] T015 [P] [US1] Write failing unit tests for globally reachable IPv4/IPv6 classification, mixed DNS answers, IP literals, DNS rebinding-resistant connection selection, redirect revalidation/loops, and five-hop limits in `tests/unit/metadata-network-policy.test.ts`
- [ ] T016 [P] [US1] Write failing unit tests for five-second total timeout, 1 MiB HTML cap, content-type/status rejection, decompression limits, metadata precedence, malformed HTML, field statuses, 300-character title cap, 2,000-character description cap, and raster-icon validation in `tests/unit/metadata-extraction.test.ts`
- [ ] T017 [P] [US1] Write failing API integration tests for `POST /api/metadata/preview`, `POST /api/bookmarks`, `GET /api/bookmarks`, public-address denials, partial/failed previews, transactional tag creation, persistence, and duplicate HTTP 409 responses with `existingId` in `tests/integration/bookmark-create.test.ts`
- [ ] T018 [P] [US1] Write failing component tests for paste-triggered preview, pending/partial/failure announcements, untouched-field suggestions, user-edit preservation, keyboard save flow, fallback title, and duplicate navigation in `tests/unit/client/save-bookmark.test.tsx`

### Implementation for User Story 1

- [ ] T019 [P] [US1] Implement URL validation, display preservation, and normalized duplicate keys—lowercase scheme/host, remove fragment/default port, normalize empty path to `/`, preserve query—in `src/server/metadata/url-policy.ts`
- [ ] T020 [P] [US1] Implement IPv4/IPv6 global-reachability classification from IANA special-purpose ranges and guarded DNS resolution that rejects any non-public answer in `src/server/metadata/network-policy.ts`
- [ ] T021 [US1] Implement a pinned-address HTTP fetch adapter with original Host/TLS identity, no ambient credentials/proxy, manual redirect validation, loop/hop detection, concurrency limits, five-second total timeout, and bounded streaming/decompression in `src/server/metadata/safe-fetch.ts`
- [ ] T022 [P] [US1] Implement deterministic title and description extraction, normalization, field-level source/status values, and hostname/path fallback in `src/server/metadata/extract-html.ts`
- [ ] T023 [US1] Implement SSRF-validated raster icon selection, magic-byte/type/dimension/256 KiB checks, opaque preview tokens, and safe cache persistence in `src/server/metadata/icon-cache.ts`
- [ ] T024 [US1] Compose complete/partial/failed non-blocking previews without overwriting supplied user edits in `src/server/metadata/metadata-service.ts`
- [ ] T025 [P] [US1] Implement Bookmark, Tag, and BookmarkTag repositories with prepared statements and create/list transactions in `src/server/repositories/bookmark-repository.ts` and `src/server/repositories/tag-repository.ts`
- [ ] T026 [US1] Implement bookmark creation validation, title fallback, tag normalization, duplicate conflict mapping, and cached-icon adoption in `src/server/services/bookmark-service.ts`
- [ ] T027 [US1] Implement `POST /api/metadata/preview`, `POST /api/bookmarks`, baseline `GET /api/bookmarks`, and cached-icon delivery in `src/server/api/metadata-routes.ts`, `src/server/api/bookmark-routes.ts`, and `src/server/api/icon-routes.ts`
- [ ] T028 [P] [US1] Implement the paste-first save form with editable title/description, notes, tags, read-later choice, retrieval feedback, and preserved input in `src/client/features/bookmarks/SaveBookmarkForm.tsx` and `src/client/features/bookmarks/useMetadataPreview.ts`
- [ ] T029 [P] [US1] Implement the baseline bookmark library/card, empty state, external-link behavior, safe cached icon display, and initial loading/error states in `src/client/features/bookmarks/BookmarkLibrary.tsx` and `src/client/features/bookmarks/BookmarkCard.tsx`
- [ ] T030 [US1] Integrate save, list refresh, success/failure announcements, and duplicate-to-existing focus/navigation in `src/client/features/bookmarks/BookmarksView.tsx`
- [ ] T031 [US1] Add the failing-then-passing Playwright MVP journey for metadata success/fallback, user edits, persistence, opening links, unsafe URL denial, and duplicate handling in `tests/e2e/save-bookmark.spec.ts`

**Checkpoint**: User Story 1 is deployable as the MVP and independently passes its unit, integration, component, and browser checks.

---

## Phase 4: User Story 2 — Find and Organize Bookmarks (Priority: P2)

**Goal**: Search across fields, require exact quoted phrases, search complete tags, combine text with tag alternatives, apply selected tag filters, and sort results.

**Independent Test**: Seed overlapping bookmark fields and verify `Rome`, `"ancient Rome"`, `tag:book`, `tag:"science fiction"`, and `Rome tag:(article|book)` plus malformed input, selected filters, and every sort direction.

### Tests for User Story 2

- [ ] T032 [P] [US2] Write failing parser tests for implicit AND, exact phrases, escaped quote/backslash, complete tag values, parenthesized alternatives, Unicode NFKC/case normalization, deduplication, the 1,000-character/50-clause limits, and every stable error span/code in `tests/unit/search-parser.test.ts`
- [ ] T033 [P] [US2] Write failing compiler/repository tests proving parameter binding, wildcard escaping, phrase-within-one-field behavior, exact normalized tags, OR only within tag alternatives, additional tag-filter AND semantics, and allowlisted sorting in `tests/unit/search-query.test.ts`
- [ ] T034 [P] [US2] Write failing API integration tests for `GET /api/bookmarks` query summaries, combined search, multiple selected tags, title/date ascending/descending sorts, empty results, and HTTP 400 parse errors in `tests/integration/bookmark-search.test.ts`
- [ ] T035 [P] [US2] Write failing component tests for search guidance, active-condition labels, keyboard submission, inline error spans, tag filter controls, reset actions, sort controls, and no-match state in `tests/unit/client/bookmark-search.test.tsx`

### Implementation for User Story 2

- [ ] T036 [P] [US2] Define AST types and implement the approved grammar for bare terms, phrases, `tag:value`, and `tag:(value|value)` with typed character-span errors in `src/shared/search/ast.ts` and `src/shared/search/parser.ts`
- [ ] T037 [P] [US2] Implement normalized human-readable active-condition labels and query serialization helpers in `src/shared/search/presentation.ts`
- [ ] T038 [US2] Compile validated AST nodes, selected tag filters, read scope, and allowlisted sort/order values to parameterized SQLite predicates in `src/server/search/compile-query.ts`
- [ ] T039 [US2] Extend bookmark and tag repositories for combined search, filter counts, deterministic ordering, and `GET /api/tags` in `src/server/repositories/bookmark-repository.ts`, `src/server/repositories/tag-repository.ts`, and `src/server/api/tag-routes.ts`
- [ ] T040 [US2] Extend `GET /api/bookmarks` to return authoritative raw query, AST, active labels, items, and stable parse errors in `src/server/api/bookmark-routes.ts`
- [ ] T041 [P] [US2] Implement the search input, syntax help/examples, active-condition summary, and accessible parse-error feedback in `src/client/features/search/SearchBar.tsx` and `src/client/features/search/SearchHelp.tsx`
- [ ] T042 [P] [US2] Implement multi-tag filter controls and title/date ascending/descending sort controls in `src/client/features/search/LibraryControls.tsx`
- [ ] T043 [US2] Integrate query/filter/sort URL state, result refresh, reset behavior, and distinct no-match state into `src/client/features/bookmarks/BookmarksView.tsx`
- [ ] T044 [US2] Add the failing-then-passing Playwright search journey for exact phrases, tag-only matching, `Rome tag:(article|book)`, filters, sorts, errors, and resets in `tests/e2e/search-bookmarks.spec.ts`

**Checkpoint**: User Story 2 can be tested against seeded bookmarks independently of metadata availability.

---

## Phase 5: User Story 3 — Manage a Read-Later List (Priority: P3)

**Goal**: Add or remove bookmarks from read later, explicitly mark them read/unread, and display a dedicated unread queue without deleting anything.

**Independent Test**: Mix ordinary, unread, and read bookmarks; show only unread read-later entries; mark one read and confirm it leaves but remains saved; mark it unread and confirm it returns; remove it from read later and confirm ordinary state.

### Tests for User Story 3

- [ ] T045 [P] [US3] Write failing service and repository tests for every approved reading-state transition, `is_read=false` when removed from read later, persistence, and opening-without-state-change in `tests/unit/reading-state.test.ts`
- [ ] T046 [P] [US3] Write failing API integration tests for `PATCH /api/bookmarks/{id}/reading-status` and `scope=unread-read-later`, including invalid combinations and missing records, in `tests/integration/read-later.test.ts`
- [ ] T047 [P] [US3] Write failing component tests for add/remove/read/unread controls, status announcements, keyboard use, and read-later empty states in `tests/unit/client/read-later.test.tsx`

### Implementation for User Story 3

- [ ] T048 [US3] Implement atomic reading-state transitions and unread-queue selection in `src/server/services/reading-state-service.ts` and `src/server/repositories/bookmark-repository.ts`
- [ ] T049 [US3] Implement `PATCH /api/bookmarks/{id}/reading-status` with Bookmark responses and stable validation/not-found errors in `src/server/api/bookmark-routes.ts`
- [ ] T050 [P] [US3] Implement card-level read-later and read/unread actions with accessible labels and pending state in `src/client/features/read-later/ReadingStatusControls.tsx`
- [ ] T051 [P] [US3] Implement the dedicated unread read-later view, navigation count, and context-specific empty state in `src/client/features/read-later/ReadLaterView.tsx`
- [ ] T052 [US3] Integrate reading-state updates into library/search results without changing state when a destination opens in `src/client/features/bookmarks/BookmarkCard.tsx` and `src/client/App.tsx`
- [ ] T053 [US3] Add the failing-then-passing Playwright read-later journey covering all transitions, filtering, persistence, and ordinary library retention in `tests/e2e/read-later.spec.ts`

**Checkpoint**: User Story 3 is independently usable with existing bookmarks and preserves prior save/search behavior.

---

## Phase 6: User Story 4 — Maintain Bookmark Details (Priority: P4)

**Goal**: Edit every user-controlled bookmark field without silent metadata replacement and permanently delete only after explicit confirmation.

**Independent Test**: Edit URL/title/description/notes/tags, verify persistence and duplicate validation, cancel deletion, then confirm deletion and verify the bookmark and associations are removed.

### Tests for User Story 4

- [ ] T054 [P] [US4] Write failing integration tests for partial bookmark updates, URL revalidation/duplicate conflict, transactional tag reconciliation, orphan-tag cleanup, retained user metadata, deletion cascade, and missing records in `tests/integration/bookmark-maintenance.test.ts`
- [ ] T055 [P] [US4] Write failing component tests for populated edit forms, explicit metadata re-fetch, preserved manual edits, validation feedback, delete confirmation/cancel, focus return, and operation announcements in `tests/unit/client/bookmark-maintenance.test.tsx`

### Implementation for User Story 4

- [ ] T056 [US4] Implement transactional patch, URL-change duplicate checks, explicit-only metadata suggestion refresh, tag reconciliation, delete cascade, and orphan cleanup in `src/server/services/bookmark-service.ts` and `src/server/repositories/bookmark-repository.ts`
- [ ] T057 [US4] Implement `PATCH /api/bookmarks/{id}` and `DELETE /api/bookmarks/{id}` with stable validation, duplicate, not-found, and no-content responses in `src/server/api/bookmark-routes.ts`
- [ ] T058 [P] [US4] Implement the accessible edit form with current values, optional metadata refresh, dirty-field protection, and validation in `src/client/features/bookmarks/EditBookmarkForm.tsx`
- [ ] T059 [P] [US4] Implement the explicit confirmation dialog with destructive labeling, cancel behavior, focus restoration, and pending/error state in `src/client/features/bookmarks/DeleteBookmarkDialog.tsx`
- [ ] T060 [US4] Integrate edit/delete actions, refreshed views, tag changes, and focus placement into `src/client/features/bookmarks/BookmarksView.tsx` and `src/client/features/bookmarks/BookmarkCard.tsx`
- [ ] T061 [US4] Add the failing-then-passing Playwright maintenance journey for editing every field, retained manual metadata, duplicate URL rejection, deletion cancellation/confirmation, cascades, and persistence in `tests/e2e/maintain-bookmarks.spec.ts`

**Checkpoint**: All four approved stories are functional and independently covered.

---

## Phase 7: Polish and Cross-Cutting Validation

**Purpose**: Prove system-wide safety, accessibility, performance, resilience, and presentation readiness.

- [ ] T062 [P] Add responsive desktop/mobile layouts, long-content wrapping, visible focus, reduced-motion handling, and high-contrast-safe states across `src/client/styles/global.css` and `src/client/styles/library.css`
- [ ] T063 [P] Add automated axe checks and complete keyboard journey coverage for save, search, filters, reading state, edit, and delete in `tests/e2e/accessibility.spec.ts`
- [ ] T064 [P] Add metadata abuse regression tests for private ranges, IPv4-mapped IPv6, mixed DNS results, rebinding adapters, redirect-to-private targets, credential URLs, oversized/decompression responses, unsupported icons, and log redaction in `tests/integration/metadata-security.test.ts`
- [ ] T065 [P] Add 1,000-bookmark fixtures and performance assertions for search/filter/sort/read-later completion within one second in at least 95% of local test iterations in `tests/integration/library-performance.test.ts`
- [ ] T066 Add database restart, failed transaction rollback, failed save input preservation, cached-icon cleanup, and corrupted/failed-load user feedback tests and handling in `tests/integration/resilience.test.ts`, `src/server/db/database.ts`, and `src/client/App.tsx`
- [ ] T067 [P] Document environment variables, storage/backup behavior, metadata-network policy, search syntax, and operator commands in `README.md`
- [ ] T068 Configure the prepared application runtime contract with `kind: application`, port `4000`, path `/`, `start_command: ["npm", "start"]`, and `start_cwd: "/work"` in `.harness/app.json`
- [ ] T069 Run the complete build, lint, typecheck, unit, integration, component, Playwright 1.61.0, and `specs/001-manage-bookmarks/quickstart.md` validation; record results and any honest limitations in `specs/001-manage-bookmarks/validation.md`

---

## Dependencies and Execution Order

### Phase Dependencies

- **Setup (Phase 1)** starts immediately.
- **Foundational (Phase 2)** depends on Setup and blocks every user story.
- **US1 (Phase 3)** starts after Foundational and is the MVP.
- **US2 (Phase 4)** starts after Foundational; it uses the baseline bookmark repository/list UI established by US1 for full integration, but its parser/compiler can begin independently.
- **US3 (Phase 5)** starts after Foundational; it uses bookmark records and cards established by US1.
- **US4 (Phase 6)** starts after US1 because it maintains saved records and reuses its metadata safeguards.
- **Polish (Phase 7)** starts after all stories selected for the release are complete; T068 follows a successful production build, and T069 is last.

### User Story Dependency Graph

```text
Setup → Foundation → US1 (MVP) ─┬→ US2
                               ├→ US3
                               └→ US4

US1 + US2 + US3 + US4 → Polish and full validation
```

US2's pure parser and US3's state service can be developed after Foundation while US1 is underway, but their final UI/API integration waits for US1's library surface. US4 intentionally follows US1.

### Within Each User Story

- Write the story's failing tests before its implementation.
- Implement pure validation/models before services, services before endpoints, and endpoints before client integration.
- Complete the story's browser journey before declaring its checkpoint met.
- Do not weaken an earlier story's passing tests to complete a later story.

## Parallel Opportunities

- T002–T004 can run concurrently after T001; T005 follows the chosen configuration.
- T008, T009, T011–T013 can run concurrently around the database/server spine T006–T010.
- Within US1, T014–T018 are independent test files; T019/T020/T022/T025/T028/T029 target separate modules, subject to their stated prerequisites.
- Within US2, parser, compiler, API, and component tests can be authored in parallel; T036 and T037 can run concurrently.
- Within US3 and US4, API/component tests and separate UI components can be authored concurrently.
- T062–T065 and T067 can run in parallel after their covered stories exist.

## Parallel Examples

### User Story 1

```text
T014 URL normalization tests
T015 network-policy tests
T016 extraction/limit tests
T017 create API integration tests
T018 save-form component tests
```

After those tests fail as expected, separate workers can take `T019`, `T020`, `T022`, `T025`, `T028`, and `T029`; integration tasks `T021`, `T023`–`T027`, `T030`, and `T031` then follow their dependencies.

### User Story 2

```text
T032 parser tests          → T036 parser/AST
T033 compiler tests        → T038 SQL compiler
T035 component tests       → T041 search UI and T042 controls
```

T039–T044 integrate those branches after their prerequisites pass.

### User Story 3

```text
T045 state tests           → T048 state service
T046 API tests             → T049 endpoint
T047 component tests       → T050 controls and T051 view
```

### User Story 4

```text
T054 integration tests     → T056 service/repository and T057 routes
T055 component tests       → T058 edit form and T059 delete dialog
```

## Implementation Strategy

### MVP First

1. Complete Setup and Foundation.
2. Complete US1 through T031.
3. Stop and validate the paste-to-preview-to-save flow, fallback, persistence, open behavior, and duplicate handling independently.
4. Present that working slice before expanding if incremental review is desired.

### Incremental Delivery

1. **US1**: Saving and revisiting with safe automatic metadata—the MVP.
2. **US2**: Precise and combinable retrieval over the saved library.
3. **US3**: Deliberate unread read-later queue.
4. **US4**: Full maintenance and confirmed deletion.
5. **Polish**: Cross-story safety, accessibility, resilience, performance, documentation, and runtime delivery.

## Task Summary

- Setup: 5 tasks
- Foundation: 8 tasks
- User Story 1: 18 tasks
- User Story 2: 13 tasks
- User Story 3: 9 tasks
- User Story 4: 8 tasks
- Polish and cross-cutting validation: 8 tasks
- **Total: 69 tasks**

Every task uses the required checkbox, sequential ID, applicable parallel marker, required story label within story phases, and an explicit file path.
