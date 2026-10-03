# Quickstart & Validation: Bookmark Manager

How to run the app and validate the feature end-to-end. Implementation details
live in [plan.md](./plan.md), [data-model.md](./data-model.md), and
[contracts/api.md](./contracts/api.md); this is a run/validation guide.

## Prerequisites

- Node.js 24 and npm (available in the shared image).
- Shared Chromium at `/opt/playwright-browsers`; `playwright` pinned to `1.61.0`
  in devDependencies (no second browser download).

## Setup & run

```bash
cd /work
npm install            # installs deps; preserves lockfile
npm start              # starts server on 0.0.0.0:4000
```

The client reaches the app at `http://maker:4000`. The app shell sets
`data-harness-ready="true"` once the initial view and its data have loaded
(including a valid empty state). Runtime declared in `/work/.harness/app.json`
(`kind: application`, port 4000, `start_command: ["npm","start"]`).

## Validation scenarios (map to user stories & success criteria)

1. **Save with auto details (US1, SC-001/SC-002)**: Add a reachable web address
   with no title. A bookmark appears with auto-filled title/description/favicon and
   a preview thumbnail; editing title/description persists. Submitting an invalid
   address is rejected with a message and nothing is saved.

2. **Snapshot preserved; PDFs stay PDFs (US2, SC-004)**: Save a normal page and
   reopen its snapshot — the captured static content is viewable. Save a PDF
   address and reopen — it is served and viewed as a PDF. A page whose snapshot
   fails still saves and is marked "no snapshot available".

3. **Browse / search / filter / sort (US3, SC-003)**: With many bookmarks, keyword
   search matches title/address/description/notes/tags; tag filter narrows the
   list; sorting by date added and by title (asc/desc) reorders correctly; a
   no-match search shows the empty-result state.

4. **Read-later & unread view (US4)**: Mark a bookmark unread → it shows in the
   unread view; mark read → it leaves the unread view but stays in the full list.

5. **Notes (US5)**: Add/edit a note; it persists and is found by searching its
   text.

6. **Archive vs delete (US6, SC-007)**: Archive a bookmark → leaves main list,
   appears in archive view; restore → returns. Delete (with confirmation) →
   permanently gone from all views.

7. **Duplicate → edit existing (US7, SC-006)**: Re-submit an existing address →
   the app opens the existing bookmark for editing; no duplicate is created,
   including when the existing one is archived.

8. **Import / export (US8, SC-008)**: Import a standard browser bookmark HTML file
   → entries added, folders mapped to tags, existing addresses not duplicated,
   counts reported. Export → a standard-format file that re-imports with the
   collection intact and no duplicates.

9. **Durability (SC-005)**: Restart the server and confirm bookmarks, notes,
   status, tags, and snapshots are all still present.

## Automated checks

```bash
npm test               # node:test unit + contract suites
npm run test:e2e       # Playwright 1.61.0 UI flows against a running server
```
