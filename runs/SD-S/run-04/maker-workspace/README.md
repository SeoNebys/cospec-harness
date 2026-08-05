# Bookmark Manager

A single-user app to save and manage web bookmarks. Paste a link and the app
automatically fetches the page's title and a short preview; browse, search, tag,
edit, and delete your collection.

Built with Spec-Driven Development — see [`specs/001-bookmark-manager/`](specs/001-bookmark-manager/)
for the spec, plan, data model, API contract, and validation guide.

## Architecture

- **backend/** — Node.js + TypeScript + Fastify API, SQLite storage (FTS5 search),
  server-side page-metadata fetching (Open Graph / meta tags via Cheerio).
- **frontend/** — React + Vite single-page app.

The backend exists because fetching metadata from arbitrary sites can't happen in
the browser (CORS), and because durable local persistence + fast search are
server-side concerns. Saving is decoupled from fetching: a bookmark is stored
immediately and enriched asynchronously, so a slow or failed fetch never blocks
you.

## Prerequisites

- Node.js 20 or newer
- npm

## Setup

```bash
cd backend && npm install
cd ../frontend && npm install
```

## Run (development)

In two terminals:

```bash
# Terminal 1 — API on http://localhost:3001
cd backend && npm run dev

# Terminal 2 — UI on http://localhost:5173 (proxies /api to the backend)
cd frontend && npm run dev
```

Open http://localhost:5173. The SQLite database file (`backend/bookmarks.sqlite`)
is created automatically on first run.

## Test

```bash
# Backend unit + integration tests
cd backend && npm test

# Frontend end-to-end tests (requires both dev servers running, then:)
cd frontend && npx playwright install   # first time only, downloads browsers
npm run test:e2e
```

## API

See [`specs/001-bookmark-manager/contracts/api.md`](specs/001-bookmark-manager/contracts/api.md).
Base path `/api`:

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/bookmarks` | Create (async metadata enrichment; 409 on duplicate) |
| GET | `/api/bookmarks?q=&tag=` | List / search / filter, newest-first |
| GET | `/api/bookmarks/:id` | Read one |
| PATCH | `/api/bookmarks/:id` | Edit title / note / tags |
| DELETE | `/api/bookmarks/:id` | Delete |
| GET | `/api/tags` | List tags with counts |

## Configuration

- `PORT` — backend port (default `3001`)
- `DB_FILE` — SQLite file path (default `bookmarks.sqlite`)
