# Quickstart and Validation Guide: Bookmark Manager

**Status**: Commands and automated acceptance scenarios validated on 2026-09-18.

## Prerequisites

- Node.js 24.15 or newer within the Node 24 LTS line
- npm
- Chromium installed at the environment-provided Playwright browser path

No external database or third-party service is required. Automated metadata tests use controlled fixtures rather than public websites.

## Install and Configure

From `/work` after implementation:

```bash
npm ci
```

Optional runtime configuration:

```text
BOOKMARK_DATA_DIR=/absolute/writable/directory
PORT=4000
HOST=0.0.0.0
```

When `BOOKMARK_DATA_DIR` is omitted, the app uses `/work/data`. Startup applies pending numbered migrations automatically.

## Development Run

```bash
npm run dev
```

The planned development command serves the application on port 4000. In the client review environment, open `http://maker:4000`. Browser automation inside the workspace uses `http://127.0.0.1:4000`.

## Production Build and Run

```bash
npm run build
npm start
```

Expected result: one foreground process listens on `0.0.0.0:4000`, serves the application and `/api`, and shows a valid library state marked with `data-harness-ready="true"` after initial loading.

## Automated Verification

```bash
npm run typecheck
npm run lint
npm run test:unit
npm run test:integration
npm run test:e2e
npm run test:a11y
npm run build
```

The default `npm test` command will run the required unit, integration, and Chromium end-to-end suites. Tests use temporary databases and must not read or modify `/work/data`.

## End-to-End Acceptance Walkthrough

### 1. Save with page details

1. Open the empty active library.
2. Paste an eligible fixture URL that publishes a title and description.
3. Confirm both fields fill within five seconds.
4. Change the title, wait for any late preview result, and confirm the edit remains.
5. Save, reload, and confirm the bookmark persists with the edited title and fetched description.
6. Open the bookmark and confirm the library remains open with its view state intact.

### 2. Save without page details

1. Enter a fixture URL whose metadata response is delayed or unavailable.
2. Save immediately while the status is loading or unavailable.
3. Confirm the bookmark saves with its normalized URL as title, blank description, and a non-blocking explanation.

### 3. Validation and duplicates

1. Enter title, description, and tags, then submit an invalid URL.
2. Confirm the error is actionable and every other field remains.
3. Save a valid URL, then try its equivalent without a scheme.
4. Confirm the duplicate warning directs to the existing bookmark rather than creating another.

### 4. Find and organize

1. Seed representative bookmarks with distinct titles, URLs, descriptions, tags, favorite states, and dates.
2. Search each supported field and combine search with multiple tags and favorite.
3. Verify active constraints are visible and can be cleared.
4. Verify newest, oldest, and title sorting.
5. Produce no matches and verify the clear action restores results.

### 5. Maintain the collection

1. Edit every mutable field and verify updates everywhere.
2. Archive a bookmark, switch to Archive, and restore it.
3. Start deletion and cancel; verify the bookmark remains.
4. Confirm deletion; verify it is absent from active and archived views.

### 6. Responsive, keyboard, and accessibility checks

1. Repeat primary workflows at 1280×720 and 320×700.
2. Verify no horizontal document scrolling, including with long content.
3. Complete save, filter, edit, archive/restore, and delete using only the keyboard.
4. Verify dialog focus entry, containment, Escape/cancel behavior, and focus return.
5. Verify metadata and validation statuses are announced and all stable states pass the configured axe scan.
6. Repeat at 200% zoom and with reduced motion enabled.

### 7. Performance criterion

1. Seed exactly 1,000 bookmarks in a temporary test database.
2. Warm the library once.
3. Measure at least 20 representative search, filter, and sort updates from interaction to settled results.
4. Confirm at least 19 complete within one second.

## Data Safety

- Runtime data lives only beneath `BOOKMARK_DATA_DIR`.
- Never reset or remove the runtime database as part of normal test commands.
- A consistent backup is a copy made while the single application process is stopped.
