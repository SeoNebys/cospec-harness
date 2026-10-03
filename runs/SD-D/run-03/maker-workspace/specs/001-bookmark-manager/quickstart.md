# Quickstart and Validation Guide

This guide defines how the completed implementation will be built, run, and verified. Commands become runnable during the implementation phase; no application code exists at the planning gate.

## Prerequisites

- Node.js 24.x and npm 11.x
- The shared Playwright Chromium installation at `/opt/playwright-browsers`
- A writable local `data/` directory for the SQLite database
- Port 4000 available

## Install and Verify

```bash
npm ci
npm run format:check
npm run lint
npm run typecheck
npm run test:unit
npm run test:integration
npm run test:performance
npm run build
npm run test:e2e
```

The project pins `@playwright/test` to `1.61.0`; do not download another browser revision.

Expected verification outcomes:

- Pure search, normalization, note, and metadata rules pass unit tests.
- API/SQLite integration tests use isolated temporary databases and deterministic network fixtures.
- The seeded 10,000-bookmark search suite meets the one-second p95 criterion.
- A 1,000-bookmark tag-changing bulk action finishes within ten seconds and changes no out-of-selection row.
- The production build completes before runtime presentation.

## Run the Prepared Application

```bash
npm start
```

The foreground server must:

- apply pending migrations before accepting requests;
- bind to `0.0.0.0:4000`;
- serve the JSON API under `/api` and the built client at `/`;
- mark the loaded application shell with `data-harness-ready="true"` only after initial data has loaded or a valid empty state is visible.

Review from the client environment at `http://maker:4000/`. Automated browser checks use `http://127.0.0.1:4000/`.

After dependencies, tests, and the production build succeed, implementation must create:

```json
{"kind":"application","port":4000,"path":"/","start_command":["npm","start"],"start_cwd":"/work"}
```

at `/work/.harness/app.json`.

## End-to-End Validation

### 1. Address-Only Capture and Duplicate Prevention

1. Paste a deterministic fixture-page address and save immediately without typing a title.
2. Confirm a readable fallback and pending state appear immediately.
3. Confirm title, description, and app-origin icon appear when metadata completes.
4. Edit the title, refresh metadata, and confirm the manual title is not replaced.
5. Paste a normalized equivalent of the same address.
6. Confirm no row is created and the existing bookmark opens in edit mode.
7. Repeat after archiving it; confirm the archived match opens and can be restored.

Metadata E2E uses a deterministic injected fixture provider. Separate integration tests prove the production network policy; the browser suite does not depend on public sites.

### 2. Search, Filters, and Sort

1. Seed records with overlapping fields and tags.
2. Verify ordinary adjacent terms use `AND` across fields.
3. Verify `OR`, quoted phrases, `#tag`, and `#"multiword tag"` against [search-grammar.md](./contracts/search-grammar.md).
4. Select multiple tag filters and confirm every selected tag is required.
5. Combine favorite/read state with search and tags.
6. Verify all four sort orders.
7. Enter unmatched quotes and missing operands; confirm position-aware guidance and no data mutation.

### 3. Read Later and Archive Restoration

1. Mark both favorite and non-favorite bookmarks for Read Later.
2. Confirm both appear in Read Later independently of favorite state.
3. Mark one read and confirm it leaves Read Later but remains active.
4. Archive the other and confirm it leaves Read Later while remaining unread.
5. Restore it and confirm it returns to Read Later with favorite and unread states intact.

### 4. Organization and Formatted Notes

1. Edit title, description, tags, favorite state, and note.
2. Use each supported note construct: heading, bold, italic, ordered list, unordered list, link, and inline code.
3. Confirm rendered output contains only supported elements and visible note text is searchable.
4. Exercise raw HTML, image syntax, and unsafe link fixtures; confirm none creates executable or embedded content.

### 5. Stable Bulk Actions

1. Create a filtered result spanning more than one rendered page.
2. Select all results and record the server-confirmed count.
3. Cause a pending metadata update that would otherwise alter the live result.
4. Apply add/remove tag, favorite/unfavorite, read/unread, archive/restore, and delete actions in isolated cases.
5. Confirm only the original snapshot members change.
6. Change the view with an active selection and confirm the selection clears.
7. Confirm bulk deletion shows the stable count and does nothing when cancelled.

### 6. Individual Edit and Delete

1. Edit every editable field and reload the app.
2. Change the address to one already saved and confirm the edited row keeps its old address while the existing match opens.
3. Cancel deletion and confirm no change.
4. Confirm deletion and verify the bookmark disappears from all scopes and live saved-view results.

### 7. Saved Views

1. Configure query, multiple tags, status filters, scope, and sort.
2. Save with a unique name, then change the collection.
3. Reopen the saved view and confirm the criteria are restored against current data.
4. Rename and update it.
5. Remove the last use of a referenced tag and confirm the view remains editable with an empty result.
6. Cancel and then confirm saved-view deletion; bookmarks must remain unchanged.

## Accessibility and Responsive Checks

- Complete every core flow using only the keyboard.
- Confirm focus is visible, dialogs trap and restore focus correctly, and status/error changes are announced.
- Run Axe on empty, populated, filtered, detail/edit, saved-view, and bulk-confirmation states.
- Repeat representative workflows at 320 CSS pixels and a standard desktop width with no horizontal page scrolling.
- Verify external bookmark destinations open without replacing the manager.

## Security-Specific Checks

- Confirm metadata requests deny direct and DNS-resolved loopback, private, link-local, multicast, reserved, and cloud-metadata destinations.
- Confirm every redirect and icon candidate is revalidated and DNS-pinned.
- Confirm time, redirect, decoded-byte, media-type, and image-dimension limits abort safely.
- Confirm the browser never requests remote site icons directly.
- Confirm metadata failures expose friendly categories without internal IP addresses or stack traces.
- Confirm all mutation routes reject invalid schemas and inappropriate cross-origin requests.

## Artifact References

- Approved behavior: [spec.md](./spec.md)
- Technical decisions: [research.md](./research.md)
- Persistence model: [data-model.md](./data-model.md)
- JSON API: [openapi.yaml](./contracts/openapi.yaml)
- Query semantics: [search-grammar.md](./contracts/search-grammar.md)
