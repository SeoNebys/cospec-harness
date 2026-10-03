# Quickstart and Validation: Personal Bookmark Manager

This guide defines how the completed implementation will be built, started, and validated. Commands become runnable during the implementation phase; no application code or dependencies are created by this planning phase.

## Prerequisites

- Node.js 24.x and npm
- Chromium from the shared Playwright 1.61.0 browser installation
- A writable application data directory
- Network access only for manual title-preview checks; automated tests use controlled fixtures

## Install and configure

```bash
npm ci
cp .env.example .env
```

The example environment documents at least:

- `HOST=0.0.0.0`
- `PORT=4000`
- a database path below `/work/data`
- production/development cookie mode
- session expiry settings

Secrets and the runtime database are excluded from version control. No third-party service credentials are required.

## Quality checks

```bash
npm run format:check
npm run lint
npm run typecheck
npm test
npm run test:e2e
npm run build
```

Expected result: every command exits successfully. The test suite includes contract validation, domain/service integration, title-fetch safety fixtures, component behavior, and end-to-end user journeys.

## Run the production-shaped application

```bash
npm start
```

Expected result:

- The server binds `0.0.0.0:4000`.
- `GET /api/health` reports ready only after migrations complete and the database is usable.
- The built web client is served at `/`.
- For client review, the URL is `http://maker:4000/`.
- For local browser automation, the URL is `http://127.0.0.1:4000/`.
- A visible loaded application state includes `data-harness-ready="true"`; loading and fatal-error placeholders do not.

## Required end-to-end scenarios

### 1. Automatic title suggestion and save

1. Create an account and open the new-bookmark dialog.
2. Paste the URL of the controlled HTML fixture and do not touch the title field.
3. Confirm “Finding title…” appears without a button press.
4. Confirm the fixture title populates automatically and remains editable.
5. Add notes and two tags, mark the bookmark as a favorite, and save.
6. Reload and sign in again.

Expected: all saved values persist and the bookmark appears newest-first. This proves FR-002–FR-005, FR-008, FR-009, FR-015, and FR-020.

### 2. Title fallback and race protection

Run controlled fixtures for timeout, redirect to a private address, non-HTML content, oversized content, and HTML without a title. Also start a slow valid preview and type a manual title before it returns.

Expected: every failure leaves the form usable and preserves input; blocked/private resources are never contacted; the slow response never overwrites the manual title. Saving succeeds once a valid manual title is present.

### 3. Duplicate warning

1. Save a URL.
2. Try variants using host capitalization, a default port, a fragment, and a trailing slash.
3. From the warning, open or edit the existing bookmark.
4. Repeat and explicitly continue with a duplicate.

Expected: no duplicate is silently created; the existing item is identified; explicit continuation creates the requested second record without losing the draft.

### 4. Search and filters

Seed varied titles, URLs, notes, tags, and favorite states. Search each field, select two tags, add the favorite filter, clear all filters, and exercise the no-results state.

Expected: partial case-insensitive search covers all specified fields; tag filters use intersection semantics; filters combine; clearing resets everything in one action.

### 5. Edit, archive, restore, and delete

Edit every bookmark field, archive it, find it only in the archived view, restore it, then request deletion. Cancel once and confirm once.

Expected: edits persist, lifecycle views remain isolated, cancellation preserves the item, and confirmed deletion permanently removes it.

### 6. Ownership isolation

Create two accounts and one bookmark for each. While signed in as the second account, attempt every read and mutation route using the first account's bookmark and tag identifiers.

Expected: no response reveals the other user's data; all resource attempts behave as not found. Search and tag counts remain account-scoped.

### 7. Scale target

Use the deterministic fixture command to create 10,000 bookmarks for one account, then run representative title, URL, notes, single-tag, multi-tag, favorite, and combined queries.

Expected: visible results settle within one second under the documented test environment and pagination remains stable without duplicates or gaps.

## Contract and data references

- API operations and response shapes: [contracts/openapi.yaml](contracts/openapi.yaml)
- Browser interaction rules: [contracts/ui-behavior.md](contracts/ui-behavior.md)
- Persistence rules and transitions: [data-model.md](data-model.md)

## Review-runtime handoff

After implementation and successful build, create `/work/.harness/app.json` with:

```json
{"kind":"application","port":4000,"path":"/","start_command":["npm","start"],"start_cwd":"/work"}
```

The start command only launches the already prepared application; dependency installation, migrations packaging, and client build complete beforehand.
