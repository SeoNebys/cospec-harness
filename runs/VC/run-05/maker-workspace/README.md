# 🔖 Bookmark Manager

A local-first bookmark manager. React + TypeScript frontend (Vite), a small
Express + SQLite backend. Your data lives in a local SQLite file — nothing
leaves your machine except the optional "fetch page title" call.

## Features

- Add, edit, and delete bookmarks (URL, title, notes)
- Tags with click-to-filter and live counts
- Full-text-ish search across title, URL, and notes
- "Get title" button that fetches a page's `<title>` for you
- Favicons, dark UI, responsive layout
- Data persists to `data/bookmarks.db` (SQLite)

## Getting started

```bash
npm install
npm run dev
```

Then open **http://localhost:5173**.

- The web app runs on port `5173` (Vite).
- The API runs on port `3001` (Express) and is proxied under `/api`.

## Other scripts

| Command           | What it does                                  |
| ----------------- | --------------------------------------------- |
| `npm run dev`     | Run frontend + backend together (hot reload)  |
| `npm run build`   | Type-check and build the frontend for prod    |
| `npm run preview` | Preview the production build                  |

## Project layout

```
server/
  index.ts       Express app + routes + validation
  db.ts          SQLite connection + schema
  bookmarks.ts   Data access (bookmarks + tags)
  fetchTitle.ts  Best-effort page <title> fetcher
src/
  App.tsx        Top-level UI, search + tag filtering
  api.ts         Typed fetch wrappers for the API
  components/     BookmarkForm, BookmarkItem
  styles.css      Styling
```

## API

| Method   | Route                | Body / query                       |
| -------- | -------------------- | ---------------------------------- |
| `GET`    | `/api/bookmarks`     | `?search=` `?tag=`                 |
| `POST`   | `/api/bookmarks`     | `{ url, title?, notes?, tags? }`   |
| `PUT`    | `/api/bookmarks/:id` | `{ url, title?, notes?, tags? }`   |
| `DELETE` | `/api/bookmarks/:id` | —                                  |
| `GET`    | `/api/tags`          | — (returns `{ name, count }[]`)    |
| `POST`   | `/api/fetch-title`   | `{ url }` → `{ title }`            |

## Ideas for next steps

- Import/export (browser bookmarks HTML, JSON)
- Multi-user accounts + auth
- Browser extension to save the current tab
- Full-text search with SQLite FTS5
