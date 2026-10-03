# Quickstart and Validation Guide: Bookmark Manager

This guide defines how the implemented feature will be built, run, and validated. Commands become runnable after the implementation phase creates the application and scripts.

## Prerequisites

- Node.js 24 LTS and npm 11
- Linux build tools for the pinned SQLite dependency
- Playwright 1.61.0 browser binaries available at `/opt/playwright-browsers`
- Write access to a durable application data directory

## Prepare

```bash
cd /work
npm ci
export BOOKMARK_DATA_DIR=/work/data
npm run db:migrate
npm run build
```

Expected: dependencies install from the lockfile, migrations create/upgrade the database and verify FTS5, and the production build finishes without type or build errors.

## Automated validation

```bash
npm run lint
npm run typecheck
npm test
npm run test:integration
npm run test:contract
npm run test:e2e
npm run test:performance
```

Expected:

- Unit tests prove URL/tag normalization, query grammar and precedence, AST compilation, metadata address policy, and domain state independence.
- Integration tests use real temporary SQLite databases to prove migrations, uniqueness, FTS synchronization, persistence, savepoints, snapshots, and idempotent retries.
- Contract tests validate the metadata responses against `contracts/metadata-api.yaml` and mutation behavior against `contracts/ui-actions.md`.
- End-to-end tests cover primary workflows, keyboard-only operation, focus restoration, live announcements, duplicate navigation, and metadata fallback.
- Seeded performance tests establish the 10,000-bookmark search/update and 1,000-target bulk thresholds from the specification.

## Run for review

```bash
npm start
```

Expected: the production application listens on `0.0.0.0:4000`. The client review address is `http://maker:4000/`; automated capture uses `http://127.0.0.1:4000/`.

The implementation phase will create `.harness/app.json` with:

```json
{"kind":"application","port":4000,"path":"/","start_command":["npm","start"],"start_cwd":"/work"}
```

The main UI receives `data-harness-ready="true"` only after its initial collection or valid empty state has loaded.

## End-to-end acceptance scenarios

### 1. Automatic metadata with editable fallback

1. Open the add-bookmark flow and paste a fixture URL that provides Open Graph title, description, and a PNG icon.
2. Confirm all three preview within five seconds.
3. Edit the title and description, save, reopen the bookmark, and confirm the edits—not fetched originals—remain.
4. Repeat with timeout, missing-description, missing-icon, oversized, non-HTML, and blocked-private-address fixtures.
5. Confirm every failure permits manual title entry and saving; missing description/icon do not block save.

### 2. Duplicate navigation

1. Save a URL containing a fragment.
2. Attempt to save the same canonical destination with an inconsequential spelling variation.
3. Confirm no second row is created and the existing bookmark detail opens.
4. Confirm URLs with meaningfully different query values remain distinct.

### 3. Search contract

Seed bookmarks whose title, URL, description, note, and tags overlap. Validate the examples and errors in [search-grammar.md](contracts/search-grammar.md), including:

- plain implicit `AND`;
- quoted exact phrases;
- exact `tag:` conditions;
- precedence across `NOT`, `AND`, and `OR`;
- parentheses;
- text found only in a personal note;
- unmatched quotes/parentheses with retained input and position-aware feedback.

### 4. Independent read-later and favorite state

1. Mark a favorite bookmark unread.
2. Confirm it appears in unread and favorites views.
3. Mark it read from the unread view.
4. Confirm it leaves unread, remains favorite, and stays in the main collection.
5. Archive and restore it; confirm both read and favorite state persist.

### 5. Notes

Add, edit, remove, and restore a personal note while confirming it remains visually distinct from the page description and participates in search after each save.

### 6. Explicit and all-matching bulk actions

1. Select several visible bookmarks and preview add-tags, archive, mark-read/unread, and delete actions.
2. Confirm the target count precedes execution and deletion requires explicit confirmation.
3. Filter a seeded collection so matches exceed one displayed page; choose all matching and verify the snapshot count and targets.
4. Change the underlying query after preview and confirm execution still uses the frozen snapshot.
5. Inject one item failure and confirm successful items remain changed, the failed item does not, and the summary identifies both counts.
6. Retry the same confirmation and confirm it returns the stored outcome without applying twice.

### 7. Persistence and accessibility

1. Restart the app and verify bookmark details, notes, tags, statuses, and archive state remain.
2. Complete add, search, selection, bulk confirmation, edit, archive, restore, and delete using keyboard only.
3. Verify visible focus, dialog focus containment/restoration, associated field errors, and live result announcements.

## Security validation for metadata retrieval

Use controlled fixtures to test literal and DNS-resolved private/loopback/link-local IPv4 and IPv6, IPv4-mapped IPv6, mixed public/private DNS answers, DNS answer changes, public-to-private redirects, more than five redirects, credentials, disallowed ports, HTTPS downgrade, oversized/chunked/decompression bodies, slow headers/bodies, wrong MIME, SVG/HTML icons, and relative icon URLs.

Expected: prohibited targets are never contacted, every redirect and icon is revalidated, response limits abort promptly, remote HTML is never returned, and logs omit full sensitive URL queries and bodies.

## Data integrity inspection

Run the planned reconciliation command after mutation and bulk suites:

```bash
npm run db:verify
```

Expected: foreign-key checks pass, each bookmark's FTS document matches its base text/tags, normalized URL and tag keys are unique, and no incomplete bulk operation is reported as completed.
