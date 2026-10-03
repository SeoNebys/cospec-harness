# Quickstart & Validation: Bookmark Manager

**Feature**: 001-bookmark-manager
**Date**: 2026-09-27

This guide validates that the feature works end-to-end. It references the
[API contract](contracts/api.md) and [data model](data-model.md) rather than
repeating them.

## Prerequisites

- Node.js 24 and npm (provided by the environment).
- Playwright `1.61.0` (pinned) using the shared browsers at
  `/opt/playwright-browsers`.

## Setup

```bash
cd /work
npm install        # installs dependencies, preserves package-lock.json
npm run build      # if a build step exists (no-op otherwise)
```

## Run

```bash
npm start          # starts the server on 0.0.0.0:4000
```

- App (client): `http://maker:4000/`
- VM capture: `http://127.0.0.1:4000/`
- The page marks `data-harness-ready="true"` after the initial list (or empty
  state) loads.

## Validation scenarios

Map to the spec's acceptance scenarios and success criteria.

1. **Save a bookmark (US1 / FR-001–003)**: Open the app, submit a valid URL, and
   confirm it appears in the list with a title (or the URL as fallback).
2. **Reject invalid input (US1 / FR-002)**: Submit non-URL text; confirm a clear
   error and that typed input is preserved.
3. **Duplicate warning (FR-013)**: Save the same URL twice; confirm the second
   attempt is warned and not silently duplicated.
4. **Browse & search (US2 / FR-006, FR-007)**: With several bookmarks, confirm
   newest-first order; search a keyword and confirm only matches show; search a
   nonsense term and confirm a "no results" message.
5. **Open (US2 / FR-009)**: Click a bookmark and confirm it opens the original
   page in a new tab.
6. **Tags & notes (US3 / FR-004, FR-005, FR-008)**: Add tags and a note; filter
   by a tag and confirm only tagged bookmarks show.
7. **Edit & delete (US4 / FR-010, FR-011)**: Edit a title and confirm it persists;
   delete a bookmark, confirm the confirmation step, and confirm removal.
8. **Persistence (FR-012 / SC-005)**: Restart the server and confirm all saved
   bookmarks are still present.

## Automated checks

```bash
npm test                       # node:test API/integration suite
npx playwright test            # Playwright e2e smoke (save → list → search)
```

## Review artifacts

Any post-action screenshots for the client are saved under `prototypes/` and
named in the review guidance, per project conventions.
