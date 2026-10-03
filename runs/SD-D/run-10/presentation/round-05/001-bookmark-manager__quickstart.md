# Quickstart and Validation Guide

**Purpose**: Run the completed v1 application and prove the approved feature end to end.  
**Status**: Planning artifact; commands become runnable during implementation.

## Prerequisites

- Node.js 24 LTS and npm
- Linux build tools for native dependencies
- Chromium from the shared Playwright 1.61.0 installation at `/opt/playwright-browsers`
- Write access to `/work/data/`
- Network access for manual metadata-capture checks; automated metadata tests use local controlled fixtures

No external database is required. Production password recovery requires an SMTP-compatible provider; local/review mode uses a log-only mail transport.

## Install and Configure

From `/work`:

```bash
npm ci
cp .env.example .env
npm run db:migrate
npm run db:seed:review
```

Expected development values in `.env`:

```dotenv
NODE_ENV=development
HOST=0.0.0.0
PORT=4000
DATABASE_PATH=./data/bookmarks.sqlite
ASSET_DIRECTORY=./data/assets
APP_ORIGINS=http://maker:4000,http://127.0.0.1:4000
SESSION_SECRET=replace-with-at-least-32-random-bytes
MAIL_TRANSPORT=log
```

The implementation must validate configuration at startup, create neither weak default secrets nor production log-mail behavior, and keep `.env`, database files, and captured assets out of version control.

The review seed creates:

- Email: `review@example.test`
- Password: `ReviewPassphrase-2026!`

The seed command is idempotent and permitted only outside production.

## Automated Verification

Run fast checks first:

```bash
npm run typecheck
npm run lint
npm run test:unit
npm run test:integration
npm run test:contract
```

Expected outcome: every command exits zero; integration tests use isolated temporary databases and asset directories and leave no state in the review database.

Run browser tests with the installed browser revision:

```bash
PLAYWRIGHT_BROWSERS_PATH=/opt/playwright-browsers npm run test:e2e
```

Expected outcome: Playwright 1.61.0 runs the core scenarios at desktop and phone viewports without downloading another browser.

Run scale acceptance checks:

```bash
npm run test:performance
```

Expected outcome:

- the seeded 10,000-bookmark library meets the 1-second search/filter/sort target in at least 95% of recorded runs under the documented test environment;
- a 1,000-match bulk action accounts for every selected item;
- changed all-match counts block archive/delete execution pending reconfirmation.

## Build and Start

```bash
npm run build
npm start
```

Expected outcome:

- one foreground Fastify process listens on `0.0.0.0:4000`;
- `curl http://127.0.0.1:4000/health/ready` returns `200` only after migrations and storage checks finish;
- the client is available to the client reviewer at `http://maker:4000/`;
- the visible application root receives `data-harness-ready="true"` only after session and initial-library loading reaches a valid page or empty state.

After successful build/start verification, implementation writes:

```json
{"kind":"application","port":4000,"path":"/","start_command":["npm","start"],"start_cwd":"/work"}
```

to `/work/.harness/app.json`.

## End-to-End Acceptance Walkthrough

Use a fresh review account unless a scenario says otherwise.

### 1. Rich Bookmark Capture

1. Choose “Add bookmark” and paste a controlled public test page that publishes Open Graph title, description, image, and an icon.
2. Confirm all four values appear as proposals within the metadata target.
3. Edit the title and description, remove or replace one visual, add a formatted note with a heading, bold text, a list, and a link, then save.
4. Open the bookmark detail view and confirm the user edits and safe formatting are preserved.
5. Repeat using controlled unreachable and partial-metadata URLs; confirm a valid URL remains savable with field-specific warnings and a fallback title.

Evidence: P1, FR-003–FR-013, SC-001–SC-003.

### 2. Read Later and Favorites Independence

1. Add a bookmark to Read Later and favorite it.
2. Confirm it appears in both views.
3. Mark it read from Read Later; confirm it leaves Read Later but remains a favorite and in the main library.
4. Mark it unread; confirm it returns to Read Later.

Evidence: P2, FR-014–FR-016, SC-004.

### 3. Tags First, Collections Optional

1. Create several tags and type a prefix in another bookmark's tag field.
2. Select suggestions and apply multiple tags without selecting a collection.
3. Confirm the bookmark appears under every tag and all tag search/filter features work.
4. Optionally assign one collection and confirm the tags remain unchanged.
5. Exercise confirmed tag merge/delete and collection delete; confirm bookmarks survive and collection removal makes them unfiled.

Evidence: P2 organization story, FR-020–FR-026, SC-008.

### 4. Archive and Permanent Delete

1. Archive an unread favorite with tags, collection, note, and media.
2. Confirm it disappears from the main, favorites, Read Later, and normal search views and appears in Archive.
3. Search within Archive, restore it, and confirm every prior field/state returns.
4. Permanently delete a separate bookmark from Archive; cancel once, then confirm, and verify it cannot be found afterward.

Evidence: P2 archive story, FR-017–FR-019, SC-005.

### 5. Search Grammar and Saved Searches

1. Seed bookmarks with known words, phrases, notes, and tags.
2. Verify ordinary terms, `#tag`, quoted phrases, implicit AND, and explicit `NOT`, `AND`, and `OR` against the conformance cases in [search-syntax.md](./contracts/search-syntax.md).
3. Submit an unclosed quote and a missing operand; confirm the query text remains and the error identifies the failing range.
4. Add included and excluded tag filters, reading/favorite/collection criteria, and a sort order; save the search.
5. Change the library, reopen the saved search, and confirm it restores criteria and evaluates current data rather than a frozen list.

Evidence: P3 search and saved-search stories, FR-027–FR-035, SC-006–SC-007.

### 6. Bulk Actions and Dynamic Matches

1. Create a filtered result set spanning more than one page.
2. Select individual items and verify the exact count.
3. Choose all matches and verify the count includes non-visible matches.
4. Apply tags, reading state, and favorite state; confirm exact success/failure accounting.
5. Preview an archive action, make another bookmark start matching in a second session, then execute; confirm no mutation and a `selection_changed` reconfirmation response.
6. Preview again, execute archive, restore the selection, and finally verify permanent deletion requires the exact-count confirmation.

Evidence: P3 bulk story, FR-036–FR-040, SC-009.

### 7. Privacy, Recovery, and Concurrency

1. Create two accounts with distinct bookmarks, tags, collections, assets, and saved searches.
2. Attempt every resource type from the other account and confirm indistinguishable `404` responses with no content leakage.
3. Request recovery for existing and nonexistent emails and confirm identical public responses; use the development mail link once, verify reuse fails, and confirm old sessions are revoked.
4. Open one bookmark in two sessions, save the first edit, then submit the stale second edit and confirm a `409` preserves the newer content.

Evidence: P4 private-library story, FR-001–FR-002, FR-041, FR-044, SC-010–SC-011.

### 8. Responsive and Readiness Review

1. Repeat capture, detail, search, saved-search, selection, and bulk confirmation on phone and desktop viewport projects.
2. Verify keyboard navigation, visible focus, labeled controls, error announcements, touch-target usability, and no horizontal page overflow.
3. Confirm empty Library, Read Later, Archive, and no-match states are distinct and actionable.
4. Confirm `data-harness-ready="true"` is absent during loading/fatal failure and present for a fully loaded valid empty state.

Evidence: FR-042–FR-043, SC-012.

## Security Regression Set

Automated controlled fixtures must cover:

- direct and DNS-resolved loopback/private/link-local IPv4 and IPv6;
- a public URL redirecting to a blocked address;
- embedded URL credentials, unsupported protocols, redirect loops, timeouts, oversized/compression-expanded bodies, and content-type mismatches;
- malicious Markdown/raw HTML and unsafe link protocols;
- missing/invalid/foreign CSRF tokens and cross-site state-changing requests;
- session fixation, expired/revoked sessions, reset-token reuse, and login/recovery throttling;
- foreign media-asset attachment and access;
- raw FTS syntax, quotes, and operator-like inputs that must never become unparameterized SQL.

All must fail closed without corrupting previously persisted user data.

## Troubleshooting Expectations

- Startup configuration failures must name the missing/invalid setting and exit nonzero.
- Migration failure must prevent readiness and leave the prior schema transactionally intact.
- Metadata fixture failures should return structured warnings or problems, not crash the server.
- A missing asset file should render the UI's visual fallback, record a server warning with request/resource IDs, and leave bookmark editing available.
- Browser-test failures should retain Playwright traces/screenshots under the ignored test-results directory.
