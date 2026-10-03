# Implementation Plan: Bookmark Manager

**Branch**: `[001-bookmark-manager]` | **Date**: 2026-09-23 | **Spec**: [spec.md](spec.md)

**Input**: Approved feature specification from `specs/001-bookmark-manager/spec.md`

## Summary

Build a responsive, accessible single-page bookmark manager that saves a personal collection in the browser. A React and TypeScript client will keep UI and form state explicit, while a narrow asynchronous repository backed by IndexedDB will provide durable, transactional CRUD operations. Pure domain functions will normalize URLs and tags, detect duplicates, search, filter, and sort. Layered automated tests will cover the approved behavior without introducing a backend, accounts, or synchronization.

## Technical Context

**Language/Version**: TypeScript 5.x on Node.js 24 for development and builds

**Primary Dependencies**: React 19, Vite 7; no router, server framework, or application state library

**Storage**: Browser IndexedDB, accessed only through an asynchronous `BookmarkRepository`

**Testing**: Vitest, React Testing Library, `user-event`, `fake-indexeddb`, axe accessibility checks, and Playwright 1.61.0

**Target Platform**: Current evergreen desktop and mobile browsers; production preview served on `0.0.0.0:4000`

**Project Type**: Client-only web application

**Performance Goals**: Search/filter results visible within 1 second for 1,000 bookmarks; initial usable collection view within 2 seconds under normal local conditions

**Constraints**: WCAG 2.2 AA target; keyboard-complete workflows; browser-local/offline CRUD after initial load; no account, backend, sync, import/export, page scraping, or link-health service

**Scale/Scope**: One collection screen, add/edit form, duplicate/delete confirmations, 5–8 focused UI components, and up to 1,000 bookmarks in the acceptance dataset

## Constitution Check

*GATE: Passed before research and re-checked after design.*

- The project constitution is still an unratified template and imposes no additional technical gates.
- Repository instructions require spec-driven development. The specification is approved, this plan is presented for approval, and task generation and implementation remain gated.
- The design is limited to the approved personal, single-user scope. No unapproved accounts, sharing, synchronization, metadata fetching, or server components are introduced.
- Requirements remain traceable through the UI contract and quickstart scenarios; tests are planned at domain, repository, component, accessibility, and end-to-end levels.
- Post-design re-check: passed. The data model and UI contract preserve the approved scope and introduce no constitutional violation.

## Project Structure

### Documentation (this feature)

```text
specs/001-bookmark-manager/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── ui-contract.md
└── tasks.md               # Created only after plan approval
```

### Source Code (repository root)

```text
src/
├── app/
│   ├── App.tsx
│   └── app.css
├── components/
│   ├── BookmarkCard.tsx
│   ├── BookmarkForm.tsx
│   ├── BookmarkList.tsx
│   ├── ConfirmDialog.tsx
│   ├── EmptyState.tsx
│   └── SearchAndFilter.tsx
├── domain/
│   ├── bookmark.ts
│   ├── bookmarkSearch.ts
│   ├── tagNormalization.ts
│   └── urlNormalization.ts
├── storage/
│   └── bookmarkRepository.ts
├── test/
│   └── setup.ts
└── main.tsx

tests/
├── e2e/
│   └── bookmark-workflows.spec.ts
├── integration/
│   └── bookmarkRepository.test.ts
├── unit/
│   ├── bookmarkSearch.test.ts
│   ├── tagNormalization.test.ts
│   └── urlNormalization.test.ts
└── accessibility/
    └── bookmark-ui.test.tsx

index.html
package.json
vite.config.ts
playwright.config.ts
```

**Structure Decision**: Use one client application with domain and persistence boundaries inside `src/`. IndexedDB access stays isolated behind the repository so UI tests can substitute a deterministic in-memory implementation and storage choices can change without rewriting components.

## Delivery and Verification Strategy

1. Establish the typed domain model, normalization rules, and repository contract.
2. Implement IndexedDB CRUD and load handling, committing storage operations before reflecting success in the interface.
3. Build the collection, forms, search/tag controls, empty states, and confirmation flows using native semantic controls.
4. Add responsive styling and explicit loading, success, error, and focus behavior.
5. Verify pure rules with unit tests, persistence with integration tests, user behavior with component tests, and approved journeys with Playwright.
6. Build the production bundle, configure the port-4000 harness entry, and run the quickstart validation before review.

## Complexity Tracking

No constitution violations or exceptional complexity require justification.
