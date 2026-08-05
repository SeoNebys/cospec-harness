# Quickstart & Validation: Bookmark Manager

A run/validation guide proving the feature works end-to-end. Implementation
details live in `tasks.md`; this file describes how to run and what to observe.

## Prerequisites

- Node.js 22 LTS and a package manager (npm)
- A modern web browser

## Setup

```text
# from repo root
(backend)  install deps, then start the API server
(frontend) install deps, then start the dev server
```

The backend creates its SQLite database file on first run; no external services
are required.

## Run

- Start the backend API, then the frontend dev server.
- Open the frontend URL in a browser.

## Validation scenarios

Each scenario maps to a user story / acceptance scenario in [spec.md](./spec.md).
See [contracts/api.md](./contracts/api.md) and [data-model.md](./data-model.md)
for the underlying shapes.

### V1 — Effortless capture (User Story 1, P1)
1. Paste a reachable URL with standard metadata (e.g. a news article) into the add form.
2. **Expect**: the title and a preview (description + thumbnail if present) populate automatically without typing; a brief "fetching…" state may show first.
3. Save. **Expect**: the bookmark appears in the collection with the fetched title.
4. Paste a URL, edit the title before saving. **Expect**: the saved bookmark uses your edited title (FR-015).
5. Paste an unreachable/metadata-less URL. **Expect**: you can still save; label falls back to the address and you can type a title (FR-016). Saving completes within ~5s regardless (SC-007).
6. Enter a non-URL. **Expect**: rejected with a clear message; nothing saved (FR-002).

### V2 — Browse & find (User Story 2, P2)
1. With several bookmarks saved, open the app. **Expect**: list ordered newest-first (FR-005).
2. Search a word in one bookmark's title. **Expect**: only matching bookmarks shown (FR-006).
3. Search a term that matches nothing. **Expect**: a clear "no results" message (FR-007).
4. Open the app with an empty collection. **Expect**: a helpful empty state (FR-007).

### V3 — Organize with tags (User Story 3, P3)
1. Add one or more tags to a bookmark. **Expect**: tags stored and displayed (FR-008).
2. Filter by a tag. **Expect**: only bookmarks with that tag shown (FR-009).
3. Remove a tag from one bookmark. **Expect**: it disappears from that tag's filter; other bookmarks with the tag are unaffected.

### V4 — Edit & delete (User Story 4, P3)
1. Edit a bookmark's title/note; reload. **Expect**: changes persist (FR-010, SC-005).
2. Delete a bookmark. **Expect**: a confirmation prompt precedes removal (FR-011).
3. Confirm. **Expect**: the bookmark is gone.

### V5 — Duplicate handling (edge case)
1. Save a URL, then save the same URL again (including a trivially different form). **Expect**: a warning that it is already saved rather than a silent duplicate (FR-012); you may proceed if you choose.

## Automated coverage

- Unit/integration (Vitest): URL validation, normalization/duplicate detection, metadata parsing, tag normalization, search, API routes.
- End-to-end (Playwright): scenarios V1–V5 above.
