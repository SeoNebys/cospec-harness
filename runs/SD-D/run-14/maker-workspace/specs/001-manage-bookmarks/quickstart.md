# Quickstart and Validation Guide

This guide defines the runnable checks the implementation must support. Commands describe the planned repository interface; they become executable during implementation.

## Prerequisites

- Node.js 24.x and npm
- Chromium revision bundled for Playwright 1.61.0 at `/opt/playwright-browsers`
- A writable temporary directory for isolated test data
- No external database, queue, or internet page is required for the deterministic suite

## Install and verify

```bash
npm ci
npm run typecheck
npm test
npm run build
npm run test:e2e
```

Expected outcome: all type, unit, component, contract, integration, build, and browser checks pass. The test configuration may allow only the repository's local capture fixture; production URL policy remains public-network-only.

## Run the prepared application

```bash
BOOKMARK_DATA_DIR=/tmp/bookmark-manager-review npm start
```

Expected outcome:

- The foreground server binds `0.0.0.0:4000`.
- `GET http://127.0.0.1:4000/api/health` returns `{"status":"ok"}`.
- `GET http://127.0.0.1:4000/api/ready` returns `{"status":"ready"}` after migrations and worker startup.
- `http://maker:4000/` is the client review URL.
- The application shell adds `data-harness-ready="true"` only after a valid initial collection or empty state loads.

## End-to-end acceptance journeys

### 1. Save, enrich, and preserve

1. Start the deterministic capture fixture and application with the test-only fixture allowance.
2. Save the fixture URL without entering a title.
3. Confirm the bookmark appears immediately with pending metadata/snapshot state.
4. Wait for terminal capture state and confirm title, description, favicon, and preview are populated.
5. Open the snapshot viewer and confirm the dated full-page image is visible independently of the fixture page.
6. Edit the title, request a normal refresh, and confirm the user title is preserved.
7. Request replacement refresh, confirm the warning, and verify the retrieved title may replace it.
8. Stop the fixture and confirm the stored snapshot remains viewable while opening the live URL fails independently.

### 2. Read later and persistence

1. Save one default bookmark and one marked Read later.
2. Confirm only the latter appears in Read later.
3. Mark it read and confirm it leaves that view but remains in Collection.
4. Mark it unread again, restart the application with the same data directory, and confirm state persists.

### 3. Search grammar

Seed records that distinguish terms, exact phrases, tags, and fields. Verify the normative cases in [search-grammar.md](contracts/search-grammar.md), including:

```text
cooking NOT #recipes
"weeknight dinner"
cooking (#vegan OR #quick)
NOT (#work OR "meeting notes")
```

Confirm precedence, exact-tag behavior, phrase adjacency within one field, and NOT-only queries. Enter unclosed quotes, unmatched parentheses, empty groups, and dangling operators; each must keep the input, show a positioned error, and avoid executing a fallback interpretation.

### 4. Saved views

1. Combine a grouped search with read/favorite/tag filters and a non-default sort.
2. Save it under a unique name.
3. Change the collection, reopen the view, and confirm current records are evaluated using the saved definition.
4. Rename and update the view, then delete it; confirm no bookmarks change.

### 5. Bulk maintenance

1. Create more results than one loaded page and filter them to a known set.
2. Select explicit items and add a tag; confirm only those items change.
3. Choose all current results and preview archive; confirm the server-provided total includes unloaded results.
4. Change the result set before execution and confirm the stale count produces a conflict requiring a new preview.
5. Execute archive with the current count and verify the complete matching set moves to Archived.
6. Preview delete, cancel once, then confirm; verify the accurate count, relational removal, and snapshot-file cleanup.

### 6. Sorting and display preferences

1. Verify all four sort fields in both directions and newest-saved default behavior.
2. Choose dark theme and compact density, reload, and confirm both persist.
3. Choose system theme and change the browser preference; confirm appearance reacts while stored preference remains system.
4. Repeat core collection actions at a mobile-sized viewport and with keyboard-only navigation.

## Failure and security checks

- Submit malformed and unsupported URLs; no bookmark is created.
- Attempt loopback, RFC1918, link-local, reserved IPv4/IPv6, metadata-service, and public-to-private redirect targets; capture is rejected with a safe explanation.
- Serve missing metadata, oversized resources, excessive redirects, slow responses, and extreme page height; the bookmark remains manageable and status becomes partial or failed within the configured bound.
- Attempt path traversal through asset identifiers; the server returns not found/validation error and never reads outside the asset root.
- Use SQL metacharacters in every search token form; results follow the search grammar and the database schema/data remain unchanged.
- Interrupt a capture, restart, and confirm the persisted job resumes without creating two active jobs or losing the prior snapshot.

## Performance validation

Generate 10,000 bookmarks with representative tag associations, then run a fixed suite of plain, phrase, exact-tag, grouped, exclusion-only, filtered, and sorted queries. On the review environment:

- Each result update must be visible within one second.
- Ordinary list/detail/preferences API reads should remain below 250 ms at p95.
- Bulk preview and execution must produce accurate counts for all-results selectors.

Record dataset seed, hardware/container limits, warm-up, sample count, p50, p95, and worst time so the result is reproducible.

## Contract references

- HTTP shapes and status codes: [api.yaml](contracts/api.yaml)
- Search syntax and errors: [search-grammar.md](contracts/search-grammar.md)
- UI states and interaction requirements: [ui-contract.md](contracts/ui-contract.md)
- Persistence invariants and transitions: [data-model.md](data-model.md)

## Runtime handoff

After build and validation succeed, create:

```json
{"kind":"application","port":4000,"path":"/","start_command":["npm","start"],"start_cwd":"/work"}
```

at `.harness/app.json`. The start command must only start already installed and built artifacts; it must not install dependencies or rebuild.
