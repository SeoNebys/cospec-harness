# Quickstart & Validation: Bookmark Manager

How to run the app and validate that it satisfies the spec. Details of the data
model and endpoints live in [data-model.md](./data-model.md) and
[contracts/api.md](./contracts/api.md).

## Prerequisites

- Node.js 24 and npm (provided by the shared image).
- Playwright 1.61.0 for the end-to-end checks (dev dependency; uses the shared
  browser binaries at `/opt/playwright-browsers`).

## Setup & run

```bash
npm install            # install dependencies, preserve lockfile
npm start              # starts the server on 0.0.0.0:4000
```

The app is reachable at `http://maker:4000/` in the review environment. The
SQLite file is created automatically at `data/bookmarks.db` on first run.

For review readiness, the app declares `/work/.harness/app.json`
(`kind: application`, port 4000, `start_command: ["npm","start"]`) and marks its
main UI with `data-harness-ready="true"` once the initial bookmark list (or
empty state) has loaded.

## Automated validation

```bash
node --test            # unit + integration (URL helpers, REST API)
npx playwright test    # end-to-end user-story flows
```

## Manual / scripted validation scenarios

Each maps to a user story and its acceptance scenarios in
[spec.md](./spec.md).

1. **Save a bookmark (US1 / FR-001–003)**: Open the app; enter `example.com`
   with a title; save. Expect it to appear in the list with `https://example.com`.
   Enter `not a url`; expect a clear rejection message and no new bookmark.
2. **Persistence (SC-003)**: Restart the server; reload the app. Expect all
   previously saved bookmarks still present and unchanged.
3. **Browse & search (US2 / FR-005–007)**: With several bookmarks, type a
   keyword; expect only matching bookmarks (title/url/notes). Click a bookmark;
   expect its address to open in a new tab.
4. **Edit & delete (US3 / FR-008–009)**: Edit a bookmark's title; expect the
   change to persist. Delete a bookmark; expect a confirmation prompt, then
   removal that persists after reload.
5. **Tags (US4 / FR-010)**: Tag two bookmarks `work`; filter by `work`; expect
   only those two shown.
6. **Empty & no-results states (FR-012)**: With no bookmarks, expect a welcoming
   empty state. Search for a term matching nothing; expect a clear no-results
   message.
7. **Duplicate warning (FR-011)**: Save a url that already exists; expect a
   non-blocking duplicate warning while the bookmark is still saved.

## Expected outcomes

- All automated tests pass.
- Scenarios 1–7 behave as described, covering FR-001 through FR-012 and success
  criteria SC-001–SC-005.
