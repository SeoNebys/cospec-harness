# Keep — Personal Bookmark Manager

Keep is a single-user web application for saving, organizing, finding, and maintaining useful links. It supports manual titles, notes, case-insensitive tags, literal search, match-all tag filters, favorite/archive filters, sorting, favorites, archive/restore, editing, duplicate detection, and confirmed permanent deletion.

Automatic title retrieval, accounts, sharing, import/export, synchronization, folders, and browser extensions are intentionally outside version 1.

## Requirements

- Node.js 24.15 or newer
- npm
- A writable `data/` directory

## Install, verify, and run

```bash
npm ci
npm run build
npm run format:check
npm run lint
npm run typecheck
npm test
npm run test:integration
PLAYWRIGHT_BROWSERS_PATH=/opt/playwright-browsers npm run test:e2e
npm start
```

The prepared application listens on `0.0.0.0:4000` by default. Set `PORT` to override the port and `DATABASE_PATH` to use another SQLite file.

## Data and backup

Runtime data is stored in `data/bookmarks.sqlite` unless `DATABASE_PATH` is set. Stop the application before copying the database and its possible `-wal`/`-shm` companions for backup. Runtime database files are ignored by version control. Startup applies numbered migrations from `migrations/` before accepting traffic.

Tests use temporary or `.tmp/` databases and never expose a production reset endpoint.

## Validation

The test suite includes normalization and schema boundaries, repository behavior, API contracts, React interactions, complete browser journeys, automated accessibility checks, persistence, and the 5,000-bookmark scale target. The manual accessibility checklist in `specs/001-bookmark-manager/quickstart.md` supplements automated scans.

## Future title assistance

Version 1 intentionally requires a title. A future specification can add safe metadata retrieval that proposes a page title while defining network timeouts, private-network protections, error fallback, and metadata quality behavior.
