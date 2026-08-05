# Implementation Plan: Bookmark Manager

**Branch**: `001-bookmark-manager` | **Date**: 2026-07-13 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-bookmark-manager/spec.md`

## Summary

A personal, single-user bookmark manager that runs entirely on the user's own
computer with no accounts, no login, and no backend server. The user saves web
addresses, gives them titles and tags, browses and opens them, edits and deletes
them, and searches/filters to find them. All data persists locally in the
browser on the user's device.

Technical approach: a single-page web application built with TypeScript + React
(via Vite), storing bookmarks in the browser's IndexedDB through a thin data
layer. No network calls, no server component — the app is a static bundle the
user opens in their browser. This is the smallest architecture that satisfies
every functional requirement while honoring the "on my own computer, no login"
scope.

## Technical Context

**Language/Version**: TypeScript 5.x

**Primary Dependencies**: React 18, Vite (build/dev server), Dexie (thin
IndexedDB wrapper)

**Storage**: Browser IndexedDB (local, on-device) via Dexie

**Testing**: Vitest + React Testing Library (unit/component); Playwright (one
end-to-end smoke flow)

**Target Platform**: Modern desktop web browser (Chrome/Firefox/Edge/Safari,
current versions)

**Project Type**: Single-page web application, static bundle, no backend

**Performance Goals**: Bookmark list and search results render within 1 second
with 1,000+ stored bookmarks (SC-004)

**Constraints**: Fully offline-capable; no network requests; no user accounts;
all data stays on the user's device

**Scale/Scope**: One user, personal collection up to a few thousand bookmarks;
~4 primary screens/views (list, add/edit form, tag filter, search)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

The project constitution (`.specify/memory/constitution.md`) is an unpopulated
template with no ratified principles. There are therefore **no constitutional
gates to evaluate**, and nothing in this plan conflicts with the placeholder
structure.

- **Initial check (pre-research)**: PASS (no active principles).
- **Post-design re-check (after Phase 1)**: PASS (design introduces no new
  complexity beyond a single static SPA; see Complexity Tracking — empty).

## Project Structure

### Documentation (this feature)

```text
specs/001-bookmark-manager/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (data-layer contract)
│   └── data-layer.md
└── tasks.md             # Phase 2 output (/speckit-tasks — not created here)
```

### Source Code (repository root)

```text
index.html               # App entry (Vite)
package.json
vite.config.ts
tsconfig.json

src/
├── main.tsx             # React bootstrap
├── App.tsx              # Top-level layout / routing between views
├── models/
│   └── bookmark.ts      # Bookmark & Tag types, validation helpers
├── data/
│   ├── db.ts            # Dexie database definition (schema, indexes)
│   └── bookmarkRepository.ts  # CRUD + search/filter operations (the contract)
├── components/
│   ├── BookmarkList.tsx
│   ├── BookmarkItem.tsx
│   ├── BookmarkForm.tsx      # add + edit
│   ├── TagFilter.tsx
│   ├── SearchBar.tsx
│   ├── EmptyState.tsx
│   └── ConfirmDialog.tsx     # delete confirmation
└── lib/
    └── url.ts           # address validation & normalization, title fallback

tests/
├── unit/                # models, url validation, repository logic (Vitest)
├── component/           # component behavior (React Testing Library)
└── e2e/                 # one Playwright smoke flow: save → find → open
```

**Structure Decision**: Single project, single-page web application. There is no
backend, so the Option-2 (frontend+backend) and Option-3 (mobile+API) layouts
are not used. All application code lives under `src/`, tests under `tests/`,
mirroring the three test layers (unit / component / e2e).

## Complexity Tracking

> No constitutional violations. No complexity to justify. This section is
> intentionally empty.
