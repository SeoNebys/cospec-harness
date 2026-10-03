# Quickstart & Validation: Bookmark Manager

How to run the app and validate the primary user journeys. Details of endpoints
live in [contracts/api.md](./contracts/api.md); the data shapes in
[data-model.md](./data-model.md).

## Prerequisites

- Node.js 24 (provided by the shared image).
- Dependencies installed: `npm install` (installs Express, better-sqlite3,
  node-html-parser, and Playwright pinned to 1.61.0 for the e2e test).

## Run the app

```bash
npm install
npm start          # starts the server on 0.0.0.0:4000
```

- App URL for the client review container: `http://maker:4000/`.
- The app marks `data-harness-ready="true"` once the bookmark list (or its empty
  state) has loaded.
- Runtime descriptor lives at `.harness/app.json`
  (`kind: application`, port 4000, `start_command: ["npm","start"]`).

## Automated tests

```bash
npm test           # node:test unit + integration suites
npm run test:e2e   # Playwright smoke test of the primary flows
```

## Manual validation scenarios (map to spec acceptance criteria)

1. **Save with auto-collected details (US1)**: Paste a reachable URL without a
   scheme (e.g. `example.com`) and save. Expect: scheme becomes `https://`, and
   title/description/favicon are populated automatically. Edit the title, reload
   → the edited title persists.
2. **Fetch failure still saves (US1)**: Save an unreachable/invalid-content URL.
   Expect: bookmark still created, title falls back to the host, placeholder icon
   shown, no error blocking the save.
3. **Reject empty/invalid address (US1)**: Submit with no url, or a malformed one.
   Expect: clear validation message, nothing saved.
4. **Browse & open (US2)**: With several bookmarks saved, reload → all listed with
   title, address, favicon, tags. Activate one → opens in a new browser tab.
   With zero bookmarks → friendly empty state.
5. **Tags (US3)**: Add tags `work` and `reading` to a bookmark. Tag another and
   confirm `work` is offered as an existing suggestion; adding `Work` does not
   create a second tag. Filter by `work` → only tagged bookmarks show; clear the
   filter → all show again.
6. **Edit & delete (US4)**: Edit a bookmark's title/description/url/tags → changes
   persist after reload. Delete a bookmark → confirmation prompt appears; after
   confirming it is gone permanently.
7. **Find (US5)**: With many bookmarks, type a search term → only title/description/
   url/tag matches remain. Combine with an active tag filter → results satisfy
   both. Search with no matches → "no results" message.
8. **Duplicate handling (edge/FR-019)**: Save an address already bookmarked.
   Expect: no new row; the app navigates to and highlights the existing bookmark.

## Expected outcomes

- All eight scenarios pass as described.
- Bookmarks and tags survive a server restart (stop `npm start`, start again).
- List is visible within ~2s of opening; auto-collected details appear within
  ~5s for reachable pages.
