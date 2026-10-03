# Bookmark Manager

A single-user web app to **save, find, organize, and preserve bookmarks**. Built
with Spec-Driven Development — see `specs/001-bookmark-manager/` for the spec,
plan, and tasks.

## Features

- **Save with review** — enter a URL; the app collects the title, description,
  favicon, and preview image for you to review and edit *before* committing. If a
  page can’t be read promptly, you get fallback details and can save immediately.
- **No duplicates** — re-saving an existing address opens the existing bookmark
  for editing (http/https, trailing slash, and host case are treated as the same).
- **Advanced search** — case-insensitive across title, description, notes, and
  address; `#tag`, exact `"quoted phrases"`, and `AND`/`OR`/`NOT` with parentheses.
  Free text plus `#tag` requires both; quoted operator words are literals.
- **Read-later & archive** — unread by default; archive is reversible and separate
  from delete; archived items stay out of the normal list and search.
- **Sort & bulk actions** — sort by date/title/last-updated; select items or all
  matching the current view to tag, mark read/unread, archive, or delete together.
- **Markdown notes** — stored as Markdown, rendered (sanitized) on view.
- **Saved filters** — named search + included/excluded tags.
- **Snapshots** — each page saved as a self-contained single HTML file (PDFs
  downloaded as PDFs), captured in the background; optional Internet Archive
  preservation. Background capture never overwrites your title/description.
- **Import/Export** — standard Netscape bookmarks HTML (folders ↔ tags, dates
  preserved, duplicates skipped).
- **Display preferences** — default sort, items per page, font size.

## Requirements

- Node.js 24 + npm
- Chromium (shared at `/opt/playwright-browsers`) for snapshots; Playwright pinned
  to 1.61.0.

## Setup, build, run

```bash
npm install       # install dependencies
npm run build     # build the frontend (Vite) into dist/
npm start         # serve API + frontend on 0.0.0.0:4000
```

Open http://127.0.0.1:4000/ (or `http://maker:4000` in the review environment).
Data persists in `data/` (SQLite `bookmarks.db` + `snapshots/`).

## Tests

```bash
npm test          # Vitest unit + API (Supertest) tests
npm run test:e2e  # Playwright end-to-end flow
```

## Architecture

- **Backend**: Node.js + Express, SQLite (`better-sqlite3`). One process serves the
  JSON API and the built SPA.
- **Frontend**: React + Vite (built to `dist/`, served by Express).
- **Search**: a hand-written boolean parser (`src/server/services/search/`) evaluated
  in the app layer for exact grammar control.
- **Background work**: an in-process queue runs only snapshot capture; on startup it
  re-enqueues any snapshot left `pending` so interrupted captures resume.

See `specs/001-bookmark-manager/contracts/openapi.yaml` for the API and
`contracts/search-grammar.md` for the search rules.
