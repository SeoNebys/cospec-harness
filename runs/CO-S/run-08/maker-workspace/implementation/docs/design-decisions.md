# Design-decision record — cycle 1

Lightweight record to support later-cycle impact analysis and, if requested,
generation of traditional design/test artifacts.

## Architecture

- **Single Node.js/Express service** serves both the JSON API and the static
  frontend, on one port (4000). Chosen for simplicity: one owner, one deployable.
- **Frontend**: plain HTML/CSS/vanilla JS single page (`public/`), two views
  (auth, app) toggled client-side after checking `/api/session`. No framework —
  keeps the build trivial and the review server a plain `node` start.
- **Persistence**: a single JSON document (`data/db.json`) via `src/store.js`,
  written atomically (temp file + rename). Chosen over SQLite to avoid native
  build steps; adequate for a single-owner dataset. Central server-side storage
  is what makes bookmarks appear on every device (SCN-011).
  - Alternative dropped: `better-sqlite3`/`node:sqlite` — more machinery than a
    single-user store needs; native/experimental risk in this trial.

## Authentication (SCN-011)

- **Single account.** Registration is allowed only when no account exists; after
  that the endpoint returns `409 account_exists`. There is no multi-user model
  (client: "just for me").
- **Passwords** hashed with `bcryptjs` (pure JS, no native build).
- **Sessions**: opaque random token in an httpOnly cookie (`sid`); server stores
  the token with an optional expiry. "Keep me signed in" → 30-day persistent
  cookie + matching server expiry; unticked → session cookie (no maxAge) that
  ends with the browser session. Sessions persist in the store so they survive a
  server restart (the review broker may restart the process).
- Cookie `secure:false`, `sameSite:'lax'` for the http review environment;
  production hardening (HTTPS/secure cookies) is noted in the non-functional
  backlog (NF-1), kept separate from these review settings.

## Domain logic (`src/urls.js`)

- `normalizeUrl` adds a missing `https://` only (SCN-009).
- `canonicalUrl`/`sameLink` compare addresses ignoring scheme, trailing slashes,
  and case, for duplicate detection (SCN-008).
- Extracted into a pure module so it is unit-testable independent of HTTP.

## Behavioural placement

- **Grouping, alphabetical order, counts, "Uncategorized" fallback, live search,
  highlighting, topic buttons, "All clears search"** are rendered client-side in
  `public/app.js` from the raw bookmark list. The server stores topics verbatim
  (including empty); the UI maps empty topic → "Uncategorized" (SCN-007) so the
  stored data stays clean.
- **Required address, normalization, duplicate detection** are enforced
  server-side (authoritative) and mirrored in the UI for immediate feedback.
- **Delete confirmation and in-place edit** are UI interaction states (SCN-004/005);
  the server exposes plain PUT/DELETE.

## Testing strategy

- **Unit** (`tests/unit`, node:test): URL logic and the store (accounts,
  sessions, bookmark CRUD, persistence).
- **Acceptance** (`tests/e2e`, Playwright 1.61.0): browser-driven, one scenario
  family per test, run against the real app on port 4010 with a throwaway data
  file. Serial mode; the single account is created by the first test.
