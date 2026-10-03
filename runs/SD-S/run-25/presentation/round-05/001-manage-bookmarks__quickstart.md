# Quickstart and Validation: Personal Bookmark Manager

This guide defines how to run and validate the completed feature. The commands become available during implementation; the planning phase does not create application code or dependencies.

## Prerequisites

- Node.js 24.15 or newer within the Node 24 LTS line (the workspace currently has 24.21.0).
- npm 11 or newer.
- The workspace-provided Chromium revision at `/opt/playwright-browsers`.
- Port 4000 free for the production application.
- No external database or account credentials.

## Install and Verify

From `/work` after implementation:

```bash
npm ci
npm run typecheck
npm run lint
npm test
npm run build
npm run test:e2e
```

Expected results:

- TypeScript and lint checks complete without errors.
- Unit, component, and HTTP integration tests pass using isolated temporary databases and deterministic metadata transports.
- The production client and server build successfully.
- Playwright 1.61.0 uses the preinstalled Chromium browser and passes desktop, mobile-width, keyboard, persistence, and accessibility scenarios.
- Normal automated tests do not require access to public websites.

## Run the Production Application

```bash
npm start
```

Expected runtime behavior:

- The server listens on `0.0.0.0:4000`.
- `GET http://127.0.0.1:4000/api/health` returns `{"status":"ok"}` after migrations finish.
- The client-review address is `http://maker:4000/`.
- The main application shell gains `data-harness-ready="true"` only after the initial library request resolves to saved content or a valid empty state.
- Data is stored in `/work/data/bookmarks.sqlite` unless `DATABASE_PATH` selects an isolated path.

## End-to-End Acceptance Walkthrough

### 1. Quick save with automatic page information

1. Open the empty library and choose **Add bookmark**.
2. Paste a public HTTP(S) page known to expose a document title and description.
3. Confirm that retrieval status is announced and both fields populate within five seconds.
4. Change the suggested title, add `Research` and `Web` tags, select **To Read**, and save.
5. Confirm the bookmark appears with the edited title, tags, saved date, and To Read status.
6. Reload the page and confirm the bookmark remains.

Expected: automatic suggestions never replace the edited title, the saved destination opens in a new tab, and all data survives reload.

### 2. Manual metadata fallback

1. Start another bookmark using an HTTP(S) destination that metadata policy cannot retrieve, such as a loopback/private destination, or use an injected unavailable response in an automated scenario.
2. Confirm the app explains that page information is unavailable without blocking the form.
3. Enter a title manually and save.

Expected: the bookmark is saved when the address and manual title are valid; no fetched HTML or internal-network response is exposed.

### 3. Stale-result and user-edit protection

1. Begin retrieval for URL A, immediately change the address to URL B, and type a title while URL B is loading.
2. Let both simulated responses complete out of order.

Expected: neither URL A's response nor URL B's title overwrites the user's title; only untouched fields for the current URL may receive suggestions.

### 4. Duplicate warning

1. Attempt to save the first bookmark's address again.
2. Choose the existing-bookmark action and confirm it opens or focuses that entry without saving.
3. Repeat, choose **Save anyway**, and confirm the second entry is created.

Expected: duplicates require explicit acknowledgement but are not prohibited.

### 5. Read Later lifecycle

1. Open **Read Later** and confirm the To Read bookmark appears while Untracked and Read bookmarks do not.
2. Mark the item **Read**.
3. Confirm it leaves Read Later but remains in the full Library with a Read status.
4. Mark it **To Read** again and confirm it returns.

Expected: reading-state changes survive reload and never delete the bookmark.

### 6. Search, tags, and sorting

1. Create bookmarks whose title, URL, description, and tags provide distinct search matches.
2. Search using each field, then select two tags.
3. Confirm only bookmarks containing both tags remain.
4. Exercise newest, oldest, and title sorts in both Library and Read Later.
5. Enter a query with no matches and clear it from the purpose-built empty state.

Expected: search is case-insensitive, selected tags use AND semantics, sort order is deterministic, and criteria remain active after editing or saving.

### 7. Edit and delete

1. Edit every bookmark field and save.
2. Start deletion, choose **Cancel**, and confirm the item remains.
3. Start again, confirm deletion, and verify the item disappears from the Library, Read Later, search results, and tag counts.

Expected: edits persist atomically; deletion occurs only after explicit confirmation.

### 8. Keyboard and responsive use

1. Complete save, search, tag selection, sort, edit, open, reading-state, and delete flows using only the keyboard.
2. Verify visible focus, logical order, correct tab behavior for Library/Read Later, associated validation messages, and announced status feedback.
3. Repeat the primary flows at a narrow mobile viewport.

Expected: all core flows remain operable and readable without pointer input or horizontal page scrolling.

## Persistence Check Across Process Restart

1. Save bookmarks and reading states.
2. Stop the server normally.
3. Run `npm start` again with the same `DATABASE_PATH`.
4. Reload the Library and Read Later views.

Expected: bookmarks, tags, timestamps, and reading states are unchanged. Search/filter/sort URL state may be restored through the browser URL, while no server-side user session is required.

## Scale Check

Run the dedicated seeded performance scenario:

```bash
npm run test:e2e -- --grep @performance
```

Expected: with 1,000 generated bookmarks, search, tag filtering, and sorting visibly settle within one second, and a known bookmark can be located through the tested interaction in under ten seconds.

## Contract References

- HTTP behavior: [contracts/openapi.yaml](contracts/openapi.yaml)
- Entities and invariants: [data-model.md](data-model.md)
- Technical decisions and alternatives: [research.md](research.md)
