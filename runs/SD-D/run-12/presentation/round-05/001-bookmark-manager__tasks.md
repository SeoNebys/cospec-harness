# Tasks: Personal Bookmark Manager

**Input**: Approved design documents from `/specs/001-bookmark-manager/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`

**Tests**: The approved plan requires unit, component, integration, end-to-end, accessibility, security, and performance coverage. Within each story, test tasks precede implementation and must demonstrate the expected failure before production code is added.

**Organization**: Tasks are grouped by approved user story so each increment has a clear goal and independent verification checkpoint.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel with adjacent tasks because it changes different files and has no dependency on an incomplete adjacent task
- **[Story]**: Maps the task to User Story 1–4 from `spec.md`
- Every task names the exact file or directory it changes

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish the pinned toolchain, scripts, and repository structure without implementing product behavior.

- [X] T001 Create `package.json` with the exact runtime/dev dependency pins from `plan.md` and scripts for dev, build, start, migrate, lint, typecheck, unit, integration, e2e, and performance verification
- [X] T002 [P] Configure strict ESM client/server compilation and path aliases in `tsconfig.json`, `tsconfig.client.json`, and `tsconfig.server.json`
- [X] T003 [P] Configure React production/dev builds and the `/api` development proxy in `vite.config.ts` and `index.html`
- [X] T004 [P] Configure Vitest projects, jsdom setup, and coverage boundaries in `vitest.config.ts` and `tests/setup/vitest.setup.ts`
- [X] T005 [P] Configure Playwright 1.61.0 against port 4000 and `/opt/playwright-browsers` in `playwright.config.ts`, and configure lint rules in `eslint.config.js`
- [X] T006 Create the planned source/test/runtime directory skeleton and ignore generated builds, SQLite files, journals, logs, and temporary test artifacts in `.gitignore`, `src/**/.gitkeep`, `tests/**/.gitkeep`, and `var/.gitkeep`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Create shared persistence, normalization, contracts, server, client shell, and test harnesses required by every user story.

**⚠️ CRITICAL**: No user-story implementation begins until this phase passes.

- [X] T007 Write failing migration/schema integration tests for foreign keys, WAL, indexes, uniqueness, cascade behavior, and a fresh/upgrade/repeated migration cycle in `tests/integration/db/migrations.test.ts`
- [X] T008 Define the initial SQL migration in `src/server/db/migrations/001_initial.sql`: Bookmark rules must include “normalized URL is unique,” “title is 1–512 Unicode code points,” “description is at most 2,000 code points,” “notes whitespace-only becomes null and is at most 10,000 code points,” favorite/unread default false, UTC timestamps, and required search shadows; Tag rules must include “display name is 1–64 code points” and unique normalized identity; IconAsset rules must include verified PNG/JPEG/GIF/WebP/ICO content type, unique digest, and “maximum 256 KiB”; BookmarkTag must use composite primary key `(bookmark_id, tag_id)` with cascading foreign keys
- [X] T009 Implement SQLite opening, foreign-key/WAL configuration, ordered transactional migrations, shutdown, and test-database injection in `src/server/db/database.ts` and `src/server/db/migrate.ts`
- [X] T010 [P] Write failing normalization tests covering NFKC, Unicode lowercase, URL canonicalization, tag trim/collapse identity, search shadows, punctuation preservation, and no accent folding in `tests/unit/shared/normalization.test.ts`
- [X] T011 [P] Implement shared URL, tag-identity, and search normalization helpers in `src/shared/normalization/index.ts`
- [X] T012 [P] Define Zod request/response schemas and TypeScript types matching every schema and stable problem code in `contracts/openapi.yaml` in `src/shared/schemas/api.ts` and `src/shared/contracts/types.ts`; preserve MetadataDraft statuses `success|partial|unavailable|rejected`, request IDs, sourced text, warnings, and nullable fields exactly
- [X] T013 [P] Create temporary SQLite, deterministic clock/ID, HTTP transport, fixture-page, and API application test factories in `tests/fixtures/database.ts`, `tests/fixtures/http.ts`, and `tests/fixtures/app.ts`
- [X] T014 Write failing readiness/static-host/error-envelope integration tests in `tests/integration/api/foundation.test.ts`
- [X] T015 Implement Express JSON limits, validation/error translation, request correlation, production static hosting, SPA fallback, health route, and graceful shutdown in `src/server/app.ts`, `src/server/api/errors.ts`, and `src/server/server.ts`
- [X] T016 Create the typed same-origin request wrapper and Problem decoding in `src/client/services/api.ts`, plus the React entry point, error boundary, loading/valid-empty shell, and delayed `data-harness-ready="true"` marker in `src/client/main.tsx` and `src/client/app/App.tsx`
- [X] T017 [P] Establish semantic layout tokens, visible focus, screen-reader utilities, responsive foundations, and live-region styling in `src/client/styles/tokens.css` and `src/client/styles/global.css`

**Checkpoint**: Migrations, shared normalization/contracts, API shell, client shell, and isolated test fixtures all pass; user stories may begin.

---

## Phase 3: User Story 1 — Save a Link with Automatic Details (Priority: P1) 🎯 MVP

**Goal**: A user can paste a valid public URL, receive safe automatic title/description/icon details or sensible fallbacks, preserve their edits, and save a durable non-duplicate bookmark.

**Independent Test**: From an empty installation, paste a fixture URL, verify automatic details, edit a field during a delayed response, save, reload, and see the durable bookmark; repeat with a soft retrieval failure and duplicate URL.

### Tests for User Story 1

- [X] T018 [P] [US1] Write failing URL-policy tests for schemes, credentials, default ports, special-use hosts, IP forms, every IPv4/IPv6 special range, mixed DNS answers, and validation-to-socket rebinding in `tests/unit/server/metadata/url-policy.test.ts`
- [X] T019 [P] [US1] Write failing extraction tests for charset handling, plain-text normalization, title/description precedence, 512/2,000-code-point caps, fallback title, favicon candidate order, signature verification, and SVG/HTML rejection in `tests/unit/server/metadata/extractor.test.ts`
- [X] T020 [P] [US1] Write failing metadata integration tests for manual relative redirects, five-hop/loop limits, public-to-private redirects, pinned peer verification, 8-second/2-second phases, 1 MiB decoded HTML, 256 KiB icon, content type, gzip/chunked limits, no credential forwarding, and stable soft/rejected codes in `tests/integration/metadata/fetcher.test.ts`
- [X] T021 [P] [US1] Write failing repository/API tests for URL-only create, fallback title, fields and caps, final-URL duplicate conflict, transactional tags/icon, persistence, newest-first listing, and `/api/icons/{id}` fixed type plus `nosniff` in `tests/integration/api/bookmarks-create.test.ts`
- [X] T022 [P] [US1] Write failing component tests for URL paste, retrieval progress/warnings, request-ID cancellation, dirty title/description precedence, retained input after errors, optional notes/tags/favorite/unread, and duplicate navigation in `tests/unit/client/BookmarkForm.test.tsx`
- [X] T023 [US1] Write the failing URL-only happy/fallback/late-response/duplicate browser journey in `tests/e2e/save-bookmark.spec.ts`

### Implementation for User Story 1

- [X] T024 [P] [US1] Implement public URL parsing/canonicalization, IANA special-address/domain classification, all-answer rejection, DNS-to-socket pinning contracts, peer verification, and typed rejection codes in `src/server/metadata/url-policy.ts`
- [X] T025 [US1] Implement the credential-free guarded transport with manual per-hop validation, relative redirects, loop detection, abort deadlines, decoded byte/header caps, HTML-only handling, and injectable resolver/connector in `src/server/metadata/safe-fetch.ts`
- [X] T026 [P] [US1] Implement inert charset-aware HTML extraction, deterministic title/description precedence, Unicode whitespace/control cleanup, length caps, fallback title, and favicon candidate selection in `src/server/metadata/extractor.ts`
- [X] T027 [P] [US1] Implement raster/ICO signature verification, 256 KiB enforcement, digest deduplication, short-lived pending upload tokens, placeholder selection, and fixed-type asset reads in `src/server/metadata/icon-store.ts`
- [X] T028 [US1] Orchestrate page and one-icon retrieval into `success|partial|unavailable|rejected` MetadataDraft responses without leaking internal addresses or stack traces in `src/server/metadata/metadata-service.ts`
- [X] T029 [US1] Implement transactional Bookmark create/list/icon repository methods in `src/server/repositories/bookmark-repository.ts`; enforce title `1–512`, description `≤2,000`, notes whitespace-null and `≤10,000`, tags `≤50` each `1–64`, unique normalized final URL, favorite/unread default false, search shadows, icon ownership, and stable `created_at DESC, id DESC`
- [X] T030 [P] [US1] Implement `POST /api/metadata` concurrency/rate limits and response mapping in `src/server/api/metadata-routes.ts`
- [X] T031 [US1] Implement `GET/POST /api/bookmarks` and `GET /api/icons/{iconAssetId}` with OpenAPI validation, 201/409/422 behavior, pagination, immutable caching, and `nosniff` in `src/server/api/bookmark-routes.ts` and register routes in `src/server/app.ts`
- [X] T032 [P] [US1] Add typed metadata/create/list calls, abort handling, and request-ID propagation in `src/client/services/bookmarks.ts`
- [X] T033 [P] [US1] Implement BookmarkForm state transitions and dirty-field guards so late/mismatched metadata never overwrites user edits in `src/client/features/bookmarks/useBookmarkForm.ts`
- [X] T034 [US1] Build the accessible create-bookmark dialog with URL-first flow, editable title/description, personal notes, basic normalized tag entry without suggestions, favorite/unread choices, retrieval status/warnings, retained values, and focus restoration in `src/client/features/bookmarks/BookmarkForm.tsx`
- [X] T035 [P] [US1] Build bookmark card/list, same-origin icon with deterministic placeholder, visible metadata/state/date, safe external link, loading, valid-empty, and duplicate-focus behavior in `src/client/features/bookmarks/BookmarkCard.tsx` and `src/client/features/bookmarks/BookmarkList.tsx`
- [X] T036 [US1] Integrate initial newest-first loading, create refresh, success/error live announcements, and ready marker into `src/client/app/App.tsx`

**Checkpoint**: Setup + Foundation + US1 is a demonstrable MVP that saves and reloads URL-only bookmarks with safe automatic metadata and non-blocking fallbacks.

---

## Phase 4: User Story 2 — Find Bookmarks with Advanced Search (Priority: P2)

**Goal**: A user can combine ordinary terms, exact phrases, exact `#tags`, `AND`, `OR`, `NOT`, parentheses, implicit `AND`, and collection filters, receive actionable syntax errors, and retain the view when opening a bookmark.

**Independent Test**: Against a deterministic varied collection, run every grammar example and invalid form in `contracts/search-grammar.md`, combine favorite/unread/tag filters, open a result and return, and verify the exact result set and retained view.

### Tests for User Story 2

- [X] T037 [P] [US2] Write failing lexer/parser golden and invalid-syntax tests for offsets, escapes, Unicode, keywords, exact phrases/tags, implicit AND, `NOT > AND > OR`, grouping, empty query, and 1,000-character/128-leaf/64-level limits in `tests/unit/server/search/parser.test.ts`
- [X] T038 [P] [US2] Write failing compiler tests proving every AST leaf uses bound parameters, escapes `%`, `_`, and backslash, keeps phrases within one field/tag, uses exact hashtag identity, and conjoins filters in `tests/unit/server/search/sql-compiler.test.ts`
- [X] T039 [P] [US2] Write failing semantic API tests across title/URL/description/notes/tags, Boolean truth tables, Unicode case, no accent folding, stable newest-first cursor pages, empty/no-result distinction, and unmodified syntax-error query/spans in `tests/integration/api/search.test.ts`
- [X] T040 [P] [US2] Write failing component tests for URL-mirrored query/tag/favorite/unread filters, syntax guidance, reset-all, loading/no-results states, and returning from external navigation in `tests/unit/client/SearchControls.test.tsx`
- [X] T041 [US2] Write the failing advanced-search, filter-combination, reset, no-results, and view-retention browser journey in `tests/e2e/search-bookmarks.spec.ts`

### Implementation for User Story 2

- [X] T042 [P] [US2] Implement the source-spanned lexer and recursive-descent AST parser exactly matching `contracts/search-grammar.md` in `src/server/search/lexer.ts` and `src/server/search/parser.ts`
- [X] T043 [P] [US2] Implement parameterized AST-to-SQL predicate compilation, wildcard escaping, exact tag EXISTS predicates, and conjoined tag/favorite/unread filters in `src/server/search/sql-compiler.ts`
- [X] T044 [US2] Add filtered/search listing and stable `(created_at,id)` cursor pagination to `src/server/repositories/bookmark-repository.ts`
- [X] T045 [US2] Implement `GET /api/bookmarks` search validation and typed `SearchProblem` mapping while preserving the original query and source span in `src/server/api/bookmark-routes.ts`
- [X] T046 [P] [US2] Implement typed URL query-parameter serialization, debounced/cancelled search requests, and retained CollectionViewState in `src/client/features/search/useCollectionSearch.ts`
- [X] T047 [US2] Build accessible search help/input, tag/favorite/unread filters, active-filter summary, reset-all, syntax error highlighting, and no-results state in `src/client/features/search/SearchControls.tsx` and integrate results into `src/client/app/App.tsx`

**Checkpoint**: US2 is independently verifiable with seeded data and adds precise advanced retrieval without changing saved content or read status.

---

## Phase 5: User Story 3 — Organize with Consistent Tags (Priority: P3)

**Goal**: A user receives reusable case-insensitive tag-prefix suggestions, can select them by pointer or keyboard, avoids duplicates, and can still create a new normalized tag.

**Independent Test**: Seed `recipes` and `research`, type `re`, select with keyboard, confirm focus remains usable, verify the selected tag cannot be re-added, then create one genuinely new normalized tag.

### Tests for User Story 3

- [X] T048 [P] [US3] Write failing repository/API tests for NFKC/lowercase/trim/collapse identity, case-insensitive prefix suggestions, `1–64` code-point names, maximum 20 suggestions, exclusion of up to 50 selected tags, first-display-form preservation, and orphan removal in `tests/integration/api/tags.test.ts`
- [X] T049 [P] [US3] Write failing ARIA combobox component tests for pointer selection, Arrow keys, Enter, Escape, announcements, focus continuity, exclusion, and new-tag creation in `tests/unit/client/TagCombobox.test.tsx`
- [X] T050 [US3] Write the failing reusable/new/duplicate-prevention keyboard tag journey in `tests/e2e/tag-suggestions.spec.ts`

### Implementation for User Story 3

- [X] T051 [P] [US3] Implement transactional tag upsert, case-insensitive prefix suggestion, selected-tag exclusion, stable display naming, `1–64` code-point validation, and orphan cleanup in `src/server/repositories/tag-repository.ts`
- [X] T052 [US3] Implement validated `GET /api/tags?prefix=&exclude=&limit=` with maximum limit 20 and exclusion count 50 in `src/server/api/tag-routes.ts` and register it in `src/server/app.ts`
- [X] T053 [P] [US3] Add typed debounced/cancelled tag suggestion requests in `src/client/services/tags.ts`
- [X] T054 [US3] Build the semantic ARIA combobox/listbox with keyboard/pointer selection, new-tag creation, deduplication, announcements, and continued input focus in `src/client/features/tags/TagCombobox.tsx`, then replace the US1 basic tag entry in `src/client/features/bookmarks/BookmarkForm.tsx`

**Checkpoint**: US3 independently proves consistent reuse and creation of tags in the bookmark form.

---

## Phase 6: User Story 4 — Track and Maintain the Collection (Priority: P4)

**Goal**: A user can independently favorite and mark unread/read, see unread-only links, edit bookmark details, and safely cancel or confirm deletion; opening never mutates unread status.

**Independent Test**: Mark one bookmark favorite and unread, open it and verify unread remains, remove favorite without affecting unread, filter unread, explicitly mark read, edit all editable fields, cancel deletion once, then confirm it.

### Tests for User Story 4

- [X] T055 [P] [US4] Write failing repository tests for independent favorite/unread transitions, partial edits, unchanged `created_at`, updated search shadows, final-URL duplicate conflicts, atomic tag/icon replacement, cascades, and orphan tag/icon cleanup in `tests/integration/repositories/bookmark-maintenance.test.ts`
- [X] T056 [P] [US4] Write failing API contract tests for `GET/PATCH/DELETE /api/bookmarks/{id}`, 404/409/422 responses, favorite/unread-only patches, and proof that bookmark GET/open behavior performs no mutation in `tests/integration/api/bookmark-maintenance.test.ts`
- [X] T057 [P] [US4] Write failing component tests for independent card toggles, explicit mark-read wording, edit retention/errors, confirmation cancel/confirm, focus restoration, and unread/favorite filters in `tests/unit/client/BookmarkMaintenance.test.tsx`
- [X] T058 [US4] Write the failing favorite/unread independence, open-without-read, edit, filter, cancel-delete, and confirm-delete browser journey in `tests/e2e/maintain-bookmarks.spec.ts`

### Implementation for User Story 4

- [X] T059 [US4] Add transactional get/update/delete/state methods to `src/server/repositories/bookmark-repository.ts`; preserve “favorite and unread are independent,” “opening URL is not a mutation,” edit title `1–512`, description `≤2,000`, notes whitespace-null and `≤10,000`, tags each `1–64`, atomic shadow updates, duplicate handling, cascades, and orphan cleanup
- [X] T060 [US4] Implement `GET/PATCH/DELETE /api/bookmarks/{bookmarkId}` with partial validation and 200/204/404/409/422 mapping in `src/server/api/bookmark-routes.ts`
- [X] T061 [P] [US4] Add typed get/patch/delete calls and optimistic-toggle rollback behavior in `src/client/services/bookmarks.ts` and `src/client/features/bookmarks/useBookmarkActions.ts`
- [X] T062 [US4] Add separately labeled favorite and unread/read actions to `src/client/features/bookmarks/BookmarkCard.tsx`; external link activation must only navigate and must never call a mutation endpoint
- [X] T063 [P] [US4] Build the accessible edit dialog with existing values, URL duplicate handling, metadata retry without overwriting dirty fields, tag combobox, retained failures, and focus restoration in `src/client/features/bookmarks/EditBookmarkDialog.tsx`
- [X] T064 [P] [US4] Build the accessible delete confirmation dialog with cancel-by-default behavior and focus restoration in `src/client/features/bookmarks/DeleteBookmarkDialog.tsx`
- [X] T065 [US4] Integrate optimistic favorite/unread changes, explicit read action, edit/delete refresh, unread/favorite views, and live success/failure announcements in `src/client/app/App.tsx`

**Checkpoint**: All four user stories are functional, retain the approved manual read-status behavior, and pass their independent acceptance journeys.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Validate system-wide safety, scale, accessibility, runtime delivery, and documentation after all desired stories are integrated.

- [X] T066 [P] Add property/fuzz tests proving arbitrary search input never crashes or emits unbound SQL and excessive/deep input fails safely in `tests/unit/server/search/fuzz.test.ts`
- [X] T067 [P] Add the full SSRF regression matrix for ambiguous IPv4, IPv4-mapped IPv6, transition ranges, mixed DNS answers, rebinding, unsafe icon redirects, and response data leakage in `tests/integration/metadata/security-regression.test.ts`
- [X] T068 [P] Create the deterministic 5,000-bookmark fixture and performance assertions for complete collection/search/filter usability under 2 seconds and internal database search target 250 ms in `tests/performance/search.performance.test.ts`
- [X] T069 [P] Add axe checks plus complete keyboard-only flows for empty, populated, dialog, combobox, no-results, and error states in `tests/e2e/accessibility.spec.ts`
- [X] T070 Harden shared security headers, body/rate/concurrency limits, structured redacted logs, request cancellation, and graceful error handling in `src/server/app.ts`, `src/server/api/middleware.ts`, and `src/server/metadata/metadata-service.ts`
- [X] T071 Refine responsive/long-content/Unicode/slow-loading presentation and visible state distinctions in `src/client/styles/global.css` and `src/client/styles/components.css`
- [X] T072 Configure production build/start/migrate ordering and create the required runtime declaration in `package.json` and `.harness/app.json` with `0.0.0.0:4000`, `npm start`, and `/work`
- [X] T073 Run every command and manual scenario in `specs/001-bookmark-manager/quickstart.md`, record verified outcomes and any environment limitations in `specs/001-bookmark-manager/validation.md`, and keep the quickstart commands synchronized

---

## Dependencies & Execution Order

### Phase dependencies

- **Phase 1 — Setup**: starts immediately.
- **Phase 2 — Foundation**: depends on Phase 1 and blocks all story phases.
- **Phase 3 — US1**: depends on Foundation and produces the MVP capture/list surface.
- **Phase 4 — US2**: core parser/repository/API work depends only on Foundation and seeded fixtures; final App integration uses the US1 collection surface.
- **Phase 5 — US3**: repository/API/combobox work depends only on Foundation; final BookmarkForm integration uses US1.
- **Phase 6 — US4**: repository/API tests can use Foundation fixtures; final UI integration uses the US1 collection/form and US2 filter surface.
- **Phase 7 — Polish**: begins after all stories selected for release are complete.

### User-story completion graph

```text
Setup -> Foundation -> US1 (MVP)
                    |-> US2 core -> US2 UI integrates with US1
                    |-> US3 core -> US3 UI integrates with US1
                    `-> US4 core -> US4 UI integrates with US1/US2

US1 + US2 + US3 + US4 -> Polish -> Release validation
```

### Within each user story

1. Add the listed tests and verify they fail for the intended missing behavior.
2. Implement pure models/policies/parsers before orchestration and repositories.
3. Implement repositories/services before API routes.
4. Implement typed client services/state before visual components.
5. Integrate the story and make its independent browser journey pass.
6. Stop at the checkpoint and verify prior stories remain green.

## Parallel Opportunities

- Setup tasks T002–T005 touch separate configuration files and can run together after T001 establishes dependency names.
- Foundation normalization/contracts/fixtures tasks T010–T013 can run together after database conventions are fixed.
- After Foundation, the core US2 parser, US3 tag repository, and US4 maintenance test work can proceed alongside US1, but their final UI integrations wait for US1 surfaces.
- Test files marked `[P]` within each story can be authored concurrently before implementation.
- Pure policy/parser/client-state tasks marked `[P]` can proceed concurrently where their prerequisite test contract is complete.
- Cross-cutting fuzz, SSRF regression, performance, and accessibility tasks T066–T069 touch separate suites and can run together.

## Parallel Examples

### User Story 1

```text
T018 URL-policy tests | T019 extraction tests | T020 fetch integration tests | T021 API tests | T022 component tests
After tests: T024 URL policy | T026 extraction | T027 icon store | T032 client service | T033 form state
```

### User Story 2

```text
T037 parser tests | T038 compiler tests | T039 API semantics | T040 component tests
After tests: T042 parser | T043 SQL compiler | T046 client collection state
```

### User Story 3

```text
T048 tag API tests | T049 combobox tests
After tests: T051 tag repository | T053 client tag service
```

### User Story 4

```text
T055 repository tests | T056 API tests | T057 component tests
After API contract: T061 client actions | T063 edit dialog | T064 delete dialog
```

## Implementation Strategy

### MVP first

1. Complete Setup (T001–T006).
2. Complete Foundation (T007–T017).
3. Complete US1 (T018–T036).
4. Stop and run the independent URL-only save/reload/fallback/duplicate journey.
5. Present the working MVP before expanding the release if a narrower checkpoint is desired.

### Incremental delivery

1. Add US2 advanced search and verify its grammar/result fixtures independently.
2. Add US3 tag suggestions and verify keyboard/pointer reuse independently.
3. Add US4 read-later/favorite maintenance and explicitly re-verify that opening never marks read.
4. Complete cross-cutting security, scale, accessibility, build, and quickstart validation.

## Notes

- `[P]` indicates file-level parallelism, not permission to bypass a prerequisite or failing-test checkpoint.
- Story labels provide traceability back to `spec.md`; requirement details come from `data-model.md` and `contracts/`.
- No authentication, sharing, sync, folders, import/export, browser extension, page preview, screenshot, content archive, or automatic mark-read work belongs in this task list.
- Any requested behavioral change must return through the specification and planning gates before tasks are altered or implementation begins.
