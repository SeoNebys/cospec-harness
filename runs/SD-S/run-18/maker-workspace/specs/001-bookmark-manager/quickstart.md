# Quickstart and Validation Guide: Bookmark Manager

This guide defines the runnable setup and end-to-end checks supported by the implementation. Final recorded results are in `validation-results.md`.

## Prerequisites

- Node.js 24 LTS and npm
- The repository at `/work`
- Chromium already installed at `/opt/playwright-browsers`
- Outbound DNS and HTTP(S) access only when manually validating real-page metadata

No external database, hosted authentication provider, or second application server is required.

## Configure

```bash
cd /work
cp .env.example .env
```

Set the following values in `.env`:

```dotenv
NODE_ENV=development
HOST=0.0.0.0
PORT=4000
DATABASE_PATH=/work/data/bookmarks.sqlite
BETTER_AUTH_SECRET=<at-least-32-random-bytes>
BETTER_AUTH_URL=http://maker:4000
BETTER_AUTH_TRUSTED_ORIGINS=http://maker:4000,http://127.0.0.1:4000
REVIEW_MODE=1
```

Review origins are development-only. Production uses its exact HTTPS origin, secure cookies, a production secret, `REVIEW_MODE=0`, and network egress controls that deny internal destinations.

## Install and prepare

```bash
npm install
npm run db:migrate
npm run seed:review
```

The seed command must be idempotent, print the two configured review identities, and refuse to run when `NODE_ENV=production`. It creates distinct Alice and Bob accounts through the authentication library's supported server API; runtime signup remains disabled.

## Run for development

```bash
npm run dev
```

Open `http://maker:4000/`. The server must listen on `0.0.0.0:4000`; do not use localhost for client review guidance.

## Build and run the prepared application

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm start
```

`npm start` must be a foreground production-server command honoring `HOST` and `PORT`. Migrations and seeding are completed before start rather than hidden in the start command.

The shared review harness uses `npm run start:review` to provide its development-only origin, secret, and review-mode settings. It must never be used as the production command.

## Automated validation

```bash
npm run test:unit
npm run test:integration
npm run test:security
npm run test:contract
npm run test:e2e
```

Expected results:

- Unit/component tests cover normalization, metadata state, dirty-field protection, fallback titles, tags, filters, and dialogs.
- Integration tests apply committed migrations to temporary SQLite files and prove transactional writes, duplicate constraints, owner scoping, and session behavior.
- Security tests cover special IP forms/ranges, mixed DNS answers, rebinding, redirect pivots, deadlines, byte limits, response types, sanitization, and inert parsing.
- Contract tests validate all resource responses against `contracts/openapi.yaml`.
- Playwright 1.61.0 starts the built app on port 4000 with a reset test database and one worker.

## Manual acceptance journey

### 1. Automatic metadata and save

1. Sign in as Alice.
2. Paste a publicly reachable page URL into the quick-save form.
3. Confirm that a retrieval indicator appears and the page title is filled without typing it.
4. If the page declares a short description, confirm it is filled too.
5. Edit the title and verify that a late preview response does not overwrite the edit.
6. Add two tags and save.
7. Refresh the library and open the saved destination.

Expected: the edited title, description if available, URL, tags, and saved date persist. The destination opens without removing the bookmark.

### 2. Metadata fallback

1. Paste a valid HTTP(S) bookmark URL that cannot be inspected, using the controlled fallback fixture from `tests/fixtures` when running automated checks.
2. Wait for inspection to finish.
3. Save without typing a title.

Expected: the app supplies a readable hostname/path title, leaves the description blank, gives a safe explanation, and allows saving.

### 3. Duplicate handling

1. Attempt to save Alice's first URL again using differences that normalize away, such as host capitalization or a fragment.

Expected: no duplicate is created; the UI links to the existing bookmark. Saving the same normalized URL as Bob is allowed.

### 4. Organize, search, and filter

1. Create bookmarks with overlapping title, URL, description, and tag terms.
2. Search for a term present in each supported field.
3. Apply a tag filter while search remains active.
4. Clear both controls in one action.

Expected: matching is case-insensitive; combined results satisfy both constraints; a no-match state offers reset; clearing restores newest-first listing.

### 5. Edit and delete

1. Change a bookmark's URL, title, description, and tags.
2. Refresh and confirm persistence.
3. Start deletion and cancel it.
4. Start deletion again and confirm it.

Expected: valid edits persist atomically; cancel keeps the bookmark; confirmation permanently removes it and reports success.

### 6. Owner isolation

1. Keep Alice and Bob signed in through two separate browser contexts.
2. Create a bookmark/tag as Alice.
3. Search and filter as Bob, then issue direct fetch, update, delete, and tag-association requests using Alice's known IDs.
4. Sign out and repeat a resource request.

Expected: Bob never sees Alice's data; foreign IDs return `404`; unauthenticated requests return `401`; Alice's rows remain unchanged. Bob can save the same URL in Bob's library.

### 7. Scale and timing

1. Seed 1,000 bookmarks for Alice.
2. Load the library and search for a known item under the documented normal test profile.
3. Run metadata preview against the controlled fast fixture set.

Expected: library/search views become usable within 2 seconds for at least 95% of runs; qualifying title previews complete within 3 seconds for at least 95% of runs.

## Presentation readiness

After all checks pass, implementation creates `/work/.harness/app.json`:

```json
{"kind":"application","port":4000,"path":"/","start_command":["npm","start"],"start_cwd":"/work"}
```

The sign-in page or loaded library carries `data-harness-ready="true"`; loading and error placeholders do not.
