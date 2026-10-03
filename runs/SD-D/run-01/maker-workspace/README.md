# Keepmark

Keepmark is a private, responsive bookmark manager. Paste a URL to retrieve its title, description, and icon; organize bookmarks with tags and notes; keep a read-later queue; search exact phrases and combined tags; archive links safely; and import or export your collection.

## Run locally

Requirements: Node.js 24.21 or newer and npm.

```bash
npm ci
npm run build
npm start
```

The production server listens on `0.0.0.0:4000` by default. Configuration is read from environment variables documented in `.env.example`. Database migrations run automatically at startup.

For development, run `npm run dev` for the API and `npx vite` for the client development server. The Vite server proxies `/api` to port 4000.

## Review account

There are no default credentials in production. To create a review account, set `REVIEW_EMAIL` and `REVIEW_PASSWORD`, then run:

```bash
npm run seed:review
```

For the prepared workspace review build:

- Email: `review@example.com`
- Password: `keepmark-review-2026`

## Validation

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run test:e2e
```

Unit and integration tests use temporary in-memory databases. Browser tests exercise the built application at desktop and mobile sizes.

## Security boundaries

- Every bookmark, tag, icon, import, and export query is scoped to the authenticated account.
- Passwords use asynchronous scrypt hashing. Session cookies are opaque, hashed in storage, HttpOnly, SameSite=Lax, and rotated on login.
- Server-side metadata retrieval rejects credentials, IP literals, local names, private/special DNS answers, mixed public/private answers, non-default ports, redirect cycles, and HTTPS downgrades. Fetches are DNS-pinned and bounded by time and size.
- Imported HTML is parsed as inert data. Scripts, styles, event handlers, unsupported URL schemes, and active icon formats are ignored or rejected.
- Page text is handled as plain text, and accepted icons are decoded and re-encoded as app-owned PNG files.

Use `COOKIE_SECURE=true` behind HTTPS in production. Keep the SQLite database and environment secrets outside public/static directories and include the database in operational backups.

## Portability

Browser-compatible HTML export is intended for Chrome, Edge, Firefox, Safari, and similar browsers. Complete JSON backup is the lossless format: it includes active and archived bookmarks, descriptions, notes, tags, favorite and reading states, dates, and app-owned icons. Complete backups restore only into an empty collection so restoration is predictable and atomic.

Saved copies of destination pages are deliberately not implemented in this release. They remain the next separately specified feature because page capture needs explicit storage, privacy, active-content, update, deletion, and content-rights policies.
