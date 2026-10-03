# Bookmark Manager

A single-user, local-only web app to save and manage bookmarks. Built with
Node.js, Express, and SQLite; the browser UI is dependency-free vanilla JS.

## Features

- Save a bookmark by URL (optional title, description, tags); title auto-derived
- Browse all bookmarks, open in a new tab
- Edit (including the address) and delete with confirmation
- Read-later / unread tracking with a dedicated view
- Archive and restore, with a dedicated archive view
- Search by keyword and filter by tag
- Saving an existing address opens that bookmark for editing (no duplicates)

## Run

```bash
npm install
npm start          # http://localhost:4000
```

The SQLite database is created at `data/bookmarks.db` on first run.

## Test

```bash
npm test           # unit + integration (node --test)
npm run test:e2e   # Playwright end-to-end flows (requires a browser)
```

## Layout

- `src/server.js` — Express app + entry point (binds 0.0.0.0:4000)
- `src/db/` — SQLite connection and schema
- `src/models/bookmarks.js` — data access, validation, view/search logic
- `src/services/` — URL normalization, best-effort title derivation
- `src/api/routes.js` — REST API under `/api`
- `src/web/` — single-page browser UI
- `specs/001-bookmark-manager/` — spec, plan, tasks, and design docs
