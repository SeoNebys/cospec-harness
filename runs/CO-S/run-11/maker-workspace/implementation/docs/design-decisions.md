# Design decisions (Cycle 1)

Lightweight record to enable impact analysis and artifact generation in later
cycles. Behaviour basis: approved scenarios SCN-001..SCN-013.

## Architecture

- **Single Node.js service** (`src/server.js`, Express) serving a JSON API and a
  static browser front-end from `public/`. Chosen because the collection must be
  central and reachable from any device (SCN-013); a server with per-account data
  is required. Alternatives dropped: browser-only storage (localStorage/IndexedDB)
  — rejected because it cannot satisfy cross-device access.
- **SQLite via better-sqlite3** for storage (`src/db.js`). Chosen for zero
  external services (no DB server to provision in this environment) while still
  being a real central store. Alternative dropped: an external Postgres/MySQL —
  unnecessary for a single personal user and would need a service not provided.
- **Vanilla JS front-end** (`public/app.js`), no build step. Chosen to keep the
  toolchain minimal and the app easy to run (`npm start`). The live search and
  inline editing are simple enough not to need a framework.

## Key decisions

- **Live search is client-side** over the full collection loaded at sign-in
  (SCN-004). Rationale: instant as-you-type filtering with highlight is the core
  value; a personal collection is small enough to filter in the browser.
  Performance at large scale is tracked as NF-1 (non-functional backlog).
- **Duplicate detection key** (`src/url.js` `normalizeUrl`): lowercase host,
  strip one trailing "/", keep path/query case-sensitive (SCN-006). Enforced both
  in application logic and by a `UNIQUE (user_id, norm_url)` DB constraint.
- **Reading status vs. archive vs. delete are three separate concerns**
  (SCN-003 / SCN-011 / SCN-012): `finished` (boolean) and `archived` (boolean)
  are independent columns; delete removes the row. Archived items are excluded
  from normal search in the client (only shown on the Archived tab).
- **Auto-fill is best-effort** (`src/metadata.js`, `GET /api/metadata`): on any
  failure the endpoint returns `{ok:false}` and the UI still allows manual save
  (SCN-009). Never blocks saving.
- **Auth**: email + password (SCN-013). Passwords hashed with scrypt + per-user
  salt (`src/auth.js`, NF-2). Sessions are random opaque tokens stored in the
  `sessions` table, delivered as an httpOnly `sid` cookie (SameSite=Lax) so
  cookies work in the review environment over HTTP.
- **Account creation**: a `POST /api/register` endpoint plus a "Create an
  account" toggle on the sign-in screen. This is enabling infrastructure for
  SCN-013 (a personal account must be creatable); it introduces no bookmark
  behaviour beyond the approved scenarios. A review account
  (`demo@bookmarks.test` / `demo123`) is seeded on startup.

## Data model (`src/db.js`)

- `users(id, email UNIQUE, password_hash, created_at)`
- `sessions(token PK, user_id, created_at)`
- `bookmarks(id, user_id, url, norm_url, title, description, note, finished,
  archived, created_at, updated_at, UNIQUE(user_id, norm_url))`
- `bookmark_tags(bookmark_id, tag, PK(bookmark_id, tag))`

## Notable implementation notes

- `[hidden] { display:none !important }` in CSS so the `hidden` attribute always
  wins over component classes that set `display` (overlay/tabs/userbar).
- better-sqlite3 under `node:test` can crash at teardown if many DB handles are
  opened/closed; tests use a single shared in-memory DB closed via `t.after`.
