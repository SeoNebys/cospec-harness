# Keepsake

A private, single-user bookmark library with automatic page details, strict deduplication, read-later and archive workflows, formatted notes, expressive and saved searches, bulk actions, browser HTML import/export, and display preferences.

## Run

```bash
npm ci
npm run db:migrate
npm run build
npm start
```

Open `http://maker:4000` in the review environment. Set `DATABASE_PATH` to choose another writable SQLite database.

## Validate

```bash
npm run lint
npm run typecheck
npm test
PLAYWRIGHT_BROWSERS_PATH=/opt/playwright-browsers npm run test:e2e
```

## Data and deployment

The default database is `data/bookmarks.db`. This release has no authentication and must remain in a trusted private environment. It is not safe for public or multi-user deployment.

For a consistent backup of a running database, use SQLite's backup API or `VACUUM INTO` rather than copying only the main file while WAL mode is active. Restore while the application is stopped, retaining a backup of the current data directory until the restored database has been verified.

Browser HTML exports preserve portable bookmark fields. They cannot reliably preserve read/archive state, rich notes, saved searches, or display preferences.
