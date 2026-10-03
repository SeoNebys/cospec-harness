# Lattice Bookmarks

Lattice is a private bookmark manager. Paste an HTTP or HTTPS address and it safely retrieves the page title, description, and raster icon when available; an unreachable page is still saved with a readable fallback title. The library also supports notes, tags, favorites, full-text search, combined filters, editing, archive/restore, and confirmed permanent deletion.

## Requirements

- Node.js 24 or newer and npm
- A writable directory for the SQLite database
- Chromium at `/opt/playwright-browsers` for the included browser tests

## Local setup

```bash
npm ci
cp .env.example .env
npm run db:migrate
SEED_REVIEW_USER=true npm run db:seed
npm run build
npm start
```

The production server listens on `0.0.0.0:4000`. In the review environment, open `http://maker:4000/bookmarks`.

The optional seeded review account is:

- Email: `reviewer@example.com`
- Password: `Review-Bookmark-2026!`

Change or remove this account before a real deployment.

## Configuration

Copy `.env.example` and set a unique, high-entropy `BETTER_AUTH_SECRET` in every deployed environment. `APP_BASE_URL` and `TRUSTED_ORIGIN` must match the public application origin. `DATABASE_PATH` identifies the persistent SQLite file.

Password recovery uses the in-memory mail sink in local development. Production deployments should set `MAIL_TRANSPORT=smtp` and provide `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, and `SMTP_FROM`. Reset links are intentionally not exposed through an application endpoint or written to logs.

## Operations

```bash
npm run db:migrate
npm run db:rebuild-search
npm run db:backup -- --dry-run
npm run db:backup -- --output=/path/to/bookmarks.db.bak
npm run db:cleanup-icons -- --dry-run
npm run db:cleanup-icons
```

Run migrations before each release. The backup command checkpoints the write-ahead log before copying the database. Schedule tested backups outside the application data directory and periodically exercise restore procedures. Icon cleanup supports a dry run and removes only unreferenced icon blobs.

The shallow health endpoint is `GET /api/health`; it confirms that the process can query SQLite without exposing internal details.

## Verification

```bash
npm run lint
npm run typecheck
npm test
npm run test:contract
PLAYWRIGHT_BROWSERS_PATH=/opt/playwright-browsers npm run test:e2e
npm run test:performance
npm audit --audit-level=low
```

The browser suite creates and resets `/work/data/e2e.db`; it does not alter the main review database. Unit and integration tests use isolated in-memory databases where applicable.

## Security model

Every bookmark query and mutation is scoped to the authenticated owner. Mutation requests require a trusted origin, and missing and cross-account resources share the same not-found response. Metadata retrieval accepts only HTTP(S), rejects embedded credentials, validates every resolved address and redirect, blocks non-public destinations, caps time and response sizes, and never retries. Page content is parsed as untrusted data and rendered as text. Raster icons are signature-checked, size-limited, deduplicated, and delivered only through an authorized endpoint.

