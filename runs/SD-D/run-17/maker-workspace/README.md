# Bookmark Manager

A single-user web app to save and manage bookmarks. Built with Spec-Driven
Development — see `specs/001-bookmark-manager/` for the spec, plan, and tasks.

## Features

- Save URLs with auto-captured title, description, favicon, and preview image
  (editable before and after saving)
- Markdown notes (rendered and sanitized), open originals in a new tab
- Re-saving an existing URL opens it for editing (no duplicates)
- Advanced search across title, URL, description, note, and tag names:
  `#tag`, `"quoted phrases"`, `AND`/`OR`/`NOT`, parentheses, implicit-AND,
  quoted-operator-as-literal, with clear errors for malformed queries
- Tag suggestions with unique tag names
- Read-later (unread view) and reversible archiving
- Bulk actions on a selection or all results in the current filter
- Sorting (newest/oldest/title/updated) and saved reusable filters
  (search terms + included/excluded tags)
- Import/export standard browser bookmark HTML (titles, tags, dates preserved)
- Preserved single-file local page copies (PDFs kept as PDFs) and optional
  Internet Archive submission
- Display preferences: default sort, items per page, text size

## Requirements

- Node.js 24, npm
- Playwright 1.61.0 (dev) using the shared browsers at `/opt/playwright-browsers`

## Setup & run

```bash
npm install
npm start          # serves on http://0.0.0.0:4000
```

In the review environment the app is reached at `http://maker:4000`.

## Tests

```bash
npm test           # unit tests (search parser, import/export round-trip)
npm run test:e2e   # Playwright end-to-end journeys
```

## Structure

- `src/server.js` — Express bootstrap (listens on `0.0.0.0:4000`)
- `src/db/` — SQLite connection + migrations
- `src/models/` — data access (bookmarks, tags, filters, preferences)
- `src/services/` — url, metadata, search, notes, pagecopy, archiveorg, porthtml
- `src/routes/` — HTTP API + app shell
- `src/public/` — frontend (vanilla JS modules + CSS)
- `data/` — SQLite database and preserved page copies (not committed)
