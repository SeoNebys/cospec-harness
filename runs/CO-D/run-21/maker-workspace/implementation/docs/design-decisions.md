# Design decisions (cycle 1)

Lightweight record to enable impact analysis and artifact generation later.

## Architecture
- **Plain Node.js HTTP server** (`server.js`) + **static SPA** (`public/`). No web
  framework and **no runtime npm dependencies** — chosen for robustness in this
  environment (no reliance on package downloads at start). Dev-only dependency:
  `playwright@1.61.0` pinned to the shared browser build for acceptance tests.
- **Layers:** `lib/store.js` (JSON-file persistence + snapshot files) →
  `lib/service.js` (business logic, testable without HTTP) → `server.js` (REST) →
  `public/app.js` (UI). Alternative considered: SQLite (better-sqlite3) — dropped
  to avoid a native build/download dependency for a single-user app.

## Persistence (SCN-018, durability)
- Single JSON file `data/db.json` (atomic write via temp+rename). Preferences,
  bookmarks, and saved searches persist across sessions server-side.
- Preserved copies stored as files under `data/snapshots/<id>.html|.pdf`.

## Preservation (SCN-014)
- On save of a readable page, capture once: a page becomes a self-contained-ish
  single HTML (a `<base>` for link resolution, a capture banner, and best-effort
  **inlined images** as data URIs so it works offline). A PDF stores the actual
  fetched bytes. Capture is **once**, never silently re-run.
- Internet Archive submission is explicit/optional via the Wayback `save/` URL;
  failures are reported honestly, never silently swallowed.
- Full asset inlining (CSS/fonts) is best-effort only; noted as a known limit.

## Search / sort / paging / selection
- Computed **client-side** over the full fetched state so the approved query
  language (phrases, #tag, AND/OR/NOT, parentheses) and live filtering are exact.
- "Select all matching" is computed on the client (full result set) and the id
  list is sent to the server for the bulk action.

## Icons/previews
- Generated deterministically on the client (SVG data URIs) so they render
  offline; `og:image`/favicon fetching was intentionally not relied upon.

## Duplicate rule (SCN-005)
- `normalizeUrl`: host case-insensitive + `www.`-insensitive, trailing slash
  ignored, **path case-sensitive**, query preserved. Enforced on create and on
  edit (address change into a collision is blocked).

## Import/export (SCN-017)
- Netscape bookmark HTML. Import maps folders→tags, keeps titles/tags/original
  dates, skips existing addresses (reports counts). Export is browser-compatible
  (title/tags/date) — explicitly not a full backup.
