# Bookmark Manager

A single-user, browser-based app to save and manage bookmarks. Built with
Spec-Driven Development — see `specs/001-bookmark-manager/` for the approved
spec, plan, and tasks.

## Features

- **Save with automatic enrichment** — paste a URL; the server collects the page's
  title, description, favicon, and preview image. Title/description are editable.
- **No duplicates** — saving an existing address takes you to the existing bookmark.
- **Markdown notes** — per-bookmark notes rendered safely.
- **Advanced search** — across title/description/note/address, case-insensitive,
  with `#tag`, `"exact phrases"`, `AND`/`OR`/`NOT` (any case), parentheses, and
  implicit AND between adjacent terms.
- **Tags** with type-ahead suggestions and include/exclude filtering.
- **Read-later** state with a dedicated unread view (never auto-set).
- **Sorting**, multi-select and view-wide **bulk actions** (add/remove tags,
  read/unread, archive, delete).
- **Archive vs delete** — archiving is non-destructive and restorable; deletion is
  permanent and always confirmed.
- **Saved views** — a named search + included/excluded tags.
- **Import/export** — standard browser bookmark HTML, preserving titles, tags, dates.
- **Preservation** — a self-contained single-HTML snapshot per page (PDFs kept as
  PDFs), plus an optional Internet Archive save. Every outcome (success/failure) is
  visibly surfaced.
- **Display preferences** — default sort, items per page, font size.

## Tech stack

- Backend: Node.js 24, Express, better-sqlite3 (embedded SQLite), Playwright
  (Chromium) for enrichment/snapshots, marked + sanitize-html, cheerio, zod.
- Frontend: React + Vite (built to static assets, served by the backend).
- All data (SQLite DB + snapshot files) lives under `data/`; no external services
  required to run.

## Running

```bash
npm install       # installs backend + frontend workspaces
npm run build     # builds the frontend to frontend/dist
npm start         # serves API + UI on http://0.0.0.0:4000
```

Open `http://maker:4000` in the review environment (or `http://127.0.0.1:4000`
locally). Runtime data is created under `data/` on first run.

> Note: `better-sqlite3` and `esbuild` require their install scripts to build native
> binaries. This repo pre-approves them in `package.json` (`allowScripts`); if a
> fresh `npm install` skips them, run `npm install-scripts approve better-sqlite3`
> and `... approve esbuild`.

## Tests

```bash
npm run test:unit   # vitest (search parser, URL normalization) + node import/export
npm run test:e2e    # Playwright (per-user-story browser scenarios)

# Persistence-across-restart (SC-007):
node backend/tests/node/restart-persistence.test.js

# Performance fixture (SC-004): seed N bookmarks
BOOKMARKS_DATA_DIR=./data-perf node backend/tests/fixtures/seed.js 5000
```

Playwright uses the shared browsers at `/opt/playwright-browsers`
(`PLAYWRIGHT_BROWSERS_PATH`); pinned to 1.61.0.

## Project layout

```
backend/src/    server, db (schema + statement cache), models, services
                (enrichment, snapshot, archiveOrg, importExport, search, markdown),
                search (tokenizer + parser), url (normalize), api (routers)
frontend/src/   React SPA (pages, components, api client)
specs/          Spec-Driven Development artifacts
data/           runtime SQLite DB + snapshots (gitignored)
```
