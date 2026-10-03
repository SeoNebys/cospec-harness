# Tasks: Bookmark Manager

**Input**: Approved design documents in `specs/001-bookmark-manager/`  
**Prerequisites**: `spec.md`, `plan.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`  
**Testing approach**: Story tests are written before their implementations and must initially fail.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Safe to execute in parallel because it uses different files and has no unmet dependency.
- **[USn]**: Maps the task to an approved user story.

## Phase 1: Setup

**Purpose**: Establish the exact-pinned application, tooling, and directory skeleton.

- [X] T001 Initialize the Next.js 16.3.5, React 19.3.0, and TypeScript 7.0.2 project with Node `>=24.15 <25`, exact direct dependency versions, scripts, and committed lockfile in `package.json` and `package-lock.json`
- [X] T002 Install and configure Drizzle, better-sqlite3, Zod, Cheerio, parse5, Markdown/sanitization packages, Vitest 4.2.0, Testing Library React 16.3.3, jsdom 30.1.0, and Playwright 1.61.0 in `package.json`
- [X] T003 [P] Configure strict TypeScript, Next.js, and import aliases in `tsconfig.json` and `next.config.ts`
- [X] T004 [P] Configure linting and formatting scripts in `eslint.config.mjs` and `package.json`
- [X] T005 [P] Configure Vitest environments and Playwright to use `/opt/playwright-browsers` in `vitest.config.ts` and `playwright.config.ts`
- [X] T006 Create the planned `src/app`, `src/features`, `src/lib`, `src/server`, `drizzle`, `data`, and `tests` structure and ignore runtime data in `.gitignore`

---

## Phase 2: Foundational Prerequisites

**Purpose**: Build shared persistence, validation, error, and presentation foundations that block every story.

**Checkpoint**: No story implementation starts until this phase passes.

- [X] T007 Define Bookmark, Tag, BookmarkTag, SavedSearch, Preferences, BulkOperation, BulkOperationTarget, ImportRun, and ImportIssue tables with all enums, foreign keys, and unique constraints from `data-model.md` in `src/server/db/schema.ts`
- [X] T008 Create SQLite migration files with WAL, foreign keys, busy timeout, FTS5 projection/triggers, deterministic sort indexes, archive/read partial indexes, and tag reverse index in `drizzle/`
- [X] T009 Implement configurable `DATABASE_PATH`, connection lifecycle, migration startup, and graceful close in `src/server/db/client.ts` and `src/server/db/migrate.ts`
- [X] T010 [P] Define Zod boundary schemas with URL ≤2,048, title 1–300, description ≤2,000, notes ≤50,000, tag 1–100, ≤100 tags/bookmark, saved-search name 1–100, and preference enums in `src/lib/validation/schemas.ts`
- [X] T011 [P] Implement shared problem responses, validation mapping, and safe operational logging in `src/server/services/errors.ts` and `src/server/services/logger.ts`
- [X] T012 [P] Implement the responsive application shell, navigation for main/unread/archive/saved searches/settings, global styles, accessibility focus treatment, and loading/error boundaries in `src/app/layout.tsx`, `src/app/globals.css`, `src/app/loading.tsx`, and `src/app/error.tsx`
- [X] T013 Implement bookmark and tag repositories with transactional FTS synchronization and cleanup of unused tags in `src/server/repositories/bookmark-repository.ts` and `src/server/repositories/tag-repository.ts`
- [X] T014 [P] Create deterministic fixtures and temporary SQLite test helpers in `tests/fixtures/bookmarks.ts` and `tests/helpers/database.ts`
- [X] T015 Write migration, constraint, cascade, FTS synchronization, and persistence integration tests in `tests/integration/database.test.ts`
- [X] T016 Implement shared API response helpers and request-boundary validation in `src/app/api/_shared/responses.ts` and `src/app/api/_shared/validate.ts`

---

## Phase 3: User Story 1 — Save with Automatic Details (P1) 🎯 MVP

**Goal**: Paste a link, safely prefill available metadata/icon, edit it, save, and open it.

**Independent Test**: Use a controlled page to retrieve metadata, override it before saving, verify fallback behavior on failure, persist the bookmark, and open its destination.

- [X] T017 [P] [US1] Write metadata extraction, timeout, redirect, MIME, size, unsafe-address, and late-response unit tests in `tests/unit/metadata-fetch.test.ts`
- [X] T018 [P] [US1] Write create/open bookmark route contract tests, including validation limits and non-blocking metadata failure, in `tests/contract/bookmarks-create.test.ts`
- [X] T019 [US1] Implement public-IP classification, DNS resolution/pinning, redirect revalidation, ports 80/443, 3-second connect/10-second total, 64 KiB headers, and 2 MiB decoded-body enforcement in `src/server/security/safe-fetch.ts`
- [X] T020 [US1] Implement inert HTML title/description extraction with 300/2,000-character caps and no canonical-URL adoption in `src/server/services/metadata-service.ts`
- [X] T021 [US1] Implement guarded icon discovery, 3 redirects, 5-second/512 KiB/512×512 limits, raster validation, local PNG re-encoding/storage, and fallback selection in `src/server/services/icon-service.ts`
- [X] T022 [US1] Implement bookmark creation with HTTP(S), required title, optional metadata, unread default, and transactional persistence in `src/server/services/bookmark-service.ts`
- [X] T023 [US1] Implement `POST /api/metadata/preview`, `POST /api/bookmarks`, and opening-safe bookmark response behavior in `src/app/api/metadata/preview/route.ts` and `src/app/api/bookmarks/route.ts`
- [X] T024 [US1] Build the URL-first save form with cancellable retrieval, manual fallback, protected user edits, validation retention, icon fallback, and external destination opening in `src/features/bookmarks/BookmarkForm.tsx` and `src/app/bookmarks/new/page.tsx`
- [X] T025 [US1] Add the independent save-and-open Playwright journey, including unavailable metadata, in `tests/e2e/save-bookmark.spec.ts`

**Checkpoint**: A user can safely save and reopen a bookmark with minimal typing.

---

## Phase 4: User Story 2 — Prevent Duplicates (P1)

**Goal**: Enforce one canonical record per normalized destination across active and archived bookmarks.

**Independent Test**: Submit every documented equivalent URL variant and verify the existing record opens; distinct paths/queries remain distinct.

- [X] T026 [P] [US2] Write table/property tests for scheme/host case, default ports, root slash, fragments, path case, query order/content, credentials, and IDN handling in `tests/unit/url-normalization.test.ts`
- [X] T027 [P] [US2] Write create/edit duplicate race and archived-canonical integration tests in `tests/integration/deduplication.test.ts`
- [X] T028 [US2] Implement WHATWG normalization that ignores host case, default ports, root slash, and fragments while preserving path and query semantics in `src/lib/url/normalize.ts`
- [X] T029 [US2] Enforce normalized uniqueness on create/edit and return canonical ID plus archive state from `src/server/services/bookmark-service.ts` and `src/app/api/bookmarks/[id]/route.ts`
- [X] T030 [US2] Add duplicate redirection, archived notice, update, and restore affordances to `src/features/bookmarks/BookmarkForm.tsx` and `src/features/bookmarks/DuplicateNotice.tsx`
- [X] T031 [US2] Add canonical duplicate and distinct-address Playwright coverage in `tests/e2e/deduplication.spec.ts`

**Checkpoint**: Repeat links can never create or overwrite a second record.

---

## Phase 5: User Story 3 — Read Later and Archive (P1)

**Goal**: Support durable unread/read, archive browsing, and lossless restore workflows.

**Independent Test**: Save unread, mark read/unread, archive, inspect archive, restore, and verify retained read state after restart.

- [X] T032 [P] [US3] Write status transition, active/unread/archive scope, and persistence integration tests in `tests/integration/bookmark-status.test.ts`
- [X] T033 [P] [US3] Write bookmark collection card/list component tests for visible status and empty/no-match distinctions in `tests/unit/collection-ui.test.tsx`
- [X] T034 [US3] Implement status mutations and scoped collection queries with deterministic pagination in `src/server/services/bookmark-status-service.ts` and `src/server/repositories/bookmark-repository.ts`
- [X] T035 [US3] Implement `GET /api/bookmarks` status scopes and bookmark status updates in `src/app/api/bookmarks/route.ts` and `src/app/api/bookmarks/[id]/route.ts`
- [X] T036 [US3] Build main, unread, and archive collection views with status actions, visible state, empty states, pagination, and restored session view state in `src/features/collection/BookmarkCollection.tsx`, `src/app/page.tsx`, and `src/app/archive/page.tsx`
- [X] T037 [US3] Add read/archive/restore/restart Playwright coverage in `tests/e2e/read-archive.spec.ts`

**Checkpoint**: The reading queue and reversible archive work independently.

---

## Phase 6: User Story 4 — Precise and Saved Search (P1)

**Goal**: Provide the approved query language, visible interpretation, and reusable searches over current data.

**Independent Test**: Run all grammar forms and errors, save combined criteria, change data, and verify reevaluation.

- [X] T038 [P] [US4] Write lexer/parser precedence, escaping, source-span error, unknown-field, empty-group, and malformed-input tests from `contracts/search-grammar.md` in `tests/unit/search-parser.test.ts`
- [X] T039 [P] [US4] Write FTS/text/tag/status/negation/sort and 10,000-row query integration tests in `tests/integration/search.test.ts`
- [X] T040 [P] [US4] Write saved-search uniqueness, versioning, and current-data reevaluation contract tests in `tests/contract/saved-searches.test.ts`
- [X] T041 [US4] Implement tokenizer, recursive-descent parser, typed AST, precedence, offsets, and correction suggestions in `src/lib/search/tokenizer.ts`, `src/lib/search/parser.ts`, and `src/lib/search/ast.ts`
- [X] T042 [US4] Implement parameterized AST compilation to scoped FTS/relational set queries and interpreted criteria in `src/server/services/search-service.ts`
- [X] T043 [US4] Implement SavedSearch repository/service with unique normalized 1–100-character names, original query, versioned criteria, scope, read filter, and sort in `src/server/repositories/saved-search-repository.ts` and `src/server/services/saved-search-service.ts`
- [X] T044 [US4] Implement bookmark search and saved-search list/create/update/delete routes in `src/app/api/bookmarks/route.ts` and `src/app/api/saved-searches/route.ts` and `src/app/api/saved-searches/[id]/route.ts`
- [X] T045 [US4] Build query entry, interpreted chips, source-span errors, scope/read filters, sorting, and saved-search management in `src/features/search/SearchBar.tsx`, `src/features/search/CriteriaView.tsx`, and `src/features/saved-searches/SavedSearchPanel.tsx`
- [X] T046 [US4] Add expressive search, errors, and saved-search reevaluation Playwright coverage in `tests/e2e/search.spec.ts`

**Checkpoint**: A 10,000-item collection is precisely searchable and common searches are reusable.

---

## Phase 7: User Story 5 — Maintain Rich Details (P2)

**Goal**: Edit all bookmark details, safely read formatted notes, and permanently delete with confirmation.

**Independent Test**: Edit every field, render allowed note structures and hostile input, then permanently delete only after confirmation.

- [X] T047 [P] [US5] Write Markdown allowlist, unsafe protocol, raw HTML, mutation-XSS, and visible-text extraction tests in `tests/unit/note-renderer.test.ts`
- [X] T048 [P] [US5] Write edit and permanent-delete route contract tests with all documented field limits in `tests/contract/bookmarks-maintain.test.ts`
- [X] T049 [US5] Implement restricted Markdown rendering, sanitizer schema, safe external-link attributes, and plain-text derivation in `src/server/security/note-renderer.ts`
- [X] T050 [US5] Implement transactional content/tag editing, FTS refresh, and permanent deletion in `src/server/services/bookmark-service.ts` and `src/app/api/bookmarks/[id]/route.ts`
- [X] T051 [US5] Build bookmark detail/edit view with Markdown authoring help, formatted preview/display, retained validation input, and immutable metadata timestamps in `src/features/bookmarks/BookmarkDetail.tsx`, `src/features/bookmarks/NoteEditor.tsx`, and `src/app/bookmarks/[id]/page.tsx`
- [X] T052 [US5] Add explicit irreversible single-delete confirmation and post-delete navigation in `src/features/bookmarks/DeleteBookmarkDialog.tsx`
- [X] T053 [US5] Add edit, safe formatted notes, and deletion Playwright coverage in `tests/e2e/maintain-bookmark.spec.ts`

**Checkpoint**: Bookmark context is rich, safely rendered, editable, and permanently removable.

---

## Phase 8: User Story 6 — Manage Many at Once (P2)

**Goal**: Apply supported actions to explicit or all-matching selections without stale-target mistakes.

**Independent Test**: Select across pages, force the match set to change, verify reconfirmation, then execute every bulk action against only confirmed records.

- [X] T054 [P] [US6] Write explicit/all-matching/exclusion, expiration, single-use, exact-set stale, and atomic mutation integration tests in `tests/integration/bulk-actions.test.ts`
- [X] T055 [P] [US6] Write bulk preview/execute contract tests including `409 stale_selection` replacement tokens and result counts in `tests/contract/bulk-actions.test.ts`
- [X] T056 [US6] Implement expiring BulkOperation/Target persistence, criteria hashing, exact-set comparison, and cleanup in `src/server/repositories/bulk-operation-repository.ts`
- [X] T057 [US6] Implement preview and transactional add/remove tag, read/unread, archive/restore, and permanent-delete execution with result summaries in `src/server/services/bulk-action-service.ts`
- [X] T058 [US6] Implement bulk preview and execute routes from `contracts/api.yaml` in `src/app/api/bulk-actions/preview/route.ts` and `src/app/api/bulk-actions/execute/route.ts`
- [X] T059 [US6] Build explicit/all-match selection, exclusions, count refresh, action bar, stale reconfirmation, irreversible deletion warning, and result feedback in `src/features/collection/SelectionController.tsx` and `src/features/collection/BulkActionBar.tsx`
- [X] T060 [US6] Add cross-page selection, stale-set, every action, and 10,000-target Playwright/integration coverage in `tests/e2e/bulk-actions.spec.ts` and `tests/performance/bulk-actions.perf.test.ts`

**Checkpoint**: Bulk actions affect exactly the current, explicitly confirmed set.

---

## Phase 9: User Story 7 — Import and Export (P2)

**Goal**: Port browser bookmarks in and out with strict validation, deduplication, folder-to-tag conversion, and transparent loss reporting.

**Independent Test**: Import nested/duplicate/invalid/partial fixtures, verify exact report and records, then import the export into a representative browser/parser.

- [X] T061 [P] [US7] Create nested, duplicate, malformed, hostile, oversized, and empty Netscape bookmark fixtures in `tests/fixtures/import/`
- [X] T062 [P] [US7] Write parser, limits, folder-tag mapping, no-overwrite, partial-success, and all-or-nothing invalid-file tests in `tests/integration/import.test.ts`
- [X] T063 [P] [US7] Write escaping, active/archive inclusion, disclosure, and round-trip export tests in `tests/integration/export.test.ts`
- [X] T064 [US7] Implement tolerant staged HTML traversal with 10 MiB/10,000-link/50-level limits, HTTP(S)-only validation, ignored embedded icons, 300-character titles, 2,000-character descriptions, and ≤100 tags of ≤100 characters in `src/server/services/import-service.ts`
- [X] T065 [US7] Implement escaped streamed UTF-8 browser HTML export with titles, URLs, dates, tags, descriptions, and omission disclosure in `src/server/services/export-service.ts`
- [X] T066 [US7] Implement multipart import and downloadable export routes in `src/app/api/imports/bookmarks/route.ts` and `src/app/api/exports/bookmarks/route.ts`
- [X] T067 [US7] Build file selection, limitations disclosure, import counts/reasons, and export controls in `src/features/import-export/ImportExportPanel.tsx` and `src/app/settings/page.tsx`
- [X] T068 [US7] Add import/report/export round-trip Playwright coverage in `tests/e2e/import-export.spec.ts`

**Checkpoint**: Existing collections move in without data corruption and can leave in a disclosed compatible form.

---

## Phase 10: User Story 8 — Personalize Display (P3)

**Goal**: Persist default sort, page size, and text size while allowing saved-search sort to override locally.

**Independent Test**: Change all preferences, restart, verify every default, then verify saved-search sort precedence without global mutation.

- [X] T069 [P] [US8] Write default, enum validation, persistence, and saved-search precedence tests in `tests/integration/preferences.test.ts`
- [X] T070 [US8] Implement singleton preference repository/service and GET/PUT routes with newest/25/standard defaults in `src/server/repositories/preference-repository.ts`, `src/server/services/preference-service.ts`, and `src/app/api/preferences/route.ts`
- [X] T071 [US8] Build accessible sort/page-size/text-size controls and apply root text sizing without layout loss in `src/features/preferences/DisplayPreferences.tsx` and `src/app/settings/page.tsx`
- [X] T072 [US8] Add restart persistence and saved-search override Playwright coverage in `tests/e2e/preferences.spec.ts`

**Checkpoint**: Display choices persist without changing saved-search semantics.

---

## Phase 11: Polish and Cross-Cutting Validation

**Purpose**: Verify the complete approved system, security boundaries, performance, accessibility, and review delivery.

- [X] T073 [P] Add controlled metadata servers and DNS/IP/redirect/decompression/malicious-icon security fixtures in `tests/fixtures/http/` and `tests/integration/metadata-security.test.ts`
- [X] T074 [P] Add 10,000-bookmark search/filter/sort/page p95 performance suite in `tests/performance/collection.perf.test.ts`
- [X] T075 [P] Add keyboard, focus, labeling, contrast, text-size, and responsive viewport checks across primary journeys in `tests/e2e/accessibility.spec.ts`
- [X] T076 Configure content security, MIME sniffing prevention, referrer, and same-origin response headers in `next.config.ts` and verify them in `tests/contract/security-headers.test.ts`
- [X] T077 Add database backup/restore and private single-user deployment guidance in `README.md`
- [X] T078 Execute lint, typecheck, unit, integration, contract, performance, build, and Playwright suites and record any justified deviations in `specs/001-bookmark-manager/quickstart.md`
- [X] T079 Create `/work/.harness/app.json` for `npm start` on port 4000, start the prepared build, and verify `/` reaches a non-loading element with `data-harness-ready="true"`
- [X] T080 Perform the complete manual acceptance run in `specs/001-bookmark-manager/quickstart.md` and save relevant post-action review screenshots under `prototypes/`

---

## Dependencies and Execution Order

### Phase Dependencies

- Phase 1 → Phase 2 → all user-story phases.
- US1 provides canonical creation used by US2 and the collection used by later stories.
- US2 should precede import because import shares normalization/deduplication.
- US3 provides scopes/status transitions consumed by search, bulk actions, and export.
- US4 provides criteria compilation consumed by all-matching bulk selection.
- US5 supplies note plain text and editing/deletion but can begin after the foundation alongside US3/US4.
- US6 depends on US3 status actions and US4 criteria compilation.
- US7 depends on US1 creation, US2 deduplication, and foundational tags.
- US8 depends only on the foundation; saved-search precedence integration requires US4.
- Polish follows all stories selected for the release.

### Story Dependency Graph

```text
Setup → Foundation → US1 → US2 ─────────→ US7
                    ├────→ US3 ──┬──────→ US6
                    ├────→ US4 ──┘
                    ├────→ US5
                    └────→ US8 (US4 needed only for saved-search precedence)
All completed stories → Polish
```

### Parallel Opportunities

- Setup tasks T003–T005 can run together after T001–T002.
- Foundation tasks T010–T012 and T014 can run while schema/migration work proceeds.
- In every story, tasks marked `[P]` are test/fixture work in separate files and can run before implementation.
- After US1, US3, US4, US5, and most of US8 can proceed in parallel; US2 can proceed concurrently but gates US7.
- T073–T075 can run together before the final sequential validation and harness steps.

## Parallel Examples

### US1

```text
T017 metadata/security unit tests
T018 create/open contract tests
```

### US4

```text
T038 parser tests
T039 search integration/performance tests
T040 saved-search contract tests
```

### US7

```text
T061 import fixtures
T062 import integration tests
T063 export integration tests
```

## Implementation Strategy

### MVP First

1. Complete Setup and Foundation.
2. Complete US1 and validate it independently.
3. Add US2 to guarantee collection integrity.
4. Add US3 and US4 to deliver the full P1 daily-use experience.

### Incremental Release

1. **Capture MVP**: US1.
2. **Reliable daily workflow**: US2–US4.
3. **Collection maintenance and portability**: US5–US7.
4. **Personalization**: US8.
5. **Release hardening**: Phase 11.

## Notes

- Each task includes an exact target path and conforms to the required checklist syntax.
- Tests precede implementations and should fail for the intended missing behavior before production work begins.
- `[P]` denotes file-level parallel safety, not permission to bypass dependencies.
- Stop at each story checkpoint for focused validation; application coding begins only after this task list is approved.
