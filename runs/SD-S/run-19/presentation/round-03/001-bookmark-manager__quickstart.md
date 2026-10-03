# Quickstart and Validation Guide: Bookmark Manager

This guide defines how the completed implementation will be installed, run, and validated. Commands become runnable during the implementation phase.

## Prerequisites

- Node.js 24.x and npm 11.x
- Chromium provided for Playwright 1.61.0
- A writable `data/` directory
- Optional outbound HTTP(S) access for manual live metadata checks; automated tests use deterministic fixtures

## Install and Build

```bash
npm ci
npm run build
```

Expected result: dependencies install from the lockfile, type checking succeeds, and production client/server output is prepared without warnings treated as errors.

## Automated Validation

```bash
npm test
npm run test:e2e
```

Expected result:

- Unit and integration tests pass for URL policy, metadata parsing/fallback, repository behavior, API contracts, and UI states.
- Playwright passes the approved user journeys at desktop and mobile-sized viewports.
- The end-to-end suite uses an isolated temporary database and deterministic remote-page fixtures.

Run the 10,000-bookmark acceptance benchmark separately:

```bash
npm run test:performance
```

Expected result: search and tag-filter results become visible within two seconds under the documented test conditions.

## Start the Production Application

```bash
npm start
```

Expected result: one foreground server listens on `0.0.0.0:4000`, applies database migrations, serves the interface at `http://maker:4000/`, and exposes the API described in [contracts/openapi.yaml](contracts/openapi.yaml).

The implementation phase must also create `.harness/app.json` with:

```json
{
  "kind": "application",
  "port": 4000,
  "path": "/",
  "start_command": ["npm", "start"],
  "start_cwd": "/work"
}
```

The initial usable library or valid empty state must expose `data-harness-ready="true"`.

## Acceptance Walkthrough

### 1. Save and reopen a bookmark

1. Open `http://maker:4000/` and confirm the empty library state is clear.
2. Paste a public URL for a page that provides a title and description.
3. Confirm the title and available description appear automatically within five seconds.
4. Edit the title, add two tags, and save.
5. Confirm the bookmark appears first in the library and opens in a new tab without clearing the library view.
6. Restart the server and confirm the bookmark and edits remain.

### 2. Verify fallback saving

1. Submit a syntactically valid public URL whose page is unavailable or lacks usable metadata.
2. Confirm a readable address-derived title and non-blocking warning appear.
3. Save without typing a replacement title and confirm the bookmark appears.
4. Submit an invalid scheme and a local/private network address; confirm both are rejected with actionable messages.

### 3. Verify duplicate handling

1. Submit a URL equivalent to an existing bookmark after normalization.
2. Confirm the app warns about the existing bookmark and does not create another immediately.
3. Cancel once and verify the count is unchanged.
4. Repeat and explicitly continue; confirm the deliberate duplicate is created.

### 4. Search and filter

1. Add bookmarks whose titles, descriptions, URLs, and tags contain distinct terms.
2. Search each field using different letter casing and confirm only matching bookmarks appear.
3. Apply a tag filter together with search text and confirm the result is the intersection.
4. Use criteria with no matches and confirm a clear empty result with a reset action.
5. Clear criteria and confirm all bookmarks return in newest-first order.

### 5. Edit and delete

1. Edit a bookmark's URL, title, description, and tags and confirm all valid changes persist after reload.
2. Attempt an invalid URL edit and confirm the saved bookmark remains unchanged.
3. Start deletion, cancel, and confirm the bookmark remains.
4. Start deletion again, confirm it, and verify the bookmark is absent from normal, search, and filtered views.

## Contract and Model References

- API behavior: [contracts/openapi.yaml](contracts/openapi.yaml)
- Persistence rules and state transitions: [data-model.md](data-model.md)
- Technical decisions and alternatives: [research.md](research.md)
