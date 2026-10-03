# Keepsake

Keepsake is a private, responsive bookmark manager for saving links, suggesting page titles, organizing with tags and favorites, searching, archiving, and permanent deletion with confirmation.

## Run locally

Requires Node.js 24.x.

```bash
npm ci
cp .env.example .env
npm run build
npm start
```

The production-shaped server listens on `0.0.0.0:4000` by default and stores its SQLite database at `/work/data/bookmarks.db`. Open `http://maker:4000/` from the review environment or `http://127.0.0.1:4000/` from local browser automation.

Create an account from the entry screen; no external identity or service credentials are needed.

## Development and verification

```bash
npm run dev
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
```

Database migrations run transactionally at server startup. Runtime data, environment files, reports, coverage, and builds are ignored by version control.

## Automatic title security

Title previews run on the server because browsers cannot reliably read metadata across origins. The fetcher accepts only HTTP(S), blocks localhost and non-public IPv4/IPv6 destinations, validates all DNS answers, pins the validated address, revalidates each redirect, sends no cookies or credentials, allows at most three redirects, stops after five seconds or one MiB, and parses only HTML titles. Fetched markup is never rendered or stored. Failure returns a manual-title fallback and never blocks saving.

## Data and session boundaries

- Every bookmark and tag query is scoped to the authenticated owner.
- Passwords use asynchronous scrypt with random salts.
- Session cookies are opaque, HttpOnly, SameSite=Lax, server-revocable, and Secure in production.
- State-changing cross-origin requests are rejected.

See [the validated feature guide](specs/001-manage-bookmarks/quickstart.md) for the full acceptance scenarios.
