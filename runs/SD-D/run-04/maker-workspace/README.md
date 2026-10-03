# Bookmark Manager

A single-user, desktop-first web app to save and manage bookmarks: rich metadata
capture, formatted notes, tags with suggestions, advanced search
(phrase / `#tag` / AND-OR-NOT with parentheses), read-later status, reversible
archiving, bulk actions over the complete current view, sorting, saved views,
page preservation (self-contained HTML, PDF, Internet Archive), standard browser
import/export, and display preferences.

Built per the spec in `specs/001-bookmark-manager/`.

## Requirements

- Node.js 24+
- (For e2e) Chromium via Playwright 1.61.0

## Run

```bash
npm install
npm start          # serves on http://0.0.0.0:4000
```

Open http://localhost:4000 (or `http://maker:4000` in the review environment).
Data is stored in `./data/` (SQLite `bookmarks.db` + preserved copies under
`data/preserved/`). All data is one shared collection — it persists across
restarts and browser visits and is never partitioned by session.

## Test

```bash
npm test           # unit + integration (node:test)
npm run test:e2e   # Playwright end-to-end flows
```

## Architecture

- `server.js` / `src/app.js` — Express server (JSON API + static front end).
- `src/db/` — SQLite schema, migrations, prepared-statement cache.
- `src/services/` — url normalization, metadata, search parser, sanitizer,
  preservation, import/export.
- `src/models/` — bookmark, tag, saved view, preferences persistence and the
  shared view-resolver used by both browse and bulk actions.
- `src/routes/` — thin HTTP adapters.
- `src/public/` — dependency-light single-page front end.

See `specs/001-bookmark-manager/contracts/api.md` for the HTTP API and
`specs/001-bookmark-manager/quickstart.md` for validation scenarios.
