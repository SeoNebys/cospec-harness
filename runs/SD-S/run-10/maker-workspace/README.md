# Bookmark Manager

A single-user web app to save, browse, search, edit, delete, and tag bookmarks.
Bookmarks are stored locally in a SQLite file so they survive restarts.

## Requirements

- Node.js 24 and npm
- (For end-to-end tests) Playwright 1.61.0 — uses the shared browser binaries

## Run

```bash
npm install
npm start
```

The server listens on `0.0.0.0:4000`. In the review environment it is reachable
at `http://maker:4000/`. The SQLite database is created automatically at
`data/bookmarks.db` on first run.

## Test

```bash
node --test          # unit + integration (URL helpers, REST API)
npx playwright test  # end-to-end browser flows
```

## Structure

- `src/server.js` — Express app; serves the API under `/api` and the UI from `public/`
- `src/db.js` — SQLite connection and schema
- `src/repository.js` — data access (bookmarks + tags)
- `src/routes/bookmarks.js` — REST route handlers
- `src/lib/url.js` — URL validation and normalization
- `public/` — browser UI (HTML/CSS/JS)
- `tests/` — unit, integration, and end-to-end tests

See `specs/001-bookmark-manager/` for the specification, plan, and API contract.
