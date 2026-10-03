# Tasks: Bookmark Manager

**Input**: Design documents from `specs/001-bookmark-manager/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/ui-contract.md`, `quickstart.md`

**Tests**: The approved plan requires unit, repository-integration, component, accessibility, and browser tests. Story tests are written before their corresponding implementation and must initially fail for the intended missing behavior.

**Organization**: Tasks are grouped by user story so each story can be implemented and validated as an increment.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it targets different files and has no dependency on an incomplete task in the phase.
- **[Story]**: Maps the task to an approved user story.
- Every task includes an exact file path.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Initialize the client application and verification toolchain.

- [ ] T001 Create the React 19 and TypeScript 5.x Vite application manifests and scripts for development, test, build, and `0.0.0.0:4000` production serving in `package.json`, `package-lock.json`, `tsconfig.json`, and `vite.config.ts`
- [ ] T002 Create the HTML entry point and React bootstrap with the initial loading shell in `index.html` and `src/main.tsx`
- [ ] T003 [P] Configure Vitest, jsdom, React Testing Library matchers, and fake IndexedDB in `vite.config.ts` and `src/test/setup.ts`
- [ ] T004 [P] Configure Playwright 1.61.0 with the installed Chromium and application base URL in `playwright.config.ts`

**Checkpoint**: The empty application builds, starts on port 4000, and both test runners can execute.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish the shared domain, persistence, and application-state boundaries required by every story.

**Critical**: No user-story implementation begins until this phase is complete.

- [ ] T005 Define `Bookmark`, `BookmarkInput`, repository error, and repository interface types in `src/domain/bookmark.ts`, preserving the constraints “Stable, unique UUID assigned at creation and never edited,” “Assigned at creation; immutable” for `createdAt`, and “Assigned at creation and replaced after every successful edit” for `updatedAt`
- [ ] T006 [P] Write failing unit tests for trimming, required title, canonical HTTP(S) address validation, hostname requirements, unsupported schemes, and scheme insertion in `tests/unit/urlNormalization.test.ts`
- [ ] T007 [P] Write failing unit tests for tag trimming, empty-tag removal, Unicode NFKC/case-insensitive uniqueness, and first visible spelling retention in `tests/unit/tagNormalization.test.ts`
- [ ] T008 Implement bookmark input validation and standards-based URL normalization in `src/domain/urlNormalization.ts`, enforcing “Trimmed; must contain at least one non-whitespace character” for title and “Canonical serialized HTTP or HTTPS URL with a non-empty hostname” for URL
- [ ] T009 Implement tag normalization in `src/domain/tagNormalization.ts`, enforcing “Zero or more trimmed, non-empty values; unique by normalized comparison key; first visible spelling retained”
- [ ] T010 Write failing repository integration tests for versioned database creation, list/create/update/delete transactions, reload persistence, immutable identity/creation time, missing records, and aborted-write error propagation in `tests/integration/bookmarkRepository.test.ts`
- [ ] T011 Implement the versioned IndexedDB `bookmarks` store and asynchronous `BookmarkRepository` transactions in `src/storage/bookmarkRepository.ts`
- [ ] T012 Create the application loading, ready, storage-error, mutation-error, and live-status state orchestration with injectable repository support in `src/app/App.tsx`

**Checkpoint**: Domain rules and transactional persistence work independently of the visual story components; initial loading resolves to a collection or valid empty state.

---

## Phase 3: User Story 1 — Save and revisit a bookmark (Priority: P1) — MVP

**Goal**: A user can save a valid bookmark, retain it across visits, and open it without losing collection context.

**Independent Test**: Save one valid web address, leave or reload the collection, return, and open it. The same title and normalized address remain available, and the destination opens in a new tab.

### Tests for User Story 1

- [ ] T013 [P] [US1] Write failing component tests for the empty state, labeled add form, retained validation errors, successful save status, persisted list rendering, and external-link notice in `tests/component/save-and-open.test.tsx`
- [ ] T014 [P] [US1] Write the failing browser journey for create, reload persistence, invalid addresses, and opening in a new tab using real IndexedDB in `tests/e2e/save-and-open.spec.ts`

### Implementation for User Story 1

- [ ] T015 [P] [US1] Implement the actionable empty-collection state in `src/components/EmptyState.tsx`
- [ ] T016 [P] [US1] Implement bookmark cards with text-only user content, title/address/tags display, optional description, and a `target="_blank"` link with an accessible new-tab notice in `src/components/BookmarkCard.tsx`
- [ ] T017 [US1] Implement the add-bookmark form with required title/address, optional description/tags, adjacent `aria-invalid` and `aria-describedby` errors, cancel behavior, and retained invalid input in `src/components/BookmarkForm.tsx`
- [ ] T018 [US1] Implement newest-created-first collection rendering with deterministic ID tie-breaking in `src/components/BookmarkList.tsx`
- [ ] T019 [US1] Integrate create, committed-write refresh, loading/error states, live success messages, and `data-harness-ready="true"` only after a successful initial load in `src/app/App.tsx`
- [ ] T020 [US1] Implement canonical duplicate detection plus explicit Cancel/Save duplicate confirmation without writing on the first attempt in `src/components/ConfirmDialog.tsx` and `src/app/App.tsx`

**Checkpoint**: User Story 1 is a deployable MVP and passes its component, repository, and browser tests.

---

## Phase 4: User Story 2 — Find and organize bookmarks (Priority: P2)

**Goal**: A user can organize bookmarks with reusable tags and find them through search, one-tag filtering, or both.

**Independent Test**: Create varied bookmarks, search across every supported field, filter by a tag, combine and clear controls, and verify exact matches, result counts, and the recoverable no-results state.

### Tests for User Story 2

- [ ] T021 [P] [US2] Write failing unit tests for case-insensitive partial search across title, URL, description, and tags, one-tag filtering, combined criteria, tag derivation/counting, and a deterministic 1,000-item result benchmark in `tests/unit/bookmarkSearch.test.ts`
- [ ] T022 [P] [US2] Write failing component tests for labeled search/filter controls, result-count announcements, clear actions, and the no-results state in `tests/component/search-and-filter.test.tsx`
- [ ] T023 [P] [US2] Write the failing browser journey for search, tag filter, combined criteria, clear controls, and no-match recovery in `tests/e2e/search-and-filter.spec.ts`

### Implementation for User Story 2

- [ ] T024 [US2] Implement normalized multi-field partial search, one-tag filtering, combined criteria, and derived reusable tag counts in `src/domain/bookmarkSearch.ts`
- [ ] T025 [US2] Implement labeled search and tag controls, clear behavior, and polite result-count announcements in `src/components/SearchAndFilter.tsx`
- [ ] T026 [US2] Integrate derived results, tag choices, and the actionable no-match state without altering the stored collection in `src/app/App.tsx` and `src/components/BookmarkList.tsx`

**Checkpoint**: User Stories 1 and 2 work together, and Story 2 remains independently testable with seeded bookmarks.

---

## Phase 5: User Story 3 — Maintain the collection (Priority: P3)

**Goal**: A user can edit all bookmark details or delete a bookmark, with safe cancellation and explicit delete confirmation.

**Independent Test**: Edit every field and verify persistence, cancel a second edit and verify no changes, cancel one deletion, then confirm deletion and verify the bookmark remains absent after reload.

### Tests for User Story 3

- [ ] T027 [P] [US3] Write failing component tests for edit prefill/save/cancel, unchanged `createdAt`, updated `updatedAt`, delete confirmation/cancel, storage failure preservation, and modal focus restoration in `tests/component/edit-and-delete.test.tsx`
- [ ] T028 [P] [US3] Write the failing browser journey for edit/reload, edit cancellation, delete cancellation, confirmed delete/reload, keyboard dialog behavior, and injected mutation failure in `tests/e2e/edit-and-delete.spec.ts`

### Implementation for User Story 3

- [ ] T029 [US3] Extend the shared bookmark form with complete edit prefill, validation, save, cancel, and unchanged persistent state until transaction commit in `src/components/BookmarkForm.tsx`
- [ ] T030 [US3] Implement accessible modal behavior for delete confirmation, including safe initial focus, Escape/cancel, focus containment, and focus restoration in `src/components/ConfirmDialog.tsx`
- [ ] T031 [US3] Integrate edit and delete repository transactions, explicit success/error announcements, and preservation of the prior collection on failure in `src/app/App.tsx`

**Checkpoint**: All three user stories are functional and independently covered by their acceptance journeys.

---

## Phase 6: Polish and Cross-Cutting Concerns

**Purpose**: Complete responsive presentation, accessibility verification, performance validation, and runtime delivery.

- [ ] T032 [P] Implement responsive layout, readable long-content wrapping, visible focus, non-color-only states, and WCAG 2.2 AA color contrast in `src/app/app.css`
- [ ] T033 [P] Add automated axe checks for the empty collection, populated collection, validation errors, add/edit form, and confirmation dialog states in `tests/accessibility/bookmark-ui.test.tsx`
- [ ] T034 Review all user-visible failure and empty-state language against the UI contract and centralize final messages in `src/app/messages.ts`
- [ ] T035 Run unit, integration, component, accessibility, 1,000-item performance, and Playwright suites; record command outcomes and any manual keyboard/focus findings in `specs/001-bookmark-manager/validation.md`
- [ ] T036 Build the production bundle, create the port-4000 application launch declaration in `.harness/app.json`, start it through the declared command, and execute every scenario in `specs/001-bookmark-manager/quickstart.md`, recording results in `specs/001-bookmark-manager/validation.md`

**Checkpoint**: The production build is ready at `http://maker:4000/`, the harness readiness marker reflects genuinely loaded UI, and validation evidence is recorded.

---

## Dependencies and Execution Order

### Phase dependencies

- **Phase 1 — Setup**: Starts immediately.
- **Phase 2 — Foundation**: Depends on Phase 1 and blocks all stories.
- **Phase 3 — US1**: Depends on Foundation and delivers the suggested MVP.
- **Phase 4 — US2**: Depends on Foundation and reuses collection rendering; it can be developed alongside US1 after the shared collection seam exists.
- **Phase 5 — US3**: Depends on Foundation and the shared form/card seams from US1; delete behavior does not depend on US2.
- **Phase 6 — Polish**: Depends on all stories selected for release.

### User-story dependency graph

```text
Setup → Foundation → US1 (MVP) ──┬→ Polish
                    ├→ US2 ───────┤
                    └→ US3 ───────┘
```

- **US1** has no story dependency after Foundation.
- **US2** is independently testable with seeded repository data, though final integration reuses the shared collection UI.
- **US3** is independently testable with one seeded bookmark, though final integration reuses the shared form and card actions.

### Within each story

- Write and run the story's tests first; verify failure is caused by the missing behavior.
- Implement pure/domain behavior before UI integration.
- Persist mutations before showing success or replacing prior rendered data.
- Finish the independent test before beginning the next priority when working sequentially.

## Parallel Execution Examples

### User Story 1

```text
T013: Component tests in tests/component/save-and-open.test.tsx
T014: Browser tests in tests/e2e/save-and-open.spec.ts
T015: Empty state in src/components/EmptyState.tsx
T016: Bookmark card in src/components/BookmarkCard.tsx
```

After those converge, complete T017–T020 sequentially where they share application/form files.

### User Story 2

```text
T021: Domain tests in tests/unit/bookmarkSearch.test.ts
T022: Component tests in tests/component/search-and-filter.test.tsx
T023: Browser tests in tests/e2e/search-and-filter.spec.ts
```

Then complete T024–T026 in dependency order.

### User Story 3

```text
T027: Component tests in tests/component/edit-and-delete.test.tsx
T028: Browser tests in tests/e2e/edit-and-delete.spec.ts
```

Then complete T029–T031 in dependency order.

## Implementation Strategy

### MVP first

1. Complete Setup and Foundation.
2. Complete User Story 1.
3. Stop and run the Story 1 independent test plus all foundational tests.
4. Demonstrate the save, reload, open, validation, and duplicate flow before expanding scope.

### Incremental delivery

1. Foundation → stable domain and storage.
2. US1 → useful bookmark-saving MVP.
3. US2 → searchable, tag-organized collection.
4. US3 → maintainable collection with safe edit/delete.
5. Polish → responsive, accessible, fully validated release candidate.

## Notes

- `[P]` means the task can be started concurrently with other `[P]` tasks in that phase, not that all edits can be merged without review.
- Story labels provide traceability to the approved specification.
- Keep browser storage limitations honest: same-browser persistence is not backup or synchronization.
- Do not add accounts, sharing, synchronization, imports, browser extensions, metadata scraping, or link-health checks without returning to the specification gate.
