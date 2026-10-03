# Quickstart and Validation Guide

This guide describes the commands and end-to-end checks the completed implementation must support. It is a plan artifact; application commands become runnable during the implementation phase.

## Prerequisites

- Node.js 24 LTS and npm
- The browser binaries already installed at `/opt/playwright-browsers`
- Writable persistent directory `/work/data`
- No external mail service for local validation; the development mail sink is used

## Prepare the Application

```bash
cd /work
npm ci
cp .env.example .env
npm run db:migrate
SEED_REVIEW_USER=true npm run db:seed
npm run build
```

The local validation configuration must include:

```dotenv
APP_BASE_URL=http://maker:4000
BETTER_AUTH_SECRET=replace-with-at-least-32-random-bytes
DATABASE_PATH=/work/data/bookmarks.db
MAIL_TRANSPORT=memory
SEED_REVIEW_USER=true
```

`BETTER_AUTH_SECRET` above is a placeholder; generate a high-entropy value for every real environment. Do not commit `.env` or `data/`.

## Run

```bash
npm start
```

The prepared start script must listen on `0.0.0.0:4000`. Open `http://maker:4000/bookmarks` from the client review environment. The unauthenticated route redirects to sign-in.

Review credentials after seeding:

- Email: `reviewer@example.com`
- Password: `Review-Bookmark-2026!`

## Automated Verification

```bash
npm run lint
npm run typecheck
npm run test
npm run test:contract
PLAYWRIGHT_BROWSERS_PATH=/opt/playwright-browsers npm run test:e2e
npm run test:performance
```

Expected result: every command exits successfully. Contract tests validate [the application API](contracts/openapi.yaml) and [authentication flows](contracts/auth.md); integration tests use temporary databases and do not modify `/work/data/bookmarks.db`.

## Scenario 1 — Address-Only Save and Metadata

1. Sign in with the review account.
2. Paste the URL of the deterministic metadata fixture page into the save field; do not enter a title.
3. Save the bookmark.
4. Confirm within five seconds that the card shows the fixture's published title, description, and raster icon.
5. Open the bookmark and confirm its stored address is used.
6. Edit the generated title, save it, and reload the library.
7. Confirm the edited title remains and is not overwritten.

Expected result: the save requires only an address, the available metadata appears, and the custom title persists.

## Scenario 2 — Metadata Failure Fallback

1. Submit the deterministic unreachable-page fixture address.
2. Wait for the bounded metadata attempt to finish.
3. Confirm the bookmark is present with a readable address-derived title.
4. Confirm the UI explains that page details were unavailable without exposing internal network information.
5. Edit the fallback title and save.

Expected result: retrieval failure never discards a valid bookmark.

## Scenario 3 — Duplicate Decision

1. Submit an address that already exists in the current user's library.
2. Confirm the app warns about the existing bookmark without creating another copy.
3. Choose “Save another copy.”
4. Confirm exactly one additional bookmark is created.

Expected result: duplicates require an explicit user decision.

## Scenario 4 — Organize and Find

1. Add `Design` and `Reference` tags to one bookmark, add `Design` to another, and favorite the first.
2. Search for text found separately in a title, address, retrieved description, notes, and tag.
3. Apply both tag filters and confirm only bookmarks containing both remain.
4. Apply the favorite filter and confirm the active controls are visible.
5. Clear all filters with the single clear action.
6. Search for a phrase with no matches and confirm an actionable empty state.

Expected result: search covers every specified field, selected tags use intersection semantics, and filter state remains understandable.

## Scenario 5 — Maintain the Library

1. Edit a bookmark title, address, notes, and tags; reload and confirm persistence.
2. Favorite and unfavorite it.
3. Archive it and confirm it leaves the active library.
4. Open the archive and restore it.
5. Start permanent deletion, cancel the confirmation, and confirm the bookmark remains.
6. Delete again and confirm; verify it disappears from lists and search.

Expected result: every state transition matches [the data model](data-model.md), and permanent deletion always requires confirmation.

## Scenario 6 — Account Isolation

1. Create a second test account.
2. While signed in as the review user, capture one bookmark ID and icon URL.
3. Sign in as the second user and request those URLs directly.
4. Attempt update and deletion using the first user's ID.

Expected result: every attempt returns the same not-found behavior as a nonexistent resource, and no first-user content is exposed or changed.

## Scenario 7 — Recovery

1. Request password recovery for the review account and for an unknown email.
2. Confirm both flows show the same accepted response.
3. Obtain the review account's link from the test mail sink and set a new valid password.
4. Confirm the link cannot be reused and pre-reset sessions no longer work.

Expected result: recovery works without account enumeration and revokes existing sessions.

## Security and Performance Gates

- Run the metadata security suite against loopback/private/link-local IPv4 and IPv6, cloud metadata targets, mixed public/private DNS answers, safe-to-private redirects, credential-bearing URLs, oversized/slow responses, redirect loops, and non-HTML bodies. No guarded request may connect to a non-public destination.
- Seed 10,000 bookmarks and 500 tags for one user. At least 95% of the representative search/filter trials must complete within two seconds.
- Run keyboard-only and automated accessibility checks at desktop and mobile widths. Save, search/filter, edit, archive/restore, confirmation, authentication, errors, and empty states must be operable and announced.

## Runtime Handoff

After all checks pass, create `/work/.harness/app.json`:

```json
{"kind":"application","port":4000,"path":"/bookmarks","start_command":["npm","start"],"start_cwd":"/work"}
```

The rendered sign-in or library root receives `data-harness-ready="true"` only after its initial session/data state is known. A loading or error placeholder must not carry the marker.
