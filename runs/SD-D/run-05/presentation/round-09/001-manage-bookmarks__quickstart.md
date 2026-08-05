# Quickstart & Validation Guide: Manage Bookmarks

How to run the app during development and confirm it does what the spec promises.
This is a validation guide — implementation code lives in the source tree and
`tasks.md`.

## Prerequisites

- Node.js 20 LTS
- A package manager (npm)

## Setup

```bash
npm install          # install dependencies
npm run dev          # launch the desktop app in development mode
```

The app opens as a desktop window. All data is written to a local per-user data
directory (a SQLite database file plus a `saved-copies/` folder); nothing leaves
the machine.

## Build an installable app

```bash
npm run build        # produce an installer for the current platform (macOS/Windows/Linux)
```

## Run the tests

```bash
npm run test         # unit + integration (Vitest)
npm run test:e2e     # end-to-end UI flows (Playwright)
```

## Validation scenarios (map to spec success criteria)

Each scenario proves one or more acceptance criteria. Run them in the dev app.

1. **Save with auto-fill (US1, SC-001/002)**
   - Paste a normal article URL → Save.
   - Expect: bookmark appears immediately; within moments its title, description,
     and favicon fill in on their own; you did not type a title.

2. **Readable copy survives, offline (US3, SC-003)**
   - After saving the article above, disconnect the network.
   - Open the bookmark's **saved copy**.
   - Expect: the article text is readable from within the app with no network.

3. **PDF retained (US3, SC-003)**
   - Save a URL that points to a PDF.
   - Expect: the app keeps the PDF; opening the saved copy shows the PDF even if
     the original link is later unavailable.

4. **No duplicates (US1 edge, SC-011)**
   - Save a URL you already saved.
   - Expect: no second entry is created; you are taken to the existing bookmark to
     edit it.

5. **Formatted note (US4, FR-014)**
   - Add a note with bold text, a bullet list, and a link; save; reopen.
   - Expect: the note reads back formatted, not as one flat blob.

6. **Search inside everything, case-insensitive (US5, SC-005)**
   - Put a distinctive word only in one bookmark's note; search it in a different
     letter case.
   - Expect: that bookmark is found.

7. **Exact phrase & tag-scoped search (US5, FR-020/021)**
   - Search a phrase in quotes → only whole-phrase matches.
   - Search a word scoped to a tag → only that tag's matches.

8. **Saved search (US5, FR-023)**
   - Save "unread, tagged recipes" as a named search; add a new matching bookmark;
     reopen the saved search.
   - Expect: the new bookmark appears (criteria re-evaluated, not frozen).

9. **Batch action (US6, SC-006)**
   - Select ~50 bookmarks (or a whole search result) → add a tag / mark read /
     archive in one action.
   - Expect: the action applies to all of them at once.

10. **Import & export (US7, SC-007)**
    - Import a real browser bookmarks HTML export of 500+ entries.
    - Expect: entries appear; a summary shows added vs. skipped; the app stayed
      responsive. Then export and confirm the file re-imports.

11. **Archive vs. delete (US4)**
    - Archive a bookmark → it leaves the main list, appears in Archived, can be
      restored. Delete a bookmark (confirm) → it is gone for good after restart.

12. **Persistence (SC-009)**
    - Close and reopen the app.
    - Expect: all bookmarks, details, and saved copies are still present.

## References

- Entities & rules: [data-model.md](./data-model.md)
- Operation contracts: [contracts/](./contracts/)
- Decisions & rationale: [research.md](./research.md)
