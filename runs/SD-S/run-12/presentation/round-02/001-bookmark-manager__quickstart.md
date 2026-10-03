# Quickstart & Validation: Bookmark Manager

**Feature**: 001-bookmark-manager

This guide validates the feature end-to-end. It references
[contracts/api.md](./contracts/api.md) and [data-model.md](./data-model.md); it does
not restate implementation code.

## Prerequisites

- Node.js 24 and npm (image-provided).
- Playwright `1.61.0` for the browser check (image-provided; shared browsers at
  `/opt/playwright-browsers`).

## Setup

```bash
cd /work
npm install        # installs dependencies, preserves lockfile
```

## Run

```bash
npm start          # foreground server on 0.0.0.0:4000
```

- Review URL: `http://maker:4000/` (VM capture uses `http://127.0.0.1:4000/`).
- The root page sets `data-harness-ready="true"` once the initial list or empty state
  has loaded.

## Automated checks

```bash
npm test           # node:test unit/API suite + Playwright e2e flow
```

Unit/API suite covers: url normalization & validation (FR-002/FR-003), create/list/
update/delete (FR-001/FR-005/FR-007/FR-008), duplicate warning (FR-013), search &
tag filter (FR-010/FR-011), default ordering (FR-014).

## Manual validation scenarios (map to acceptance scenarios)

1. **Save (US1)**: open app → enter `example.com`, title "Example" → save. Expect a
   bookmark shown as "Example" with url `https://example.com`. Saving an invalid value
   (e.g. `not a url`) shows an error and creates nothing.
2. **Browse & open (US2)**: reload the app → saved bookmark still listed; activating it
   opens `https://example.com` in a new tab. With no bookmarks, an empty state explains
   how to add the first one.
3. **Edit & delete (US3)**: edit the title → list reflects the change. Delete → confirm
   prompt appears → after confirming, the bookmark is gone and stays gone after reload.
4. **Organize & find (US4)**: add tags, type a keyword → list narrows to matches; filter
   by a tag → only tagged bookmarks show; a non-matching keyword shows a "no results"
   state.

## Expected outcomes

- All automated checks pass.
- Persistence: bookmarks created before a server restart are present after it
  (SC-004) — the SQLite file under `data/` is the source of truth.
- Success criteria SC-001..SC-005 are demonstrable via the scenarios above.
