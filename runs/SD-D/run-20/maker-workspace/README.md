# Pinboard bookmark manager

Pinboard is a private, single-user bookmark library. Paste a web address and it safely retrieves editable page details, then lets you organize the result with read-later states, reusable tags, formatted notes, advanced search, sorting, bulk actions, and a reversible archive.

## Run locally

Requires Node.js 24 and npm.

```bash
npm ci
npm run db:migrate
npm run build
npm start
```

The server listens on `0.0.0.0:4000` by default. Open `http://maker:4000/` in the review environment. Set `HOST` or `PORT` to override those defaults, and set `BOOKMARK_DB_PATH` to use a different SQLite file.

## Verify

```bash
npm run lint
npm run typecheck
npm test
npm run test:integration
npm run test:contract
npm run test:e2e
npm run test:accessibility
npm run test:performance
```

Playwright uses the image's installed Chromium 1.61 revision. Metadata network tests use injected deterministic transports; production metadata retrieval validates every resolved address and redirect before connecting.

## Data and backup

Persistent data lives in `data/bookmarks.sqlite` (plus SQLite `-wal`/`-shm` files while running) and accepted cached images live in `data/assets/`. Stop the server, then copy both the database and assets directory together for a consistent backup. Restore them to the same paths before starting the app.

Migrations in `db/migrations/` run automatically at startup and through `npm run db:migrate`. Never edit an already-applied migration in a deployed copy; add a numbered migration instead.

## Scope

This release intentionally targets one person on one device. Account login, cross-device sync, saved offline page copies, reusable saved searches, and browser bookmark import/export are deferred. The approved behavior and technical design live in `specs/001-bookmark-manager/`.
