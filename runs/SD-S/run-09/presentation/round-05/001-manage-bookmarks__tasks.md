# Tasks: Personal Bookmark Manager

**Input**: Approved design documents from `specs/001-manage-bookmarks/`

**Prerequisites**: [spec.md](spec.md), [plan.md](plan.md), [research.md](research.md), [data-model.md](data-model.md), [API contract](contracts/openapi.yaml), [UI contract](contracts/ui-states.md), and [quickstart.md](quickstart.md)

**Tests**: Included because the approved specification defines independent acceptance scenarios and measurable privacy, persistence, metadata, scale, and usability outcomes. Story tests establish the acceptance boundary before each story is considered complete.

**Organization**: Tasks are grouped by user story so the core save flow can be delivered as an MVP, followed by organization and maintenance increments.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel with adjacent tasks after its stated phase prerequisites are satisfied because it targets different files and has no dependency on an incomplete adjacent task.
- **[Story]**: Maps the task to User Story 1, 2, or 3 from the approved specification.
- Every checklist item names the exact file or files it changes.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish the reproducible TypeScript, client, server, and test workspace without implementing product behavior.

- [X] T001 Create the Node 24 ESM package, pin the approved runtime/development dependencies including `@playwright/test@1.61.0`, define build/start/test/database scripts, and commit the lockfile in `package.json` and `package-lock.json`
- [X] T002 [P] Configure strict shared, browser, and server TypeScript builds plus Vite's React build/proxy/output settings in `tsconfig.json`, `tsconfig.client.json`, `tsconfig.server.json`, and `vite.config.ts`
- [X] T003 [P] Configure linting and formatting for TypeScript, React, JSON, YAML, and Markdown in `eslint.config.js`, `.prettierrc.json`, and `.prettierignore`
- [X] T004 [P] Define validated environment settings for host, port, database path, exact trusted origins, Better Auth secrets/base URL, SMTP/console mail transport, and review seeding in `.env.example` and `src/server/config.ts`
- [X] T005 [P] Scaffold the planned client, server, and shared entry points without feature logic in `index.html`, `src/client/main.tsx`, `src/client/app/App.tsx`, `src/server/app.ts`, `src/server/index.ts`, and `src/shared/contracts/index.ts`
- [X] T006 [P] Configure Vitest projects, jsdom/component setup, Playwright 1.61.0 with the production web server, and deterministic test environment values in `vitest.config.ts`, `tests/setup/client.ts`, `tests/setup/server.ts`, and `playwright.config.ts`
- [X] T007 [P] Exclude runtime databases, secrets, build output, coverage, and browser reports while preserving migrations and public assets in `.gitignore`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Provide the database, authentication, authorization, request protection, error handling, and shell required by every user story.

**Critical**: No user-story implementation begins until this phase is complete.

- [X] T008 Implement the `better-sqlite3` connection factory with `foreign_keys = ON`, WAL mode, `busy_timeout = 5000`, local-path validation, transaction helpers, and the checked-in Drizzle migration runner in `src/server/db/client.ts`, `src/server/db/migrate.ts`, and `drizzle.config.ts`
- [X] T009 Define the Better Auth-owned `user`, `session`, `account`, `verification`, and rate-limit schema with these invariants: "User email is normalized and unique under Better Auth's schema", "Credential passwords are stored only in Better Auth's account record as a scrypt hash", "Sessions are database-backed, expire after seven days, and can be revoked immediately", and "Password-reset identifiers are hashed, expire after one hour, and are single use" in `drizzle/schema/auth.ts` and `drizzle/migrations/0001_auth.sql`
- [X] T010 [P] Write integration coverage for registration, generic duplicate registration, sign-in/out, seven-day sessions with one-day rolling refresh, one-hour single-use password reset, reset session revocation, rate limits, and production/review cookie flags in `tests/integration/auth.test.ts`
- [X] T011 [P] Write security tests that reject forged origins, cross-site Fetch Metadata, missing `X-Bookmark-App`, non-JSON mutations, and unauthenticated application requests in `tests/integration/request-security.test.ts`
- [X] T012 [P] Implement the injected SMTP, in-memory test, and explicitly development-only console transports without exposing reset tokens in production responses or logs in `src/server/mail/mailer.ts`, `src/server/mail/smtp-mailer.ts`, and `src/server/mail/test-mailer.ts`
- [X] T013 Configure Better Auth email/password flows with 15–128 character passwords, non-blocking scrypt, database sessions, disabled session cookie cache, exact trusted origins, database rate limiting, generic reset requests, hashed one-hour reset identifiers, and session revocation after reset in `src/server/auth/auth.ts`
- [X] T014 Mount the Better Auth catch-all handler and implement authenticated-session resolution that never accepts `userId` from clients in `src/server/auth/routes.ts` and `src/server/auth/require-session.ts`
- [X] T015 Implement centralized application mutation protection requiring JSON, `X-Bookmark-App: 1`, matching configured origin, and non-cross-site Fetch Metadata in `src/server/api/request-security.ts`
- [X] T016 Implement the Fastify app factory with request IDs, structured redacted logging, stable error envelopes, security headers, static SPA delivery, and `0.0.0.0:4000` production defaults in `src/server/app.ts`, `src/server/api/errors.ts`, and `src/server/index.ts`
- [X] T017 [P] Define shared error/session contracts, Zod parsing helpers, and a same-origin browser client that preserves typed field errors in `src/shared/contracts/auth.ts`, `src/shared/contracts/errors.ts`, `src/shared/validation/common.ts`, and `src/client/lib/api.ts`
- [X] T018 Build accessible sign-in, registration, recovery, and reset views with generic account-existence messaging and valid ready markers in `src/client/features/auth/AuthGate.tsx`, `src/client/features/auth/SignInPage.tsx`, `src/client/features/auth/RegisterPage.tsx`, `src/client/features/auth/RecoveryPage.tsx`, and `src/client/features/auth/ResetPasswordPage.tsx`
- [X] T019 Create an idempotent development-only review-account seed that reads explicit environment credentials and cannot run in production in `scripts/seed-review.ts`
- [X] T020 Run the foundational auth/security suites and document the resulting environment/cookie/recovery behavior in `tests/integration/auth.test.ts`, `tests/integration/request-security.test.ts`, and `.env.example`

**Checkpoint**: Accounts, private sessions, recovery, shared request security, database startup, and the signed-out shell are functional and testable.

---

## Phase 3: User Story 1 — Save and Revisit Bookmarks (Priority: P1) — MVP

**Goal**: A signed-in user can paste a URL, receive an automatic or fallback title/icon, save without typing a title, edit that title, revisit the destination, and find the bookmark after a new session.

**Independent Test**: Sign in, paste a public fixture URL, verify automatic title/icon preview, save without typing a title, edit the title, open the destination, start a new session, and confirm persistence; repeat with blocked/unreadable fixtures and confirm fallback saving and generic icon behavior.

### Acceptance Tests for User Story 1

- [X] T021 [P] [US1] Write unit tests for trimmed HTTP(S)-only URLs, rejected credentials/schemes, fragment-preserving duplicate normalization, readable hostname fallbacks, 1–300 code-point titles, and the `fallback → page → user` title-source race rules in `tests/unit/url-normalization.test.ts` and `tests/unit/title-source.test.ts`
- [X] T022 [P] [US1] Write deterministic metadata-network tests covering public A/AAAA results, every blocked IPv4/IPv6/special-use class, mixed public/private answers, pinned-peer rebinding, default ports, five redirects, cycles, downgrade rejection, 4.5-second deadline, 16 KiB headers, 1 MiB HTML, 256 KiB icons, and no credentials/cookies/retries in `tests/unit/metadata-fetcher.test.ts`
- [X] T023 [P] [US1] Write metadata parsing and icon tests for HTML/XHTML types, identity encoding, title/Open Graph/Twitter/fallback precedence, charset/entity/control normalization, 300-code-point truncation, favicon/base resolution, PNG/JPEG/GIF/WebP/ICO signatures, SVG rejection, and generic-icon fallback in `tests/unit/metadata-parser.test.ts` and `tests/unit/icon-validator.test.ts`
- [X] T024 [P] [US1] Write temporary-SQLite integration tests for bookmark/icon constraints, duplicate warnings versus intentional copies, signed metadata receipts, immediate fallback persistence, late-result compare-and-set, icon authorization, restart recovery of one stale pending attempt, and cross-user denial in `tests/integration/bookmark-save.test.ts`
- [X] T025 [P] [US1] Write OpenAPI contract tests for `POST /metadata/preview`, `GET/POST /bookmarks`, `GET/PATCH /bookmarks/{bookmarkId}`, and `GET /bookmarks/{bookmarkId}/icon`, including validation, 401/404, duplicate 409, and fallback payloads in `tests/contract/bookmarks-create.contract.test.ts`
- [X] T026 [P] [US1] Write component tests for composer entry/loading/ready/fallback/error states, preservation of typed titles during late preview, duplicate choices, new-library/loaded states, safe external opening, and retained form values after failure in `tests/component/SaveBookmarkComposer.test.tsx` and `tests/component/BookmarkLibrary.test.tsx`
- [X] T027 [P] [US1] Write the Playwright MVP journey for URL-only save, captured title/icon, editable title, fallback save, duplicate warning choices, new-session persistence, and opening without removal in `tests/e2e/save-and-revisit.spec.ts`

### Implementation for User Story 1

- [X] T028 [P] [US1] Define `IconAsset` with the verbatim field rules `id`: "Primary key"; `sha256`: "Required; lowercase hex; unique"; `media_type`: "One of image/png, image/jpeg, image/gif, image/webp, image/x-icon"; `byte_size`: "Required; 1–262,144"; `bytes`: "Required; validated signature agrees with media_type"; and `created_at`: "Required" in `drizzle/schema/icon-assets.ts`
- [X] T029 [P] [US1] Define `Bookmark` with the verbatim field rules `id`: "Primary key"; `user_id`: "Required; references auth user, cascade on user deletion"; `url`: "Required; trimmed user-facing HTTP(S) URL; fragment preserved"; `normalized_url`: "Required; canonical duplicate-detection value; fragment removed"; `final_metadata_url`: "Final public URL used only as metadata provenance; never replaces url"; `title`: "Required; trimmed; 1–300 code points"; `title_sort`: "Required; normalized case-insensitive sorting key"; `title_source`: "page, fallback, or user"; `notes`: "Trimmed; at most 10,000 code points"; `folder_id`: "At most one folder; must belong to same user"; `is_favorite`: "Required; default 0; constrained boolean"; `icon_asset_id`: "References validated icon asset; null means generic icon"; `metadata_status`: "pending, ready, partial, blocked, or failed"; `metadata_failure_code`: "Coarse non-sensitive reason"; `metadata_fetched_at`: "Last completed attempt time"; and required `created_at`/`updated_at` in `drizzle/schema/bookmarks.ts`
- [X] T030 [US1] Create the bookmark/icon migration with auth-user/icon foreign keys, checks, composite bookmark owner key, content-address uniqueness, documented owner/sort/duplicate/folder/favorite indexes, reversible teardown, and a nullable `folder_id` whose same-owner foreign key is added after folders exist in migration 0003 in `drizzle/migrations/0002_bookmarks_icons.sql`
- [X] T031 [P] [US1] Implement URL parsing, fallback-title derivation, duplicate normalization, title/control normalization, and metadata-eligibility validation in `src/server/metadata/url-policy.ts` and `src/shared/validation/bookmark.ts`
- [X] T032 [US1] Implement the bounded HTTP/HTTPS client with full public-address classification, cancellable A/AAAA resolution, DNS-to-socket pinning, Host/SNI preservation, peer verification, manual redirect revalidation, resource limits, global concurrency control, and per-user rate hooks in `src/server/metadata/safe-http-client.ts` and `src/server/metadata/ip-policy.ts`
- [X] T033 [P] [US1] Implement inert title/favicon discovery, encoding handling, deterministic title/icon precedence, image signature validation, and neutral failure categories in `src/server/metadata/parse-metadata.ts` and `src/server/metadata/validate-icon.ts`
- [X] T034 [US1] Implement content-addressed icon persistence, authorized icon lookup, and orphan cleanup without deleting referenced assets in `src/server/repositories/icon-repository.ts`
- [X] T035 [US1] Implement short-lived signed metadata receipts plus the bounded preview/background coordinator that persists fallback immediately, resumes one stale pending attempt after restart, and conditionally updates only `title_source = 'fallback'` in `src/server/metadata/receipt.ts` and `src/server/metadata/metadata-service.ts`
- [X] T036 [US1] Implement owner-scoped bookmark create/list/get/title-update/duplicate transactions and persistence mapping in `src/server/repositories/bookmark-repository.ts` and `src/server/services/bookmark-service.ts`
- [X] T037 [US1] Implement metadata preview, bookmark create/list/get/title patch, and authorized icon routes with the OpenAPI response/error behavior in `src/server/api/metadata-routes.ts` and `src/server/api/bookmark-routes.ts`
- [X] T038 [US1] Implement typed bookmark/metadata client contracts, debounced preview cancellation, cursor loading, and mutation state that retains input on failure in `src/shared/contracts/bookmarks.ts`, `src/client/features/bookmarks/bookmark-api.ts`, and `src/client/features/bookmarks/useBookmarks.ts`
- [X] T039 [US1] Build and integrate the responsive library, URL-first save composer, metadata preview, generic/captured icon display, duplicate dialog, title editing, safe external links, new-library/load/error states, and post-load ready marker in `src/client/features/bookmarks/BookmarkLibrary.tsx`, `src/client/features/bookmarks/SaveBookmarkComposer.tsx`, `src/client/features/bookmarks/BookmarkCard.tsx`, `src/client/features/bookmarks/DuplicateDialog.tsx`, and `src/client/app/App.tsx`

**Checkpoint**: User Story 1 is a deployable MVP and passes its unit, integration, contract, component, and browser acceptance tests independently.

---

## Phase 4: User Story 2 — Find and Organize Bookmarks (Priority: P2)

**Goal**: A user can create, rename, and remove folders/tags; assign bookmarks; search partial title/address/tag text; combine folder/tag/favorite filters; sort by newest/oldest/title; and recover clearly from no matches.

**Independent Test**: Seed bookmarks with distinct titles, URLs, folders, tags, dates, and favorite values, then verify partial search, every sort mode, combined filters, stable cursor pages, organization persistence, and bookmark retention after folder/tag deletion.

### Acceptance Tests for User Story 2

- [X] T040 [P] [US2] Write unit tests for trimmed Unicode-normalized locale-independent folder/tag keys, folder names of 1–80 code points, tag names of 1–50 code points, search escaping, trigram/short-query selection, and stable cursor encoding in `tests/unit/organization-normalization.test.ts` and `tests/unit/search-query.test.ts`
- [X] T041 [P] [US2] Write temporary-SQLite integration tests for same-user composite relationships, unique normalized names, folder disassociation, tag-association cascade, transactional search refresh on title/URL/tag changes, rebuild consistency, combined filters, all sort orders, and cursor stability in `tests/integration/organization-search.test.ts`
- [X] T042 [P] [US2] Write contract tests for folder/tag list/create/rename/delete plus bookmark search/filter/sort pagination and name-conflict/ownership errors in `tests/contract/organization.contract.test.ts` and `tests/contract/bookmark-query.contract.test.ts`
- [X] T043 [P] [US2] Write component tests for folder/tag management, combined visible filter chips, query-string persistence/history, all sort modes, pagination, organization counts, no-match distinction, and clear-filters behavior in `tests/component/OrganizationPanel.test.tsx` and `tests/component/LibraryControls.test.tsx`
- [X] T044 [P] [US2] Write the Playwright organization journey covering create/assign/rename/delete, partial title/URL/tag search, combined filters, three sorts, refresh persistence, retained bookmarks, and no-match clearing in `tests/e2e/find-and-organize.spec.ts`

### Implementation for User Story 2

- [X] T045 [P] [US2] Define `Folder` with the verbatim field rules `id`: "Primary key"; `user_id`: "Required; references auth user, cascade on user deletion"; `name`: "Required; trimmed display value; 1–80 code points"; `name_key`: "Required; normalized comparison key"; required `created_at`/`updated_at`; unique `(user_id, name_key)` and `(id, user_id)`; and `(user_id, name_key)` index in `drizzle/schema/folders.ts`
- [X] T046 [P] [US2] Define `Tag` with the verbatim field rules `id`: "Primary key"; `user_id`: "Required; references auth user, cascade on user deletion"; `name`: "Required; trimmed display value; 1–50 code points"; `name_key`: "Required; normalized comparison key"; required `created_at`/`updated_at`; unique `(user_id, name_key)` and `(id, user_id)`; and `(user_id, name_key)` index in `drizzle/schema/tags.ts`
- [X] T047 [US2] Define `BookmarkTag` with verbatim required fields `bookmark_id`, `tag_id`, and `user_id`; "Primary key (bookmark_id, tag_id) prevents duplicate assignment"; cascading same-owner composite foreign keys to bookmark and tag; and `(user_id, tag_id, bookmark_id)` index; define `BookmarkSearch` with `bookmark_id`: "Unindexed canonical bookmark ID; also used as FTS row ID", `user_id`: "Unindexed mandatory ownership filter", and searchable current title, saved URL, and space-separated current tag display names; then add the folder same-owner foreign key and all organization/search objects in `drizzle/schema/bookmark-tags.ts`, `drizzle/schema/bookmark-search.ts`, and `drizzle/migrations/0003_organization_search.sql`
- [X] T048 [P] [US2] Implement shared folder/tag display normalization, constraints, conflict mapping, and query/cursor validation in `src/shared/validation/organization.ts` and `src/shared/validation/bookmark-query.ts`
- [X] T049 [US2] Implement transactional FTS insert/update/delete, escaped phrase search, under-three-character scoped `LIKE`, tag-driven refresh, and canonical rebuild in `src/server/repositories/bookmark-search-repository.ts` and `scripts/rebuild-search.ts`
- [X] T050 [US2] Implement owner-scoped folder/tag create/list/count/rename/delete transactions, clearing folder associations while retaining bookmarks and cascading only tag associations in `src/server/repositories/organization-repository.ts` and `src/server/services/organization-service.ts`
- [X] T051 [US2] Extend bookmark querying with search, combined folder/tag/favorite filters, newest/oldest/title ordering, stable ID tie-breakers, and cursor pages in `src/server/repositories/bookmark-repository.ts` and `src/server/services/bookmark-service.ts`
- [X] T052 [US2] Implement the contracted folder/tag endpoints and bookmark query parameters with ownership-safe 404s and normalized-name 409s in `src/server/api/organization-routes.ts` and `src/server/api/bookmark-routes.ts`
- [X] T053 [US2] Implement typed folder/tag/query clients, query-string state, debounced search, pagination reset, and result/count cache refresh in `src/shared/contracts/organization.ts`, `src/client/features/organization/organization-api.ts`, and `src/client/features/bookmarks/useLibraryQuery.ts`
- [X] T054 [US2] Build accessible folder/tag navigation and management dialogs that retain input on failure and confirm bookmark retention on deletion in `src/client/features/organization/OrganizationSidebar.tsx` and `src/client/features/organization/ManageOrganizationDialog.tsx`
- [X] T055 [US2] Integrate folder/tag assignment, combined filters, visible removable chips, three sort modes, stable load-more behavior, query-history persistence, organization counts, and distinct no-match/clear states in `src/client/features/bookmarks/SaveBookmarkComposer.tsx`, `src/client/features/bookmarks/LibraryControls.tsx`, and `src/client/features/bookmarks/BookmarkLibrary.tsx`

**Checkpoint**: User Stories 1 and 2 both work, and organization/search can be demonstrated and tested without requiring maintenance actions from User Story 3.

---

## Phase 5: User Story 3 — Maintain the Library (Priority: P3)

**Goal**: A user can edit bookmark details, mark/unmark favorites, retry metadata without losing a custom title, and permanently delete only after explicit confirmation.

**Independent Test**: Edit every supported field, toggle favorite twice, retry failed metadata after setting a custom title, cancel one deletion, confirm another, and verify all successful changes persist and deleted records disappear from every view after a new session.

### Acceptance Tests for User Story 3

- [X] T056 [P] [US3] Write integration tests for owner-scoped full edits, same validation as create, changed-URL metadata restart, user-title precedence, optimistic favorite endpoints, retry rate limits, transactional search refresh, deletion cleanup, and other-user 404s in `tests/integration/bookmark-maintenance.test.ts`
- [X] T057 [P] [US3] Write contract tests for full `PATCH /bookmarks/{bookmarkId}`, favorite PUT/DELETE, metadata retry POST, and bookmark DELETE including 400/401/404/409/429 behavior in `tests/contract/bookmark-maintenance.contract.test.ts`
- [X] T058 [P] [US3] Write component tests for prefilled edit state, retained edits after failure, favorite rollback/announcement, metadata retry status, focus-safe delete confirmation/cancel/error, and removal only after server success in `tests/component/BookmarkMaintenance.test.tsx`
- [X] T059 [P] [US3] Write the Playwright maintenance journey for editing address/title/notes/folder/tags, favorite persistence/filtering, retry without title overwrite, delete cancellation, confirmed deletion, and new-session persistence in `tests/e2e/maintain-library.spec.ts`

### Implementation for User Story 3

- [X] T060 [US3] Extend the bookmark service with atomic full edits, required trimmed 1–300 code-point titles, nullable trimmed notes at most 10,000 code points, same-owner folder/tags, URL revalidation/duplicate warning, `title_source = 'user'`, idempotent favorite state, explicit metadata retry, and deletion/search/icon cleanup in `src/server/services/bookmark-service.ts` and `src/server/repositories/bookmark-repository.ts`
- [X] T061 [US3] Implement the full edit, favorite PUT/DELETE, retry, and permanent-delete route behavior from the OpenAPI contract in `src/server/api/bookmark-routes.ts` and `src/server/api/metadata-routes.ts`
- [X] T062 [P] [US3] Build the accessible prefilled edit dialog with title/address/notes/folder/tag validation, duplicate choices, retry-safe retained values, and metadata status in `src/client/features/bookmarks/EditBookmarkDialog.tsx`
- [X] T063 [P] [US3] Implement optimistic favorite/unfavorite controls with rollback and live-region error feedback in `src/client/features/bookmarks/FavoriteButton.tsx` and `src/client/features/bookmarks/useBookmarkMutations.ts`
- [X] T064 [P] [US3] Implement the named-bookmark delete confirmation dialog with focus trap, Escape/Cancel, server-confirmed removal, and retryable failure state in `src/client/features/bookmarks/DeleteBookmarkDialog.tsx`
- [X] T065 [US3] Add explicit metadata retry UI that retains the current title/icon while pending and applies returned titles only when still fallback-sourced in `src/client/features/bookmarks/MetadataStatus.tsx` and `src/client/features/bookmarks/useBookmarkMutations.ts`
- [X] T066 [US3] Integrate edit, favorite, retry, and delete actions into cards/library results and refresh folder/tag counts, filters, search, and empty states after mutations in `src/client/features/bookmarks/BookmarkCard.tsx` and `src/client/features/bookmarks/BookmarkLibrary.tsx`

**Checkpoint**: All three user stories are independently acceptance-tested and the complete agreed bookmark-management behavior is functional.

---

## Phase 6: Polish and Cross-Cutting Validation

**Purpose**: Prove privacy, safety, scale, accessibility, delivery readiness, and artifact consistency across the complete feature.

- [X] T067 [P] Expand the two-user authorization matrix across every list/get/create/update/delete/favorite/folder/tag/search/metadata/icon path and assert uniform 404/401 behavior in `tests/integration/user-isolation.test.ts`
- [X] T068 [P] Complete the adversarial metadata matrix for numeric IPv4 forms, mapped IPv6, zone IDs, special-use names, mixed DNS, peer mismatch, public-to-private redirects, same cases for icons, slow/oversized/chunked/malformed content, active/polyglot images, and redacted logs in `tests/integration/metadata-security.test.ts`
- [X] T069 [P] Seed 10,000 bookmarks and verify every search/filter/sort combination, query plans, stable pagination without missing/duplicate rows, rebuild consistency, under-15-second human lookup, and 95% under-two-second visible interactions in `tests/performance/library-scale.test.ts` and `tests/fixtures/seed-large-library.ts`
- [X] T070 [P] Audit keyboard operation, focus restoration/traps, labels, live regions, color-independent states, long-content containment, mobile touch targets, and desktop/mobile ready states in `tests/e2e/accessibility-responsive.spec.ts` and `src/client/styles/app.css`
- [X] T071 Harden production-only HTTPS cookie settings, CSP/CORP/nosniff icon delivery, static path handling, CORS absence, secret validation, SMTP enforcement, rate/concurrency limits, and URL/query log redaction in `src/server/app.ts`, `src/server/config.ts`, `src/server/auth/auth.ts`, and `src/server/api/metadata-routes.ts`
- [X] T072 [P] Validate the OpenAPI description, run schema/contract drift checks, and update implementation-facing run guidance without changing approved behavior in `specs/001-manage-bookmarks/contracts/openapi.yaml`, `specs/001-manage-bookmarks/quickstart.md`, and `README.md`
- [X] T073 Build the production assets, run migrations and the idempotent review seed, verify `npm start` binds `0.0.0.0:4000`, and write the final foreground launch declaration in `/work/.harness/app.json`
- [X] T074 Execute the complete lint/type/unit/component/integration/contract/performance/Playwright quickstart gate, record any unavailable external SMTP validation honestly, and resolve all in-scope failures in `specs/001-manage-bookmarks/quickstart.md` and `tests/`

---

## Dependencies and Execution Order

### Phase dependencies

```text
Setup (Phase 1)
  └─► Foundation (Phase 2)
        └─► US1 Save/Revisit (Phase 3, MVP)
              ├─► US2 Find/Organize (Phase 4)
              └─► US3 core maintenance services may begin
                    └─► US3 organization-aware editing finishes after US2
                          └─► Cross-cutting validation (Phase 6)
```

- **Phase 1** has no prerequisite.
- **Phase 2** depends on Phase 1 and blocks every story.
- **User Story 1** depends on Phase 2 and establishes the bookmark, icon, and metadata core.
- **User Story 2** depends on the User Story 1 bookmark core because it adds folder/tag relationships and search indexing around saved bookmarks.
- **User Story 3** service/test work can start after User Story 1; its folder/tag editing integration depends on User Story 2.
- **Phase 6** depends on every story selected for the release.

### Within each user story

1. Write the story's acceptance tests and fixtures.
2. Add or extend schema and migrations.
3. Implement validation, repositories, and services.
4. Implement HTTP contracts.
5. Implement client state and UI.
6. Run the story checkpoint before advancing.

### Parallel opportunities

- In Setup, configuration tasks T002–T007 target separate files after T001.
- In Foundation, authentication/security tests, mail transport, and shared contracts can proceed in parallel after database setup.
- In User Story 1, all six acceptance-test tasks can proceed in parallel; icon/bookmark schema and pure URL/parser work can also be divided.
- In User Story 2, five acceptance-test tasks and the folder/tag schema tasks can proceed in parallel.
- In User Story 3, four acceptance-test tasks and the three focused UI controls can proceed in parallel around the shared service/API work.
- Privacy, metadata adversarial, scale, accessibility, and contract-document validation in Phase 6 use separate files and can run in parallel before the final build/gate.

## Parallel Execution Examples

### User Story 1

```text
Task T021: URL and title-source unit tests
Task T022: Safe metadata network tests
Task T023: Metadata parser and icon tests
Task T024: Bookmark persistence integration tests
Task T025: Bookmark API contract tests
Task T026: Save composer component tests
Task T027: Save/revisit Playwright journey
```

### User Story 2

```text
Task T040: Organization/search unit tests
Task T041: Organization/search SQLite integration tests
Task T042: Folder/tag and query contract tests
Task T043: Organization controls component tests
Task T044: Find/organize Playwright journey
Task T045: Folder schema
Task T046: Tag schema
```

### User Story 3

```text
Task T056: Maintenance integration tests
Task T057: Maintenance contract tests
Task T058: Maintenance component tests
Task T059: Maintenance Playwright journey
```

## Implementation Strategy

### MVP first

1. Complete Setup and Foundation.
2. Complete User Story 1 through T039.
3. Stop and run the User Story 1 checkpoint.
4. Demonstrate URL-only save, automatic/fallback metadata, duplicate handling, editable title, safe opening, and persistence before adding organization.

### Incremental delivery

1. **MVP**: Setup + Foundation + User Story 1.
2. **Organization increment**: User Story 2, independently verified against the existing bookmark core.
3. **Maintenance increment**: User Story 3, independently verified without regressing save/search behavior.
4. **Release gate**: Cross-cutting privacy, metadata security, scale, accessibility, production build, and harness verification.

## Notes

- `[P]` tasks change distinct files or are independently authorable after their phase prerequisites.
- `[US1]`, `[US2]`, and `[US3]` map directly to the approved prioritized user stories.
- Tests define completion for each story and must pass before its checkpoint is accepted.
- All reads and writes remain scoped by the authenticated user even where database constraints add defense in depth.
- Keep public behavior aligned with the approved specification; route requested behavior changes back through specification and plan review.
