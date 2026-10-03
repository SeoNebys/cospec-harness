---

description: "Dependency-ordered implementation tasks for the Bookmark Manager"
---

# Tasks: Bookmark Manager

**Input**: Approved design documents from `specs/001-bookmark-manager/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: Included because the approved implementation plan explicitly requires unit, integration, end-to-end, accessibility, responsive, security, and performance verification.

**Organization**: Tasks are grouped by user story so each story can be implemented and validated as an incremental slice.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel with adjacent tasks because it targets different files and does not depend on their incomplete work.
- **[Story]**: Maps the task to an approved user story (`US1`, `US2`, or `US3`).
- Every task names the exact file or directory it changes.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish the single-package Node/React/Express project and its development commands.

- [ ] T001 Create `package.json` and `package-lock.json` for Node 24 with TypeScript 7, React 19, Vite 8, Express 5, Zod 4, Cheerio 1, exact `@playwright/test@1.61.0`, `@axe-core/playwright`, and scripts for dev, build, start, typecheck, lint, unit, integration, E2E, and accessibility tests
- [ ] T002 [P] Configure strict ESM TypeScript builds for shared, server, and client sources in `tsconfig.json`, `tsconfig.server.json`, and `tsconfig.client.json`
- [ ] T003 [P] Configure the Vite React build and development proxy in `vite.config.ts` and create the client mount document in `index.html`
- [ ] T004 [P] Configure linting and repository ignores, including runtime `data/`, build output, coverage, and Playwright artifacts, in `eslint.config.js` and `.gitignore`
- [ ] T005 [P] Configure Chromium projects at 1280×720 and 320×700, the port-4000 web server, one-worker database isolation, and trace-on-first-retry behavior in `playwright.config.ts`
- [ ] T006 Create the planned source and test module boundaries with minimal compilable entry files in `src/client/main.tsx`, `src/client/App.tsx`, `src/server/index.ts`, `src/server/app.ts`, and `tests/fixtures/index.ts`

**Checkpoint**: Dependency installation, typecheck, lint, client build, and a minimal server start all succeed.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Implement shared contracts, URL rules, persistence startup, and HTTP infrastructure required by every story.

**⚠️ CRITICAL**: No user-story implementation begins until this phase passes its focused tests.

- [ ] T007 [P] Define API/domain types and shared constants in `src/shared/types/bookmark.ts` and `src/shared/types/api.ts`, including the exact limits “URL maximum 2,048 code points,” “title 1–300 code points,” “description up to 1,000 code points,” “tag name 1–50 code points,” and “one bookmark may have at most 20 tags”
- [ ] T008 [P] Define Zod request, query, response, and problem-detail schemas matching `contracts/openapi.yaml` in `src/shared/schemas/bookmark.ts` and `src/shared/schemas/api.ts`, preserving the exact nullable/required fields and `active|archived`, `newest|oldest|title`, and `available|partial|unavailable` enums
- [ ] T009 [P] Write failing unit coverage for scheme insertion, HTTP/HTTPS-only parsing, credential rejection, canonical equivalence, default ports, and meaningful path/query/fragment preservation in `tests/unit/url-normalization.test.ts`
- [ ] T010 Implement the single WHATWG URL parser/canonicalizer used by forms, APIs, duplicate checks, and metadata preview in `src/shared/url/normalize.ts` until `tests/unit/url-normalization.test.ts` passes
- [ ] T011 Create strict `bookmarks`, `tags`, and `bookmark_tags` tables and indexes in `migrations/001_initial.sql`, including “`canonical_url` unique,” “title 1–300 code points,” “description up to 1,000 code points,” “tag name 1–50 code points,” cascading join foreign keys, active/archive timestamps, favorite state, and UTC creation/update timestamps
- [ ] T012 Implement configurable `BOOKMARK_DATA_DIR`, safe directory creation, SQLite connection settings, numbered transactional migrations, and test database injection in `src/server/config.ts`, `src/server/db/database.ts`, and `src/server/db/migrate.ts`
- [ ] T013 [P] Implement normalized problem responses, request IDs, JSON body limits, baseline security headers, same-origin checks for mutations, SPA static serving, and `/api` routing boundaries in `src/server/middleware/security.ts`, `src/server/middleware/errors.ts`, and `src/server/app.ts`
- [ ] T014 [P] Implement the typed same-origin fetch client and problem-response decoding without losing field errors or duplicate IDs in `src/client/api/client.ts` and `src/client/api/types.ts`
- [ ] T015 [P] Create temporary-database, deterministic-clock, seeded-bookmark, and injectable metadata-network fixtures in `tests/fixtures/database.ts`, `tests/fixtures/bookmarks.ts`, and `tests/fixtures/metadata.ts`

**Checkpoint**: Shared contracts compile, URL unit tests pass, a fresh temporary database migrates successfully, and the base API returns normalized errors.

---

## Phase 3: User Story 1 — Save and Open Bookmarks (Priority: P1) 🎯 MVP

**Goal**: Paste a URL, receive editable title/description when available, save immediately with fallback when unavailable, persist the bookmark, and open it without losing the library.

**Independent Test**: Paste an address for an eligible fixture page, verify title and description auto-fill and user edits win, save and reopen after reload, then save during an unavailable/slow preview and verify the URL-title fallback.

### Tests for User Story 1

- [ ] T016 [P] [US1] Write failing unit tests for title/description precedence, entity decoding, Unicode/whitespace/control cleanup, 300/1,000-code-point caps, and metadata-free HTML in `tests/unit/metadata-extraction.test.ts`
- [ ] T017 [P] [US1] Write failing unit tests for request-generation and title/description dirty-field rules, including stale and late results never overwriting user values, in `tests/unit/metadata-form-state.test.ts`
- [ ] T018 [P] [US1] Write failing integration tests for create/get/list, URL-title fallback, persistence after database reopen, field preservation on validation errors, and canonical duplicate `409` responses in `tests/integration/bookmark-create-api.test.ts`
- [ ] T019 [P] [US1] Write failing integration tests for public-address enforcement, A/AAAA checks, IPv4-mapped IPv6, DNS rebinding prevention through connection pinning, redirect revalidation, ports 80/443, four-second deadline, five-redirect cap, HTML/XHTML requirement, one-megabyte decoded limit, and safe unavailable outcomes in `tests/integration/metadata-preview-api.test.ts`
- [ ] T020 [P] [US1] Write failing desktop/mobile Playwright coverage for successful auto-fill, edited-field ownership, immediate slow/failure save, invalid-input preservation, duplicate navigation, reload persistence, external opening, and empty/load-error states in `tests/e2e/save-bookmark.spec.ts`

### Implementation for User Story 1

- [ ] T021 [P] [US1] Implement prepared, transactional bookmark/tag create and read operations with generated UUIDs, UTC timestamps, canonical uniqueness, tag normalization, and the exact entity limits from `data-model.md` in `src/server/repositories/bookmark-repository.ts` and `src/server/repositories/tag-repository.ts`
- [ ] T022 [US1] Implement create/get/list orchestration, server-side URL-title fallback, plain-text normalization, validation mapping, and duplicate lookup in `src/server/services/bookmark-service.ts`
- [ ] T023 [US1] Implement `POST /api/bookmarks`, `GET /api/bookmarks`, and `GET /api/bookmarks/:bookmarkId` per `contracts/openapi.yaml` in `src/server/routes/bookmarks.ts`
- [ ] T024 [P] [US1] Implement metadata destination eligibility, IANA special-address rejection, A/AAAA resolution, IPv4-mapped IPv6 normalization, redirect target validation, and validated-address connection pinning in `src/server/metadata/address-policy.ts` and `src/server/metadata/transport.ts`
- [ ] T025 [P] [US1] Implement non-executing HTML title/description extraction and plain-text cleanup according to the approved precedence and size limits in `src/server/metadata/extract.ts`
- [ ] T026 [US1] Compose the bounded metadata service with cancellation, four-second wall-clock timeout, five manual redirects, ports 80/443, HTML/XHTML content checks, one-megabyte decoded-body cap, concurrency limit, and redacted failure logging in `src/server/metadata/metadata-service.ts`
- [ ] T027 [US1] Implement `POST /api/metadata-preview` with `available`, `partial`, `unavailable`, validation, and capacity responses from `contracts/openapi.yaml` in `src/server/routes/metadata-preview.ts`
- [ ] T028 [P] [US1] Implement the client metadata-preview state machine with debounce/paste trigger, abort controller, request generation, dirty fields, and non-blocking status text in `src/client/hooks/useMetadataPreview.ts` and `src/client/hooks/metadataFormState.ts`
- [ ] T029 [US1] Build the accessible save form with preserved values after errors, optional title/description/tags/favorite, immediate save while preview loads, duplicate-to-existing action, and live metadata/validation status in `src/client/components/SaveBookmarkForm.tsx`
- [ ] T030 [P] [US1] Build the bookmark list/card presentation with title, URL, optional description, tags, favorite/date context, safe text rendering, and isolated external links in `src/client/components/BookmarkList.tsx` and `src/client/components/BookmarkCard.tsx`
- [ ] T031 [US1] Integrate initial loading, valid empty state, retryable load errors, saving, persisted reload, and post-load `data-harness-ready="true"` behavior in `src/client/App.tsx`
- [ ] T032 [US1] Implement the responsive P1 layout, readable long-content behavior, visible focus, status, error, and empty-state styling in `src/client/styles/base.css` and `src/client/styles/bookmarks.css`

**Checkpoint**: User Story 1 passes its unit, integration, desktop, and mobile tests and is a demonstrable MVP independent of search and maintenance controls.

---

## Phase 4: User Story 2 — Find and Organize Bookmarks (Priority: P2)

**Goal**: Search title/URL/description/tags, combine tag and favorite filters, sort by newest/oldest/title, retain view state, and recover from no results.

**Independent Test**: Seed varied bookmarks and confirm each searchable field, AND-combined filters, all three sort modes, visible active constraints, browser history preservation, and clearable no-results behavior.

### Tests for User Story 2

- [ ] T033 [P] [US2] Write failing unit tests for Unicode-normalized case-insensitive search, trimmed search text, title/URL/description/tag matching, multi-tag AND semantics, favorite/view combinations, and newest/oldest/title ordering in `tests/unit/bookmark-query.test.ts`
- [ ] T034 [P] [US2] Write failing integration contract tests for filtered `GET /api/bookmarks` and view-scoped `GET /api/tags`, including invalid query responses and tag counts, in `tests/integration/bookmark-query-api.test.ts`
- [ ] T035 [P] [US2] Write failing Playwright coverage for search by every supported field, combined filters, active-filter visibility, all sorts, URL/Back/Forward preservation, no-results clearing, and 1,000-item result correctness in `tests/e2e/find-organize.spec.ts`

### Implementation for User Story 2

- [ ] T036 [P] [US2] Implement Unicode-normalized search, multi-tag AND filtering, favorite/view filtering, stable newest/oldest/title sorting, and invalid-query defaults in `src/server/services/bookmark-query-service.ts`
- [ ] T037 [US2] Extend list and tag-count persistence queries without relying on SQLite default case folding in `src/server/repositories/bookmark-repository.ts` and `src/server/repositories/tag-repository.ts`
- [ ] T038 [US2] Complete query parsing for `GET /api/bookmarks` and implement view-scoped `GET /api/tags` per `contracts/openapi.yaml` in `src/server/routes/bookmarks.ts` and `src/server/routes/tags.ts`
- [ ] T039 [P] [US2] Implement validated URL search-parameter state for `view`, `q`, repeated `tag`, `favorite`, and `sort`, including browser Back/Forward updates, in `src/client/hooks/useLibraryViewState.ts`
- [ ] T040 [P] [US2] Build labeled search, multi-tag, favorite, sort, active/archive, active-constraint, and clear controls in `src/client/components/LibraryToolbar.tsx` and `src/client/components/ActiveFilters.tsx`
- [ ] T041 [P] [US2] Build the result count and actionable no-results state that distinguishes constraints from an empty library in `src/client/components/LibraryResults.tsx` and `src/client/components/EmptyState.tsx`
- [ ] T042 [US2] Integrate query-driven loading, tag options, stable filters while details open/close, and newest-by-default behavior in `src/client/App.tsx` and `src/client/api/bookmarks.ts`

**Checkpoint**: User Story 2 passes independently against seeded data and adds organization without regressing the P1 save/open slice.

---

## Phase 5: User Story 3 — Maintain the Collection (Priority: P3)

**Goal**: Edit bookmark details/favorite state, archive and restore without data loss, and permanently delete only after confirmation.

**Independent Test**: Edit every mutable field, archive and restore the entry, cancel deletion and confirm it remains, then confirm deletion and verify removal from active and archived views.

### Tests for User Story 3

- [ ] T043 [P] [US3] Write failing integration tests for partial edits, URL duplicate conflicts, tag replacement/orphan cleanup, favorite changes, archive idempotency errors, restore, confirmed DELETE behavior, and missing IDs in `tests/integration/bookmark-maintenance-api.test.ts`
- [ ] T044 [P] [US3] Write failing desktop/mobile Playwright coverage for edit, favorite, archive, empty archive, restore with unchanged details, canceled deletion, confirmed deletion, dialog keyboard focus/return, and mutation-error recovery in `tests/e2e/maintain-bookmarks.spec.ts`

### Implementation for User Story 3

- [ ] T045 [P] [US3] Implement transactional update, tag replacement and orphan cleanup, archive, restore, and permanent delete repository operations in `src/server/repositories/bookmark-repository.ts` and `src/server/repositories/tag-repository.ts`
- [ ] T046 [US3] Implement edit/archive/restore/delete service rules and `404`, duplicate `409`, already-active, and already-archived problem mapping in `src/server/services/bookmark-service.ts`
- [ ] T047 [US3] Implement `PATCH`/`DELETE /api/bookmarks/:bookmarkId` and `POST` archive/restore endpoints per `contracts/openapi.yaml` in `src/server/routes/bookmarks.ts`
- [ ] T048 [P] [US3] Build the labeled edit dialog with URL, “title 1–300 code points,” “description up to 1,000 code points,” “tag name 1–50 code points,” “at most 20 tags,” favorite state, preserved errors, focus containment, and focus return in `src/client/components/EditBookmarkDialog.tsx`
- [ ] T049 [P] [US3] Build active archive and archived restore controls with bookmark-specific accessible names and unchanged-detail updates in `src/client/components/BookmarkActions.tsx`
- [ ] T050 [P] [US3] Build the destructive confirmation dialog that names the bookmark, distinguishes delete from archive, sends DELETE once only after confirmation, and returns focus on cancel in `src/client/components/DeleteBookmarkDialog.tsx`
- [ ] T051 [US3] Integrate edit, favorite, archive/restore, deletion, empty archive, last-filtered-item removal, and mutation-failure recovery in `src/client/App.tsx` and `src/client/api/bookmarks.ts`

**Checkpoint**: All three stories pass their independent acceptance suites and the complete collection lifecycle works end to end.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Validate security, accessibility, responsiveness, performance, production startup, and review delivery across all stories.

- [ ] T052 [P] Add axe scans for empty library, save form, populated results, no results, archive, validation error, edit dialog, and delete dialog plus keyboard/status ARIA assertions in `tests/e2e/accessibility.spec.ts`
- [ ] T053 [P] Add 320-pixel no-horizontal-scroll, long-content, 200%-zoom, reduced-motion, and desktop layout assertions for every primary state in `tests/e2e/responsive.spec.ts`
- [ ] T054 [P] Add the deterministic 1,000-bookmark, 20-interaction measurement requiring at least 19 search/filter/sort updates within one second in `tests/e2e/performance.spec.ts` and `tests/fixtures/large-library.ts`
- [ ] T055 [P] Add integration coverage for same-origin mutation enforcement, JSON limits, security headers, safe error detail, query/fragment log redaction, and clean shutdown in `tests/integration/security-and-runtime.test.ts`
- [ ] T056 Harden global responsive/accessibility styles for 320-pixel through desktop widths, 200% zoom, visible focus, non-color states, long-content wrapping, dialogs, and reduced motion in `src/client/styles/base.css`, `src/client/styles/bookmarks.css`, and `src/client/styles/dialogs.css`
- [ ] T057 Add structured redacted server logging, process-level shutdown, database close, and production static fallback without exposing metadata network details in `src/server/index.ts`, `src/server/logging.ts`, and `src/server/app.ts`
- [ ] T058 Build the production bundle, create the required port-4000 foreground launch manifest, and document the final prepared command in `.harness/app.json` and `package.json`
- [ ] T059 Execute every command and acceptance walkthrough in `specs/001-bookmark-manager/quickstart.md`, correct any discovered implementation/guide mismatch in the relevant source or test file, and update `specs/001-bookmark-manager/quickstart.md` only if the approved run contract changed

**Checkpoint**: Typecheck, lint, unit, integration, E2E, accessibility, production build, runtime smoke test, and quickstart validation all pass; the app is ready for client review at `http://maker:4000`.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 — Setup**: Starts immediately.
- **Phase 2 — Foundational**: Depends on Phase 1 and blocks every user story.
- **Phase 3 — US1**: Depends on Phase 2 and delivers the recommended MVP.
- **Phase 4 — US2**: Depends on Phase 2 for contracts/DB and reuses the bookmark read model introduced in US1. It can be developed against seeded fixtures while US1 UI work proceeds, but final integration follows T023 and T030.
- **Phase 5 — US3**: Depends on Phase 2 for contracts/DB and reuses bookmark rows/cards introduced in US1. Its API can proceed against fixtures while US1 UI work proceeds, but final integration follows T030 and T042.
- **Phase 6 — Polish**: Depends on every story selected for release; for the approved full feature, it follows Phases 3–5.

### User Story Dependency Graph

```text
Setup → Foundation → US1 (MVP)
                   ├─→ US2
                   └─→ US3
US1 + US2 + US3 → Polish/Delivery
```

US2 and US3 are independently testable with seeded data after the foundation, but the complete UI intentionally layers them onto US1's persistent bookmark list.

### Within Each User Story

- Write the listed story tests first and confirm they fail for the intended missing behavior.
- Implement repository/model behavior before services, services before routes, and routes before UI integration.
- Keep external-site behavior behind injected deterministic metadata fixtures; automated tests never depend on live websites.
- Complete and pass the phase checkpoint before declaring that story done.

### Parallel Opportunities

- T002–T005 can run together after T001 starts because they target independent configuration files.
- T007–T009 and T013–T015 can be split across shared contract, server infrastructure, client API, and fixture work.
- Within US1, T016–T020 are independent failing-test tasks; T024 and T025 can run together; T028 and T030 can run alongside server implementation after contracts stabilize.
- Within US2, T033–T035 can run together, followed by parallel service, URL-state, toolbar, and result-state work where file ownership does not overlap.
- Within US3, T043–T044 can run together and T048–T050 are separate UI components that can run in parallel after the API shape is fixed.
- T052–T055 are separate verification files and can run in parallel after story integration.

## Parallel Examples

### User Story 1

```text
T016: tests/unit/metadata-extraction.test.ts
T017: tests/unit/metadata-form-state.test.ts
T018: tests/integration/bookmark-create-api.test.ts
T019: tests/integration/metadata-preview-api.test.ts
T020: tests/e2e/save-bookmark.spec.ts

Then in parallel:
T024: src/server/metadata/address-policy.ts + transport.ts
T025: src/server/metadata/extract.ts
T028: src/client/hooks/useMetadataPreview.ts + metadataFormState.ts
T030: src/client/components/BookmarkList.tsx + BookmarkCard.tsx
```

### User Story 2

```text
T033: tests/unit/bookmark-query.test.ts
T034: tests/integration/bookmark-query-api.test.ts
T035: tests/e2e/find-organize.spec.ts

Then in parallel:
T036: src/server/services/bookmark-query-service.ts
T039: src/client/hooks/useLibraryViewState.ts
T040: src/client/components/LibraryToolbar.tsx + ActiveFilters.tsx
T041: src/client/components/LibraryResults.tsx + EmptyState.tsx
```

### User Story 3

```text
T043: tests/integration/bookmark-maintenance-api.test.ts
T044: tests/e2e/maintain-bookmarks.spec.ts

Then in parallel:
T048: src/client/components/EditBookmarkDialog.tsx
T049: src/client/components/BookmarkActions.tsx
T050: src/client/components/DeleteBookmarkDialog.tsx
```

## Implementation Strategy

### MVP First

1. Complete Setup and Foundation (T001–T015).
2. Complete User Story 1 (T016–T032).
3. Stop and run the US1 checkpoint: auto-fill, editable values, non-blocking fallback save, persistence, and external opening.
4. Demo this slice before adding collection organization or maintenance if early feedback is useful.

### Incremental Delivery

1. **Foundation**: build, contracts, URL rules, SQLite, HTTP safety, fixtures.
2. **US1 / MVP**: useful persistent save-and-open application with automatic page details.
3. **US2**: retrieval and organization for a growing library.
4. **US3**: complete collection maintenance and safe deletion.
5. **Polish**: security, accessibility, responsive/performance evidence, and review runtime.

### Execution Discipline

- Treat the approved spec and contracts as the source of truth; route behavior changes require artifact review rather than ad-hoc divergence.
- Preserve the user's data: tests use temporary databases, and no test/reset command touches `data/` or `BOOKMARK_DATA_DIR` outside an explicit test directory.
- Use one owner at a time for files shared across stories (`src/client/App.tsx`, bookmark repositories/routes, and global styles) to avoid merge conflicts.
- Commit after a passing task or coherent task group and retain the package lockfile.

## Notes

- `[P]` means safe file-level parallelism, not permission to ignore stated dependencies.
- The task list includes 59 tasks: 6 setup, 9 foundational, 17 US1, 10 US2, 9 US3, and 8 polish/delivery tasks.
- No implementation work is included in this task-generation phase.

