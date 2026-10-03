# Quickstart & Validation: Bookmark Manager

**Feature**: 001-bookmark-manager | **Date**: 2026-09-25 | **Phase**: 1

How to run the app and validate that the feature works end-to-end. Details of
the data model live in [data-model.md](./data-model.md) and the endpoints in
[contracts/api.md](./contracts/api.md); this guide references them rather than
repeating them.

## Prerequisites

- Node.js 24 and npm (provided by the image).
- Chromium via the shared Playwright browsers at `/opt/playwright-browsers`
  (used for self-contained HTML capture). `playwright`/`@playwright/test` pinned
  to 1.61.0 — do not download a second browser revision.
- Network access is required only for best-effort external features (metadata
  fetch, HTML/PDF capture, Internet Archive); their failure must not break core
  flows.

## Setup & run

```bash
npm install          # installs backend + frontend deps (lockfile preserved)
npm run build        # Vite builds the React frontend to the static dir Express serves
npm start            # starts Express on 0.0.0.0:4000  (foreground)
```

- App URL for the client review environment: `http://maker:4000`.
- The VM capture uses `http://127.0.0.1:4000`.
- The SPA sets `data-harness-ready="true"` on a visible element only after the
  initial UI and data have loaded (including a valid empty state).

Runtime declaration written to `/work/.harness/app.json`:

```json
{"kind": "application", "port": 4000, "path": "/", "start_command": ["npm", "start"], "start_cwd": "/work"}
```

## Test commands

```bash
npm test             # Vitest unit tests (search parser/evaluator, netscape import/export, metadata)
npm run test:e2e     # Playwright Test end-to-end flows (pinned 1.61.0)
```

## Validation scenarios (mapped to spec)

Each scenario proves one or more user stories / functional requirements.

1. **Save with metadata (US1, FR-001–004)**: Enter a URL → metadata (title,
   description, icon, preview) is shown → edit the title → save → the bookmark
   appears with the edited title. Enter an invalid/empty URL → rejected with a
   clear message. Enter a URL whose page can't be fetched → still saved with the
   address as title.

2. **Browse, sort, search (US2, FR-005–011)**: With several bookmarks, confirm
   newest-first default; switch sort to title A–Z and confirm reorder; search
   `#work AND ("release notes" OR changelog) NOT draft` and confirm results
   follow NOT→AND→OR precedence with the quoted phrase matched exactly; search a
   quoted operator `"AND"` and confirm it matches the literal word; empty result
   shows "no matches"; clicking a bookmark opens it in a new tab.

3. **Tags with suggestions (US3, FR-012–013)**: Type a tag and confirm existing
   tags are suggested; filter by an included tag and by an excluded tag; clear
   the filter to restore the full list.

4. **Edit incl. address, duplicate-opens-existing, delete (US4, FR-003,
   FR-015, FR-018)**: Edit a bookmark's address and title and confirm persistence
   after reload; save an already-saved address and confirm it opens the existing
   bookmark for editing (no duplicate); permanently delete with confirmation and
   confirm it does not return.

5. **Import / export (US5, FR-021–022)**: Import a standard browser bookmark
   file; confirm entries appear, source folders become tags, existing URLs are
   skipped, and an added-vs-skipped summary is shown. Export and confirm the
   file re-imports with the same bookmarks.

6. **Read-later & archive states (US6, FR-016–017)**: Mark a bookmark read-later
   → appears in the read-later view; toggle read/unread; archive another → it
   leaves the active list and appears in the archive view; restore it → returns
   to active unchanged. Confirm all three states are distinct from deletion.

7. **Bulk actions (US7, FR-019–020)**: Filter the list; "select all in current
   results"; apply add-tag to the selection and confirm every selected bookmark
   carries it; bulk archive and bulk delete (with confirmation).

8. **Saved views (US8, FR-014)**: Create a named view from a search plus one
   included and one excluded tag; reopen it and confirm it shows the live
   matching set; edit and delete the view and confirm bookmarks are unchanged.

9. **Local & Internet Archive copies (US9, FR-023–025)**: Request a local copy
   of a page and open the stored self-contained HTML; for a PDF address confirm
   the stored copy is the PDF itself; request an Internet Archive snapshot and
   confirm the snapshot link is recorded when available; simulate an unreachable
   page and confirm the bookmark is unaffected and the user is informed.

10. **Formatted notes (US10, FR-026)**: Add a note with bold text and a list;
    save; view the bookmark and confirm the formatting renders.

11. **Display preferences (US11, FR-027–028)**: Set default sort, information
    density, and text size; reload and confirm they persist and take effect;
    confirm list items show title, description, tags, and site icon.

## Performance checks (Success Criteria)

- Seed 500+ bookmarks and confirm search/sort/filter update within ~1 second
  (SC-002, SC-003).
- Close and reopen the app; confirm all bookmarks, tags, saved views, and
  preferences persist (SC-004).
- Import a 500-entry file and confirm completion with summary under ~1 minute
  (SC-005).
