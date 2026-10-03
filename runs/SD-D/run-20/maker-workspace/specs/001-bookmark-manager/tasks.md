---
description: "Dependency-ordered implementation tasks for the bookmark manager"
---

# Tasks: Bookmark Manager

**Input**: Approved design documents from `specs/001-bookmark-manager/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`, and `quickstart.md`

**Tests**: Required because the approved specification defines acceptance scenarios, measurable performance outcomes, keyboard-only workflows, and automated accessibility evaluation. Within each user-story phase, write the listed tests first and confirm they fail for the expected missing behavior before implementing that story.

**Organization**: Tasks are grouped by user story so each approved product capability can be implemented and demonstrated as an incremental slice.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it uses different files and has no dependency on another unfinished task in the same group.
- **[Story]**: Maps the task to a user story in `spec.md`.
- Every task names the exact file or directory it changes.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Initialize the one-package TypeScript application and its verification toolchain.

- [X] T001 Create `package.json` and `package-lock.json` with Node 24 engines plus pinned React 19.3, Vite 8.3, Fastify 5, better-sqlite3 13, Cheerio 1, Undici 7, Tiptap 3, Zod 4, file-type 21, Vitest 5, Playwright 1.61.0, Testing Library, and axe dependencies from `plan.md`
- [X] T002 Configure ESM TypeScript compilation, client/server path aliases, development/build/start scripts, and `HOST=0.0.0.0`/`PORT=4000` defaults in `tsconfig.json`, `tsconfig.server.json`, `vite.config.ts`, and `package.json`
- [X] T003 [P] Create the planned source/test directory skeleton and minimal entry files in `index.html`, `src/client/main.tsx`, `src/client/app/App.tsx`, `src/server/index.ts`, and `src/server/app.ts`
- [X] T004 [P] Configure linting and formatting for TypeScript, React, tests, and generated build exclusions in `eslint.config.js` and `.prettierrc.json`
- [X] T005 [P] Configure unit/component and browser test projects without downloading a second browser revision in `vitest.config.ts` and `playwright.config.ts`
- [X] T006 [P] Ignore runtime databases, cached assets, builds, coverage, and browser artifacts while retaining placeholder directories in `.gitignore`, `data/.gitkeep`, and `data/assets/.gitkeep`
- [X] T007 [P] Define accessible color, spacing, typography, focus, and responsive layout tokens in `src/client/styles/tokens.css` and `src/client/styles/global.css`

**Checkpoint**: Dependencies install and the empty client/server/test projects compile.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish storage, contracts, errors, application boundaries, and deterministic test seams required by every story.

**⚠️ CRITICAL**: No user-story implementation starts until this phase is complete.

- [X] T008 Implement shared Zod request/response schemas matching `contracts/openapi.yaml` in `src/shared/schemas/api.ts`, including bookmark title `1–200`, URL `1–2,048`, description maximum `500`, note readable-text maximum `5,000`, tag label `1–30`, at most `20` tags, at most `100` unique bulk IDs, and enum values exactly as contracted
- [X] T009 Implement the numbered migration runner and startup migration command in `src/server/db/migrate.ts` and `src/server/db/connection.ts`, enabling foreign keys, WAL, bounded busy timeout, defensive prepared access, and one application connection
- [X] T010 Create `db/migrations/001_core.sql` with `bookmarks`, `tags`, and `bookmark_tags`: `normalized_url` unique across active and archived bookmarks; title `1–200` readable characters; URL `1–2,048`; description maximum `500`; `note_text` maximum `5,000`; lifecycle `active|archived`; reading `none|unread|read`; metadata status `complete|partial|failed|skipped|fallback`; tag label `1–30`; normalized tag unique; composite bookmark/tag key; and no more than `20` tag relationships enforced by service validation
- [X] T011 Create `db/migrations/002_metadata_search.sql` with `media_assets`, `metadata_previews`, schema migration tracking, and FTS5: media bytes greater than zero and no more than `2 MiB`, state `temporary|claimed`, preview expiry exactly fifteen minutes after creation, allowlisted status values, FTS columns `title,url,description,note_text,tags_text`, Unicode tokenization, and required indexes from `data-model.md`
- [X] T012 [P] Implement public-ID, timestamp, transaction, pagination, row-mapping, and FTS replace/rebuild helpers in `src/server/repositories/database.ts` and `src/server/repositories/search-index.ts`
- [X] T013 Implement Fastify construction, structured error envelopes, Zod validation mapping, security headers, same-origin policy, `/api/health`, production static serving, and graceful database shutdown in `src/server/app.ts`, `src/server/api/errors.ts`, and `src/server/index.ts`
- [X] T014 [P] Implement the typed same-origin request client, abort handling, and error decoding in `src/client/lib/api.ts` and `src/client/lib/errors.ts`
- [X] T015 [P] Implement the application frame, active/unread/archived navigation model, live-status region, global error boundary, and loading/empty-ready boundaries in `src/client/app/App.tsx`, `src/client/app/AppShell.tsx`, and `src/client/app/useLibraryState.ts`
- [X] T016 [P] Implement reusable accessible controls and layout primitives in `src/client/components/Button.tsx`, `src/client/components/Dialog.tsx`, `src/client/components/Field.tsx`, `src/client/components/StatusMessage.tsx`, and `src/client/styles/components.css`
- [X] T017 [P] Create temporary migrated database factories, deterministic clocks/UUIDs, metadata transport injection, API builders, and reusable bookmark/page fixtures in `tests/fixtures/database.ts`, `tests/fixtures/metadata.ts`, and `tests/fixtures/bookmarks.ts`
- [X] T018 [P] Add OpenAPI lint/schema-response contract helpers and a contract coverage test for every declared operation in `tests/contract/openapi.test.ts` and `tests/contract/helpers.ts`
- [X] T019 Add failing-then-passing foundation smoke tests for migration idempotence, `/api/health`, error envelopes, static fallback, and database shutdown in `tests/integration/foundation.test.ts`

**Checkpoint**: The foundation builds, migrations are repeatable, the health contract passes, and story work can use stable shared types and test fixtures.

---

## Phase 3: User Story 1 — Save with automatic page details (Priority: P1) 🎯 MVP

**Goal**: Paste a URL, see safely fetched title/description/icon/image or a usable fallback, edit the text, save durably, reject duplicates, and reopen the destination.

**Independent Test**: Paste a public fixture URL, review/edit its metadata, save, restart the app, and reopen it; repeat with blocked, timed-out, metadata-poor, invalid, and duplicate URLs and verify saving remains possible whenever the URL itself is valid.

### Tests for User Story 1

- [X] T020 [P] [US1] Write failing table-driven tests for HTTP(S)-only URL validation, trimming, lowercase scheme/host, fragment removal, default-port removal, empty-path normalization, query preservation, duplicate keys, and hostname/path fallback titles in `tests/unit/url-normalization.test.ts`
- [X] T021 [P] [US1] Write failing security tests for IPv4/IPv6/mapped loopback, private, link-local, multicast, documentation, reserved ranges, all A/AAAA answers, DNS pinning, credential URLs, redirects, hop limit, timeout, byte limit, and header stripping in `tests/unit/restricted-fetch.test.ts`
- [X] T022 [P] [US1] Write failing extraction tests for Open Graph → Twitter → standard → fallback priority, encoding sniffing, relative media URLs, malformed/oversized fields, and no script execution in `tests/unit/metadata-extractor.test.ts`
- [X] T023 [P] [US1] Write failing media tests for PNG/JPEG/WebP/GIF/AVIF/ICO signature acceptance, SVG/HTML rejection, `2 MiB` cap, content-hash deduplication, temporary expiry, and safe response headers in `tests/integration/media-assets.test.ts`
- [X] T024 [P] [US1] Write failing API integration/contract tests for `POST /api/metadata-previews`, `POST /api/bookmarks`, `GET /api/bookmarks`, `GET /api/bookmarks/{id}`, `GET /api/media/{id}`, preview expiry/mismatch, persistence, field limits, and duplicate `409` responses in `tests/integration/bookmark-create.test.ts` and `tests/contract/bookmark-create.test.ts`
- [X] T025 [P] [US1] Write failing component and end-to-end tests for preview progress, the 10-second recoverable outcome, partial warnings, editable title/description, retained form values after errors, save, empty state, persisted card, and external open-without-mutation in `tests/component/bookmark-form.test.tsx` and `tests/e2e/save-bookmark.spec.ts`

### Implementation for User Story 1

- [X] T026 [P] [US1] Implement URL normalization, validation, duplicate-key production, and deterministic non-empty fallback titles in `src/server/services/url.ts`
- [X] T027 [P] [US1] Implement the SSRF-resistant Undici transport with validated/pinned DNS, manual revalidated redirects, shared 8-second network and 10-second request budgets, 2 MiB streaming caps, safe headers, and injected test transport in `src/server/metadata/restrictedFetch.ts` and `src/server/metadata/addressPolicy.ts`
- [X] T028 [P] [US1] Implement bounded Cheerio parsing and metadata priority/fallback selection in `src/server/metadata/extractMetadata.ts`
- [X] T029 [US1] Implement signature-checked, content-hashed temporary/claimed media persistence and guarded media streaming in `src/server/metadata/mediaStore.ts` and `src/server/repositories/mediaRepository.ts`
- [X] T030 [US1] Implement fifteen-minute metadata preview creation, warning/status mapping, cancellation, expiry, and asset claiming in `src/server/services/metadataPreviewService.ts` and `src/server/repositories/metadataPreviewRepository.ts`
- [X] T031 [US1] Implement transactional bookmark create/get/list persistence, exact field constraints, duplicate handling across lifecycle states, preview-token matching, FTS insertion, and durable timestamps in `src/server/repositories/bookmarkRepository.ts` and `src/server/services/bookmarkService.ts`
- [X] T032 [US1] Implement metadata preview, bookmark create/get/list, and media routes exactly matching OpenAPI responses in `src/server/api/metadataPreviewRoutes.ts`, `src/server/api/bookmarkRoutes.ts`, and `src/server/api/mediaRoutes.ts`
- [X] T033 [US1] Implement the cancellable create form, URL-only start, metadata progress/preview/warnings, editable title/description, fallback messaging, retained drafts, and save behavior in `src/client/features/bookmarks/BookmarkForm.tsx` and `src/client/features/bookmarks/useBookmarkDraft.ts`
- [X] T034 [US1] Implement the active library page, bookmark card with cached preview/icon and external open action, pagination, initial/empty/error states, and post-load `data-harness-ready="true"` marker in `src/client/features/bookmarks/LibraryPage.tsx` and `src/client/features/bookmarks/BookmarkCard.tsx`

**Checkpoint**: User Story 1 is a complete demonstrable bookmark-saving MVP, including safe failure fallbacks and persistence.

---

## Phase 4: User Story 2 — Maintain a read-later queue (Priority: P2)

**Goal**: Mark bookmarks unread/read, show only active unread bookmarks, preserve state through archive/restore, and never mark read merely by opening a destination.

**Independent Test**: Save one ordinary and two unread fixtures, mark one read, verify the unread view contains only the remaining unread bookmark, open it without state change, and mark the read item unread again.

### Tests for User Story 2

- [X] T035 [P] [US2] Write failing repository/API tests for `none → unread`, `none → read`, `unread → read`, `read → unread`, active-only unread filtering, persistence, and open-without-mutation in `tests/integration/read-later.test.ts`
- [X] T036 [P] [US2] Write failing component/end-to-end tests for create-time read-later choice, unread navigation, mark-read removal, mark-unread return, counts, empty state, keyboard access, and open-without-auto-read in `tests/component/read-later.test.tsx` and `tests/e2e/read-later.spec.ts`

### Implementation for User Story 2

- [X] T037 [P] [US2] Implement reading-state transitions and active-unread list filtering in `src/server/services/readingStateService.ts` and `src/server/repositories/bookmarkRepository.ts`
- [X] T038 [US2] Extend bookmark create/update/list API handling for `none|unread|read` and the `unread` view in `src/server/api/bookmarkRoutes.ts` and `src/shared/schemas/api.ts`
- [X] T039 [P] [US2] Add read-later selection to the draft form and explicit accessible read/unread actions to cards in `src/client/features/bookmarks/BookmarkForm.tsx` and `src/client/features/bookmarks/ReadingStateButton.tsx`
- [X] T040 [US2] Implement unread navigation, live result/count updates, and its distinct empty state without coupling external-link opening to state changes in `src/client/features/bookmarks/LibraryPage.tsx` and `src/client/app/useLibraryState.ts`

**Checkpoint**: User Story 2 works against seeded or user-created bookmarks without requiring later search/bulk features.

---

## Phase 5: User Story 3 — Find and sort bookmarks precisely (Priority: P3)

**Goal**: Search all approved fields with terms, phrases, exact tags, Boolean operators and parentheses; combine filters; click tags; handle syntax errors; and sort by title or saved date.

**Independent Test**: Seed overlapping records and verify every grammar example in `contracts/search-grammar.md`, invalid-query offsets, query/filter intersection, one-click tag filtering, clear-all, pagination, and all four sort choices.

### Tests for User Story 3

- [X] T041 [P] [US3] Write failing lexer/parser tests for terms, escaped quoted phrases, `#tag`, `#"tag with spaces"`, case-insensitive operators, implicit `AND`, precedence `NOT > AND > OR`, parentheses, double NOT, original-query preservation, and precise error spans in `tests/unit/search-parser.test.ts`
- [X] T042 [P] [US3] Write failing parser limit tests for maximum query `500` characters, `100` parsed tokens, nesting depth `10`, bare `#`, empty parentheses, unsupported escapes, unterminated quotes, and missing operands in `tests/unit/search-limits.test.ts`
- [X] T043 [P] [US3] Write failing SQLite integration tests for text/phrase leaves, exact normalized tags, NOT within the outer view universe, parameter binding, all searchable fields, lifecycle/read/tag intersection, stable pagination, and title/date directions in `tests/integration/search.test.ts`
- [X] T044 [P] [US3] Write failing API/component/end-to-end tests for retained invalid queries, accessible help, visible filters, one-click card tags, filter combination, clear-all, no-results state, and sort controls in `tests/contract/search.test.ts`, `tests/component/search-controls.test.tsx`, and `tests/e2e/search-and-sort.spec.ts`

### Implementation for User Story 3

- [X] T045 [P] [US3] Implement the bounded tokenizer, recursive-descent AST, implicit AND insertion, precedence, escaping, and structured syntax errors from `contracts/search-grammar.md` in `src/server/search/tokenize.ts` and `src/server/search/parse.ts`
- [X] T046 [US3] Compile AST leaves to bound FTS/tag row-ID sets and Boolean nodes to parameterized `INTERSECT`, `UNION`, and universe-minus-set expressions in `src/server/search/compile.ts`
- [X] T047 [US3] Implement repository search across title, URL, description, readable note text, and tags plus outer filters, stable pagination, title A–Z/Z–A, and saved-date oldest/newest in `src/server/repositories/bookmarkSearchRepository.ts`
- [X] T048 [US3] Complete `GET /api/bookmarks` query validation and `INVALID_SEARCH_QUERY` `422` responses with unchanged query, offset, length, explanation, and expected tokens in `src/server/api/bookmarkRoutes.ts`
- [X] T049 [P] [US3] Implement debounced search, syntax feedback/help, filter chips, no-results behavior, and clear-all in `src/client/features/search/SearchControls.tsx`, `src/client/features/search/SearchHelp.tsx`, and `src/client/features/search/useSearchState.ts`
- [X] T050 [US3] Implement title/date sort controls and make every displayed tag an accessible exact-filter action that combines with active criteria in `src/client/features/search/SortControl.tsx`, `src/client/features/tags/TagChip.tsx`, and `src/client/features/bookmarks/LibraryPage.tsx`

**Checkpoint**: User Story 3 can retrieve a known record from a 10,000-item seeded library using every approved query form and sort option.

---

## Phase 6: User Story 4 — Add context with formatted notes and reusable tags (Priority: P4)

**Goal**: Edit saved details safely, author/render searchable formatted notes, and reuse normalized existing tags through keyboard- and pointer-accessible suggestions.

**Independent Test**: Edit a bookmark's address/title/description; reuse prefix and substring tag suggestions; create a new normalized tag; add every allowed note format; cancel another edit; then verify rendering and note/tag search.

### Tests for User Story 4

- [X] T051 [P] [US4] Write failing note-schema tests allowing only `doc,paragraph,text,bulletList,orderedList,listItem` nodes and `bold,italic,link` marks, requiring absolute HTTP(S) links, rejecting unknown structures/protocols, normalizing empty notes, deriving readable text, and enforcing maximum `5,000` readable characters in `tests/unit/note-document.test.ts`
- [X] T052 [P] [US4] Write failing tag tests for trimmed/collapsed/Unicode-normalized/case-folded uniqueness, label length `1–30`, at most `20` tags, prefix-before-substring ordering, stable case-insensitive order, at most eight results, assigned-tag exclusion, and orphan-tag retention in `tests/integration/tags.test.ts`
- [X] T053 [P] [US4] Write failing update tests for URL re-preview/duplicate validation, title `1–200`, URL `1–2,048`, description maximum `500`, cancel/no-write behavior, transactional tag and FTS replacement, and safe note persistence in `tests/integration/bookmark-edit.test.ts` and `tests/contract/bookmark-edit.test.ts`
- [X] T054 [P] [US4] Write failing component/end-to-end tests for rich formatting, safe rendering, searchable readable text, edit/cancel, autocomplete keyboard/pointer use, existing-tag reuse, new-tag creation, and first-tag empty suggestions in `tests/component/bookmark-editor.test.tsx` and `tests/e2e/edit-notes-and-tags.spec.ts`

### Implementation for User Story 4

- [X] T055 [P] [US4] Implement allowlisted Tiptap JSON validation, HTTP(S) link validation, empty normalization, and readable-text extraction in `src/shared/schemas/noteDocument.ts` and `src/server/services/noteDocumentService.ts`
- [X] T056 [P] [US4] Implement normalized tag reuse and eight-result prefix-first/substring suggestion queries excluding assigned tags in `src/server/repositories/tagRepository.ts` and `src/server/services/tagService.ts`
- [X] T057 [US4] Implement transactional bookmark edit with address preview-token matching, duplicate protection, tag replacement, note validation, updated timestamp, asset claiming, and FTS replacement in `src/server/services/bookmarkService.ts` and `src/server/repositories/bookmarkRepository.ts`
- [X] T058 [US4] Implement `PATCH /api/bookmarks/{id}` and `GET /api/tags?suggest=...&excludeBookmarkId=...` exactly as contracted in `src/server/api/bookmarkRoutes.ts` and `src/server/api/tagRoutes.ts`
- [X] T059 [P] [US4] Build the constrained Tiptap editor toolbar for bold, italic, HTTP(S) link, bulleted list, and numbered list with accessible pressed/disabled states in `src/client/features/editor/NoteEditor.tsx` and `src/client/features/editor/noteExtensions.ts`
- [X] T060 [P] [US4] Build safe structured read-only note rendering without raw HTML insertion in `src/client/features/editor/NoteRenderer.tsx`
- [X] T061 [US4] Implement edit-mode drafts, address-change metadata preview, validation, cancel-without-write, and formatted notes in `src/client/features/bookmarks/BookmarkForm.tsx` and `src/client/features/bookmarks/useBookmarkDraft.ts`
- [X] T062 [US4] Implement the accessible tag combobox, prefix/subsequence suggestion groups, assigned-tag exclusion, normalized creation, removal, and form integration in `src/client/features/tags/TagAutocomplete.tsx` and `src/client/features/bookmarks/BookmarkForm.tsx`

**Checkpoint**: User Story 4 preserves safe rich content, finds it as readable text, and prevents accidental near-duplicate tags through suggestions and normalization.

---

## Phase 7: User Story 5 — Organize several bookmarks at once (Priority: P5)

**Goal**: Explicitly select up to 100 current-result bookmarks and apply tag, reading-state, or archive actions with accurate per-item completion feedback.

**Independent Test**: Select several visible bookmarks, add/remove tags, mark unread/read, archive them, inspect changed/unchanged/failed IDs, then change query/view and verify selection clears with notice.

### Tests for User Story 5

- [X] T063 [P] [US5] Write failing service tests for `1–100` unique explicit IDs, add/remove tags without touching unrelated tags, mark read/unread, archive active items, per-item eligibility, one SQL transaction, FTS refresh, and changed/unchanged/failed summaries in `tests/integration/bulk-actions.test.ts`
- [X] T064 [P] [US5] Write failing contract tests for `POST /api/bookmarks/bulk-actions`, action-specific `tagLabels`, invalid/duplicate/over-100 IDs, and result counts/IDs in `tests/contract/bulk-actions.test.ts`
- [X] T065 [P] [US5] Write failing component/end-to-end tests for explicit selection, selected count, valid action availability, accessible bulk tag input, completion summary, partial failures, and selection clearing on view/new-search context changes in `tests/component/bulk-actions.test.tsx` and `tests/e2e/bulk-organize.spec.ts`

### Implementation for User Story 5

- [X] T066 [P] [US5] Implement client selection state keyed by view/query/tag context with explicit IDs, a 100-item cap, and accessible clearing notices in `src/client/features/bookmarks/useBookmarkSelection.ts`
- [X] T067 [US5] Implement transactional addTags/removeTags/markRead/markUnread/archive action evaluation, tag-limit enforcement, FTS refresh, and completion summaries in `src/server/services/bulkActionService.ts`
- [X] T068 [US5] Implement the contracted bulk-action route and validation in `src/server/api/bulkActionRoutes.ts` and register it in `src/server/app.ts`
- [X] T069 [P] [US5] Add per-card selection controls and select-state styling without interfering with links/tag actions in `src/client/features/bookmarks/BookmarkCard.tsx` and `src/client/styles/bookmarks.css`
- [X] T070 [US5] Implement the keyboard-accessible bulk toolbar, add/remove tag flow, read/unread/archive actions, progress state, and changed/unchanged/failed live summary in `src/client/features/bookmarks/BulkActionBar.tsx` and `src/client/features/bookmarks/LibraryPage.tsx`

**Checkpoint**: User Story 5 performs safe, explicit bulk organization and reports exactly what happened.

---

## Phase 8: User Story 6 — Remove clutter safely (Priority: P6)

**Goal**: Archive and restore without data loss, and permanently delete only archived bookmarks after a clear individual or multi-item confirmation.

**Independent Test**: Archive/restore an item with tags, media, notes, and unread state intact; archive again; cancel deletion once; then confirm individual and group deletion and verify removed data/search rows plus correct counts.

### Tests for User Story 6

- [X] T071 [P] [US6] Write failing lifecycle tests for active→archived→active transitions, `archived_at`, preserved reading/details/tags/media, unread-view exclusion while archived, archive-only deletion, required `confirmed:true`, cascaded joins/FTS cleanup, and database rollback on unexpected failure in `tests/integration/archive-delete.test.ts`
- [X] T072 [P] [US6] Write failing component/end-to-end tests for archive/restore controls, archived empty state, irreversible wording and affected count, focus containment/restoration, cancel-with-no-change, individual deletion, and multi-delete summaries in `tests/component/delete-confirmation.test.tsx` and `tests/e2e/archive-delete.spec.ts`

### Implementation for User Story 6

- [X] T073 [US6] Implement restore and confirmed archive-only permanent deletion with preserved restore data, cascaded canonical/search cleanup, and post-commit media reconciliation in `src/server/services/bulkActionService.ts`, `src/server/services/bookmarkService.ts`, and `src/server/repositories/bookmarkRepository.ts`
- [X] T074 [US6] Enforce restore/delete action contracts, `confirmed:true`, per-item ineligibility, and irreversible error messages in `src/server/api/bulkActionRoutes.ts`
- [X] T075 [P] [US6] Add individual archive/restore actions and archived-view presentation while retaining reading-state and metadata indicators in `src/client/features/bookmarks/BookmarkCard.tsx` and `src/client/features/bookmarks/LibraryPage.tsx`
- [X] T076 [US6] Implement the shared individual/group deletion dialog with affected count, irreversible wording, confirm/cancel, focus management, and pending/error behavior in `src/client/features/bookmarks/DeleteBookmarksDialog.tsx`
- [X] T077 [US6] Integrate restore and delete into selection/action availability, completion summaries, archived empty state, and post-delete pagination correction in `src/client/features/bookmarks/BulkActionBar.tsx` and `src/client/features/bookmarks/LibraryPage.tsx`

**Checkpoint**: User Story 6 proves archive is reversible and permanent deletion cannot occur without archived state plus explicit confirmation.

---

## Phase 9: Polish & Cross-Cutting Verification

**Purpose**: Verify the complete approved experience across stories, security boundaries, accessibility, scale, and runtime delivery.

- [X] T078 [P] Add full-state axe scans plus explicit keyboard, focus order, visible focus, accessible name, live-region, combobox, rich-editor, and dialog assertions in `tests/accessibility/application-accessibility.spec.ts`
- [X] T079 [P] Create the deterministic 10,000-bookmark seed and 100-sample search/filter/sort benchmark asserting at least 95% of user-visible results within one second in `db/seeds/performance.ts` and `tests/performance/search-performance.test.ts`
- [X] T080 [P] Add 100-bookmark bulk timing below 30 seconds and controlled metadata-preview timing (95% within 5 seconds, all recoverable by 10 seconds) in `tests/performance/bulk-performance.test.ts` and `tests/performance/metadata-performance.test.ts`
- [X] T081 [P] Add end-to-end metadata security regression coverage for redirect chains, DNS rebinding fixtures, slow/oversized/misleading content, no credential forwarding, and safe cached media types in `tests/integration/metadata-security.test.ts`
- [X] T082 Implement startup/periodic cleanup for expired previews, temporary assets, and unreferenced claimed assets with database-before-filesystem reconciliation in `src/server/metadata/cleanup.ts` and cover it in `tests/integration/asset-cleanup.test.ts`
- [X] T083 [P] Complete narrow/wide responsive layouts, long-content wrapping, reduced-motion behavior, loading skeletons, and all distinct actionable empty/error states in `src/client/styles/global.css`, `src/client/styles/bookmarks.css`, and `src/client/styles/forms.css`
- [X] T084 Run and stabilize every quickstart acceptance journey as a single regression suite, including reload persistence and no deferred feature placeholders, in `tests/e2e/acceptance.spec.ts`
- [X] T085 [P] Document install, migration, test, build, data backup, runtime asset/database locations, and deferred scope in `README.md`, keeping `specs/001-bookmark-manager/quickstart.md` command examples current
- [X] T086 Build the production bundle, run all lint/type/unit/integration/contract/e2e/accessibility/performance checks, smoke-test `0.0.0.0:4000`, and only then write the verified launcher to `.harness/app.json`

**Checkpoint**: All approved requirements and measurable outcomes have evidence, and the prepared application is ready for client review at `http://maker:4000/`.

---

## Dependencies & Execution Order

### Phase dependencies

- **Phase 1 — Setup**: Starts immediately.
- **Phase 2 — Foundation**: Depends on Phase 1 and blocks every story.
- **Phase 3 — US1**: Starts after Foundation and produces the demonstrable saving MVP.
- **Phase 4 — US2**: Server work can start after Foundation with fixtures; client integration T039–T040 uses US1 form/card/library surfaces.
- **Phase 5 — US3**: Parser/repository work can start after Foundation; client integration T049–T050 uses the US1 library/card surfaces.
- **Phase 6 — US4**: Validation/repository work can start after Foundation; edit/autocomplete UI T059–T062 uses the US1 form/card surfaces and US3 search index behavior.
- **Phase 7 — US5**: Service work can start after Foundation; selection UI T066/T069/T070 uses the US1 library/card surfaces and reading/tag primitives from US2/US4.
- **Phase 8 — US6**: Depends on the US5 bulk action foundation for group restore/deletion and on US1 media ownership.
- **Phase 9 — Polish**: Starts after every story selected for release is complete; T086 is always last.

### User story completion order

```text
Foundation
├── US1 Save with metadata ─┬─> US2 Read later
│                           ├─> US3 Search and sort
│                           └─> US4 Notes and tag reuse
└──────────────────────────────> US5 Bulk organization ──> US6 Safe deletion

US1 + US2 + US3 + US4 + US5 + US6 ──> Cross-cutting verification and runtime handoff
```

### Within each user story

1. Write the phase's tests and confirm expected failures.
2. Implement pure validation/models and repositories.
3. Implement services and transactions.
4. Implement routes/contracts.
5. Implement client interactions.
6. Run that story's independent test before moving to the next priority.

## Parallel Opportunities

- In Setup, T003–T007 can proceed after T001/T002 where package/config inputs are needed.
- In Foundation, shared schemas, database helpers, client primitives, and test fixtures have distinct files and can proceed in parallel as marked.
- After Foundation, server-side US2/US3/US4 work can proceed against seeded fixtures while US1 UI work is underway; shared UI integrations wait for T034.
- Unit, integration, contract, and component test files within each story are deliberately separate and parallelizable.
- In Polish, accessibility, scale, metadata-security, documentation, and responsive work can proceed in parallel before T084/T086 consolidation.

## Parallel Examples by User Story

### User Story 1

```text
T020 URL normalization tests
T021 Restricted-fetch tests
T022 Metadata extraction tests
T023 Media asset tests
T024 API integration/contract tests
T025 Component/end-to-end save-flow tests
```

### User Story 2

```text
T035 Read-state repository/API tests
T036 Read-later component/end-to-end tests
```

### User Story 3

```text
T041 Search parser behavior tests
T042 Search limit/error tests
T043 SQLite search integration tests
T044 API/UI/end-to-end retrieval tests
```

### User Story 4

```text
T051 Rich-note validation tests
T052 Tag normalization/suggestion tests
T053 Bookmark edit integration/contract tests
T054 Editor/autocomplete end-to-end tests
```

### User Story 5

```text
T063 Bulk service tests
T064 Bulk API contract tests
T065 Selection and bulk UI tests
```

### User Story 6

```text
T071 Archive/delete lifecycle tests
T072 Confirmation and restore UI tests
```

## Implementation Strategy

### MVP first

1. Complete Setup and Foundation.
2. Complete US1, including its failure fallbacks and persistence.
3. Stop and demonstrate URL-only saving with automatic metadata, editable details, durable cards, and fallback titles.

### Incremental delivery

1. Add US2 and demonstrate the explicit unread queue.
2. Add US3 and demonstrate Boolean/exact-tag search, clickable tags, filters, and sorting.
3. Add US4 and demonstrate safe formatted notes plus normalized tag suggestions.
4. Add US5 and demonstrate transactional bulk organization with summaries.
5. Add US6 and demonstrate reversible archiving plus confirmation-gated deletion.
6. Complete cross-cutting security, accessibility, performance, and runtime verification before client review.

### Release boundary

The release is not complete at the MVP checkpoint. Client review requires every approved story plus Phase 9. Do not add offline page copies, saved searches, import/export, accounts, sync, sharing, folders, favorites, or drag ordering; those remain deferred by the approved specification.

## Notes

- `[P]` means file-level parallelism is safe, not that prerequisites can be ignored.
- Every story task uses its `[USn]` label for traceability to `spec.md`.
- Tests are written before implementation within each phase and must fail for the expected missing behavior before code is added.
- Database and API validation both enforce user-visible limits; the database remains the final integrity boundary where representable.
- Security-sensitive metadata tests use injected transports and never weaken production address policy to reach localhost fixtures.
- Stop at each story checkpoint when validating incrementally; do not mark a story complete on UI appearance alone.
