# Tasks: Bookmark Manager

**Input**: Design documents from `specs/001-manage-bookmarks/`

**Prerequisites**: Approved `spec.md` and `plan.md`; `research.md`, `data-model.md`, `contracts/openapi.yaml`, and `quickstart.md`

**Tests**: Included because the approved plan defines unit, component, contract, end-to-end, security, and accessibility verification as delivery requirements.

**Organization**: Tasks are grouped by user story so each increment can be implemented and validated independently after the shared foundation.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel with adjacent tasks because it targets different files and has no dependency on an incomplete task
- **[Story]**: Maps the task to US1, US2, or US3 in the approved specification
- Every task names its target file or directory

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create the runnable project and verification skeleton.

- [x] T001 Initialize the Next.js 16 TypeScript application and production scripts in `package.json`, `tsconfig.json`, `next.config.ts`, and `app/layout.tsx`, including `npm start -- --hostname 0.0.0.0 --port 4000`
- [x] T002 Install and lock runtime dependencies (React, Zod, Drizzle ORM, `better-sqlite3`, Cheerio, and outbound HTTP/IP helpers) plus development dependencies in `package.json` and `package-lock.json`, pinning `@playwright/test` to `1.61.0`
- [x] T003 [P] Configure lint, typecheck, Vitest, jsdom, and shared test setup in `eslint.config.mjs`, `vitest.config.ts`, `tests/setup.ts`, and `package.json`
- [x] T004 [P] Configure Playwright Chromium, test web server, and axe dependency in `playwright.config.ts` and `tests/e2e/fixtures.ts`
- [x] T005 [P] Create the responsive global style foundation and semantic application shell in `app/styles.css`, `app/layout.tsx`, and `app/page.tsx`

**Checkpoint**: The empty project installs, typechecks, builds, and exposes the initial application shell.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish shared contracts, persistence, validation, and HTTP behavior required by every story.

**⚠️ CRITICAL**: No user-story implementation begins until this phase is complete.

- [x] T006 Define shared bookmark, tag, metadata-preview, and stable error Zod contracts matching `contracts/openapi.yaml` in `lib/contracts/bookmark.ts`, `lib/contracts/metadata.ts`, and `lib/contracts/error.ts`
- [x] T007 Define Drizzle tables and indexes in `lib/server/db/schema.ts` using these model constraints verbatim: Bookmark `id` is a generated immutable UUID primary key; `url` is the trimmed/serialized HTTP(S) display URL; `normalizedUrl` is unique; `title` is required, trimmed plain text, maximum 300 characters; `description` is nullable trimmed plain text, maximum 300 characters; `createdAt` is generated and immutable; `updatedAt` changes after each successful edit; BookmarkTag has unique `(bookmarkId, tagId)` foreign keys with cascade deletion
- [x] T008 Create the initial versioned SQLite migration with foreign keys, WAL mode, unique constraints, and query indexes in `lib/server/db/migrations/0001_initial.sql` and configure migration generation in `drizzle.config.ts`
- [x] T009 Implement environment-aware SQLite connection, migration startup, transaction support, and clean test disposal in `lib/server/db/connection.ts` and `lib/server/db/migrate.ts`
- [x] T010 [P] Implement bookmark URL parsing/normalization and safe text normalization in `lib/server/validation.ts`, requiring `http`/`https`, rejecting credentials, removing fragments/default ports, preserving query significance, and rendering values only as text
- [x] T011 [P] Implement same-origin JSON mutation enforcement and unified safe error serialization in `lib/server/same-origin.ts` and `lib/server/http-errors.ts`, with no permissive CORS or stack/network-detail leakage
- [x] T012 [P] Add unit tests for boundary schemas, URL normalization, safe error shapes, and text normalization in `tests/unit/contracts.test.ts` and `tests/unit/validation.test.ts`
- [x] T013 Add shared repository primitives for transactional create/read/update/delete, duplicate detection, tag joins, and orphan cleanup in `lib/server/db/repository.ts`
- [x] T014 Add API and database test factories using an isolated temporary SQLite database per test in `tests/helpers/test-db.ts` and `tests/helpers/test-app.ts`

**Checkpoint**: Shared contracts and an isolated, migrated persistence layer are ready; foundational tests pass.

---

## Phase 3: User Story 1 — Save and Revisit Bookmarks (Priority: P1) 🎯 MVP

**Goal**: Paste a public link, automatically receive editable title/description details with a safe fallback, save it, persist it, list it, and open it.

**Independent Test**: Paste a deterministic public fixture URL, observe announced progress and autofill, edit one field without it being overwritten, save/reload/open the bookmark, then repeat with a metadata failure and confirm URL-title/blank-description fallback still saves.

### Tests for User Story 1

- [x] T015 [P] [US1] Add unit fixtures/tests for metadata precedence, entity decoding, whitespace/control cleanup, title maximum 300 characters, description maximum 300 characters, missing metadata, and malformed HTML in `tests/fixtures/metadata-pages/` and `tests/unit/metadata-parser.test.ts`
- [x] T016 [P] [US1] Add network-policy unit tests for protocol/credential/port rejection, every non-global IPv4/IPv6 class, IPv4-mapped IPv6, mixed DNS answers, and pinned-address selection in `tests/unit/network-policy.test.ts`
- [x] T017 [P] [US1] Add metadata-fetch integration tests for revalidation across at most five redirects, DNS rebinding/public-to-private rejection, one eight-second budget, 2 MiB decoded-body limit, HTML-only acceptance, and stable fallback reasons in `tests/integration/metadata-fetcher.test.ts` and `tests/helpers/metadata-fixture-server.ts`
- [x] T018 [P] [US1] Add contract tests for `GET/POST /api/bookmarks` and `POST /api/metadata`, including success, partial/unavailable preview, validation, duplicate, media-type, and rate-limit responses in `tests/integration/bookmark-api.test.ts` and `tests/integration/metadata-api.test.ts`
- [x] T019 [P] [US1] Add component tests for paste/debounce/loading, per-field dirty protection, stale response rejection after URL change, editable fallback, create feedback, and keyboard labels in `tests/component/bookmark-form.test.tsx`
- [x] T020 [P] [US1] Add an MVP Playwright journey covering autofill, user override, save, newest-first list, reload persistence, external-link opening, duplicate handling, and retrieval fallback in `tests/e2e/save-bookmark.spec.ts`

### Implementation for User Story 1

- [x] T021 [P] [US1] Implement non-executing metadata extraction in `lib/server/metadata-parser.ts` with `<title>` then `og:title`, `meta[name="description"]` then `og:description`, normalized plain text, 300-character field clamps, and no body-derived summaries
- [x] T022 [P] [US1] Implement public-destination classification in `lib/server/network-policy.ts`, accepting only credential-free HTTP(S) ports 80/443 and rejecting the whole destination when any normalized A/AAAA result is non-global
- [x] T023 [US1] Implement the injectable pinned-address metadata fetcher in `lib/server/metadata-fetcher.ts` with manual per-hop validation, maximum five redirects, one eight-second deadline, 2 MiB decoded HTML limit, no cookies/auth, no scripts/subresources, and safe failure categories
- [x] T024 [P] [US1] Implement bookmark create/list domain logic in `lib/server/bookmarks.ts`, including URL-as-title fallback, atomic persistence, newest-first ordering, and duplicate responses that identify the existing bookmark
- [x] T025 [P] [US1] Implement metadata preview rate limiting and response mapping in `lib/server/metadata-preview.ts`, using `complete`, `partial`, or `unavailable` status and only `title`, `description`, `finalUrl`, and stable `reason` values
- [x] T026 [US1] Implement `GET/POST /api/bookmarks` in `app/api/bookmarks/route.ts` with shared schema validation, same-origin JSON mutation checks, and OpenAPI-aligned status/error bodies
- [x] T027 [US1] Implement `POST /api/metadata` in `app/api/metadata/route.ts` with retrieval progress-compatible responses, fallback-as-200 behavior, validation, media-type, and rate-limit handling
- [x] T028 [P] [US1] Implement the typed browser API client in `lib/client/api.ts` for bookmark list/create and metadata preview contracts
- [x] T029 [P] [US1] Implement the debounced preview state machine in `lib/client/metadata-controller.ts`, combining request abort, monotonically increasing request identity, current-URL matching, and separate title/description dirty flags
- [x] T030 [US1] Build the accessible create form in `components/bookmark-form.tsx` with URL, editable title/description, announced retrieval state, inline validation/fallback feedback, preserved input on errors, and save success feedback
- [x] T031 [P] [US1] Build newest-first bookmark presentation and safe external links in `components/bookmark-card.tsx`, `components/bookmark-list.tsx`, and `components/status-message.tsx`
- [x] T032 [US1] Integrate initial server data, empty guidance, form refresh, and `data-harness-ready="true"` only after valid initial data/empty state in `app/page.tsx`
- [x] T033 [US1] Run the US1 unit, integration, component, and Playwright suites and record any intentional contract deviations in `specs/001-manage-bookmarks/quickstart.md`

**Checkpoint**: The save/autofill/edit-before-save/persist/reopen flow works independently, including all metadata fallbacks and safety limits.

---

## Phase 4: User Story 2 — Organize and Find Bookmarks (Priority: P2)

**Goal**: Add reusable tags and quickly locate bookmarks by partial text or one tag, with clear empty/no-result states.

**Independent Test**: Seed varied bookmarks, assign case-varied tags, then independently find the target through title/address/description/tag search and a tag filter; clear each control and verify no-results guidance.

### Tests for User Story 2

- [x] T034 [P] [US2] Add repository/service tests for case-insensitive partial search across title, URL, description, and tags; newest-first results; single-tag filtering; and post-mutation consistency in `tests/integration/search-tags.test.ts`
- [x] T035 [P] [US2] Add contract tests for `GET /api/bookmarks?q=&tag=` and `GET /api/tags`, including query validation and counts in `tests/integration/discovery-api.test.ts`
- [x] T036 [P] [US2] Add component and Playwright tests for tag entry, search, filter, clear controls, empty/no-result states, and keyboard operation in `tests/component/search-controls.test.tsx` and `tests/e2e/find-bookmarks.spec.ts`

### Implementation for User Story 2

- [x] T037 [P] [US2] Complete Tag persistence in `lib/server/db/schema.ts` and `lib/server/db/repository.ts` using these constraints verbatim: Tag `id` is a generated immutable UUID primary key; `name` is trimmed display spelling of 1–40 characters; `normalizedName` is Unicode-normalized, case-folded, and unique; a bookmark has at most 20 distinct tags; empty tags are discarded; case-only variants reuse the existing Tag
- [x] T038 [US2] Implement tag normalization, transactional tag association/orphan cleanup, text search, and single-tag filter services in `lib/server/bookmarks.ts`
- [x] T039 [US2] Extend `GET /api/bookmarks` query behavior in `app/api/bookmarks/route.ts` and implement sorted tag counts in `app/api/tags/route.ts`
- [x] T040 [P] [US2] Extend create/edit tag inputs and accessible chip removal in `components/bookmark-form.tsx` and `components/tag-input.tsx`
- [x] T041 [P] [US2] Build debounced accessible search/tag filter/clear controls in `components/search-controls.tsx` and expose tags on cards in `components/bookmark-card.tsx`
- [x] T042 [US2] Integrate URL query state, filtered loading, mutation refresh, empty collection, and no-match recovery in `components/bookmark-list.tsx` and `app/page.tsx`
- [x] T043 [US2] Run the US2 unit, integration, component, and Playwright suites and verify results become visible within one second for a generated 1,000-bookmark fixture in `tests/integration/search-performance.test.ts`

**Checkpoint**: Tags, search, and filtering work independently against seeded data and preserve the US1 flow.

---

## Phase 5: User Story 3 — Maintain the Collection (Priority: P3)

**Goal**: Edit every bookmark field and delete only after explicit confirmation, without losing data on cancellation or failure.

**Independent Test**: Edit URL/title/description/tags and verify persistence plus duplicate validation; request deletion and cancel to retain the record, then confirm to remove it from the current result set.

### Tests for User Story 3

- [x] T044 [P] [US3] Add contract/integration tests for `PUT/DELETE /api/bookmarks/{id}`, including atomic field/tag updates, URL duplicate conflict, not-found behavior, rollback, orphan cleanup, and confirmed deletion effects in `tests/integration/maintain-api.test.ts`
- [x] T045 [P] [US3] Add component tests for edit initialization, changed-URL preview rules, retained manual edits, failed-save input preservation, delete dialog cancel/confirm, Escape, and focus restoration in `tests/component/edit-delete.test.tsx`
- [x] T046 [P] [US3] Add Playwright coverage for persisted editing and cancelled/confirmed deletion from active search/filter results in `tests/e2e/maintain-bookmarks.spec.ts`

### Implementation for User Story 3

- [x] T047 [US3] Implement atomic update/delete services, duplicate exclusion for the current record, URL-change revalidation, timestamps, cascading joins, and orphan cleanup in `lib/server/bookmarks.ts` and `lib/server/db/repository.ts`
- [x] T048 [US3] Implement OpenAPI-aligned `PUT/DELETE /api/bookmarks/{id}` handling in `app/api/bookmarks/[id]/route.ts`
- [x] T049 [P] [US3] Add typed update/delete calls and error mapping in `lib/client/api.ts`
- [x] T050 [US3] Reuse the bookmark form for edit mode in `components/bookmark-form.tsx`, clearing stale automatic metadata on URL change while retaining user input after failed saves
- [x] T051 [US3] Build the labelled, focus-managed confirmation dialog in `components/delete-dialog.tsx` and connect edit/delete actions in `components/bookmark-card.tsx` and `components/bookmark-list.tsx`
- [x] T052 [US3] Run the US3 integration, component, and Playwright suites under `tests/integration/`, `tests/component/`, and `tests/e2e/`, verifying cancelled/failed operations leave persisted data unchanged

**Checkpoint**: All three user stories are functional and independently covered.

---

## Phase 6: Polish and Cross-Cutting Validation

**Purpose**: Prove the complete product against approved outcomes and prepare the review runtime.

- [x] T053 [P] Run axe checks for empty, populated, create/edit, retrieval loading/fallback, filtered/no-result, and delete-dialog states in `tests/e2e/accessibility.spec.ts`
- [x] T054 [P] Add production security headers, body limits, safe logging/redaction, and metadata-preview concurrency limits in `next.config.ts`, `app/api/metadata/route.ts`, and `lib/server/safe-logger.ts`
- [x] T055 [P] Add generated 1,000-bookmark performance fixtures and measurable SC-001–SC-008 acceptance assertions in `tests/helpers/large-dataset.ts` and `tests/e2e/success-criteria.spec.ts`
- [x] T056 Refine responsive layouts, long URL/title wrapping, visible focus, loading/error/success presentation, and reduced-motion behavior in `app/styles.css`
- [x] T057 Run `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`, and `npm run test:e2e`; fix only implementation divergences from the approved artifacts and record results in `specs/001-manage-bookmarks/quickstart.md`
- [x] T058 Perform and record the manual keyboard/accessibility and security walkthrough from `specs/001-manage-bookmarks/quickstart.md`, including focus order, announcements, Escape/focus restoration, SSRF cases, redirect/time/body limits, and error redaction
- [x] T059 Create the prepared runtime declaration in `.harness/app.json` with `{"kind":"application","port":4000,"path":"/","start_command":["npm","start"],"start_cwd":"/work"}` and verify `http://127.0.0.1:4000/` reaches a `data-harness-ready="true"` state
- [x] T060 Review `specs/001-manage-bookmarks/spec.md`, `plan.md`, `data-model.md`, `contracts/openapi.yaml`, and `quickstart.md` against the delivered behavior and document any remaining unbuilt approved requirement before handoff

---

## Dependencies and Execution Order

### Phase dependencies

- **Phase 1 — Setup**: No dependencies; starts immediately.
- **Phase 2 — Foundational**: Depends on Phase 1 and blocks every story.
- **Phase 3 — US1**: Depends on Phase 2; produces the recommended MVP.
- **Phase 4 — US2**: Depends on Phase 2 and can be developed against seeded repository data, though sequential delivery after US1 is recommended.
- **Phase 5 — US3**: Depends on Phase 2 and can be developed against seeded repository data, though its integrated UI reuses the US1 form/list.
- **Phase 6 — Polish**: Depends on every story selected for release; the approved release includes US1–US3.

### User-story dependency graph

```text
Setup → Foundation ─┬→ US1 (save/revisit MVP) ─┐
                    ├→ US2 (organize/find) ────┼→ Polish + complete acceptance
                    └→ US3 (maintain) ─────────┘
```

US2 and US3 remain independently testable with seeded data. For a single implementer, use priority order US1 → US2 → US3 to minimize integration churn.

### Within each user story

1. Write the listed tests and confirm they fail for the expected missing behavior.
2. Implement lower-level model/parser/network/repository behavior.
3. Implement services, then route contracts.
4. Implement browser state/controllers, then visual components.
5. Integrate the story and run its independent checks before moving on.

## Parallel Execution Examples

### User Story 1

```text
Parallel test work: T015 metadata parser | T016 network policy | T018 API contracts | T019 form behavior | T020 E2E journey
Parallel implementation after tests: T021 parser | T022 network policy | T024 bookmark service | T025 preview mapping
Parallel client work after routes: T028 API client | T029 preview controller | T031 bookmark presentation
```

### User Story 2

```text
Parallel test work: T034 repository/search | T035 API contracts | T036 UI/E2E
Parallel UI work after services: T040 tag input | T041 search/filter controls
```

### User Story 3

```text
Parallel test work: T044 API/integration | T045 components | T046 E2E
Parallel client work after routes: T049 API client while T051 begins the isolated dialog component
```

## Implementation Strategy

### MVP first

1. Complete Setup and Foundational phases.
2. Complete US1 through T033.
3. Stop and validate paste → retrieve → edit → save → reload → open, including the manual fallback.
4. Present the MVP only if an intermediate review is desired.

### Approved incremental release

1. US1 delivers the core bookmark value.
2. US2 adds long-term retrieval through tags/search/filtering.
3. US3 adds collection maintenance with safe deletion.
4. Phase 6 verifies cross-cutting quality and prepares the review runtime.

## Notes

- `[P]` means the task can safely run concurrently only after its shared prerequisites are complete.
- Tests precede implementation within each story and must fail for the intended missing behavior before production code is added.
- Automated metadata tests use local deterministic fixtures and never arbitrary public websites.
- A fidelity bug is fixed against these approved artifacts; any product-behavior change returns to the specification gate.
