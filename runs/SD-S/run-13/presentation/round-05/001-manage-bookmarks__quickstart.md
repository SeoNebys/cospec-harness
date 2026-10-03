# Quickstart and Validation: Bookmark Manager

This guide defines how the completed implementation will be prepared and verified. Commands become runnable during the implementation phase; this planning phase does not create application code.

## Prerequisites

- Node.js 24.x and npm
- Shared Playwright browser directory at `/opt/playwright-browsers`
- Port 4000 available

## Prepare

```bash
npm ci
npm run build
```

No browser download is required. The project pins `@playwright/test` to 1.61.0 to match the installed Chromium revision.

## Automated checks

```bash
npm run lint
npm run typecheck
npm test
PLAYWRIGHT_BROWSERS_PATH=/opt/playwright-browsers npm run test:e2e
```

Expected result: all static checks, unit tests, server integration/contract tests, and desktop/mobile browser journeys pass.

## Run the production build

```bash
npm start
```

Expected result: one foreground process listens on `0.0.0.0:4000`, applies pending migrations, serves the application and API, and stores data under `data/`.

Reviewer entry point: `http://maker:4000/`

The implementation must also write `.harness/app.json` with:

```json
{"kind":"application","port":4000,"path":"/","start_command":["npm","start"],"start_cwd":"/work"}
```

## End-to-end validation scenarios

### 1. Fast save with retrieved details

1. Open the empty library.
2. Choose **Add bookmark** and paste a controlled public fixture URL that exposes a known title and description.
3. Confirm retrieval status appears and both values populate within 5 seconds.
4. Edit the title, add notes and two tags, mark it favorite, and save.
5. Reload the page and verify every value persists.
6. Open the destination and verify the bookmark remains unchanged.

### 2. Safe fallback

1. Paste a controlled URL whose HTML has no metadata, then a controlled URL that times out or rejects access.
2. Confirm each attempt resolves within 10 seconds without an endless loading state.
3. Verify the editor shows an editable hostname-derived title, a blank description, and an actionable explanation.
4. Save successfully without manually supplying a title.

Network safety integration tests use injected DNS/transport boundaries rather than contacting private addresses. They must prove that loopback, private, link-local, reserved, multicast, credential-bearing, non-HTTP(S), and redirect-to-private destinations are rejected before connection.

### 3. Preserve user edits and handle stale details

1. Retrieve details for one address and change its populated title.
2. Change the address before saving.
3. Verify the old details are marked stale and the edited title is not silently overwritten.
4. Explicitly accept replacement details for the new address and save.

### 4. Organize and find

1. Seed bookmarks spanning several titles, URLs, descriptions, notes, tags, and favorite states.
2. Verify case-insensitive partial search finds matches in each supported field.
3. Combine one tag filter with favorites and verify logical-AND behavior.
4. Verify newest, oldest, and alphabetical sorts, including stable ordering for ties.
5. Search for a missing term, verify the no-results action, and reset it.

### 5. Duplicate, edit, and delete

1. Attempt to save an existing normalized URL and verify the existing bookmark is identified.
2. Cancel once, then explicitly confirm a duplicate and verify a second record is created.
3. Edit all supported fields and verify changes survive reload.
4. Start deletion, cancel, and verify the bookmark remains.
5. Confirm deletion and verify it is permanently removed while unrelated tags/bookmarks remain valid.

### 6. Responsive and accessible use

Run the core create, search, edit, and delete journeys in desktop Chromium and a mobile viewport. Verify keyboard reachability, visible focus, associated labels, announced validation/status messages, dialog focus containment/return, adequate touch targets, and no horizontal overflow.

### 7. Scale check

Seed 10,000 representative bookmarks, then measure search/filter/sort from action to updated visible results. At least 95% of samples must complete within 1 second in the review environment.

## Contract and model references

- HTTP behavior: [contracts/openapi.yaml](contracts/openapi.yaml)
- Persistence and validation rules: [data-model.md](data-model.md)
- Product acceptance criteria: [spec.md](spec.md)
