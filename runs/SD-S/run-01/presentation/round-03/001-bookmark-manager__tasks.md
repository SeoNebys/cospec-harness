---

description: "Task list for Bookmark Manager implementation"
---

# Tasks: Bookmark Manager

**Input**: Design documents from `/specs/001-bookmark-manager/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/data-layer.md, quickstart.md

**Tests**: Included — the plan and quickstart specify Vitest + React Testing Library and one Playwright smoke flow.

**Organization**: Tasks are grouped by user story so each can be implemented and tested independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: US1, US2, US3, US4 (maps to spec.md user stories)

## Path Conventions

Single-project web SPA (per plan.md): app code under `src/`, tests under `tests/`, at repository root.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [ ] T001 Initialize Vite + React + TypeScript project at repo root (index.html, package.json, vite.config.ts, tsconfig.json)
- [ ] T002 Add dependencies: react, react-dom, dexie; dev deps: vitest, @testing-library/react, @testing-library/jest-dom, jsdom, @playwright/test
- [ ] T003 [P] Configure linting/formatting (ESLint + Prettier) and npm scripts (dev, build, preview, test, test:e2e) in package.json
- [ ] T004 [P] Create source folder skeleton per plan.md: src/{models,data,components,lib}, tests/{unit,component,e2e}
- [ ] T005 [P] Configure Vitest (jsdom environment) and Playwright config for the e2e smoke flow

**Checkpoint**: Project builds and `npm run dev` serves an empty app shell.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core data types, storage, and validation that ALL user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T006 [P] Define Bookmark and Tag types plus NewBookmarkInput/BookmarkQuery in src/models/bookmark.ts (per data-model.md)
- [ ] T007 [P] Implement URL normalization, http/https validation, and title-fallback helpers in src/lib/url.ts (VR-001, VR-002)
- [ ] T008 Define Dexie database and schema in src/data/db.ts: bookmarks store keyed by id, index on dateSaved, multi-entry index on tags (per data-model.md)
- [ ] T009 [P] Unit tests for url.ts (normalization, validation, title fallback) in tests/unit/url.test.ts
- [ ] T010 Scaffold App shell and view switching (list / add-edit form) in src/App.tsx and src/main.tsx

**Checkpoint**: Types, storage, and validation exist; app shell renders. User stories can now proceed.

---

## Phase 3: User Story 1 - Save a bookmark (Priority: P1) 🎯 MVP

**Goal**: User enters a web address, it is validated, saved to local storage, and persists across reloads.

**Independent Test**: Enter a valid address, save, reload the page — the bookmark is still recorded (verify via list or storage).

### Tests for User Story 1

- [ ] T011 [P] [US1] Unit tests for repository `add`/`findByUrl` (validation, defaults, dedupe of tags, duplicate lookup) in tests/unit/bookmarkRepository.add.test.ts
- [ ] T012 [P] [US1] Component test for BookmarkForm save + required-address rejection in tests/component/BookmarkForm.test.tsx

### Implementation for User Story 1

- [ ] T013 [US1] Implement `add` and `findByUrl` in src/data/bookmarkRepository.ts (per contracts/data-layer.md; uses url.ts + db.ts) — VR-001..VR-005
- [ ] T014 [US1] Implement BookmarkForm (add mode) in src/components/BookmarkForm.tsx: address + title + notes + tags inputs, validation errors, duplicate warning via findByUrl (FR-001,002,003,013)
- [ ] T015 [US1] Wire "add bookmark" flow into src/App.tsx (open form, save, return to list)

**Checkpoint**: A user can save a bookmark and it persists across reloads (MVP core).

---

## Phase 4: User Story 2 - Browse and open saved bookmarks (Priority: P1) 🎯 MVP

**Goal**: User sees all saved bookmarks (most-recent-first) and opens the original page; a friendly empty state shows when none exist.

**Independent Test**: With bookmarks saved, open the app — all appear with title + address; click one to open the page; with none saved, the empty state shows.

### Tests for User Story 2

- [ ] T016 [P] [US2] Unit test for repository `list` default ordering (most-recent-first) in tests/unit/bookmarkRepository.list.test.ts
- [ ] T017 [P] [US2] Component test for BookmarkList rendering and empty state in tests/component/BookmarkList.test.tsx

### Implementation for User Story 2

- [ ] T018 [US2] Implement `list` (no-query = all, most-recent-first) and `get` in src/data/bookmarkRepository.ts (FR-005, FR-014)
- [ ] T019 [P] [US2] Implement BookmarkItem in src/components/BookmarkItem.tsx: shows title + address, opens original page in browser (FR-006)
- [ ] T020 [P] [US2] Implement EmptyState in src/components/EmptyState.tsx (FR-012)
- [ ] T021 [US2] Implement BookmarkList in src/components/BookmarkList.tsx (renders items or EmptyState) and mount it in src/App.tsx (FR-005)

**Checkpoint**: US1 + US2 together = viable MVP (save, browse, open, persist).

---

## Phase 5: User Story 3 - Edit and delete bookmarks (Priority: P2)

**Goal**: User edits a bookmark's title/address (and notes/tags) with changes persisted, and deletes a bookmark after confirmation.

**Independent Test**: Edit a title and reload — change persists; delete a bookmark — confirm prompt appears, then it is gone and stays gone after reload.

### Tests for User Story 3

- [ ] T022 [P] [US3] Unit tests for repository `update` (re-validate, bump dateModified) and `remove` in tests/unit/bookmarkRepository.editdelete.test.ts
- [ ] T023 [P] [US3] Component test for edit flow and delete confirmation in tests/component/EditDelete.test.tsx

### Implementation for User Story 3

- [ ] T024 [US3] Implement `update` and `remove` in src/data/bookmarkRepository.ts (FR-007, FR-008; VR-005)
- [ ] T025 [US3] Extend BookmarkForm to support edit mode (prefill, save changes) in src/components/BookmarkForm.tsx (FR-007)
- [ ] T026 [P] [US3] Implement ConfirmDialog in src/components/ConfirmDialog.tsx (FR-008)
- [ ] T027 [US3] Add edit + delete actions to BookmarkItem/BookmarkList wired to form and ConfirmDialog in src/components/ (FR-007, FR-008)

**Checkpoint**: Bookmarks can be corrected and removed safely.

---

## Phase 6: User Story 4 - Organize and find bookmarks (Priority: P2)

**Goal**: User assigns tags, filters by tag, and searches by keyword across title/address/tags, with a clear no-results state.

**Independent Test**: Tag several bookmarks, filter by a tag (only matching show), search a keyword (matches show), search something absent (no-results state).

### Tests for User Story 4

- [ ] T028 [P] [US4] Unit tests for repository `list` with tag filter + keyword and `listTags` in tests/unit/bookmarkRepository.search.test.ts
- [ ] T029 [P] [US4] Component test for SearchBar + TagFilter behavior incl. no-results in tests/component/SearchFilter.test.tsx

### Implementation for User Story 4

- [ ] T030 [US4] Extend `list` to apply tag + keyword (AND) and implement `listTags` in src/data/bookmarkRepository.ts (FR-010, FR-011)
- [ ] T031 [P] [US4] Implement SearchBar in src/components/SearchBar.tsx (FR-011)
- [ ] T032 [P] [US4] Implement TagFilter in src/components/TagFilter.tsx driven by listTags (FR-010)
- [ ] T033 [US4] Wire search + tag filter into BookmarkList/App with no-results state in src/ (FR-011, FR-012)

**Checkpoint**: All four stories independently functional.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: End-to-end validation and finishing touches

- [ ] T034 [P] [US2] Playwright e2e smoke flow (save → find → open) in tests/e2e/smoke.spec.ts
- [ ] T035 [P] Basic responsive styling/layout pass across views in src/ (list, form, filter, search)
- [ ] T036 Verify performance target: list/search responsive with 1,000+ bookmarks (SC-004) — add a seed helper if useful
- [ ] T037 Run all quickstart.md manual validation scenarios and fix any gaps
- [ ] T038 [P] Write README with run/build/test instructions from quickstart.md

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately.
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories.
- **User Stories (Phases 3–6)**: All depend on Foundational. US1→US2→US3→US4 in priority order; US1+US2 form the MVP.
- **Polish (Phase 7)**: Depends on the targeted stories being complete.

### User Story Dependencies

- **US1 (P1)**: After Foundational. No dependency on other stories.
- **US2 (P1)**: After Foundational. Independent, but pairs with US1 for the MVP.
- **US3 (P2)**: After Foundational. Reuses BookmarkForm (US1) and list (US2) but is independently testable.
- **US4 (P2)**: After Foundational. Extends `list`/list UI; independently testable.

### Within Each User Story

- Tests written first and expected to fail before implementation.
- Repository (data) methods before the components that call them.
- Components before their wiring into App.

### Parallel Opportunities

- Setup: T003, T004, T005 in parallel.
- Foundational: T006, T007, T009 in parallel (T008 before repository work; T010 after types).
- Within a story, [P] tests and [P] components in different files run in parallel.
- Note: tasks touching `src/data/bookmarkRepository.ts` (T013, T018, T024, T030) and `src/App.tsx` (T010, T015, T021, T033) are the same-file serialization points — do not parallelize those with each other.

---

## Parallel Example: User Story 1

```bash
# Tests first (different files):
Task: "Unit tests for repository add/findByUrl in tests/unit/bookmarkRepository.add.test.ts"
Task: "Component test for BookmarkForm in tests/component/BookmarkForm.test.tsx"
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2)

1. Phase 1 Setup → 2. Phase 2 Foundational → 3. Phase 3 (US1 Save) → 4. Phase 4 (US2 Browse/Open).
5. **STOP and VALIDATE**: save, browse, open, persist all work. This is a usable product.

### Incremental Delivery

- MVP (US1+US2) → add US3 (edit/delete) → add US4 (tags/search) → Polish. Each story adds value without breaking prior ones.

---

## Notes

- [P] = different files, no dependencies.
- [Story] label maps each task to a spec.md user story for traceability.
- Verify tests fail before implementing.
- Commit after each task or logical group.
- Stop at any checkpoint to validate a story independently.
