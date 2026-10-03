# Quickstart & Validation: Bookmark Manager

This guide validates the feature end-to-end. It references
[the API contract](./contracts/rest-api.md) and [data model](./data-model.md)
rather than restating them.

## Prerequisites

- Node.js 24 and npm (shared image).
- Dependencies installed: `npm install` (installs Express, better-sqlite3,
  node-html-parser, and dev-only Playwright pinned to `1.61.0`).
- Native module `better-sqlite3` builds using the image's C/C++ toolchain.

## Run the app

```bash
npm start
```

- Server listens on `0.0.0.0:4000` and serves the UI at `/`.
- Reviewer URL: `http://maker:4000/`. VM capture uses `http://127.0.0.1:4000/`.
- The app shell sets `data-harness-ready="true"` once the initial bookmark list
  (or the empty state) has loaded.
- Runtime declaration lives in `/work/.harness/app.json`
  (`kind: application`, port 4000, `start_command: ["npm","start"]`).

## Automated checks

```bash
npm test          # node --test: URL validation/normalization, metadata parsing, REST behavior
npm run test:e2e  # Playwright smoke of the primary journeys (Chromium)
```

## Manual validation scenarios (map to spec)

1. **Save with enrichment (US1 / FR-001, FR-007, FR-008)**
   - Add a reachable URL with Open Graph tags. Expect: it appears newest-first;
     title/description/favicon/preview populate shortly after saving; the save
     itself returns promptly.
   - Add an unreachable URL. Expect: the bookmark is still saved; enrichment
     fields are empty/fallback; `enrichmentStatus` becomes `failed`.

2. **Browse & open (US2 / FR-005, FR-006, FR-015)**
   - With several bookmarks, the list shows title/address/favicon/tags/preview;
     clicking opens the original page in a new tab. With none saved, a friendly
     empty state is shown.

3. **Tags & notes (US3 / FR-010, FR-011)**
   - Add two tags and a note; reload and confirm they persist. Start typing a
     tag and confirm existing tags are suggested. Remove a tag.

4. **Edit, delete, refresh (US4 / FR-012, FR-013, FR-014)**
   - Edit title/address/description/tags/note; confirm persistence and that
     manual edits override auto-filled values. Delete with confirmation (cancel
     leaves it; confirm removes it permanently). Trigger refresh and confirm
     enrichment re-runs.

5. **Duplicate → edit (FR-009, SC-004)**
   - Save an already-saved address (including a trivially different form like a
     trailing slash). Expect: not rejected outright — the app opens the existing
     bookmark for editing.

6. **Search & filter (US5 / FR-016, SC-003)**
   - Search a keyword found in a note/description/tag/title/address and confirm
     only matches show. Filter by a tag. Clear to restore the full list. A
     no-match search shows a clear "no results" message.

7. **Persistence (FR-004, SC-002)**
   - Restart the server (`npm start` again) and confirm all bookmarks and their
     details remain.

## Expected outcomes

- All manual scenarios pass; `npm test` and `npm run test:e2e` are green.
- Invalid addresses are rejected with a clear message; duplicates route to edit.
- Enrichment failures never prevent a save.
