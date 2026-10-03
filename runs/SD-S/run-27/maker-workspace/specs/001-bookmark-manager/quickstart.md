# Quickstart & Validation: Bookmark Manager

How to run the app and validate that it satisfies the spec. Implementation details
live in `tasks.md` (Phase 2) and the code; this is a run/verify guide.

## Prerequisites

- Node.js 24 and npm (provided by the shared image).
- Playwright 1.61.0 for the e2e check (pinned to match shared browser binaries).

## Setup & run

```bash
cd /work
npm install
npm start          # starts the server on 0.0.0.0:4000
```

- App entry: `http://maker:4000/` (review) / `http://127.0.0.1:4000/` (VM capture).
- The SQLite file is created automatically at `data/bookmarks.db` on first run.

## Automated tests

```bash
npm test                       # unit + integration (node --test)
npx playwright test            # e2e primary-flow check
```

## Manual validation scenarios (map to spec)

1. **Save a bookmark (US1 / FR-001, FR-002, FR-003)**
   - Add a bookmark with an address only → it appears in the list, labeled by its
     address. Try to save with no address → rejected with a clear message.
2. **Persistence (FR-004 / SC-003)**
   - Restart the server (`npm start` again) → previously saved bookmarks are still
     listed.
3. **Browse, search, filter (US2 / FR-005, FR-006, FR-007, FR-012)**
   - With several bookmarks, type a keyword → list narrows to matches. Select a tag
     → only that tag's bookmarks show. Search for something absent → "no results"
     empty state appears.
4. **Edit & delete (US3 / FR-008, FR-009)**
   - Edit a bookmark's title/note/tags → changes persist. Delete a bookmark → a
     confirmation is required, then it disappears from the list and searches.
5. **Open (US4 / FR-010)**
   - Activate a bookmark → its original page opens in a new browser tab.
6. **Duplicate warning (FR-011)**
   - Save an address that already exists → a non-blocking warning is shown; the save
     still succeeds when confirmed.
7. **Empty states (FR-012)**
   - Fresh database → welcoming empty state inviting the first bookmark.

## Review readiness

Once running and validated, `/work/.harness/app.json` is set to
`{"kind":"application","port":4000,"path":"/","start_command":["npm","start"],"start_cwd":"/work"}`
and the loaded UI is marked `data-harness-ready="true"`.
