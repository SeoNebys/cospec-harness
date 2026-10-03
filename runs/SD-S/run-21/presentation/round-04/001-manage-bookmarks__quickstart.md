# Quickstart Validation: Bookmark Management

This guide defines the end-to-end checks the implemented application must pass. Commands become runnable after implementation tasks create the application and lockfile.

## Prerequisites

- Node.js 24 and npm
- Chromium supplied for Playwright 1.61.0
- A writable temporary directory for the validation database
- No existing service occupying port 4000

## Prepare and run

```bash
npm ci
npm run db:init
npm test
npm run build
npm start
```

The start command must listen on `0.0.0.0:4000`. Open `http://maker:4000` for client review or `http://127.0.0.1:4000` for local automated browser checks. The visible application shell receives `data-harness-ready="true"` only after its initial library state has loaded.

For isolated automated checks, set the documented test database-path variable to a fresh temporary file before database initialization. Tests must never use or remove the normal application database.

## Automated verification

```bash
npm run lint
npm run typecheck
npm test
npm run test:e2e
```

Expected result: every command exits successfully. Unit and integration coverage includes normalization, metadata precedence and failure handling, blocked network targets, duplicate detection, combined queries, status transitions, orphan-tag cleanup, and persistence. Browser coverage includes desktop and mobile viewports.

## Acceptance walkthrough

### 1. Save with gathered page information

1. Open the add-bookmark flow and submit the deterministic metadata fixture URL supplied by the test server.
2. Verify title, description, icon, and preview image appear for review.
3. Edit the title and save.
4. Verify the card shows the edited title, gathered visual details, and `To read` status.
5. Reload the application and verify the bookmark remains.

Expected: metadata reduces manual entry; the user remains in control of editable text; the bookmark defaults to to-read and survives reload.

### 2. Metadata fallback and validation

1. Submit a fixture that lacks optional metadata, then one that times out.
2. Verify available fields are retained, missing imagery has a clear fallback, and manual title/description entry remains possible.
3. Submit a malformed address and test fixture cases representing private or loopback destinations.

Expected: missing or unreachable metadata does not discard the URL or block manual creation; invalid or unsafe destinations receive actionable errors and are not fetched.

### 3. Duplicate handling

1. Submit a URL equivalent to an existing normalized URL.
2. Verify the existing bookmark is offered for editing and no duplicate is silently created.
3. Explicitly choose to save another copy.

Expected: the warning covers active and archived bookmarks, while intentional duplicates remain possible.

### 4. Read later and favorites

1. Open the To Read view and verify newly saved active bookmarks appear.
2. Mark one read and verify it leaves To Read but remains in Library.
3. Mark it to-read again and verify it returns.
4. Toggle favorite before and after reading-state changes.

Expected: reading state and favorite state remain independent.

### 5. Archive, restore, and delete

1. Archive a tagged, favorited to-read bookmark.
2. Verify it leaves Library, To Read, Favorites, and active search results but appears in Archive with all details intact.
3. Search/filter/sort the Archive, then restore the bookmark.
4. Verify all metadata and statuses return intact.
5. Begin permanent deletion and cancel; verify nothing changes. Repeat and confirm deletion.

Expected: archive is reversible and separate from confirmed permanent deletion.

### 6. Search, filters, tags, and sorting

1. Create bookmarks whose match text occurs separately in title, URL, description, notes, and tags.
2. Verify each can be found case-insensitively.
3. Combine search with tag, favorite, and reading filters.
4. Verify date-added, title, and recently-updated sorts, including stable ordering for ties.
5. Remove the last use of a tag and verify it is no longer offered as a filter.

Expected: all results satisfy every active criterion, and empty results explain how to reset criteria.

### 7. Scale, responsive layout, and accessibility

1. Run the provided data-seeding helper for 10,000 bookmarks.
2. Confirm search/filter updates appear within two seconds in the test environment.
3. Repeat primary flows at desktop and mobile viewport sizes.
4. Navigate primary actions with the keyboard and verify focus behavior, labels, status announcements, and confirmation-dialog focus containment/restoration.

Expected: the library remains usable at target scale and primary flows do not require a pointer.

## Contract and model references

- Request and response shapes: [contracts/openapi.yaml](contracts/openapi.yaml)
- Persistence rules and state transitions: [data-model.md](data-model.md)
