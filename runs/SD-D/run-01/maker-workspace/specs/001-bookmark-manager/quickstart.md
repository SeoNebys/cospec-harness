# Quickstart and Validation Guide: Bookmark Manager

This guide defines how the implemented feature will be built, started, and proven end to end. Commands become runnable during implementation; this planning phase does not install dependencies or create application code.

## Prerequisites

- Node.js 24.21 or a compatible Node 24 release
- npm 11
- Chromium revision supplied for Playwright 1.61.0
- Write access to the local data directory

No external database or identity service is required.

## Prepare

    npm ci
    npm run db:migrate

Create a local review account without embedding credentials in production defaults:

    REVIEW_EMAIL=review@example.test REVIEW_PASSWORD='Review-Only-Password-42' npm run seed:review

## Verify Before Starting

Run static checks, unit/component tests, API integration and contract tests, a production build, then browser acceptance tests:

    npm run typecheck
    npm run lint
    npm test
    npm run test:contract
    npm run build
    npm run test:e2e

Tests use temporary SQLite databases. Metadata-fetch tests use injected DNS and HTTP fixtures and must not depend on arbitrary live websites.

## Start the Prepared Application

    npm start

Expected behavior:

- Fastify listens on 0.0.0.0:4000.
- GET /api/v1/health returns status ready after migrations and database checks succeed.
- The review application is available at http://maker:4000/.
- The initial authenticated UI or login page carries data-harness-ready=true only after usable state has loaded.

The implementation phase must write:

    {"kind":"application","port":4000,"path":"/","start_command":["npm","start"],"start_cwd":"/work"}

to /work/.harness/app.json after dependencies and the production build are complete.

## End-to-End Validation Scenarios

### 1. Account Isolation

1. Create two users.
2. Save a bookmark, tag, and import preview as user A.
3. Attempt direct reads, changes, icon reads, import status reads, and export access using user B.
4. Confirm every attempt returns not found or unauthorized without revealing title, URL, notes, tags, icon bytes, or counts.

### 2. Metadata-Assisted Save

1. Sign in and paste a fixture public URL.
2. Confirm title, description, and site icon are previewed.
3. Edit title and description, select an existing suggested tag, mark read later, and save.
4. Confirm the edited values win, the icon is served from this app, and the bookmark appears in both the active collection and unread read-later view.
5. Paste an equivalent URL differing only by host case, fragment, or root trailing slash and confirm the existing bookmark is offered rather than duplicated.
6. Repeat with missing metadata, timeout, unsupported public port, invalid icon, and unreachable page fixtures; confirm usable fallbacks and a successful manual save.

### 3. Read-Later State

1. Mark an unread item read and confirm it leaves the default unread queue but remains in the collection.
2. Mark it unread and confirm it returns.
3. Remove it from read later and confirm it is in neither read state.
4. Confirm favorite state remains unchanged through all transitions.

### 4. Search, Filters, and Sorting

1. Seed at least 1,000 bookmarks with overlapping words, phrases, tags, dates, and states.
2. Search two unquoted words and confirm both are required across searchable fields.
3. Search a quoted phrase and confirm only adjacent words in the same field match.
4. Submit an unmatched quote and confirm an inline correction rather than a server error.
5. Select two tags and confirm only bookmarks containing both appear.
6. Combine a text query, tags, favorite/read-later state, and each title/date sort direction.
7. Clear controls and confirm the newest-first active view returns.

### 5. Tag Suggestions

1. Create tags Research and Research Methods.
2. Type rese in a tag field.
3. Confirm both existing tags appear case-insensitively, prefix matches are first, and keyboard selection works.
4. Attempt to create research with different letter case and confirm the existing Research tag is reused.
5. Remove a tag from its last bookmark and confirm it disappears from filters and suggestions.

### 6. Archive, Restore, and Delete

1. Archive an unread read-later favorite.
2. Confirm it disappears from active and read-later views and appears in the archive.
3. Restore it and confirm all details, favorite state, and unread read-later state return.
4. Cancel a permanent-delete confirmation and confirm no change.
5. Confirm deletion and verify the item disappears from all views and export.

### 7. Browser Import

1. Preview representative Chrome, Edge, Firefox, and Safari HTML exports containing folders, valid entries, duplicates, invalid schemes, malformed rows, and Safari Reading List data.
2. Confirm the reported new/duplicate/invalid counts before commit.
3. Commit and confirm valid rows succeed, folders become tags, Safari Reading List items are unread read-later items, and failures are listed without rolling back valid browser rows.
4. Interrupt and retry a large import; confirm already committed rows are not duplicated.

### 8. Export and Complete Restore

1. Create active, archived, favorite, unread, and read bookmarks with notes, tags, dates, and icons.
2. Download browser HTML and complete JSON exports.
3. Confirm browser HTML is importable by a browser-family fixture and is labelled as lossy.
4. Validate complete JSON against contracts/backup.schema.json and confirm it contains no account, password, session, canonical-key, or local database identifiers.
5. Import it into an empty second account and compare every exported field and state.
6. Attempt restore into a non-empty account and confirm no mutation occurs.

### 9. Metadata Security Boundary

Run the deterministic security matrix described in [research.md](research.md):

- Private, loopback, link-local, special-purpose, mixed public/private DNS, and rebinding targets.
- IP literals, credentialed URLs, unsupported schemes/ports, redirect cycles, downgrade redirects, and more than five hops.
- Slow headers/body, oversized headers, declared and streamed oversize bodies, decompression bombs, and wrong content types.
- Malformed/hostile HTML and image inputs, including SVG, fake MIME types, excessive pixels, animation, and malicious icon redirects.

For every rejected retrieval, confirm no internal response content is returned, the request is cancelled, and bookmark fallback/save behavior remains usable.

### 10. Accessibility and Responsive Presentation

1. Complete save, search, read-later, edit, archive, restore, import, export, and delete workflows using only a keyboard.
2. Confirm focus is visible and restored after dialogs, status changes are announced, controls have meaningful accessible names, and errors are associated with fields.
3. Run the acceptance suite at desktop and mobile viewports.
4. Confirm no horizontal overflow or inaccessible action menus at the supported mobile width.

## Acceptance Evidence

Implementation is ready for client review only when:

- All commands above pass from a clean install.
- The built server starts with npm start and responds on port 4000.
- Playwright has exercised the interactions being claimed.
- Runtime logs contain no unhandled exceptions or failed migrations.
- The harness readiness marker is present only on a usable state.

