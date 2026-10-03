# Bookmark Manager

A single-user web app to save and manage bookmarks with automatic page
enrichment (title, description, favicon, preview), tags, notes, search, and
tag filtering.

## Run

```bash
npm install
npm start
```

The server listens on `http://0.0.0.0:4000` and serves the UI at `/`.
Bookmarks are stored locally in `data/bookmarks.db` (SQLite) and survive
restarts.

## Test

```bash
npm test          # unit + API tests (node --test)
npm run test:e2e  # Playwright smoke (start `npm start` first)
```

## How it works

- **Backend**: Express (`src/server.js`) exposing a JSON REST API under `/api`
  (see `specs/001-bookmark-manager/contracts/rest-api.md`).
- **Storage**: SQLite via Node's built-in `node:sqlite` (`src/db.js`, `src/repository.js`).
- **Enrichment**: best-effort, server-side, non-blocking metadata fetch
  (`src/enrichment.js`). A save always succeeds even if the page can't be
  reached; details fill in shortly after.
- **Frontend**: dependency-free HTML/CSS/JS in `public/`.

Built with Spec-Driven Development; see `specs/001-bookmark-manager/` for the
spec, plan, and tasks.
