---

description: "Dependency-ordered implementation tasks for the bookmark manager"
---

# Tasks: Bookmark Manager

**Input**: Approved design documents from `/specs/001-bookmark-manager/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/openapi.yaml`, `quickstart.md`

**Tests**: Included because the approved plan defines unit, integration, contract, component, end-to-end, security, persistence, and performance validation.

**Organization**: Tasks are grouped by user story so each increment can be implemented and verified against its independent test.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it targets different files and has no dependency on another incomplete task in the same group
- **[Story]**: Maps the task to User Story 1, 2, or 3
- Every task names the file or files it changes

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Initialize the single-package TypeScript web application and its verification tooling.

- [ ] T001 Create `package.json` with Node 24 engine constraints, production dependencies (Express 5, React 19, Zod 4, Cheerio 1, better-sqlite3 13), development dependencies (TypeScript, Vite 7, Vitest, Supertest, React Testing Library, Playwright 1.61.0), and `dev`, `build`, `start`, `test`, `test:e2e`, and `test:performance` scripts
- [ ] T002 [P] Configure strict shared, browser, and server TypeScript builds in `tsconfig.json`, `tsconfig.client.json`, and `tsconfig.server.json`
- [ ] T003 [P] Configure React build output, development proxying, and production asset paths in `vite.config.ts`
- [ ] T004 [P] Configure deterministic unit/integration and Chromium end-to-end environments in `vitest.config.ts`, `tests/setup.ts`, and `playwright.config.ts`
- [ ] T005 [P] Add runtime data, build output, coverage, and local environment exclusions to `.gitignore` and add the browser shell in `index.html`

**Checkpoint**: Dependencies install from a lockfile and empty type-check, build, test, and end-to-end commands can be invoked.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish validation, URL safety, persistence, and the server shell required by every story.

**Critical**: No user story implementation begins until this phase is complete.

### Foundation tests

- [ ] T006 [P] Write failing schema tests for metadata, bookmark, tag, query, error-envelope, and duplicate-confirmation payloads in `tests/unit/shared/schemas.test.ts`
- [ ] T007 [P] Write failing URL-policy tests covering trimming, canonicalization, fragments, default ports, credentials, unsupported schemes, IPv4/IPv6 public classification, and address-derived fallback titles in `tests/unit/server/url-policy.test.ts`
- [ ] T008 [P] Write failing migration tests for idempotence, constraints, indexes, foreign keys, cascade behavior, and in-memory operation in `tests/integration/db/migrations.test.ts`

### Foundation implementation

- [ ] T009 [P] Define API/domain types and Zod schemas in `src/shared/types.ts` and `src/shared/schemas.ts`, enforcing these model rules verbatim: URL is a “Canonical absolute `http` or `https` URL; maximum 2,048 characters”; title is “Trimmed, non-empty, maximum 300 characters”; description is “Trimmed; empty input stored as null; maximum 1,000 characters”; tag name is “Trimmed display form, maximum 50 characters”; a bookmark has “at most 20 distinct tags”; search text has a 200-character maximum; and metadata source is `remote` or `fallback`
- [ ] T010 [P] Implement URL parsing, canonical and duplicate normalization, fallback-title derivation, hostname resolution hooks, and rejection of credentials or non-public IPv4/IPv6 ranges in `src/server/services/url-policy.ts`
- [ ] T011 Implement the database connection and idempotent versioned schema in `src/server/db/client.ts` and `src/server/db/migrations.ts`, enforcing these field rules verbatim: bookmark `id` is a “Generated positive identifier; immutable”; `normalized_url` is “Derived duplicate-comparison form; indexed but not unique because confirmed duplicates are allowed”; `created_at` is “Set once when created”; `updated_at` is “Set when created and changed on successful edit”; tag `normalized_name` is “Lowercased and whitespace-normalized; unique”; `(bookmark_id, tag_id)` is the primary key; bookmark and tag references cascade on deletion; and both join-table directions are indexed
- [ ] T012 Add typed row mapping, transaction helpers, UTC timestamp creation, orphan-tag cleanup, and injectable file/in-memory database support in `src/server/db/bookmark-repository.ts`
- [ ] T013 Create the Express application and production entry point with JSON limits, structured error envelopes, `/api` routing mounts, static-client serving, startup migrations, and `0.0.0.0:4000` defaults in `src/server/app.ts` and `src/server/index.ts`

**Checkpoint**: Shared schemas, safe URL primitives, SQLite migrations, and the server shell pass their foundational tests.

---

## Phase 3: User Story 1 — Save and Revisit Bookmarks (Priority: P1) — MVP

**Goal**: Paste one public address, receive editable page details or a sensible fallback, save persistently, list newest-first, and open the destination without losing library state.

**Independent Test**: Paste a valid address for a reachable page, verify that its title and available description appear without manual retyping, save it, leave and return to the library, and open the saved destination. Repeat with failed metadata retrieval and save the generated fallback title.

### Tests for User Story 1

- [ ] T014 [P] [US1] Write failing parser tests for social-title/document-title precedence, social/standard descriptions, whitespace normalization, missing fields, blank fields, and 300/1,000-character limits in `tests/unit/server/metadata-parser.test.ts`
- [ ] T015 [P] [US1] Write failing metadata integration tests for public IPv4/IPv6 lookup, vetted-address pinning, TLS hostname preservation, three-redirect maximum, per-hop validation, rebinding attempts, four-second timeout, one-mebibyte cap, HTML-only parsing, and fallback responses in `tests/integration/metadata/metadata-fetcher.test.ts` and `tests/fixtures/metadata-pages.ts`
- [ ] T016 [P] [US1] Write failing API contract tests for `POST /api/metadata`, `POST /api/bookmarks`, and unfiltered newest-first `GET /api/bookmarks`, including validation errors, fallback success, duplicate `409`, explicit duplicate override, and persisted results in `tests/integration/api/bookmarks-create.test.ts`
- [ ] T017 [P] [US1] Write failing component tests for URL-first entry, loading/status announcements, editable retrieved or fallback values, duplicate confirmation, save errors, opening in a new tab, and library/empty states in `tests/unit/client/save-and-list.test.tsx`

### Implementation for User Story 1

- [ ] T018 [P] [US1] Implement non-executing HTML parsing with social metadata precedence, document metadata fallback, whitespace cleanup, and field truncation in `src/server/services/metadata-parser.ts`
- [ ] T019 [US1] Implement bounded HTTP(S) metadata retrieval with injected DNS/transport dependencies, validated-address pinning, manual redirect checks, timeout and byte limits, HTML content checks, and non-blocking fallback results in `src/server/services/metadata-fetcher.ts`
- [ ] T020 [P] [US1] Implement bookmark creation, duplicate lookup, newest-first listing, empty descriptions as null, and durable reload mapping in `src/server/db/bookmark-repository.ts`
- [ ] T021 [US1] Implement `POST /api/metadata` with shared validation, unsafe-address rejection, remote/fallback preview responses, and actionable error messages in `src/server/api/metadata.ts`
- [ ] T022 [US1] Implement `POST /api/bookmarks` and baseline `GET /api/bookmarks` with `201`, `409`, `422`, explicit duplicate override, and OpenAPI-shaped responses in `src/server/api/bookmarks.ts`
- [ ] T023 [P] [US1] Implement typed metadata, create, and list calls plus structured error decoding in `src/client/api/client.ts`
- [ ] T024 [US1] Build the URL-first metadata and save workflow with editable title/description fields, fallback warning, duplicate confirmation, and status announcements in `src/client/components/SaveBookmarkForm.tsx`
- [ ] T025 [P] [US1] Build accessible newest-first bookmark cards, new-tab destination links, description/date presentation, long-content handling, and valid empty/loading/error states in `src/client/components/BookmarkCard.tsx`, `src/client/components/BookmarkList.tsx`, and `src/client/components/EmptyState.tsx`
- [ ] T026 [US1] Integrate save, refresh, persistence-visible reload, and library view state in `src/client/App.tsx` and `src/client/main.tsx`, setting `data-harness-ready="true"` only for a loaded library or valid empty state
- [ ] T027 [US1] Add Playwright coverage for successful metadata, user correction, fallback saving, invalid/unsafe URL feedback, duplicates, persistence after server restart, and opening without losing the library in `tests/e2e/bookmarks-save.spec.ts`
- [ ] T028 [US1] Run the US1 test slice and reconcile all implementation responses with `specs/001-bookmark-manager/contracts/openapi.yaml` in `tests/integration/api/bookmarks-create.test.ts`

**Checkpoint**: User Story 1 is a deployable MVP and passes its independent test without search, filtering, editing, or deletion.

---

## Phase 4: User Story 2 — Find and Organize Bookmarks (Priority: P2)

**Goal**: Assign normalized tags and retrieve bookmarks by case-insensitive text search, tag filtering, or both.

**Independent Test**: Seed bookmarks with distinct titles, addresses, descriptions, and tags; verify matching across every field, a selected tag filter, combined criteria, reset behavior, and a useful no-results state.

### Tests for User Story 2

- [ ] T029 [P] [US2] Write failing repository tests for normalized tag reuse, blank-tag removal, first-display-spelling retention, orphan cleanup, title/URL/description/tag search, combined tag filtering, case insensitivity, and newest-first ordering in `tests/integration/db/bookmark-search.test.ts`
- [ ] T030 [P] [US2] Write failing API contract tests for `GET /api/bookmarks?q=&tag=` and `GET /api/tags`, including 200-character query and 50-character tag limits, counts, ordering, combined criteria, and no matches in `tests/integration/api/bookmark-search.test.ts`
- [ ] T031 [P] [US2] Write failing component tests for tag entry, reusable tag filters, debounced search, combined search/filter criteria, clearing controls, and no-results recovery in `tests/unit/client/search-and-filter.test.tsx`

### Implementation for User Story 2

- [ ] T032 [US2] Implement case-insensitive tag upsert/association, maximum 20 distinct tags, orphan cleanup, multi-field containment search, selected-tag intersection, and stable newest-first query results in `src/server/db/bookmark-repository.ts`
- [ ] T033 [P] [US2] Implement alphabetical tag listing with bookmark counts and OpenAPI-shaped errors in `src/server/api/tags.ts`
- [ ] T034 [US2] Extend `GET /api/bookmarks` with trimmed case-insensitive `q` and normalized `tag` parameters in `src/server/api/bookmarks.ts`
- [ ] T035 [P] [US2] Add typed search, tag-filter, and tag-list requests in `src/client/api/client.ts`
- [ ] T036 [US2] Build accessible search, selected-tag filtering, result counts, clear controls, and no-match recovery in `src/client/components/SearchAndFilter.tsx`
- [ ] T037 [US2] Add normalized tag entry to `src/client/components/SaveBookmarkForm.tsx` and connect search/filter/tag refresh state in `src/client/App.tsx`
- [ ] T038 [US2] Add Playwright coverage for title, URL, description, and tag searches; selected and combined filters; casing/space normalization; clear behavior; and no-match states in `tests/e2e/bookmarks-search.spec.ts`

**Checkpoint**: User Story 2 passes independently with seeded bookmarks and remains compatible with the US1 save flow.

---

## Phase 5: User Story 3 — Maintain the Bookmark Library (Priority: P3)

**Goal**: Edit every user-managed bookmark field and permanently delete only after explicit confirmation.

**Independent Test**: Edit URL, title, description, and tags on a saved bookmark, verify persistence after reload, reject an invalid edit without changing stored data, then cancel and confirm separate deletion attempts.

### Tests for User Story 3

- [ ] T039 [P] [US3] Write failing repository tests for atomic bookmark/tag updates, unchanged creation time, refreshed update time, validation rollback, duplicate detection/override, orphan cleanup, deletion cascades, and not-found results in `tests/integration/db/bookmark-maintenance.test.ts`
- [ ] T040 [P] [US3] Write failing API contract tests for `PATCH /api/bookmarks/{bookmarkId}` and `DELETE /api/bookmarks/{bookmarkId}`, including `200`, `204`, `404`, `409`, `422`, partial updates, and explicit duplicate override in `tests/integration/api/bookmark-maintenance.test.ts`
- [ ] T041 [P] [US3] Write failing component tests for prefilled editing, URL/title/description/tag errors, save/cancel behavior, duplicate confirmation, delete confirmation/cancellation, and post-delete refresh in `tests/unit/client/bookmark-maintenance.test.tsx`

### Implementation for User Story 3

- [ ] T042 [US3] Implement atomic partial updates, duplicate checks, tag replacement/orphan cleanup, preserved `created_at`, refreshed `updated_at`, not-found handling, and cascading deletion in `src/server/db/bookmark-repository.ts`
- [ ] T043 [US3] Implement `PATCH` and `DELETE /api/bookmarks/{bookmarkId}` with the documented response codes and error envelopes in `src/server/api/bookmarks.ts`
- [ ] T044 [P] [US3] Build the validated, prefilled bookmark edit form with cancel and duplicate-confirmation flows in `src/client/components/BookmarkEditor.tsx`
- [ ] T045 [P] [US3] Build an accessible explicit-confirmation dialog that returns focus correctly after cancel or deletion in `src/client/components/DeleteConfirmation.tsx`
- [ ] T046 [P] [US3] Add typed update and delete calls with `404`, `409`, and `422` decoding in `src/client/api/client.ts`
- [ ] T047 [US3] Connect edit and delete controls, optimistic-disabled pending states, successful refresh, and error recovery in `src/client/components/BookmarkCard.tsx` and `src/client/App.tsx`
- [ ] T048 [US3] Add Playwright coverage for persisted edits, invalid-edit rollback, duplicate URL confirmation, delete cancellation, confirmed deletion, and absence from normal/searched/filtered results in `tests/e2e/bookmarks-maintenance.spec.ts`

**Checkpoint**: All three stories work together and each approved acceptance scenario has automated coverage.

---

## Phase 6: Polish and Cross-Cutting Validation

**Purpose**: Finish accessibility, responsiveness, performance, delivery configuration, and whole-application verification.

- [ ] T049 [P] Implement responsive desktop/mobile layout, visible focus, readable long-content wrapping, touch targets, and consistent loading/error/empty styling in `src/client/styles.css`
- [ ] T050 [P] Add cross-story accessibility assertions for labels, keyboard navigation, status announcements, focus restoration, dialog semantics, and color-independent feedback in `tests/unit/client/accessibility.test.tsx`
- [ ] T051 [P] Add a 10,000-bookmark seed and acceptance benchmark that proves search and tag-filter results complete within two seconds in `tests/performance/library-search.test.ts`
- [ ] T052 [P] Add final security regression cases for encoded/alternative IP forms, mixed public/private DNS answers, redirect-to-private targets, oversized headers/body, timeout cleanup, and malformed HTML in `tests/integration/metadata/security-regression.test.ts`
- [ ] T053 Validate the OpenAPI document and run type checking, unit/integration tests, Playwright tests, performance tests, and the production build; record any environment-limited checks in `specs/001-bookmark-manager/quickstart.md`
- [ ] T054 Create the review runtime declaration with `kind: application`, port `4000`, path `/`, start command `["npm", "start"]`, and start cwd `/work` in `.harness/app.json`
- [ ] T055 Execute every acceptance walkthrough against `http://maker:4000/`, confirm the ready marker and persistence across a real restart, and update observed expected outcomes in `specs/001-bookmark-manager/quickstart.md`

**Checkpoint**: The complete app is built, validated, and ready for client review on port 4000.

---

## Dependencies and Execution Order

### Phase Dependencies

- **Phase 1 — Setup**: Starts immediately.
- **Phase 2 — Foundation**: Depends on Setup and blocks all user-story implementation.
- **Phase 3 — US1**: Depends on Foundation and delivers the MVP.
- **Phase 4 — US2**: Depends on Foundation; integration tasks T037–T038 use the US1 client surface, while repository/API work can begin with seeded data in parallel with late US1 UI work.
- **Phase 5 — US3**: Depends on Foundation; integration tasks T047–T048 use the US1 library surface and US2 tags, while repository/API work can begin earlier.
- **Phase 6 — Polish**: Depends on all stories selected for the release; T053 depends on T049–T052, T054 depends on a successful production build, and T055 depends on T053–T054.

### User Story Dependency Graph

```text
Setup → Foundation → US1 (MVP)
                   ├→ US2 repository/API → US2 UI integrates with US1
                   └→ US3 repository/API → US3 UI integrates with US1 + tags

US1 + US2 + US3 → Polish → Runtime review
```

### Within Each Story

- Write the story's tests first and confirm that they fail for the missing behavior.
- Implement lower-level parsing/repository behavior before API routes.
- Implement API routes before wiring the browser workflow.
- Complete the story's Playwright test and checkpoint before declaring the story done.

## Parallel Opportunities

- Setup configuration tasks T002–T005 target separate files and can run together.
- Foundational test tasks T006–T008 can run together; implementations T009 and T010 can then run together.
- US1 test tasks T014–T017 can run together; T018 and T020 can run together; T023 and T025 can proceed while server endpoints settle.
- US2 test tasks T029–T031 can run together; T033 and T035 can run together after their contracts are understood.
- US3 test tasks T039–T041 can run together; T044–T046 target distinct client files and can run together after the API behavior is fixed.
- Polish tasks T049–T052 target separate concerns and can run together.

## Parallel Example: User Story 1

```text
Task T014: Parser behavior in tests/unit/server/metadata-parser.test.ts
Task T015: Safe-fetch behavior in tests/integration/metadata/metadata-fetcher.test.ts
Task T016: Create/list contracts in tests/integration/api/bookmarks-create.test.ts
Task T017: Save/list UI behavior in tests/unit/client/save-and-list.test.tsx
```

## Parallel Example: User Story 2

```text
Task T029: Tag/search persistence behavior in tests/integration/db/bookmark-search.test.ts
Task T030: Search/tag API behavior in tests/integration/api/bookmark-search.test.ts
Task T031: Search/filter UI behavior in tests/unit/client/search-and-filter.test.tsx
```

## Parallel Example: User Story 3

```text
Task T039: Update/delete persistence behavior in tests/integration/db/bookmark-maintenance.test.ts
Task T040: Update/delete API behavior in tests/integration/api/bookmark-maintenance.test.ts
Task T041: Edit/delete UI behavior in tests/unit/client/bookmark-maintenance.test.tsx
```

## Implementation Strategy

### MVP First

1. Complete Setup and Foundation.
2. Complete US1, including metadata security/fallback, persistence, and Playwright acceptance.
3. Stop and validate the URL-to-saved-bookmark journey independently.
4. Present the working MVP before layering on organization and maintenance if incremental review is useful.

### Incremental Delivery

1. **US1**: Quick save, automatic details/fallback, persistence, list, and open.
2. **US2**: Tagging, search, filters, and no-result recovery.
3. **US3**: Editing, duplicate protection on updates, and confirmed deletion.
4. **Polish**: Responsive accessibility, scale/security regressions, production build, and runtime delivery.

## Notes

- `[P]` marks tasks safe to execute concurrently because their file targets do not overlap at that point in the dependency graph.
- Story labels provide traceability to `spec.md`; setup, foundation, and polish tasks intentionally have no story label.
- Tests precede implementation within each story as defined by the approved verification strategy.
- Any discovered requirement change returns to `spec.md`; implementation defects remain within these tasks and the approved plan.
