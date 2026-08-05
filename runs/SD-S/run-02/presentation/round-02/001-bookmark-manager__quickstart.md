# Quickstart & Validation Guide: Bookmark Manager

How to run the app and validate that the feature works end-to-end. Implementation
details live in `tasks.md`; this is a run/validation guide.

## Prerequisites

- Node.js 20 LTS and npm
- A modern desktop browser

## Setup

```bash
# from repo root
cd backend && npm install
cd ../frontend && npm install
```

## Run (development)

```bash
# terminal 1 — backend API (creates data/bookmarks.db on first run)
cd backend && npm run dev

# terminal 2 — frontend SPA (proxies /api to the backend)
cd frontend && npm run dev
```

Open the SPA URL printed by Vite (e.g. http://localhost:5173).

## Validation scenarios (map to spec user stories)

### US1 — Save a bookmark (P1)
1. Enter `https://example.com` with no title → save.
2. **Expect**: bookmark appears in the list with a derived title (or the URL if none).
3. Enter `not-a-url` → save → **Expect**: rejected with a clear message (FR-002).

### US2 — Browse & open (P1)
1. With bookmarks saved, reload the app → **Expect**: all listed with title + address (persistence, FR-005).
2. Click a bookmark → **Expect**: original page opens (FR-007).
3. Clear all bookmarks → **Expect**: empty state inviting the first save (FR-008).

### US3 — Organize & find (P2)
1. Save several bookmarks with tags.
2. Type a search term → **Expect**: only matching title/url/tag results (FR-010).
3. Select a tag → **Expect**: only bookmarks with that tag (FR-011).

### US4 — Edit & delete (P2)
1. Edit a bookmark's title and tags, save → **Expect**: changes persist (FR-012).
2. Delete a bookmark → confirm → **Expect**: removed from list (FR-013).
3. Click Undo before the window elapses → **Expect**: bookmark restored (FR-014).

### Edge cases
- Save an already-saved address → **Expect**: duplicate warning offering open/update (FR-015).
- Save an unreachable URL → **Expect**: save still succeeds; title falls back to URL.

## Automated checks

```bash
cd backend && npm test        # unit + API contract/integration
cd frontend && npm test       # component/unit
cd frontend && npm run e2e     # Playwright user journeys (US1–US2 minimum)
```

## Success-criteria spot checks
- Save flow completes in well under 15s (SC-001).
- Seed 500+ bookmarks; search returns a target in seconds (SC-002); list stays
  responsive at 2,000+ (SC-005).
