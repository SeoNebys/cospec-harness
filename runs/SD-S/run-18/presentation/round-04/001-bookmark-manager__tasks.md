---

description: "Dependency-ordered implementation tasks for the Bookmark Manager"
---

# Tasks: Bookmark Manager

**Input**: Design documents from `/specs/001-bookmark-manager/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/openapi.yaml`, `quickstart.md`

**Tests**: The approved implementation plan requires unit, component, database integration, contract, security, performance, accessibility, and browser journey tests. Story test tasks precede their implementations and must initially fail for the missing behavior.

**Organization**: Tasks are grouped by user story so each story can be implemented and verified as a coherent increment.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it targets different files and does not depend on unfinished work in the phase
- **[Story]**: Maps the task to a user story in `spec.md`
- Every task names its implementation or verification path

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create the application skeleton, pinned toolchain, and shared configuration.

- [ ] T001 Initialize the Node.js 24 ESM project and pin React Router 8.4, React 19.3, TypeScript 7.0, Better Auth 1.7, Drizzle ORM 0.45, better-sqlite3 13, Zod 4, Cheerio 1.2, Vitest 5, Testing Library, and Playwright 1.61.0 in `package.json` and `package-lock.json`
- [ ] T002 Create the planned application, migration, script, test, data, and public directory skeleton with tracked placeholders in `app/`, `drizzle/`, `scripts/`, `tests/`, `data/.gitkeep`, and `public/`
- [ ] T003 [P] Configure strict TypeScript, React Router Framework Mode, Vite, and path aliases in `tsconfig.json`, `react-router.config.ts`, `vite.config.ts`, `app/routes.ts`, and `app/root.tsx`
- [ ] T004 [P] Configure linting and formatting with explicit check/fix scripts in `eslint.config.mjs`, `.prettierrc.json`, and `package.json`
- [ ] T005 [P] Configure Vitest projects, Testing Library setup, and Playwright 1.61.0 with one worker and a built-server webServer on port 4000 in `vitest.config.ts`, `tests/setup.ts`, and `playwright.config.ts`
- [ ] T006 [P] Define documented development, test, review, and production environment variables and ignore secrets/database files in `.env.example`, `.gitignore`, and `app/config.server.ts`

**Checkpoint**: The empty application compiles, linting and test runners start, and no product behavior exists yet.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish persistence, authentication, owner identity, shared errors, and the application shell required by every story.

**⚠️ CRITICAL**: No user story work begins until this phase is complete.

- [ ] T007 Define Better Auth `user`, `session`, `account`, and `verification` tables and export the shared Drizzle schema in `app/db/schema.ts`
- [ ] T008 Configure the better-sqlite3 connection with `foreign_keys=ON`, bounded `busy_timeout`, WAL mode, and dependency-injectable test databases in `app/db/client.server.ts` and `drizzle.config.ts`
- [ ] T009 Generate and commit the initial authentication migration, then implement the explicit migration command in `drizzle/migrations/0000_auth.sql`, `drizzle/meta/`, `app/db/migrate.server.ts`, and `package.json`
- [ ] T010 Configure Better Auth email/password sign-in with runtime signup disabled, opaque database sessions, HttpOnly SameSite=Lax cookies, trusted-origin validation, and production secure-cookie rules in `app/auth/auth.server.ts`
- [ ] T011 Implement the auth resource route plus reusable session/owner guards that return `401` for resource requests and redirect page requests in `app/routes/api.auth.$.ts` and `app/auth/require-user.server.ts`
- [ ] T012 Implement an idempotent, non-production-only Alice/Bob review-account seed command using the supported auth server API in `app/auth/review-seed.server.ts`, `scripts/seed-review-users.ts`, and `package.json`
- [ ] T013 [P] Define safe problem responses, validation-error mapping, request IDs, and redacted structured logging that excludes secrets and full query-bearing URLs in `app/lib/http-problem.server.ts` and `app/lib/logger.server.ts`
- [ ] T014 [P] Create temporary migrated database factories, authenticated request helpers, and two-user fixtures without production test plugins in `tests/helpers/database.ts`, `tests/helpers/auth.ts`, and `tests/fixtures/users.ts`
- [ ] T015 [P] Write initially failing auth tests for sign-in, sign-out, session expiry/revocation, disabled signup, untrusted origins, and unauthenticated route behavior in `tests/integration/auth.test.ts` and `tests/e2e/auth.spec.ts`
- [ ] T016 Implement the accessible sign-in page, sign-out control, review-only credential hint, and authentication error states in `app/routes/_auth.login.tsx` and `app/components/sign-out-button.tsx`
- [ ] T017 Implement the responsive root shell, global error boundary, accessible live-status region, base design tokens, reduced-motion behavior, and valid ready marker placement in `app/root.tsx`, `app/components/ui/status-region.tsx`, and `app/styles/app.css`

**Checkpoint**: A seeded user can sign in and out through a database-backed session; protected routes have a trusted server-derived owner ID.

---

## Phase 3: User Story 1 — Save and revisit bookmarks (Priority: P1) 🎯 MVP

**Goal**: A signed-in user pastes a public URL, receives an editable title and optional description or a fallback title, saves without typing a title, sees the persisted entry, opens it, and is warned about owner-scoped duplicates.

**Independent Test**: Paste a controlled public page URL, observe automatic title/description, edit the title, save, refresh, and open it; then prove invalid URLs are rejected, an unavailable page saves with a fallback title, and a normalized duplicate links to the existing entry.

### Tests for User Story 1

- [ ] T018 [P] [US1] Write failing URL tests for trimming, scheme-less HTTPS insertion, IDN/alternate IPv4 parsing, fragment/default-port removal, preserved path/query order, HTTP-vs-HTTPS distinction, credentials rejection, unsupported schemes, malformed/single-label hosts, and the 2,048-character limit in `tests/unit/url-normalization.test.ts`
- [ ] T019 [P] [US1] Write failing address-policy tests covering public-only resolution; mixed public/private answers; loopback, RFC1918, CGNAT, link-local, metadata, multicast, documentation, reserved, IPv4-mapped IPv6, NAT64, Teredo, and 6to4 ranges in `tests/security/address-policy.test.ts`
- [ ] T020 [P] [US1] Write failing fetcher security tests for pinned DNS, connected-peer mismatch, no proxy/credentials/cookies/referrer, safe relative redirects, HTTPS downgrade, redirect loops/fourth hop, DNS/connect/idle/total timeouts, 16 KiB/100-field headers, 512 KiB streaming cap, identity encoding, successful HTML/XHTML only, and socket disposal in `tests/security/fetch-page.test.ts`
- [ ] T021 [P] [US1] Write failing inert-parser tests for title priority `<title>` → `og:title` → `twitter:title`, description priority standard → Open Graph → Twitter, charset/entity handling, Unicode/whitespace normalization, control/bidi removal, 300/1,000-character caps, and zero script/subresource execution in `tests/unit/metadata-parser.test.ts`
- [ ] T022 [P] [US1] Write failing validation tests requiring a valid HTTP(S) URL of at most 2,048 characters, a trimmed title of 1–300 characters, a nullable trimmed description of at most 1,000 characters, and zero tags for this slice in `tests/unit/bookmark-validation.test.ts`
- [ ] T023 [P] [US1] Write failing migrated-SQLite integration tests for owner-scoped create/list/open, persistence across connections, newest-first `(createdAt,id)` ordering, atomic `UNIQUE(ownerId, normalizedUrl)`, same-URL allowance across owners, and `401`/owner-obscuring `404` behavior in `tests/integration/bookmark-create-list.test.ts`
- [ ] T024 [P] [US1] Write failing contract tests for `POST /api/metadata/preview` and `GET/POST /api/bookmarks`, including `retrieved`, `fallback`, duplicate summary, `201`, `401`, `409`, `422`, and `429` responses from `specs/001-bookmark-manager/contracts/openapi.yaml` in `tests/contract/bookmark-create.contract.test.ts`
- [ ] T025 [P] [US1] Write failing component tests for debounced preview, loading/retrieved/fallback/invalid messages, stale-request cancellation, never overwriting user-dirty title/description, duplicate navigation, success/failure status, and first-invalid-field focus in `tests/unit/bookmark-editor.test.tsx`
- [ ] T026 [P] [US1] Write a failing browser journey for automatic metadata, user override, fallback save without title typing, refresh persistence, external opening, invalid URL, duplicate warning, empty library, and cross-user create/list isolation in `tests/e2e/save-bookmark.spec.ts`

### Implementation for User Story 1

- [ ] T027 [P] [US1] Add `Bookmark` with opaque text `id`, required owner FK, normalized HTTP(S) `url`/`normalizedUrl` capped at 2,048 characters, required trimmed `title` of 1–300 characters, nullable trimmed `description` capped at 1,000 characters, timestamps, `UNIQUE(ownerId, normalizedUrl)`, `(ownerId,id)` support key, and `(ownerId,createdAt DESC,id DESC)` index in `app/db/schema.ts` and `drizzle/migrations/0001_bookmarks.sql`
- [ ] T028 [P] [US1] Implement deterministic WHATWG URL normalization and hostname/path fallback-title generation matching the approved rules in `app/features/bookmarks/url-normalization.ts`
- [ ] T029 [P] [US1] Implement IP literal normalization, all-answer DNS lookup, explicit current IANA special-range rejection, public-address snapshots, and per-stage deadlines in `app/services/metadata/address-policy.server.ts`
- [ ] T030 [US1] Implement the Node http/https page fetcher with validated lookup pinning, peer verification, manual three-hop redirects, port 80/443 policy, HTTPS downgrade rejection, abort deadlines, header/body/content bounds, identity encoding, no ambient proxy/credentials, and injectable network seams in `app/services/metadata/fetch-page.server.ts`
- [ ] T031 [P] [US1] Implement bounded inert Cheerio parsing, metadata priority, encoding handling, sanitization, and length caps in `app/services/metadata/metadata-parser.server.ts`
- [ ] T032 [US1] Compose normalize → owner-duplicate check → safe fetch → parse/fallback behavior with typed safe warning categories and no leaked network details in `app/services/metadata/metadata.service.server.ts`
- [ ] T033 [P] [US1] Implement shared Zod input/output schemas matching the 2,048-character URL, 1–300-character title, nullable 1,000-character description, and metadata response constraints in `app/features/bookmarks/bookmark.validation.ts`
- [ ] T034 [US1] Implement owner-required bookmark insert, duplicate lookup, ID lookup, newest-first cursor listing, and uniqueness-error mapping in `app/features/bookmarks/bookmark.repository.server.ts`
- [ ] T035 [US1] Implement create/list orchestration with server-side revalidation, transaction boundaries, safe `409 DUPLICATE_BOOKMARK`, and no accepted client owner ID in `app/features/bookmarks/bookmark.service.server.ts`
- [ ] T036 [US1] Implement authenticated, rate-limited metadata preview with request correlation and `retrieved`/`fallback`/duplicate results in `app/routes/api.metadata.preview.ts`
- [ ] T037 [US1] Implement authenticated bookmark GET/POST handlers exactly matching the OpenAPI status and body contract in `app/routes/api.bookmarks.ts`
- [ ] T038 [US1] Implement the accessible quick-save editor with URL-only start, debounced preview, editable fetched fields, dirty-field protection, fallback explanation, duplicate link, validation limits, pending state, and status announcements in `app/components/bookmark-editor.tsx`
- [ ] T039 [US1] Implement the protected library route, empty-library guidance, newest-first bookmark list/card, safe external links, and persistence refresh flow in `app/routes/_library._index.tsx`, `app/components/bookmark-list.tsx`, and `app/components/bookmark-card.tsx`

**Checkpoint**: User Story 1 is a deployable MVP and passes its unit, security, integration, contract, component, and browser checks independently.

---

## Phase 4: User Story 2 — Browse and organize bookmarks (Priority: P2)

**Goal**: Users browse newest-first bookmarks and add, reuse, display, and remove case-insensitive tags without deleting bookmarks.

**Independent Test**: Create several bookmarks, attach new and existing differently capitalized tags, remove an association, refresh, and verify the library, tag counts, and bookmark persistence remain correct.

### Tests for User Story 2

- [ ] T040 [P] [US2] Write failing migrated-database tests for trimmed/collapsed tag names of 1–50 characters, Unicode-normalized case-folded per-owner uniqueness, maximum 20 tags per bookmark, cross-owner association rejection, transactional replacement, orphan cleanup, and preserved bookmark rows in `tests/integration/tags.test.ts`
- [ ] T041 [P] [US2] Write failing contract tests for `GET /api/tags` and bookmark create responses with tags/counts and `401`/`422` behavior from `specs/001-bookmark-manager/contracts/openapi.yaml` in `tests/contract/tags.contract.test.ts`
- [ ] T042 [P] [US2] Write failing component tests for creating/reusing/removing tags, case-insensitive suggestions, empty-tag rejection, 50-character/20-tag limits, and rendered chips in `tests/unit/tag-input.test.tsx` and `tests/unit/bookmark-card.test.tsx`
- [ ] T043 [P] [US2] Write a failing browser journey for newest-first browsing, add/reuse/remove tag associations, refresh persistence, and per-user tag invisibility in `tests/e2e/organize-bookmarks.spec.ts`

### Implementation for User Story 2

- [ ] T044 [P] [US2] Add `Tag` with opaque ID, owner FK, 1–50-character display name, normalized name, timestamp, `UNIQUE(ownerId, normalizedName)`, `(ownerId,id)` support key, plus `BookmarkTag` with owner/bookmark/tag fields, `(bookmarkId,tagId)` primary key, composite owner-safe cascading FKs, and `(ownerId,tagId,bookmarkId)` index in `app/db/schema.ts` and `drizzle/migrations/0002_tags.sql`
- [ ] T045 [US2] Implement owner-scoped tag normalization, lookup, upsert, counts, association replacement, cross-owner prevention, and orphan cleanup in `app/features/bookmarks/tag.repository.server.ts`
- [ ] T046 [US2] Extend bookmark create/list transactions and validation for zero to 20 unique tags of 1–50 characters while preserving atomic duplicate handling in `app/features/bookmarks/bookmark.service.server.ts` and `app/features/bookmarks/bookmark.validation.ts`
- [ ] T047 [US2] Implement the authenticated owner-scoped tag listing endpoint matching the OpenAPI contract in `app/routes/api.tags.ts`
- [ ] T048 [US2] Implement accessible tag entry/suggestions/chips, tag removal, per-tag counts, and tag rendering in `app/components/tag-input.tsx`, `app/components/bookmark-editor.tsx`, `app/components/bookmark-card.tsx`, and `app/routes/_library._index.tsx`

**Checkpoint**: User Stories 1 and 2 work together, while organization can be tested independently against pre-seeded bookmarks.

---

## Phase 5: User Story 3 — Find a saved bookmark (Priority: P3)

**Goal**: Users search title, URL, description, and tag text; filter by one exact normalized tag; combine both conditions; reset them together; and recover from no-match states.

**Independent Test**: Seed distinguishable bookmarks, verify case-insensitive matches in every supported field, combine a text query and tag filter, observe only AND matches, trigger no results, and clear both controls.

### Tests for User Story 3

- [ ] T049 [P] [US3] Write failing repository tests for trimmed case-insensitive substring search across title/URL/description/tag, escaped `%`/`_` literals, exact normalized tag filtering, AND composition, owner scoping, stable newest-first order, and 50-item cursor pages in `tests/integration/bookmark-search.test.ts`
- [ ] T050 [P] [US3] Write failing OpenAPI contract tests for bookmark `query`, `tag`, `cursor`, and `limit` parameters, `nextCursor`, and invalid limit/query responses in `tests/contract/bookmark-list.contract.test.ts`
- [ ] T051 [P] [US3] Write failing component tests for debounced search, active tag filter, combined criteria, one-action reset, URL-state restoration, and distinct empty-library/no-match states in `tests/unit/filter-bar.test.tsx` and `tests/unit/bookmark-list.test.tsx`
- [ ] T052 [P] [US3] Write a failing browser journey covering every search field, case variation, tag filter, combined AND results, no-match recovery, reset, and refreshable filter state in `tests/e2e/find-bookmarks.spec.ts`

### Implementation for User Story 3

- [ ] T053 [US3] Implement owner-scoped escaped substring search, exact normalized tag filtering, AND composition, stable ordering, and opaque cursor pagination in `app/features/bookmarks/bookmark.repository.server.ts`
- [ ] T054 [US3] Extend bookmark list validation/handling for trimmed query up to 300 characters, tag up to 50 characters, limit 1–100 defaulting to 50, and cursor errors in `app/features/bookmarks/bookmark.validation.ts` and `app/routes/api.bookmarks.ts`
- [ ] T055 [US3] Implement the accessible search field, tag filter, active-criteria summary, one-action reset, and URL query-state synchronization in `app/components/filter-bar.tsx` and `app/routes/_library._index.tsx`
- [ ] T056 [US3] Implement cursor continuation and distinct no-match recovery rendering without replacing the empty-library onboarding state in `app/components/bookmark-list.tsx` and `app/routes/_library._index.tsx`

**Checkpoint**: User Story 3 independently retrieves known entries from seeded data and does not change save or organization behavior.

---

## Phase 6: User Story 4 — Maintain saved bookmarks (Priority: P4)

**Goal**: Users atomically edit all bookmark fields and permanently delete a bookmark only after explicit confirmation, with clear success/failure outcomes.

**Independent Test**: Edit URL, title, description, and tags; refresh to prove persistence; cancel a deletion and verify no change; confirm deletion and verify the item and orphan tags are gone.

### Tests for User Story 4

- [ ] T057 [P] [US4] Write failing OpenAPI contract tests for `PATCH/DELETE /api/bookmarks/{bookmarkId}` covering `200`, `204`, `401`, owner-obscuring `404`, duplicate `409`, and validation `422` in `tests/contract/bookmark-maintenance.contract.test.ts`
- [ ] T058 [P] [US4] Write failing migrated-database tests for atomic field/tag updates, `updatedAt`, duplicate rollback, cross-owner update/delete denial, cascade association deletion, orphan cleanup, and unchanged data after denied operations in `tests/integration/bookmark-maintenance.test.ts`
- [ ] T059 [P] [US4] Write failing component tests for prefilled editing, all field limits, success/failure focus and announcements, delete confirmation focus trapping, cancel, pending prevention, and confirmed removal in `tests/unit/bookmark-maintenance.test.tsx`
- [ ] T060 [P] [US4] Write a failing browser journey for full edit persistence, duplicate-edit recovery, delete cancel, confirmed permanent delete, and direct cross-owner mutation denial in `tests/e2e/maintain-bookmarks.spec.ts`

### Implementation for User Story 4

- [ ] T061 [US4] Implement owner-scoped atomic bookmark update, URL renormalization, tag replacement, timestamp update, duplicate rollback, and foreign-ID `404` behavior in `app/features/bookmarks/bookmark.service.server.ts` and `app/features/bookmarks/bookmark.repository.server.ts`
- [ ] T062 [US4] Implement owner-scoped permanent deletion with cascading associations, orphan-tag cleanup, and indistinguishable missing/foreign IDs in `app/features/bookmarks/bookmark.service.server.ts` and `app/features/bookmarks/bookmark.repository.server.ts`
- [ ] T063 [US4] Implement authenticated PATCH and DELETE handlers exactly matching the OpenAPI contract in `app/routes/api.bookmarks.$bookmarkId.ts`
- [ ] T064 [US4] Implement the accessible prefilled edit interaction with URL re-preview, user-controlled fetched fields, field-level validation, and visible operation outcomes in `app/components/bookmark-editor.tsx` and `app/components/bookmark-card.tsx`
- [ ] T065 [US4] Implement the accessible destructive confirmation dialog with cancel/no-change, pending protection, focus restoration, and successful list removal in `app/components/ui/confirmation-dialog.tsx`, `app/components/bookmark-card.tsx`, and `app/routes/_library._index.tsx`

**Checkpoint**: All four user stories are functional and independently verified.

---

## Phase 7: Polish & Cross-Cutting Verification

**Purpose**: Complete plan-wide hardening, measurable outcomes, documentation, and review delivery after all selected stories are implemented.

- [ ] T066 [P] Add per-user/per-host metadata concurrency and rate limits plus safe categorized observability without resolved IPs, secrets, or query-bearing URLs in `app/services/metadata/metadata-rate-limit.server.ts`, `app/services/metadata/metadata.service.server.ts`, and `app/lib/logger.server.ts`
- [ ] T067 [P] Add automated keyboard, landmark, label, dialog, live-region, contrast, reduced-motion, and responsive checks across sign-in and library flows in `tests/e2e/accessibility.spec.ts`
- [ ] T068 [P] Add the complete two-browser-context ownership matrix for list/search/filter/fetch/update/delete/tag association, same-URL cross-owner allowance, `401`, `404`, and unchanged denied rows in `tests/e2e/owner-isolation.spec.ts`
- [ ] T069 [P] Add adversarial metadata integration coverage for network-policy denial, parser non-execution, slow-drip responses, redirect pivots, late-response dirty-field protection, and safe user-facing failures in `tests/security/metadata-adversarial.test.ts` and `tests/e2e/metadata-failure.spec.ts`
- [ ] T070 Validate every implemented resource response against the warning-free OpenAPI document and keep contract/runtime schemas synchronized in `tests/contract/openapi-conformance.test.ts` and `specs/001-bookmark-manager/contracts/openapi.yaml`
- [ ] T071 Add deterministic 1,000-bookmark and controlled metadata fixture benchmarks for the 2-second library/search and 3-second preview success criteria in `tests/performance/bookmark-scale.test.ts` and `tests/performance/metadata-timing.test.ts`
- [ ] T072 Finalize build, migrate, seed, lint, typecheck, unit, integration, security, contract, E2E, and aggregate test scripts with CI-safe exit behavior in `package.json`
- [ ] T073 Document setup, production/review separation, migrations, review credentials, security assumptions, egress requirements, and verification commands in `README.md`, `.env.example`, and `specs/001-bookmark-manager/quickstart.md`
- [ ] T074 Create the final port-4000 runtime declaration and ensure `data-harness-ready="true"` appears only on the loaded sign-in or library state in `.harness/app.json`, `app/routes/_auth.login.tsx`, and `app/routes/_library._index.tsx`
- [ ] T075 Run the complete quickstart and acceptance journeys, record commands/results/timing and any unavailable external-service validation, and resolve all regressions before handoff in `specs/001-bookmark-manager/validation-results.md`

**Checkpoint**: The application is built, migrated, seeded, tested, security-hardened, and ready for client review at `http://maker:4000/`.

---

## Dependencies & Execution Order

### Phase dependencies

```text
Phase 1 Setup
    ↓
Phase 2 Foundation (blocks every story)
    ↓
US1 Save/Revisit (MVP)
    ├────────→ US2 Organize ────────┐
    ├────────→ US3 Find*            ├──→ Phase 7 Polish/Handoff
    └────────→ US4 Maintain* ───────┘

* US3 needs Tag foundations from US2 for tag filtering.
* US4 uses Tag foundations from US2 for complete tag editing; its non-tag edit/delete core can begin after US1.
```

- **Phase 1** has no prerequisites.
- **Phase 2** starts after Phase 1 and blocks all stories.
- **US1** starts after Phase 2 and is the first independently deployable increment.
- **US2** starts after US1 because it extends bookmark transactions and presentation with tags.
- **US3** starts after US1 for text search; tag-filter completion depends on US2.
- **US4** starts after US1 for title/URL/description edit and delete; complete tag editing depends on US2.
- **Phase 7** starts after every story selected for the release passes its checkpoint.

### Within each user story

1. Add the story's tests and confirm they fail for the intended missing behavior.
2. Add or migrate the data model before repositories.
3. Complete pure validation/security modules before composed services.
4. Complete services before resource routes.
5. Complete resource routes before final UI integration.
6. Run the story-specific unit, integration, contract, and browser checks at its checkpoint.

## Parallel Opportunities

### Setup and foundation

- After T001–T002, T003–T006 can proceed in parallel.
- After T007–T012 establish persistence/auth contracts, T013–T015 target separate error, fixture, and test files.
- T016 and T017 target separate UI surfaces once session guards exist.

### User Story 1

```text
Parallel test batch: T018, T019, T020, T021, T022, T023, T024, T025, T026
Parallel pure implementation batch after schema contract: T028, T029, T031, T033
Then: T030 → T032 → T036
And:  T027 → T034 → T035 → T037
Finally: T038 → T039 → run all US1 checks
```

### User Story 2

```text
Parallel test batch: T040, T041, T042, T043
Then: T044 → T045 → T046/T047 → T048 → run all US2 checks
```

### User Story 3

```text
Parallel test batch: T049, T050, T051, T052
Then: T053/T055 → T054/T056 → run all US3 checks
```

### User Story 4

```text
Parallel test batch: T057, T058, T059, T060
Then: T061/T062 → T063 → T064/T065 → run all US4 checks
```

### Cross-cutting phase

- T066–T069 operate in separate production/test files and can begin in parallel after story completion.
- T070–T075 converge contracts, scripts, documentation, runtime delivery, and final evidence sequentially where their outputs depend on the full suite.

## Implementation Strategy

### MVP first

1. Complete Phase 1.
2. Complete Phase 2.
3. Complete US1 tasks T018–T039.
4. Stop and run the US1 checkpoint: sign in, paste, retrieve/fallback, edit, save, refresh, open, and reject duplicates.
5. Demonstrate the MVP before expanding if early feedback is desired.

### Incremental delivery

1. **Foundation**: runnable authenticated shell with isolated sessions.
2. **US1**: core bookmark save/revisit experience with safe automatic metadata.
3. **US2**: browsing and tags.
4. **US3**: search, tag filter, reset, and pagination.
5. **US4**: full editing and confirmed deletion.
6. **Polish**: whole-system isolation, accessibility, performance, documentation, and presentation readiness.

Each increment preserves the previous story's tests and produces a usable checkpoint; no later story is required to validate the core US1 save/revisit value.

## Notes

- `[P]` means the task can be assigned concurrently at that point without editing the same unfinished file.
- Story labels provide traceability to the four approved user stories.
- Repository and service APIs always receive the authenticated owner from server context, never from client input.
- The metadata test transport is injectable; automated tests do not depend on public internet availability or bypass production SSRF policy.
- Generated SQL migrations are committed; production startup never performs an unreviewed schema push.
- Stop at each checkpoint if behavior diverges from the approved specification; fix fidelity through implementation, and route changed behavior back through the specification.
