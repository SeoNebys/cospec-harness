# Design decisions — Cycle 1

Production implementation of the bookmark manager. Built fresh from the approved
scenarios' GWT (SCN-001…025); no prototype code was reused.

## Architecture

- **Zero runtime dependencies.** Node's built-in `http` serves both the static
  frontend and a small JSON API. Chosen over Express/frameworks to keep the
  install/lockfile trivial and the app robust offline. Alternative dropped:
  Express + SQLite (heavier, native build risk) — unnecessary for a single user.
- **Storage: one JSON document** (`data/db.json`) mutated synchronously with an
  atomic tmp-write+rename. Adequate and simple for a personal single-user app.
  Snapshots are stored as files under `data/snapshots/`. `DATA_DIR` env overrides
  the location (used by tests for isolation).
- **Client-side search / filter / sort / pagination.** The full library loads
  once (`GET /api/state`); the browser does querying and paging for snappy,
  offline-friendly interaction. The server's real jobs are persistence and the
  network-bound operations the browser cannot do (metadata, snapshots, archive).
- **Shared modules** (`src/query.js`, `src/markdown.js`, `src/importexport.js`)
  are UMD-style so the exact same code runs in Node unit tests and in the browser
  (served under `/lib/*`). This keeps the search grammar, Markdown renderer, and
  bookmarks-file parser single-sourced and testable.

## Notable choices

- **Search grammar** (SCN-007): tokenizer + recursive-descent parser supporting
  quoted phrases, `#tag`, `AND/OR/NOT`, parentheses and implicit AND. Malformed
  queries never throw — they fall back to a plain-text match (`ok:false`) so live
  typing degrades gracefully. Highlighting uses one combined regex pass to avoid
  re-matching inside inserted `<mark>` tags.
- **Markdown notes** (SCN-025): HTML is escaped first; only a safe subset is then
  re-introduced; only `http/https` links become anchors. Raw HTML is shown as
  text, never executed.
- **Duplicate key** (SCN-009): `host (minus www.) + path (no trailing slash) +
  query`, lower-cased. Case, `www.` and trailing slash are ignored; query strings
  distinguish URLs (a deliberate correction found during testing).
- **Metadata / snapshot / archive** (SCN-001/010/019/020): all network-bound and
  time-bounded. Failures return `{ok:false}` so the bookmark is still saved
  (SCN-010) or the copy/archive is simply reported as failed and retryable. The
  Internet Archive base is `ARCHIVE_BASE`-configurable for testing.
- **Snapshot** stores a self-contained `.html` (stylesheets and images inlined as
  data URIs) or the original `.pdf` bytes unchanged.
- **Undo** (SCN-013/017): delete returns the removed record(s) with their index;
  a `restore` endpoint re-inserts them. The UI shows the undo bar; after it
  elapses the deletion is permanent.

## Ports / runtime

- Application listens on `0.0.0.0:4000` (`npm start`). `PORT`/`HOST` env override.
- `data-harness-ready="true"` is set on `<body>` after initial state loads.

## Testing

- Unit/integration: `node --test test/unit/*.test.js` (query, markdown,
  import/export, and the full service against a local fixture site).
- Gherkin acceptance: `python test/acceptance/acceptance.py` starts the fixture
  site + app and drives the real UI through every scenario.
