---

description: "Dependency-ordered implementation tasks for the Bookmark Manager"
---

# Tasks: Bookmark Manager

**Input**: Design documents from `/specs/001-bookmark-manager/`

**Prerequisites**: Approved `spec.md` and `plan.md`; `research.md`, `data-model.md`, `contracts/`, and `quickstart.md`

**Tests**: Automated tests are included because the approved plan defines unit, contract, integration, accessibility, performance, and end-to-end verification.

**Organization**: Tasks are grouped by user story so each increment can be implemented and tested independently after the shared foundation.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel with adjacent tasks because it uses different files and has no dependency on their unfinished work
- **[Story]**: Maps the task to an approved user story
- Every task names the files it creates or changes

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish one reproducible workspace, build, and test toolchain.

- [X] T001 Create npm workspace manifests and pinned runtime/development dependencies in `package.json`, `client/package.json`, `server/package.json`, `shared/package.json`, and `package-lock.json`
- [X] T002 [P] Configure shared and package-specific TypeScript builds in `tsconfig.json`, `client/tsconfig.json`, `server/tsconfig.json`, and `shared/tsconfig.json`
- [X] T003 [P] Configure Vite React development/build output and proxy behavior in `client/vite.config.ts` and `client/index.html`
- [X] T004 [P] Configure linting and formatting scripts in `eslint.config.js`, `.prettierrc.json`, and `.prettierignore`
- [X] T005 [P] Configure Vitest projects, Testing Library setup, and Playwright 1.61.0 browser reuse in `vitest.config.ts`, `client/tests/setup.ts`, and `playwright.config.ts`
- [X] T006 Create the planned `client/src`, `server/src`, `shared/src`, `server/tests`, `client/tests`, and `e2e` directory entry files and verify workspace build/typecheck commands in `package.json`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Implement the contracts, persistence shell, error boundary, configuration, and test fixtures required by every story.

**⚠️ CRITICAL**: No user-story implementation begins until this phase passes its tests.

- [X] T007 [P] Define shared API DTOs and Zod validation primitives matching `contracts/openapi.yaml` in `shared/src/contracts/api.ts`, `shared/src/schemas/common.ts`, and `shared/src/types/index.ts`
- [X] T008 [P] Implement environment validation for port 4000, `0.0.0.0` binding, database path, metadata limits, and test overrides in `server/src/config.ts` and `server/tests/unit/config.test.ts`
- [X] T009 Create the initial SQLite migration with foreign keys and indexes in `server/src/db/migrations/001_initial.sql`: Bookmark `url` required HTTP(S), unique `normalized_url`, `title` required 1–200 characters, `note_source` maximum 2,000 characters, boolean state fields constrained to 0/1, immutable `created_at`, mutable `updated_at`; Tag `name` 1–40 characters and unique case-folded `normalized_name`; at most 20 tags per bookmark enforced by service/transaction; MediaAsset kind `icon|preview`, raster MIME allowlist, and bytes maximum 2 MiB
- [X] T010 Implement connection initialization, foreign-key/WAL pragmas, ordered migration runner, transactions, and clean shutdown in `server/src/db/connection.ts`, `server/src/db/migrate.ts`, and `server/tests/integration/migrations.test.ts`
- [X] T011 [P] Implement stable `application/problem+json` errors, request validation middleware, and async error handling in `server/src/api/problems.ts`, `server/src/api/validate.ts`, and `server/tests/unit/problems.test.ts`
- [X] T012 [P] Create deterministic clock, UUID, DNS, HTTP-fetch, metadata-page, image, and bookmark factory adapters for tests in `server/tests/helpers/fakes.ts`, `server/tests/helpers/database.ts`, and `e2e/fixtures/metadata-server.ts`
- [X] T013 Implement the Express application shell, JSON limits, `/api/health`, API router, static production assets, and graceful lifecycle in `server/src/app.ts`, `server/src/api/router.ts`, `server/src/server.ts`, and `server/tests/contract/health.test.ts`
- [X] T014 [P] Create the React application shell, semantic navigation for Active/Favorites/Read later/Archive, route-level error handling, and API client problem decoding in `client/src/app/App.tsx`, `client/src/app/router.tsx`, `client/src/components/AppNavigation.tsx`, and `client/src/services/api.ts`
- [X] T015 [P] Establish accessible base styles, focus treatment, responsive layout tokens, loading/empty/error primitives, and notification region in `client/src/styles/index.css`, `client/src/components/AsyncState.tsx`, and `client/src/components/LiveRegion.tsx`

**Checkpoint**: Workspace builds; migrations apply to an empty database; health and shared error contracts pass; the navigable UI shell loads.

---

## Phase 3: User Story 1 — Save and Revisit Enriched Bookmarks (Priority: P1) 🎯 MVP

**Goal**: Paste a public web address, retrieve safe page details with manual fallback, save exactly one durable bookmark, return later, and open it.

**Independent Test**: Save a controlled page after editing its retrieved title, reload to prove persistence, open its destination, exercise metadata fallback, then resubmit its normalized address and verify the existing editor opens without increasing the collection count.

### Tests for User Story 1

- [X] T016 [P] [US1] Write URL normalization and duplicate identity unit tests covering whitespace, scheme/host letter case, and distinct path/query/fragment values in `server/tests/unit/url-normalizer.test.ts`
- [X] T017 [P] [US1] Write metadata security/extraction tests for public DNS, private/loopback/link-local/encoded addresses, DNS rebinding, five-redirect limit, 8-second deadline, 2 MiB HTML/image limits, raster MIME allowlist, title/icon/preview extraction, and failure reason codes in `server/tests/unit/metadata-service.test.ts`
- [X] T018 [P] [US1] Write bookmark repository persistence, unique normalized URL, cached media, and cascade-delete integration tests in `server/tests/integration/bookmark-repository.test.ts`
- [X] T019 [P] [US1] Write metadata-preview, create, get, duplicate `303/409`, validation, and media response contract tests in `server/tests/contract/bookmarks-create.test.ts`
- [X] T020 [P] [US1] Write the enriched-save, editable-title, fallback, reload, open-link, and duplicate-routing component tests in `client/tests/bookmark-save.test.tsx`

### Implementation for User Story 1

- [X] T021 [P] [US1] Implement URL parsing/normalization with HTTP(S)-only, no embedded credentials, trimmed input, lowercase scheme/host, and preserved path/query/fragment in `server/src/services/url-normalizer.ts`
- [X] T022 [P] [US1] Implement public-address classification for IPv4/IPv6 and injectable hostname resolution in `server/src/security/public-address.ts` and `server/src/security/dns-resolver.ts`
- [X] T023 [US1] Implement redirect-by-redirect pinned metadata fetching with no forwarded credentials, bounded streaming, abort deadline, and stable fallback reasons in `server/src/services/safe-fetch.ts` and `server/src/services/metadata-service.ts`
- [X] T024 [P] [US1] Implement HTML title, icon, and preview candidate extraction with relative URL resolution in `server/src/services/metadata-parser.ts`
- [X] T025 [US1] Implement validated raster image download/caching preparation for PNG/JPEG/WebP/GIF only and 2 MiB maximum in `server/src/services/media-service.ts`
- [X] T026 [P] [US1] Implement Bookmark and MediaAsset row mappings plus transactional create/get/duplicate lookup in `server/src/repositories/bookmark-repository.ts` and `server/src/repositories/media-repository.ts`
- [X] T027 [US1] Implement metadata preview, bookmark create/get, duplicate race handling, and cached media endpoints in `server/src/api/metadata-routes.ts`, `server/src/api/bookmark-routes.ts`, and `server/src/services/bookmark-service.ts`
- [X] T028 [P] [US1] Build the address-entry, metadata-loading, editable-title, optional-image, validation, and manual-fallback form in `client/src/features/bookmarks/BookmarkCreateForm.tsx` and `client/src/features/bookmarks/MetadataPreview.tsx`
- [X] T029 [P] [US1] Build the active bookmark list/card/detail presentation with title, host, media fallback, tags placeholder, state indicators, saved date, and safe new-tab destination link in `client/src/features/bookmarks/BookmarkList.tsx`, `client/src/features/bookmarks/BookmarkCard.tsx`, and `client/src/pages/BookmarkDetailPage.tsx`
- [X] T030 [US1] Integrate save, reload, duplicate-to-existing-editor routing, form-value retention, and usable empty collection state in `client/src/pages/ActiveBookmarksPage.tsx`, `client/src/pages/NewBookmarkPage.tsx`, and `client/src/services/bookmarks.ts`
- [X] T031 [US1] Add a focused Playwright MVP journey using the controlled metadata fixture in `e2e/bookmark-save.spec.ts`

**Checkpoint**: US1 is a deployable MVP and passes independently, including hostile metadata cases and duplicate prevention.

---

## Phase 4: User Story 2 — Find and Organize Bookmarks (Priority: P2)

**Goal**: Assign tags and retrieve bookmarks through filters, sorting, ordinary AND terms, exact tags, phrases, OR, and NOT with useful malformed-query feedback.

**Independent Test**: Seed overlapping titles, URLs, notes, and tags; verify each grammar form and sort order returns exactly the expected items, and malformed queries preserve the entered text.

### Tests for User Story 2

- [X] T032 [P] [US2] Write tokenizer/parser tests for words, quotes, exact `#tag`, implicit AND, OR alternatives, prefix NOT, negative-only queries, precedence, source spans, rejected parentheses, and malformed operands in `server/tests/unit/search-parser.test.ts`
- [X] T033 [P] [US2] Write tag constraints, case-folded uniqueness, 20-tag limit, orphan cleanup, search evaluation, views, filtering, and sorting integration tests in `server/tests/integration/search-and-tags.test.ts`
- [X] T034 [P] [US2] Write list/query/tag API contract tests including `INVALID_SEARCH_QUERY` and retained source-span issues in `server/tests/contract/bookmark-search.test.ts`
- [X] T035 [P] [US2] Write accessible search, tag-entry/filter, sort, clear-controls, and no-results component tests in `client/tests/bookmark-search.test.tsx`

### Implementation for User Story 2

- [X] T036 [P] [US2] Implement case-folded Tag and BookmarkTag repository operations with tag `name` required 1–40 characters, unique normalized name, 20 tags per bookmark, and orphan cleanup in `server/src/repositories/tag-repository.ts`
- [X] T037 [P] [US2] Implement the documented tokenizer, AST types, parser, precedence, and source-aware errors in `server/src/search/tokenizer.ts`, `server/src/search/parser.ts`, and `server/src/search/types.ts`
- [X] T038 [US2] Implement title/URL/plain-note/tag evaluation, negative-only queries, view filtering, exact tag filter, and newest/oldest/title sorting in `server/src/search/evaluator.ts` and `server/src/repositories/bookmark-query-repository.ts`
- [X] T039 [US2] Extend bookmark create/update transactions for tags and implement list/tags endpoints in `server/src/services/bookmark-service.ts`, `server/src/api/bookmark-routes.ts`, and `server/src/api/tag-routes.ts`
- [X] T040 [P] [US2] Build tag input/chips/filter controls with case-insensitive reuse and keyboard removal in `client/src/features/bookmarks/TagEditor.tsx` and `client/src/features/search/TagFilter.tsx`
- [X] T041 [P] [US2] Build search input, syntax help, preserved query errors, sort control, clear action, and no-results state in `client/src/features/search/SearchBar.tsx`, `client/src/features/search/SearchHelp.tsx`, and `client/src/features/search/SearchResultsState.tsx`
- [X] T042 [US2] Integrate query/view/tag/sort URL state and refreshed results in `client/src/pages/ActiveBookmarksPage.tsx` and `client/src/services/bookmarks.ts`
- [X] T043 [US2] Add the complete search grammar and organization journey in `e2e/bookmark-search.spec.ts`

**Checkpoint**: US2 can be validated from seeded bookmarks without depending on later read-later, formatted-note editing, or maintenance UI.

---

## Phase 5: User Story 3 — Keep a Read-Later Queue (Priority: P2)

**Goal**: Maintain a read-later queue whose unread/read state remains independent of favorites and survives archiving/restoration.

**Independent Test**: Add a bookmark to read later, mark it read and unread, verify unread-view membership, and prove favorite state never changes.

### Tests for User Story 3

- [X] T044 [P] [US3] Write read-later state-machine and favorite-independence service tests in `server/tests/unit/reading-state.test.ts`
- [X] T045 [P] [US3] Write patch/list persistence contract tests for add, read, unread, remove, archived exclusion, and restoration in `server/tests/contract/read-later.test.ts`
- [X] T046 [P] [US3] Write read-later navigation, counts, state actions, and keyboard component tests in `client/tests/read-later.test.tsx`

### Implementation for User Story 3

- [X] T047 [US3] Implement transactional reading transitions—add sets read-later true/read false, mark read retains read-later true, mark unread restores unread, remove resets both—without mutating favorite in `server/src/services/reading-state.ts` and `server/src/services/bookmark-service.ts`
- [X] T048 [US3] Extend patch validation and active/read-later query behavior so archived items are excluded from unread results in `shared/src/schemas/bookmark.ts`, `server/src/api/bookmark-routes.ts`, and `server/src/repositories/bookmark-query-repository.ts`
- [X] T049 [P] [US3] Build labeled add/read/unread/remove controls and status presentation in `client/src/features/bookmarks/ReadingActions.tsx` and `client/src/features/bookmarks/BookmarkCard.tsx`
- [X] T050 [US3] Build and integrate the unread read-later page without changing favorite behavior in `client/src/pages/ReadLaterPage.tsx`, `client/src/app/router.tsx`, and `client/src/services/bookmarks.ts`
- [X] T051 [US3] Add the independent favorite/read-later/archive persistence journey in `e2e/read-later.spec.ts`

**Checkpoint**: US3 works independently against seeded bookmarks and preserves favorite/archive invariants.

---

## Phase 6: User Story 4 — Add and Read Formatted Notes (Priority: P3)

**Goal**: Edit and safely render headings, links, ordered lists, and unordered lists while keeping note text searchable.

**Independent Test**: Save all supported formatting, view the rendered note, edit it again without loss, search its visible words, and prove active/unsafe content cannot execute.

### Tests for User Story 4

- [X] T052 [P] [US4] Write constrained Markdown rendering/plain-text extraction tests for supported elements, raw HTML, scripts, event attributes, embeds, and unsafe link protocols in `shared/tests/note-format.test.ts`
- [X] T053 [P] [US4] Write note 2,000-character validation, persistence, round-trip, and search projection integration tests in `server/tests/integration/formatted-notes.test.ts`
- [X] T054 [P] [US4] Write editor toolbar, preview, rendered view, accessible link, and edit-round-trip component tests in `client/tests/formatted-notes.test.tsx`

### Implementation for User Story 4

- [X] T055 [P] [US4] Implement the constrained Markdown schema, safe renderer configuration, and searchable plain-text extraction in `shared/src/schemas/note.ts` and `shared/src/notes/format.ts`
- [X] T056 [US4] Persist `note_source` at maximum 2,000 characters and derived `note_search_text`, updating both atomically in `server/src/services/bookmark-service.ts` and `server/src/repositories/bookmark-repository.ts`
- [X] T057 [P] [US4] Build the note editor with heading/link/ordered-list/unordered-list controls and safe live preview in `client/src/features/bookmarks/NoteEditor.tsx` and `client/src/features/bookmarks/NotePreview.tsx`
- [X] T058 [US4] Integrate safe rendered notes into create/edit/detail and search behavior in `client/src/features/bookmarks/BookmarkCreateForm.tsx`, `client/src/pages/BookmarkDetailPage.tsx`, and `client/src/pages/BookmarkEditPage.tsx`
- [X] T059 [US4] Add formatted-note round-trip and active-content rejection checks in `e2e/formatted-notes.spec.ts`

**Checkpoint**: US4 formatting renders safely, round-trips, and contributes visible text to search.

---

## Phase 7: User Story 5 — Maintain the Collection (Priority: P3)

**Goal**: Edit bookmarks, manage favorites, archive/restore reversibly, and permanently delete only after explicit confirmation.

**Independent Test**: Edit every mutable field, toggle favorite, archive and restore while retaining all data/state, cancel deletion, then confirm deletion and verify dependent cleanup.

### Tests for User Story 5

- [X] T060 [P] [US5] Write edit URL/title/note/tag, duplicate-on-update, favorite, archive/restore, confirmed delete, media cascade, and orphan-tag cleanup contract/integration tests in `server/tests/contract/bookmark-maintenance.test.ts` and `server/tests/integration/bookmark-deletion.test.ts`
- [X] T061 [P] [US5] Write edit retention, favorite view, archive/restore, confirmation dialog focus/cancel/confirm, and state-preservation component tests in `client/tests/bookmark-maintenance.test.tsx`

### Implementation for User Story 5

- [X] T062 [US5] Implement transactional update, favorite toggle, archive/restore, duplicate-on-update conflict, and permanent cascade deletion in `server/src/services/bookmark-service.ts`, `server/src/repositories/bookmark-repository.ts`, and `server/src/api/bookmark-routes.ts`
- [X] T063 [P] [US5] Build the reusable edit form with retained failed input and optional metadata refresh in `client/src/features/bookmarks/BookmarkEditForm.tsx` and `client/src/pages/BookmarkEditPage.tsx`
- [X] T064 [P] [US5] Build favorite/archive/restore actions and favorite/archive views in `client/src/features/bookmarks/CollectionActions.tsx`, `client/src/pages/FavoritesPage.tsx`, and `client/src/pages/ArchivePage.tsx`
- [X] T065 [P] [US5] Build the explicit delete confirmation dialog with focus trap, focus restoration, cancel, and permanent-delete language in `client/src/components/ConfirmDeleteDialog.tsx`
- [X] T066 [US5] Integrate maintenance mutations, view counts, preserved states, errors, and post-action focus in `client/src/services/bookmarks.ts`, `client/src/features/bookmarks/BookmarkCard.tsx`, and `client/src/pages/BookmarkDetailPage.tsx`
- [X] T067 [US5] Add the edit/favorite/archive/restore/cancel-delete/confirm-delete journey in `e2e/bookmark-maintenance.spec.ts`

**Checkpoint**: All five approved user stories are independently functional and integrated.

---

## Phase 8: Polish & Cross-Cutting Verification

**Purpose**: Prove scale, accessibility, security, delivery behavior, and all-story regression quality.

- [X] T068 [P] Add 1,000/10,000-bookmark seed tooling and automated list/search/filter/sort/state timing assertions for the one-second target in `server/tests/helpers/seed.ts`, `server/tests/performance/collection-performance.test.ts`, and `package.json`
- [X] T069 [P] Add automated keyboard, accessible-name, focus, live-region, and critical-barrier checks across primary pages in `e2e/accessibility.spec.ts`
- [X] T070 [P] Add HTTP security headers, restrictive content security policy, no-referrer external links, request logging without note/URL leakage, and production error redaction in `server/src/app.ts`, `server/src/api/security-headers.ts`, and `server/tests/contract/security.test.ts`
- [X] T071 Re-run metadata threat cases end to end and close any redirect, DNS, MIME-sniffing, oversized-stream, or cached-media gaps in `server/src/security/`, `server/src/services/safe-fetch.ts`, and `server/tests/unit/metadata-service.test.ts`
- [X] T072 [P] Add production build/start/migration scripts, runtime data-directory documentation, graceful shutdown, and deployment notes in `package.json`, `README.md`, and `.env.example`
- [X] T073 Run the complete unit, component, contract, integration, performance, and Playwright suites and record command outcomes against `specs/001-bookmark-manager/quickstart.md`
- [X] T074 Build the production application, run it on `0.0.0.0:4000`, exercise every quickstart journey at `http://127.0.0.1:4000/`, and fix any fidelity regressions in the affected `client/`, `server/`, or `shared/` files
- [X] T075 Create `/work/.harness/app.json` with `{"kind":"application","port":4000,"path":"/","start_command":["npm","start"],"start_cwd":"/work"}` and expose `data-harness-ready="true"` in `client/src/app/App.tsx` only after the usable initial state loads

---

## Dependencies & Execution Order

### Phase dependencies

- **Phase 1 — Setup**: starts immediately.
- **Phase 2 — Foundation**: depends on Phase 1 and blocks every user story.
- **Phase 3 — US1**: starts after Foundation and yields the MVP.
- **Phase 4 — US2**: starts after Foundation; uses seeded bookmarks independently, then integrates with US1 create/edit.
- **Phase 5 — US3**: starts after Foundation; uses seeded bookmarks independently, then integrates with collection cards/views.
- **Phase 6 — US4**: starts after Foundation; its search integration follows US2's evaluator contract.
- **Phase 7 — US5**: starts after Foundation; final integration is safest after US1–US4 because it edits and preserves all their fields/states.
- **Phase 8 — Polish**: depends on every story selected for release; T073–T075 are sequential release gates.

### User-story dependency graph

```text
Setup → Foundation → US1 (MVP)
                   ├→ US2 ─┐
                   ├→ US3  ├→ US5 → Polish/Release
                   └→ US4 ─┘
```

US2 and US3 can be implemented concurrently after Foundation. Most of US4 can run concurrently, but its final search integration uses US2. US5's core service can start from seeded records, while final UI integration follows the earlier stories.

### Within each user story

1. Add the listed tests and confirm they fail for the missing behavior.
2. Implement model/repository and pure service behavior.
3. Implement API contracts.
4. Implement client UI and integration.
5. Run the story's independent test and checkpoint before continuing.

## Parallel Opportunities

- Phase 1 has four parallel configuration tasks after T001.
- Phase 2 allows contracts/config/test adapters and client base work to proceed around the ordered database/server shell.
- US1 offers parallel normalization, address security, parsing, repository, and client presentation work before service integration.
- US2 allows parser, tag persistence, client controls, and tests to proceed in parallel.
- US3, US4, and US5 test/UI tasks marked `[P]` can proceed beside their service work when prerequisites exist.
- After Foundation, separate contributors can take US2, US3, and most of US4 simultaneously.

## Parallel Execution Examples

### User Story 1

```text
T021 URL normalization
T022 public-address classification
T024 metadata parsing
T026 bookmark/media repositories
T028 save form
T029 bookmark presentation
```

### User Story 2

```text
T036 tag repository
T037 search tokenizer/parser
T040 tag controls
T041 search controls
```

### User Stories 3 and 4

```text
US3: T044–T051
US4: T052–T057 (T058 follows US2 search integration)
```

## Implementation Strategy

### MVP first

1. Complete Setup and Foundation.
2. Complete US1 and its hostile-metadata/duplicate tests.
3. Stop and validate the enriched save, persistence, open, fallback, and duplicate-routing journey.

### Incremental delivery

1. Add US2 for organization and approved advanced search.
2. Add US3 for the independent read-later workflow.
3. Add US4 for safe formatted notes.
4. Add US5 for full collection maintenance.
5. Complete scale, accessibility, security, build, runtime, and harness gates.

## Notes

- `[P]` never overrides an explicit dependency described in the relevant phase.
- Test tasks precede implementation and should fail for the expected missing behavior.
- The future parenthesized/grouped search idea is intentionally excluded; v1 rejects parentheses clearly.
- Application code must continue to derive from the approved specification and plan; scope changes return to the appropriate SDD gate.
