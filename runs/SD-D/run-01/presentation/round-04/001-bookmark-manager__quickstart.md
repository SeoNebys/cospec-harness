# Quickstart & Validation Guide: Bookmark Manager

How to run the app locally and validate that each user story works end-to-end. Detailed
field/endpoint definitions live in [data-model.md](./data-model.md) and
[contracts/api.md](./contracts/api.md).

## Prerequisites

- Python 3.11+ and Node.js 20+ installed.
- No accounts, servers, or network services to configure — the app runs locally and
  stores everything in a local SQLite file.

## Setup & run

```bash
# Backend (from repo root)
cd backend
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -e .
uvicorn src.api.main:app --reload        # serves the API on http://localhost:8000

# Frontend (in a second terminal)
cd frontend
npm install
npm run dev                              # serves the UI on http://localhost:5173
```

Open the UI URL in your browser. On first launch the SQLite file is created automatically
and you see the empty state (FR-013).

## Validation scenarios

Each scenario maps to a user story / acceptance scenario in [spec.md](./spec.md).

### US1 — Save a bookmark (P1)
1. Paste a URL and save. → Bookmark appears with fetched title + favicon (FR-002/a).
2. Save a URL whose page is unreachable. → Still saved, address shown as title.
3. Save a URL you already saved. → App opens the existing bookmark for editing (FR-004).
4. Enter non-URL text and save. → Rejected with a clear message (FR-003).

### US2 — Browse & open (P1)
1. With several bookmarks saved, reload. → All listed with title + address (persisted, FR-005).
2. Click a bookmark. → Its page opens in the browser (FR-007).
3. Delete all, view list. → Empty state invites adding the first bookmark (FR-013).

### US3 — Edit & delete (P2)
1. Edit a title/address, save, reload. → Change persists (FR-008).
2. Delete a bookmark, confirm. → Removed. Cancel instead. → Nothing changes (FR-009).

### US4 — Organize with tags & search (P2)
1. Add tags to bookmarks; filter by a tag. → Only that tag's bookmarks show (FR-011).
2. Search a word that appears only in a note, using different letter case. → The bookmark
   is found (case-insensitive note search, FR-012).
3. Start typing a tag. → Already-used tags are suggested (FR-010a).
4. Toggle sort between newest and alphabetical. → Order changes accordingly (FR-014).

### US5 — Import browser bookmarks (P3)
1. Export bookmarks from your browser (a `bookmarks.html` file). Import it. → Bookmarks
   appear; folder names became tags; original dates preserved; summary shows added vs
   skipped (FR-016, FR-016a/b).
2. Import a non-bookmark file. → Rejected, nothing imported (FR-017).

### US6 — Export bookmarks (P3)
1. Export. → A bookmark file downloads. Re-import it here (all present, no duplicates) and
   into a browser (recognized). Confirms the round-trip (FR-018, SC-008).
2. Export with zero bookmarks. → A valid, empty file downloads without error.

## Automated test entry points

- Backend: `cd backend && pytest`  (unit, integration, contract tests)
- Frontend: `cd frontend && npm test`  (component tests) and `npm run e2e` (Playwright flows)
