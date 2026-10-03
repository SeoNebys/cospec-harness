# Design decisions — Bookmark Library (cycle 1)

Production implementation of the 17 approved scenarios (SCN-001…SCN-017).
Built fresh from the scenarios' GWT; the Phase 1 prototype under `/work/prototypes`
was not copied or reused.

## Architecture

- **Runtime: zero external dependencies.** Node 24 built-in `http` server + static
  files. Chosen for a dependable, easily-run personal tool with no install/build
  surprises. (`@playwright/test` is a dev-only dependency for acceptance tests.)
- **Persistence: a single JSON file, written atomically** (`data/bookmarks.json`,
  temp-file + rename). The goal is a *dependable personal reference library*;
  a single-user local JSON store is simple and survives restarts (unit-tested).
  Alternatives dropped: SQLite (native build / experimental flag overhead) — not
  needed at this scale; can be revisited if the library grows very large.
- **Shared logic in `public/lib/`** (`canonical.js`, `search.js`, `format.js`)
  authored as dual CommonJS/browser modules, so the exact same rules run in the
  browser UI and are unit-tested in Node. Avoids drift between client and tests.
- **Filtering/sorting/paging/search happen client-side.** The client holds the
  full list (single user), so counts and "select all matching" naturally cover
  the entire matching set, not just the loaded batch (SCN-010, SCN-015).

## Layout

```
implementation/
  src/server.js      HTTP routing, REST API, static serving
  src/store.js       domain + persistence (create/update/state/tags/bulk/delete)
  src/metadata.js    fetch page + parse title/description/site/icon/image (never throws)
  public/index.html  app shell
  public/styles.css  calm, readable design (approved presentation)
  public/app.js      UI state machine + rendering + interactions
  public/lib/*.js    canonical (dedupe), search (query language), format (time/markdown/highlight)
  tests/unit/*       node:test unit tests
  tests/e2e/*        @playwright/test acceptance tests (scenario-mapped)
  data/bookmarks.json  runtime store (created on first save)
```

## Key rules (traceability in SCENARIO_MAP.md)

- **Duplicate identity** = host without leading `www.` + path without trailing
  slash + query; scheme and fragment ignored (`canonicalKey`). SCN-002.
- **Save is preview → review → create.** `/api/preview` fetches without storing;
  the client reviews/edits; `/api/bookmarks` finalizes. SCN-007. A detail-fetch
  failure still yields a preview to fill in manually; an invalid address is
  refused. SCN-013.
- **read and archived are independent booleans**; views are derived filters
  (All = !archived, Unread = !archived && !read, Archived = archived). SCN-003.
- **Delete is permanent and confirmed**, distinct from archive. SCN-014.
- **Bulk** applies one action to many ids server-side; the client clears the
  selection whenever the view/search/tags change. SCN-015.
- **Preview image** captured (og:image/twitter:image, absolutized); shown in the
  review and Edit views only, never the list. SCN-017.

## REST API

- `GET  /api/bookmarks`
- `POST /api/preview {url}` → `{duplicate,bookmark}` | `{preview}` | 400 invalid_url
- `POST /api/bookmarks {url,title,description,note,image,retrieved}` → create/dup
- `PATCH /api/bookmarks/:id {url?,title?,description?,note?}` → 200 | 400 | 404 | 409 duplicate_address
- `POST /api/bookmarks/:id/state {read?,archived?}`
- `POST /api/bookmarks/:id/tags/add|remove {tag}`
- `DELETE /api/bookmarks/:id`
- `POST /api/bulk {ids,action,value?}`  action ∈ read|unread|archive|restore|addtag|removetag|delete
