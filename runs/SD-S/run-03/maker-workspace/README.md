# Bookmark Manager

A small single-user web app to save, browse, edit, tag, and search bookmarks.

Built with Spec-Driven Development — see `specs/001-bookmark-manager/` for the
specification, plan, and tasks.

## Stack

- Node.js 24 + Express (JSON API + static frontend, one server on port 4000)
- SQLite via `better-sqlite3` (local file under `data/`, survives restarts)
- Vanilla HTML/CSS/JS frontend (no build step)
- Tests: `node:test` (unit) + Playwright (end-to-end)

## Run

```bash
npm install
npm start          # http://localhost:4000  (listens on 0.0.0.0:4000)
```

## Test

```bash
npm test           # unit tests (URL, title extraction, repository)
npm run test:e2e   # Playwright end-to-end tests
```

## Features

- Save a bookmark by URL with an optional custom title; the title is fetched
  best-effort from the page and falls back to the address.
- Malformed and non-http(s) addresses are rejected; duplicate URLs are refused.
- Browse newest-first; open any bookmark in a new tab.
- Edit and delete (with confirmation).
- Tag bookmarks, filter by tag, and keyword-search title / address / tags.

## API

See `specs/001-bookmark-manager/contracts/api.md`.
