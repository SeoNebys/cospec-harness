# Quickstart and Validation Guide: Bookmark Manager

This guide describes how the completed implementation will be prepared and validated. Commands become runnable during the implementation phase; this planning phase does not install dependencies or create application code.

## Prerequisites

- Node.js 24 LTS and npm
- Linux build toolchain for native SQLite bindings
- Playwright 1.61.0 Chromium at `/opt/playwright-browsers`
- Optional pinned/checksummed Monolith helper; the built-in browser renderer remains available
- Writable application data directory with enough space for test captures

## Prepare

```bash
cd /work
npm ci
npm run migrate
npm run build
```

The lockfile must pin both runtime `playwright` and `@playwright/test` to `1.61.0`. Migrations must complete before the server accepts requests.

Recommended local validation environment:

```text
HOST=0.0.0.0
PORT=4000
DATA_DIR=/work/data
CAPTURE_CONCURRENCY=1
PLAYWRIGHT_BROWSERS_PATH=/opt/playwright-browsers
```

## Automated Verification

```bash
npm run lint
npm run typecheck
npm run test:unit
npm run test:integration
npm run test:security
npm run test:e2e
npm run test:performance
```

Most checks use isolated local fixtures. The browser acceptance suite additionally uses stable public `example.com` and W3C PDF fixtures to verify the production SSRF boundary, rendered HTML capture, and byte-identical PDF retention.

Expected overall result: every suite passes, no test needs public internet, and temporary databases/blob directories are isolated per run.

## Start the Prepared Application

```bash
npm start
```

Expected result:

- Server listens on `0.0.0.0:4000`.
- `GET /api/health` reports `{"status":"ok"}` only after migrations and initial worker recovery complete.
- The web application displays a visible element with `data-harness-ready="true"` after its initial state loads.
- The capture worker is supervised by the same foreground bootstrap and shuts down cleanly with the server.

Client review URL: `http://maker:4000/`

After implementation and build verification, `/work/.harness/app.json` must contain:

```json
{"kind":"application","port":4000,"path":"/","start_command":["npm","start"],"start_cwd":"/work"}
```

## End-to-End Acceptance Walkthrough

### 1. Automatic details and first save

1. Open the empty library and choose **Add bookmark**.
2. Paste the fixture page URL.
3. Verify title, description, icon, and preview image appear or show a specific partial-retrieval warning.
4. Edit the title, remove/replace one image, add tags and a formatted note, and save.

Expected:

- Bookmark is visible within 2 seconds and starts unread.
- User edits win over retrieved values.
- Copy status starts pending without blocking use of the bookmark.
- Saving the same normalized address again identifies the existing bookmark.

### 2. Read-later and opening behavior

1. Open the unread view and verify the new bookmark appears.
2. Open the live link and verify it remains unread.
3. Mark it read and verify it leaves unread but remains in the main library.
4. Mark it unread and verify it returns.

### 3. Saved HTML and PDF copies

1. Wait until the fixture HTML bookmark reports an available copy.
2. Save the deterministic fixture PDF and wait for its copy.
3. Stop the fixture origin or block outbound access.
4. Open both retained copies.

Expected:

- HTML primary text and essential images remain readable and recognizable with zero outbound requests.
- Hostile fixture scripts, forms, popups, downloads, refreshes, frames, and remote CSS cannot execute or navigate.
- PDF renders through the isolated viewer and its retained SHA-256 equals the fixture's delivered bytes.
- Source URL, effective URL, capture date, type, warnings, and failure/retry information are accurate.

See [capture-lifecycle.md](contracts/capture-lifecycle.md) for state and security assertions.

### 4. Smart search

Seed bookmarks containing overlapping titles, addresses, descriptions, notes, and tags. Verify:

```text
climate policy
"climate policy"
#research
climate OR energy
climate NOT draft
(climate OR energy) #research
-#finished
```

Expected results must match [search-grammar.md](contracts/search-grammar.md). Invalid quotes, parentheses, tags, and operators retain input and return an offset plus correction hint.

### 5. Archive lifecycle

1. Archive an unread bookmark with an available copy.
2. Verify it leaves main, ordinary search, tag, and unread views.
3. Find it through archive search and open its saved copy.
4. Restore it.

Expected: all fields, tags, read status, and the same immutable copy remain intact.

### 6. Bulk maintenance and deletion

1. Select multiple active bookmarks and add/remove a tag.
2. Mark the selection read/unread and archive it.
3. Restore it from the archive.
4. Start permanent deletion and cancel.
5. Repeat and confirm.

Expected:

- Selection count and eligible actions are accurate.
- Existing unrelated tags remain.
- Partial failures identify exact items.
- Confirmation states how many bookmarks and retained copies will be removed.
- Cancellation changes nothing; confirmation removes logical access and eventually unreferenced blobs.

### 7. Rich notes and saved views

1. Store a note using headings, lists, emphasis, and a link.
2. Verify sanitized formatted display and plain-text search.
3. Combine a query with multiple tag chips and save it under a unique name.
4. Change matching bookmark data, reopen the view, edit it, and delete it.

Expected: saved views evaluate current data, tag chips use match-all behavior, and view changes never mutate bookmarks.

### 8. Import, export, and preferences

1. Import Chrome-, Firefox-, and Safari-shaped Netscape bookmark fixtures with nested folders and invalid/duplicate entries.
2. Verify folder paths become tags and the summary separates imported, duplicate, skipped, and failed entries.
3. Confirm imported bookmarks are immediately usable while capture progress continues.
4. Export active, archived, and all scopes after acknowledging loss disclosure; smoke-import output in Chromium and Firefox.
5. Set each text size and a non-default sort, restart, and verify persistence.

Expected: a fatal parse/limit failure writes nothing; valid partial imports preserve all valid entries; export contains one escaped link per selected bookmark and no hidden proprietary state.

## Performance Acceptance

With deterministic data fixtures:

- 10,000-bookmark search/sort interactions render visible results within 1 second under normal local conditions.
- Representative known-item searches complete the user task within 10 seconds.
- A 500-item bulk action completes with an accurate summary within 5 seconds.
- A 10,000-entry supported import retains at least 99.9% of titles and addresses.
- Capture status and bookmark usability appear within 2 seconds even while capture continues.

Record cold/warm p50 and p95 database timings separately from browser-visible timings so regressions can be localized without weakening the approved user outcomes.

## Restart and Recovery

During a capture and a large import:

1. Stop the application process cleanly, then repeat with a forced termination.
2. Restart with `npm start`.
3. Verify committed bookmarks remain, expired job leases recover, duplicate captures are not published, and staging garbage is reclaimed.
4. Verify previously available copies, saved views, and preferences remain unchanged.

## Backup Validation

Create a database snapshot and matching blob manifest/tree, restore them into a clean data directory, then run integrity checks:

- All database foreign keys pass.
- Every live blob reference exists and matches its digest/size.
- No published copy references an unlisted asset.
- FTS row coverage matches bookmark and tag source rows.
- A sample HTML copy and PDF open with the original fixture offline.
