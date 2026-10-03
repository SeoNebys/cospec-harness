# Bookmark Manager

A single-user web app to save and manage bookmarks, built with Spec-Driven
Development. The approved specification, plan, and tasks live in
[`specs/001-bookmark-manager/`](specs/001-bookmark-manager/).

## Features

- Save bookmarks with fetched title, description, site icon, and preview
  (all editable before/after saving); the address itself is editable.
- Saving an address you already have opens the existing bookmark for editing.
- Browse, sort, and a case-insensitive boolean search: `#tag`, `"quoted
  phrases"`, and `AND`/`OR`/`NOT`/parentheses with precedence **NOT → AND → OR**
  (parentheses override; quote an operator word to match it literally).
- Tags with autocomplete; filter by included/excluded tags; reusable **saved
  views** built from a search + tag rules.
- **Read/unread** and **archived** are two independent properties. Views:
  All (unarchived), Read later (unread + unarchived), Archive (archived).
  Archiving/restoring never changes read/unread status.
- Bulk actions over a selection or all filtered results: tag, mark read/unread,
  archive/restore, delete.
- Import/export the standard Netscape bookmark file format (folders → tags,
  existing addresses skipped on import).
- Rich-text notes (sanitized) rendered when viewing.
- Page preservation: a self-contained HTML copy (PDFs kept as PDFs) and an
  optional Internet Archive snapshot — both best-effort.
- Display preferences: default sort, information density, and text size,
  persisted across sessions.

## Tech stack

- **Backend**: Node.js 24 + Express. Storage in SQLite via the built-in
  `node:sqlite`. Page captures/PDFs stored under `data/captures/`.
- **Frontend**: React 18 built with Vite, served as static assets by Express.
- **Page capture**: the installed Chromium via Playwright (self-contained HTML).

## Run

```bash
npm install      # installs deps (approve native/build scripts if prompted)
npm run build    # builds the React frontend to web/dist
npm start        # serves on http://0.0.0.0:4000
```

Open `http://maker:4000` in the review environment.

Optional: load a small realistic sample set into a fresh database:

```bash
node tests/sample-data.js
```

## Tests

```bash
npm test         # Vitest unit tests: search parser/evaluator, import/export, metadata, status independence
npm run test:e2e # Playwright end-to-end tests (browsers pinned to 1.61.0)
```

## Data

All state persists in `data/bookmarks.db` (SQLite) and `data/captures/`. Both
are gitignored and survive restarts.
