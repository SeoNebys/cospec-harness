# Tasks: Bookmark Manager

**Input**: Design documents from `/specs/001-bookmark-manager/`

**Prerequisites**: Approved `spec.md` and `plan.md`; `research.md`, `data-model.md`, `contracts/openapi.yaml`, and `quickstart.md`

**Tests**: Tests are included because the approved plan defines contract, security, integration, performance, accessibility, and browser verification. Within each story, create tests first and confirm they fail for the missing behavior before implementation.

**Organization**: Tasks are grouped by user story so each story can be implemented and validated as an independent increment.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Parallelizable because it targets different files and has no incomplete-task dependency
- **[Story]**: Maps the task to its specification user story
- Every task identifies its target file or directory

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create the runnable project, toolchain, and agreed source layout.

- [ ] T001 Scaffold the Next.js 16.3.3 App Router TypeScript project and pin React 19.2, TypeScript 5.9, Node 24, and npm engine metadata in `package.json`, `package-lock.json`, `tsconfig.json`, and `next.config.ts`
- [ ] T002 Configure Tailwind CSS 4, semantic global styles, visible focus defaults, and responsive design tokens in `postcss.config.mjs` and `app/globals.css`
- [ ] T003 [P] Configure ESLint, type-check, Node test, integration, security, performance, build, database migration, and production start scripts on `0.0.0.0:4000` in `eslint.config.mjs` and `package.json`
- [ ] T004 [P] Pin `@playwright/test` 1.61.0, configure shared browser binaries and base URL, and add axe support in `playwright.config.ts` and `tests/e2e/accessibility.ts`
- [ ] T005 [P] Add runtime database/icon exclusions and documented environment defaults without committing secrets in `.gitignore` and `.env.example`

**Checkpoint**: The empty application installs, lints, type-checks, builds, and exposes the configured test commands.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish persistence, shared normalization, errors, layout, and test fixtures required by every story.

**Critical**: No user-story implementation begins until this phase is complete.

- [ ] T006 Define Prisma models for Bookmark, Tag, and BookmarkTag with the exact fields, relations, unique keys, enum values, timestamps, cascades, and indexes from `specs/001-bookmark-manager/data-model.md` in `prisma/schema.prisma`
- [ ] T007 Generate and commit the forward initial SQLite migration, including foreign-key enforcement and reverse tag-join index, in `prisma/migrations/0001_initial/migration.sql`
- [ ] T008 Implement a singleton Prisma 7 SQLite adapter, writable `data/` initialization, migration entry point, and transaction-safe test override in `lib/db/client.ts` and `lib/db/migrate.ts`
- [ ] T009 [P] Implement URL input normalization shared by preview and writes—HTTP(S) only, HTTPS added when omitted, credentials and nonstandard ports rejected, fragments stripped, and path/query semantics preserved—in `lib/urls/normalize.ts`
- [ ] T010 [P] Implement Unicode NFKC/case-fold search normalization, whitespace normalization, and LIKE metacharacter escaping in `lib/text/normalize.ts` and `lib/tags/normalize.ts`
- [ ] T011 [P] Define typed application errors and the `{ error: { code, message, field?, existingId? } }` response mapper in `lib/errors.ts`
- [ ] T012 [P] Create deterministic isolated-database, fake-clock, DNS, HTTP metadata, and 10,000-bookmark fixture helpers in `tests/helpers/database.ts`, `tests/helpers/metadata-server.ts`, and `tests/helpers/seed.ts`
- [ ] T013 Create the accessible root layout, skip link, navigation landmark, generic site icon, live-status region, and initially loaded `data-harness-ready="true"` shell in `app/layout.tsx`, `components/ui/live-status.tsx`, and `public/generic-site-icon.svg`

**Checkpoint**: Fresh migration and idempotent reopen succeed; normalization and shared error behavior are ready; the empty shell is accessible and runnable.

---

## Phase 3: User Story 1 — Save and Revisit Bookmarks (Priority: P1) MVP

**Goal**: Paste a URL, preview its actual title and available icon, edit and save it, then view, open, edit, and confirm deletion with graceful metadata fallback.

**Independent Test**: From an empty database, preview a controlled public page, save its fetched title/icon, open it, edit it, reload to verify persistence, cancel and then confirm deletion; repeat with metadata failure and verify an editable fallback and generic icon.

### Tests for User Story 1

- [ ] T014 [P] [US1] Add failing contract tests for metadata preview and bookmark create/get/update/delete responses, validation errors, 404s, and duplicate 409 `existingId` behavior in `tests/integration/bookmark-api.test.ts`
- [ ] T015 [P] [US1] Add failing unit tests for first-document-title extraction, entity/whitespace handling, 300-character cap, icon candidate selection, URL fallback, and title-origin transitions in `tests/unit/metadata-parser.test.ts` and `tests/unit/title-origin.test.ts`
- [ ] T016 [P] [US1] Add failing metadata security tests for special/private IPv4 and IPv6 forms, mixed DNS answers, rebinding-safe peer checks, every redirect hop, redirect loops, timeouts, compression/byte limits, non-HTML bodies, SVG/invalid icons, and sanitized errors in `tests/security/metadata-fetcher.test.ts`
- [ ] T017 [P] [US1] Add failing repository tests for canonical URL uniqueness, atomic create/update/delete, persistence after reopen, rollback, cascade cleanup, and user-title protection in `tests/integration/bookmark-repository.test.ts`
- [ ] T018 [P] [US1] Add failing Playwright coverage for empty state, fetched preview, title editing, fallback save, duplicate warning, open, persistence, edit, delete cancellation/confirmation, keyboard operation, and focus restoration in `tests/e2e/bookmark-lifecycle.spec.ts`

### Implementation for User Story 1

- [ ] T019 [P] [US1] Define Zod request/query schemas matching `contracts/openapi.yaml`; enforce title 1–300 characters, note maximum 5,000 characters, URL maximum 2,048 characters, and `fetched|fallback|user` title origins in `lib/bookmarks/schemas.ts`
- [ ] T020 [P] [US1] Implement inert HTML title parsing and standards-based icon discovery without executing scripts or loading subresources in `lib/metadata/html.ts`
- [ ] T021 [US1] Implement the SSRF network policy with HTTP(S)-only validation, global-address allow rules, all-answer DNS checks, validated-address connection pinning, TLS hostname verification, peer verification, and sanitized failures in `lib/metadata/network-policy.ts`
- [ ] T022 [US1] Implement bounded hostile-network retrieval with no ambient credentials/proxy, manual per-hop validation for at most five redirects, 10-second total deadline, HTML content-type enforcement, compressed/decompressed limits, concurrency limits, and abort-on-limit streaming in `lib/metadata/fetcher.ts`
- [ ] T023 [US1] Implement secured icon retrieval through the same network policy, 256 KiB cap, raster-only decode, metadata stripping, resize/re-encode to app-controlled PNG, expiring opaque tokens, and generic fallback in `lib/metadata/icons.ts`
- [ ] T024 [US1] Compose normalization, duplicate lookup, fetched/fallback titles, icon processing, warnings, and rate limiting into the preview service in `lib/metadata/service.ts`
- [ ] T025 [US1] Implement transactional bookmark CRUD, unique `urlKey` conflict mapping, search-shadow maintenance, title-origin protection, icon promotion/cleanup, and stable newest listing in `lib/bookmarks/repository.ts` and `lib/bookmarks/service.ts`
- [ ] T026 [US1] Implement `POST /api/metadata` and `GET|POST /api/bookmarks` exactly to the contract, including 201, 409, 422, and 429 outcomes, in `app/api/metadata/route.ts` and `app/api/bookmarks/route.ts`
- [ ] T027 [US1] Implement `GET|PATCH|DELETE /api/bookmarks/{id}` with transactional updates, 404/409/422 mapping, and no delete side effects before confirmation in `app/api/bookmarks/[id]/route.ts`
- [ ] T028 [P] [US1] Serve app-controlled normalized icon assets with fixed image content type, `nosniff`, cache policy, and path-token validation in `app/icons/[token]/route.ts`
- [ ] T029 [US1] Build the paste-to-preview form with loading/live feedback, fetched title and icon, editable title/note, safe fallback warning, duplicate navigation, and retry behavior in `components/bookmark-form.tsx` and `components/metadata-preview.tsx`
- [ ] T030 [US1] Build the empty state, newest bookmark list/card, safe destination link, and success/failure feedback without optimistic data loss in `app/page.tsx`, `components/bookmark-list.tsx`, and `components/bookmark-card.tsx`
- [ ] T031 [US1] Build accessible edit and Radix confirmation flows, default destructive-dialog focus on Cancel, Escape/cancel focus restoration, and post-success navigation in `app/bookmarks/[id]/edit/page.tsx` and `components/delete-bookmark-dialog.tsx`
- [ ] T032 [US1] Run the US1 unit, integration, security, and browser suites and record the independent MVP result in `specs/001-bookmark-manager/quickstart.md`

**Checkpoint**: User Story 1 is a complete independently testable bookmark manager MVP.

---

## Phase 4: User Story 2 — Organize with Tags (Priority: P2)

**Goal**: Assign multiple reusable tags, reuse them across bookmarks, filter by one, remove associations, and hide orphaned tags.

**Independent Test**: Add two tags to one bookmark, reuse one on another, filter to both matching bookmarks, remove associations, and verify bookmarks remain while the final orphaned tag disappears.

### Tests for User Story 2

- [ ] T033 [P] [US2] Add failing integration tests for Unicode-normalized tag reuse, 1–50 character validation, maximum 50 tags, transactional join replacement, cascade/orphan cleanup, tag counts, and filter behavior in `tests/integration/tags.test.ts`
- [ ] T034 [P] [US2] Add failing Playwright coverage for creating, reusing, displaying, filtering, independently clearing, and removing tags without deleting bookmarks in `tests/e2e/tags.spec.ts`

### Implementation for User Story 2

- [ ] T035 [US2] Extend bookmark create/update transactions with normalized tag upsert, composite join replacement, first-entered display spelling, and orphan cleanup in `lib/bookmarks/repository.ts`
- [ ] T036 [US2] Implement active tag/count listing and exact tag filter semantics in `lib/tags/repository.ts` and `app/api/tags/route.ts`
- [ ] T037 [US2] Add reusable accessible tag entry/removal controls and tag displays to bookmark forms/cards in `components/tag-input.tsx`, `components/bookmark-form.tsx`, and `components/bookmark-card.tsx`
- [ ] T038 [US2] Add URL-backed tag filter controls, counts, active state, and independent reset behavior in `components/filters.tsx` and `app/page.tsx`
- [ ] T039 [US2] Run the US2 integration and browser suites and record the independent tag-journey result in `specs/001-bookmark-manager/quickstart.md`

**Checkpoint**: User Stories 1 and 2 each work independently, with tags adding organization without changing core lifecycle behavior.

---

## Phase 5: User Story 3 — Find Saved Bookmarks (Priority: P3)

**Goal**: Search partial text across every required field and sort visible bookmarks by newest, oldest, or alphabetical order with clear no-result recovery.

**Independent Test**: Seed varied titles, URLs, notes, tags, and dates; verify partial/case-insensitive Unicode matches, combined tag filtering, each stable sort, pagination, no-match messaging, and reset.

### Tests for User Story 3

- [ ] T040 [P] [US3] Add failing repository/API tests for escaped partial search across title, URL, note, and tags; Unicode normalization; AND-combined tag filters; stable sorts/cursors; bounds; and stale/invalid cursors in `tests/integration/search.test.ts`
- [ ] T041 [P] [US3] Add failing Playwright coverage for debounced search, stale-request cancellation, URL/history state, every sort, combined filters, pagination, and recoverable no-results state in `tests/e2e/search-sort.spec.ts`
- [ ] T042 [P] [US3] Add the failing deterministic 10,000-bookmark benchmark for first-page search/filter/sort completion within 2 seconds for at least 95% of runs in `tests/performance/bookmark-query.test.ts`

### Implementation for User Story 3

- [ ] T043 [US3] Implement parameter-bound escaped substring search over normalized bookmark shadows plus tag `EXISTS`, AND-combined filtering, stable sort tuples, opaque cursors, default limit 50, and maximum 100 in `lib/bookmarks/repository.ts`
- [ ] T044 [US3] Extend `GET /api/bookmarks` query validation and response pagination to match `contracts/openapi.yaml` in `lib/bookmarks/schemas.ts` and `app/api/bookmarks/route.ts`
- [ ] T045 [US3] Build debounced accessible search, newest/oldest/alphabetical controls, stale-request cancellation, URL/history synchronization, load-more pagination, clear actions, and no-results guidance in `components/filters.tsx`, `components/bookmark-list.tsx`, and `app/page.tsx`
- [ ] T046 [US3] Run the US3 integration, performance, and browser suites and record the independent find-journey and measured performance result in `specs/001-bookmark-manager/quickstart.md`

**Checkpoint**: All three stories are independently functional and compose into the approved product.

---

## Phase 6: Polish & Cross-Cutting Validation

**Purpose**: Prove the complete product, harden deployment behavior, and prepare the review runtime.

- [ ] T047 [P] Add automated WCAG A/AA scans and explicit keyboard, label, live-region, color-contrast, and responsive viewport assertions for all core journeys in `tests/e2e/accessibility.spec.ts`
- [ ] T048 [P] Add security headers, same-origin mutation checks, structured redacted logging, and production-safe error boundaries in `next.config.ts`, `lib/security/origin.ts`, `lib/logging.ts`, and `app/error.tsx`
- [ ] T049 [P] Add migration tests for fresh install, idempotent reopen, integrity/foreign-key checks, and supported upgrade fixtures in `tests/integration/migrations.test.ts`
- [ ] T050 Verify icon/database cleanup, bounded preview concurrency, failed-action rollback, and no user-title overwrite under concurrent operations in `tests/integration/resilience.test.ts`
- [ ] T051 Run lint, type-check, production build, all automated suites, and the complete manual validation guide; record verified results and any unavailable external validation in `specs/001-bookmark-manager/quickstart.md`
- [ ] T052 Create the runtime delivery descriptor with `kind: application`, port 4000, `/` entry path, prepared foreground start command, and `/work` start directory in `.harness/app.json`
- [ ] T053 Start the production build through the declared runtime, inspect `.harness/runtime/server.log`, and verify readiness plus the core browser journey at both review and capture addresses in `.harness/app.json` and `specs/001-bookmark-manager/quickstart.md`

---

## Dependencies & Execution Order

### Phase dependencies

- **Setup (Phase 1)** has no dependencies.
- **Foundation (Phase 2)** depends on Setup and blocks every user story.
- **US1 (Phase 3)**, **US2 (Phase 4)**, and **US3 (Phase 5)** all require Foundation. The safest incremental sequence is US1 → US2 → US3 because later stories extend shared bookmark repository and UI files.
- **Polish (Phase 6)** depends on every story selected for release.

### User-story dependency graph

```text
Setup → Foundation → US1 (MVP lifecycle)
                   ├→ US2 (tag organization)
                   └→ US3 (search and sorting)

US1 + US2 + US3 → Cross-cutting validation → Review runtime
```

- **US1** has no story dependency after Foundation.
- **US2** is independently testable using foundation-level bookmark fixtures, then integrates into US1 forms/cards.
- **US3** is independently testable using seeded bookmark/tag fixtures, then integrates into the shared list/filter UI.

### Within each story

1. Add the listed tests and confirm they fail for missing behavior.
2. Implement validation/data behavior before endpoints.
3. Implement endpoints before UI integration.
4. Run the story-specific suite and validate the independent test before crossing the checkpoint.

## Parallel Execution Examples

### User Story 1

```text
Parallel test work: T014, T015, T016, T017, T018
After parser prerequisites: T019 and T020
After CRUD endpoints exist: T028 can proceed alongside the main UI work
```

### User Story 2

```text
Parallel test work: T033 and T034
After tag repository/API: tag input/card work and filter work can be coordinated as T037 then T038
```

### User Story 3

```text
Parallel test work: T040, T041, T042
After repository query support: endpoint work T044 precedes UI integration T045
```

## Implementation Strategy

### MVP first

1. Complete Setup and Foundation.
2. Complete US1 through T032.
3. Stop and demonstrate paste → real title/icon preview → editable save → persisted browse/open/edit/delete, including fallback behavior.

### Incremental delivery

1. Deliver US1 as the functional bookmark lifecycle MVP.
2. Add US2 and validate tags independently without regressing US1.
3. Add US3 and validate retrieval independently without regressing lifecycle or tags.
4. Complete cross-cutting accessibility, security, resilience, full-suite, and runtime checks.

## Notes

- `[P]` tasks touch distinct files and can proceed concurrently only when their stated prerequisites are satisfied.
- Story labels provide traceability to the approved specification.
- Preserve the exact API shapes in `contracts/openapi.yaml` and the field rules in `data-model.md`.
- Stop at each checkpoint to validate the increment; do not treat an unexecuted test plan as proof of behavior.
