# Design-decision record (Cycle 1)

Production implementation of the personal bookmark manager. Built from the
approved GWT scenarios (SCN-001..016), not from the Phase 1 prototype code.

## Stack / key decisions

- **Runtime: Node.js built-ins only** (`node:http`, `node:sqlite`, `node:crypto`,
  global `fetch`). No npm dependencies → no install/lockfile risk in the trial
  image. Alternative dropped: Express + better-sqlite3 (needs network install +
  native build).
- **Storage: SQLite (`node:sqlite`)** at `data/bookmarks.db`. One row per bookmark,
  scoped by `user_id`; a UNIQUE index on `(user_id, url_key)` enforces the
  no-duplicate rule (SCN-001). `node:sqlite` has no `.transaction()` helper, so
  `db.tx()` wraps BEGIN/COMMIT/ROLLBACK (see src/db.js).
- **Auth: server-side sessions + HttpOnly cookie** (`sid`), scrypt password hash
  (src/auth.js, src/db.js). Single seeded personal account (SCN-011, NF-01):
  `me@bookmarks.local` / `bookmarks` (override via SEED_EMAIL/SEED_PASSWORD).
  SameSite=Lax, no Secure flag so cookies work over the review HTTP origin.
- **Search/sort/filter run client-side** over the full collection loaded once
  (`GET /api/bookmarks`). Personal-scale data; keeps the query language identical
  between UI and tests via the shared `public/query.js` (SCN-004).
- **Preserved copies are real** (src/snapshot.js): the server fetches and stores
  the page HTML (with an injected `<base>` + capture banner) or, for a PDF link,
  the actual PDF bytes, under `data/snapshots/`. Capture runs asynchronously after
  create/import; the client polls for status. Failure marks `snapshot_status=failed`
  and is retryable; the bookmark is never at risk (SCN-014/010).
- **Internet Archive** (src/archiveorg.js): optional per-bookmark, uses the Wayback
  "Save Page Now" endpoint; async, with pending/saved/failed status. External
  dependency — failures are surfaced, not fatal (SCN-014, NF-01 external note).
- **Metadata auto-fill** (src/metadata.js): server fetches title/description/
  og:image/favicon with a timeout; on failure the bookmark is still created with
  `fetch_failed=1` (SCN-001/010).
- **Import/export** (src/bookmarksHtml.js): tolerant Netscape-format parser;
  folders → tags (generic roots skipped), TAGS attribute and ADD_DATE preserved;
  export regenerates the standard file (SCN-015).

## Layout

- `server.js` — HTTP routing, static, auth gate, snapshot file serving.
- `src/db.js` — schema, tx, password hashing, seed user.
- `src/auth.js` — sessions, login.
- `src/bookmarks.js` — domain logic + async snapshot/archive orchestration.
- `src/metadata.js`, `src/snapshot.js`, `src/archiveorg.js`, `src/urls.js`,
  `src/bookmarksHtml.js` — supporting modules.
- `public/` — SPA (`index.html`, `app.js`, `styles.css`, `login.*`) + shared
  `query.js`.
- `tests/` — `*.test.js` (node:test unit/integration) + `acceptance.py`
  (Playwright browser acceptance).

## Runtime

- `npm start` / `node server.js` → listens on `0.0.0.0:${PORT|4000}`.
- Data under `data/` (DATA_DIR overridable). Snapshots under `data/snapshots/`.
