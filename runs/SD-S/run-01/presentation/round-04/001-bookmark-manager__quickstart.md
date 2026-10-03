# Validation Quickstart: Personal Bookmark Manager

**Status**: Planned commands and scenarios; runnable after implementation tasks are complete.

## Prerequisites

- Node.js 24 and npm
- The repository checked out at `/work`
- Supplied Playwright 1.61.0 Chromium available through `/opt/playwright-browsers`
- Port 4000 available for the production smoke test

No external database or network service is required. Bookmark data defaults to `data/bookmarks.db`; validation uses isolated temporary database files.

## Prepare and Verify

From `/work`:

```bash
npm ci
npm run typecheck
npm test
npm run build
npm run test:e2e
```

Expected outcomes:

- Type checking exits successfully.
- Unit, integration, component, and API contract tests pass.
- The production client and server are generated under `dist/`.
- Playwright uses the pinned 1.61.0 package and supplied Chromium rather than downloading a browser.
- End-to-end scenarios pass at desktop and small-screen viewports.

## Run the Prepared Application

```bash
npm start
```

Expected runtime behavior:

- The server listens on `0.0.0.0:4000`.
- `GET http://127.0.0.1:4000/api/health` returns a ready response.
- `GET http://127.0.0.1:4000/` serves the application.
- After initial data loads, the visible app root includes `data-harness-ready="true"`.
- For client review, use `http://maker:4000/` rather than localhost.

To run against an isolated database:

```bash
BOOKMARK_DB_PATH=/tmp/bookmark-manager-review.db npm start
```

## End-to-End Validation Scenarios

### 1. Save and Reopen

1. Open the empty active collection.
2. Add `https://example.com/reference` with a manually entered title, notes, and two tags.
3. Verify the saved details appear and persist after a page reload.
4. Activate the destination link and verify the collection remains open in its original context.
5. Attempt an invalid or unsupported address and verify actionable field feedback with preserved input.

### 2. Duplicate Choice

1. Submit the same normalized address again.
2. Verify the existing bookmark is identified and no duplicate is created automatically.
3. Cancel once and verify the count is unchanged.
4. Repeat and explicitly choose **Save another copy**; verify a second active bookmark is created.

### 3. Search, Filter, Favorite, and Sort

1. Create several bookmarks with overlapping text and different tags.
2. Search by title, address fragment, notes, and tag text.
3. Combine search, tag, and favorite filters and verify all criteria remain visible.
4. Exercise newest, oldest, recently updated, and title sorting.
5. Clear criteria and verify the full active collection returns.

### 4. Edit and Lifecycle

1. Edit a bookmark's address, title, notes, and tags and verify its updated details.
2. Favorite and unfavorite it, including from a favorites-only result set.
3. Archive it and verify it leaves the active view.
4. Restore it and verify all details and favorite state remain intact.
5. Archive it again, open permanent deletion, cancel, and verify it remains.
6. Confirm permanent deletion and verify it is removed with a completion announcement.

### 5. Empty, Error, and Recovery States

1. Verify new collection and empty archive use different guidance.
2. Apply criteria with no matches and verify **Clear filters** restores results.
3. Simulate list and mutation failures; verify retry guidance and that edits are not lost or falsely shown as saved.

### 6. Scale and Responsive Behavior

1. Seed 1,000 representative bookmarks through a test fixture.
2. Measure initial load and several combined search/filter/sort operations; each visible response must settle within 1 second under normal review conditions.
3. Complete save, search, edit, archive, restore, and delete flows at 375px and 1440px widths.
4. Assert there is no page-level horizontal overflow and that long content wraps without covering actions.

### 7. Accessibility and Readiness

1. Complete the primary flows using only the keyboard.
2. Verify dialog focus containment/restoration, field-error association, visible focus, and status announcements.
3. Run the automated WCAG A/AA scan and manually check headings, labels, contrast, target size, and reduced motion.
4. Verify loading and error placeholders lack the harness marker, while a valid loaded empty or populated state includes it.

## Contract References

- [HTTP API contract](contracts/openapi.yaml)
- [UI behavior contract](contracts/ui-behavior.md)
- [Data model and transitions](data-model.md)
- [Approved specification](spec.md)

## Harness Delivery Check

After all commands and scenarios pass, verify `.harness/app.json` contains:

```json
{"kind":"application","port":4000,"path":"/","start_command":["npm","start"],"start_cwd":"/work"}
```

The start command must launch the already-built foreground server only; it must not install dependencies or rebuild the application.
