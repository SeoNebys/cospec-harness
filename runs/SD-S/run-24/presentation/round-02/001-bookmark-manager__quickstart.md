# Quickstart Validation Guide: Personal Bookmark Manager

This guide defines how the completed implementation will be prepared and validated. Commands become runnable during the implementation phase; no application code exists at the planning gate.

## Prerequisites

- Node.js 24.15 or newer (the project environment provides Node 24.21.0)
- npm with the committed lockfile
- Chromium matching Playwright 1.61.0 at `/opt/playwright-browsers`
- Write access to the repository's `data/` directory for local runtime use

## Prepare the Application

From `/work`:

```bash
npm ci
npm run build
```

Expected result: dependency installation uses the lockfile, type checking and production builds complete, and no browser download is attempted.

## Run Automated Validation

```bash
npm run format:check
npm run lint
npm run typecheck
npm run test
npm run test:integration
npm run test:e2e
```

Expected result: all static checks, unit/component tests, API integration tests, and Chromium acceptance tests pass. The browser suite uses isolated temporary databases and does not alter `data/bookmarks.sqlite`.

## Start the Prepared Application

```bash
npm start
```

Expected result:

- The foreground server listens on `0.0.0.0:4000` unless `PORT` is explicitly set.
- The application is available to the client at `http://maker:4000/`.
- `GET http://127.0.0.1:4000/api/bookmarks` returns a JSON collection response.
- The visible application receives `data-harness-ready="true"` only after its initial collection request resolves to loaded data or a valid empty state.

## Manual Acceptance Walkthrough

### 1. Save and reopen a bookmark (P1)

1. Start from the empty collection and choose **Add bookmark**.
2. Enter a title and a valid HTTP(S) link; optionally enter notes and tags.
3. Save and verify the item shows its title, destination, tags, status, and dates.
4. Activate the destination and verify it opens separately while the collection remains in place.
5. Close and restart the application; verify the bookmark remains.

Expected result: the primary save/revisit flow completes in under 60 seconds without instruction beyond visible labels.

### 2. Validate bad and duplicate links

1. Attempt to save a missing title, malformed URL, and non-HTTP(S) URL.
2. Verify specific field messages appear and all other typed values remain.
3. Save a valid bookmark, then attempt to save the same normalized destination again, including an equivalent trailing-slash form.
4. Follow the duplicate notice to the existing bookmark.

Expected result: invalid or duplicate data is never stored; the duplicate response reveals the existing item.

### 3. Search, filter, and sort (P2)

1. Create bookmarks with overlapping and distinct titles, URL text, notes, and tags.
2. Search each supported field using mixed capitalization and punctuation.
3. Select two tags and verify results contain both tags.
4. Exercise favorite and active/archived filters.
5. Exercise newest, oldest, title, and recently updated sorts.
6. Force a no-results state, then reset all search/filter values in one action.

Expected result: each control updates the visible set and order within one second, no-results differs clearly from an empty collection, and reset restores the default active/newest view.

### 4. Maintain the collection (P3)

1. With a non-default search/filter/sort active, edit a matching bookmark.
2. Favorite/unfavorite it, archive/restore it, and verify the view settings do not reset.
3. Open the delete confirmation, cancel, and verify nothing changes.
4. Reopen it, confirm deletion, and verify the item is permanently removed.

Expected result: every mutation is reflected in the current view; a bookmark disappears only if its new state no longer matches that view; deletion never occurs without confirmation.

### 5. Accessibility and responsive behavior

1. Complete the P1 and P3 flows using only the keyboard.
2. Verify visible focus, logical focus order, dialog containment, Escape cancellation, and focus restoration.
3. Verify errors and mutation results are announced by a screen reader.
4. Inspect at 200% zoom, 320 CSS-pixel width, and forced-colors/high-contrast mode.
5. Run the axe-backed browser checks across empty, populated, form-error, duplicate, filtered, and confirmation-dialog states.

Expected result: the experience targets WCAG 2.2 AA across desktop and narrow viewports. Automated scans report no detectable A/AA violations; passing automation alone is not treated as full conformance proof.

### 6. Scale target

Run the browser performance scenario, which seeds exactly 5,000 deterministic bookmarks through a non-production test fixture and then searches, filters by multiple tags, changes status, and sorts.

Expected result: every result update becomes visible within one second, the known target can be found in under ten seconds of user interaction, and no older bookmark is omitted because of an implicit result cap.

## Design References

- [Approved specification](spec.md)
- [Implementation plan](plan.md)
- [Data model](data-model.md)
- [API contract](contracts/openapi.yaml)
- [Research decisions](research.md)
