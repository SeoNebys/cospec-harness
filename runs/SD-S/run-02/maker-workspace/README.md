# Bookmark Manager

A single-user, personal web app for saving and managing web-page bookmarks:
save links (with automatic titles), browse and reopen them, organize with tags,
search/filter, and edit or delete (with confirmation and undo).

Built with Spec-Driven Development — see `specs/001-bookmark-manager/` for the
spec, plan, tasks, and design artifacts.

## Architecture

- **backend/** — Fastify + TypeScript REST API, persisting to a local SQLite
  file (`better-sqlite3`). Derives page titles server-side (avoids browser
  cross-origin limits). See `specs/001-bookmark-manager/contracts/api.md`.
- **frontend/** — React + Vite single-page app that talks to the API.

## Prerequisites

- Node.js 20 LTS and npm

## Setup

```bash
cd backend && npm install
cd ../frontend && npm install
```

## Run (development)

```bash
# terminal 1 — backend API (creates data/bookmarks.db on first run)
cd backend && npm run dev            # http://localhost:3001

# terminal 2 — frontend SPA (proxies /api to the backend)
cd frontend && npm run dev           # http://localhost:5173
```

Open http://localhost:5173.

## Tests

```bash
cd backend && npm test               # unit + API contract/integration (Vitest)
cd frontend && npm test              # component/unit (Vitest + Testing Library)
cd frontend && npm run e2e           # Playwright user journey (needs browsers + OS libs)
```

> Note: the Playwright E2E requires a browser (`npx playwright install chromium`)
> and its OS libraries (`npx playwright install-deps`). The backend and frontend
> test suites run without a browser.

## Seed data (responsiveness check)

```bash
cd backend && npm run seed -- 2000   # inserts 2000 sample bookmarks
```

## Configuration (backend env vars)

| Variable | Default | Purpose |
|----------|---------|---------|
| `PORT` | `3001` | API port |
| `DB_PATH` | `data/bookmarks.db` | SQLite file (`:memory:` for ephemeral) |
| `UNDO_WINDOW_MS` | `30000` | How long a deleted bookmark can be restored |
| `TITLE_FETCH_TIMEOUT_MS` | `5000` | Title-derivation fetch timeout |

## Validation

See `specs/001-bookmark-manager/quickstart.md` for the full manual validation
scenarios mapped to each user story.
