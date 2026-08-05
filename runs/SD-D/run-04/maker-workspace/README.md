# Bookmark Manager

A single-user, local bookmark manager: save web pages with auto-fetched previews,
find them fast (text, exact phrase, and any/all/not tag filters), organize with
tags, read-later flags, archiving, and saved searches — and back the whole thing
up to a portable file. Everything is stored locally on your own machine; no
accounts, no cloud, no sync.

Built spec-first — see [`specs/001-bookmark-manager/`](specs/001-bookmark-manager/)
for the specification, plan, and task breakdown that drove this code.

## Requirements

- Node.js 20 LTS and npm

## Run it

```bash
npm install
npm run dev      # backend on http://localhost:8787, app on http://localhost:5173
```

Open **http://localhost:5173** in your browser. Your bookmarks persist in a local
SQLite file under `~/.bookmark-manager/` (override with `BOOKMARKS_DB_PATH`).

To run the built app as a single process (backend serves the built UI):

```bash
npm run build
npm start        # serves the app on http://localhost:8787
```

## Test

```bash
npm test         # Vitest unit + integration (in-memory SQLite, no network)
npm run test:e2e # Playwright end-to-end flows (one per user story)
```

> The e2e suite drives a real browser via Playwright. On first run, install
> browsers with `npx playwright install`.

## What it does

- **Save** — paste an address; a background fetch adds a title, description, site
  icon, and preview image (best-effort — a slow or unreachable page never blocks
  the save). Add your own title, tags, and a note at save time.
- **Find & open** — case-insensitive search, `"exact phrases"` in quotes, and tag
  filters that combine **any of / all of / excluding** — mixable, and stackable
  with the text search. Click a card to open the page.
- **Organize** — edit any field (including the address), tag suggestions as you
  type, formatted notes (headings, bullets, links — sanitized), sort by newest /
  oldest / title, archive to tuck items aside, and batch actions with
  "select all showing" (which only touches what's on screen).
- **Read later** — flag items and see just those in the Read Later tab.
- **Saved searches** — name a search + tag combination and re-apply it; it re-runs
  live against the current collection.
- **Backup & restore** — export the whole collection to a portable JSON file and
  import it (even onto a fresh machine), preserving original dates, merging by
  address so nothing duplicates, and rolling back cleanly on a bad file.

## Architecture

A small local web app in one repo:

- `src/server` — Fastify + SQLite (FTS5 for search); performs metadata fetching
  server-side (which also sidesteps browser cross-origin limits).
- `src/web` — React + Vite single-page app.
- `src/shared` — types shared by both.

## Roadmap: double-click desktop app

v1 runs as "launch the local backend, open in the browser." A tracked fast-follow
is to wrap the same backend + SPA in **Tauri** (or Electron) to ship a true
double-click desktop app. The architecture was chosen so this reuses the existing
storage, API, search, and enrichment code unchanged — see
[`plan.md`](specs/001-bookmark-manager/plan.md).
