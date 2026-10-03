# Bookmark Garden

Bookmark Garden is a private, single-user bookmark manager. Paste an HTTP or HTTPS address and
save immediately; the app stores a readable fallback first and then safely retrieves the page
title, description, and icon when the site permits it. It also provides a separate Read Later
queue, favorites, archive/restore, tags, formatted notes, precise search, stable bulk actions, and
reusable saved views.

## Requirements

- Node.js 24 or newer and npm
- A writable `data/` directory
- Port 4000 available

Install and prepare the production build:

```bash
npm ci
npm run build
npm start
```

The server listens on `0.0.0.0:4000` by default. Open `http://maker:4000/` in the shared review
environment, or `http://127.0.0.1:4000/` from the machine running the app. Configuration can be
changed with `HOST`, `PORT`, `DATABASE_PATH`, and `CLIENT_DIRECTORY`; see
[`src/server/config.ts`](src/server/config.ts) for bounded metadata settings.

This release intentionally has no accounts or authentication. Run it only on a trusted machine or
trusted private network, and do not expose it directly to the public Internet. Mutation endpoints
enforce same-origin JSON requests, but that is not a substitute for user authentication.

## Data and backups

The default database is `data/bookmarks.sqlite`. SQLite may also create `-wal` and `-shm` files
while the app is running. For a consistent simple backup, stop the server and copy the database
file to protected storage. To restore, stop the server, preserve the current file as a fallback,
put the backup at the configured `DATABASE_PATH`, and restart. Pending schema migrations run
transactionally before the server reports ready.

Never edit the database manually while the server is running. If startup reports a migration or
database error, keep the original database, verify write permissions and free disk space, and run
`npm run migrate` against a copy before attempting recovery.

## Search syntax

- Ordinary adjacent terms mean AND and can match title, address, description, or visible note text.
- `climate OR ocean` matches either branch; explicit `AND` is also accepted and binds before OR.
- `"exact phrase"` keeps words together within one searchable field.
- `#news` requires that exact tag; use `#"machine learning"` for a multiword tag.
- Selecting multiple tag filters requires every selected tag.
- Parentheses and negation are not part of grammar version 1. The app shows a position-aware error
  and leaves the active view unchanged when syntax is invalid.

Search, filters, scope, and sorting are URL-backed. A saved view stores those criteria and reruns
them against current bookmarks; it does not freeze or copy result rows.

## Metadata safety and fallbacks

Bookmarks always remain saveable when retrieval fails. Retrieval accepts only public HTTP(S)
destinations on standard ports, validates and pins all DNS answers at every redirect, applies one
overall deadline and strict decoded-size limits, and never executes page scripts. Site icons are
fetched through the same boundary, reject active content, and are re-encoded as application-served
PNG files. The browser never loads a saved site's icon directly.

A manually edited title or description is never overwritten by a late metadata response. If a
new retrieved value is available, the editor offers it as an explicit replacement instead.

## Development and verification

```bash
npm run dev
npm run format:check
npm run lint
npm run typecheck
npm run test:unit
npm run test:integration
npm run test:performance
npm run test:e2e
```

`npm run test:e2e` builds the app and uses the pinned Playwright 1.61.0 Chromium. The complete
manual and automated acceptance sequence is in
[`specs/001-bookmark-manager/quickstart.md`](specs/001-bookmark-manager/quickstart.md).

## Recovery notes

- If the UI cannot connect, confirm `npm run build` completed and `/api/health` returns
  `{"status":"ready"}`.
- If port 4000 is occupied, stop the other process or set a different `PORT` for local use.
- If a page refuses metadata access, keep the fallback or edit the bookmark manually; repeated
  retries cannot bypass a destination's policy.
- If a bulk selection expires, select the intended results again. Expiration protects the exact
  snapshot and never partially applies an action.
- Permanent deletion cannot be undone. Archive items when they may be needed later.

The approved behavior and technical design live under
[`specs/001-bookmark-manager/`](specs/001-bookmark-manager/).
