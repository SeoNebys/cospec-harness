# Bookmark Manager

A single-user web app to save and manage bookmarks, with tags, notes, boolean
search, page snapshots, and import/export. Data persists in SQLite.

## Run

```bash
npm install     # installs express, better-sqlite3, cheerio, playwright
npm start       # serves on http://0.0.0.0:4000
```

Data is stored in `data/bookmarks.db`; captured page snapshots live in
`data/snapshots/`.

## Features

- **Saving** — paste a URL and click *Fetch* to auto-collect title,
  description, favicon, and preview image; every field stays editable. Saving a
  URL that already exists opens the existing bookmark for editing instead of
  creating a duplicate.
- **Organize** — free-form tags, private notes, and three states: normal,
  **Read later**, and **Archived**.
- **Search** — a boolean query language over title / description / notes / URL /
  tags:
  - `word` — substring match
  - `"exact phrase"` — whole-phrase match
  - `tag:work` / `tag:"machine learning"` — exact tag
  - `is:read_later`, `is:archived`, `is:snapshot`
  - `AND` / `OR` / `NOT` and `( … )`; a space means AND
  - e.g. `tag:work AND "design system" NOT draft`
- **Saved searches** — store a query + view + sort under a name.
- **Sorting** — newest/oldest, recently updated, title, or site.
- **Bulk actions** — select rows to read-later / archive / tag / delete at once.
- **Snapshots** — capture a full-page screenshot + saved HTML of a page
  (via Playwright) for long-term reference.
- **Import / Export** — JSON (round-trips everything) and browser Netscape
  bookmark HTML. Duplicate URLs are skipped on import.
- **Preferences** — default sort, default view, and font size.

## Layout

- `server.js` — Express API + static hosting
- `src/db.js` — SQLite schema and connection
- `src/search.js` — boolean search-query parser → SQL
- `src/metadata.js` — URL metadata fetching
- `src/snapshot.js` — Playwright page capture
- `src/transfer.js` — import/export (JSON + Netscape HTML)
- `public/` — the single-page frontend
