# 📑 Bookmark Manager

A small, local, single-user web app to save and organize bookmarks. Add a URL
and it auto-fetches the page title; organize with tags; find things with
full-text search and tag filters. Your data stays on your machine in a single
SQLite file — no accounts, no cloud.

## Features

- **Add / edit / delete** bookmarks (URL, title, notes)
- **Auto-title** — leave the title blank and it's fetched from the page
- **Tags** — comma-separated, deduped, case-insensitive; click any tag to filter
- **Search** — matches URL, title, and notes as you type
- **Local storage** — everything lives in `bookmarks.db` (SQLite)

## Requirements

- Python 3.10+

## Run it

```bash
./run.sh
```

On first launch this creates a virtual environment and installs dependencies,
then serves the app at <http://127.0.0.1:8000>. Subsequent launches start
immediately.

To use a different host/port:

```bash
HOST=0.0.0.0 PORT=9000 ./run.sh
```

## Project layout

```
app/
  main.py      FastAPI app + JSON API
  db.py        SQLite schema and connection helper
  titles.py    Best-effort page-title fetching
  static/      Frontend (index.html, app.js, style.css) — no build step
bookmarks.db   Created on first run (safe to delete to start over)
requirements.txt
run.sh
```

## API

All endpoints return JSON.

| Method | Path                     | Purpose                                        |
| ------ | ------------------------ | ---------------------------------------------- |
| GET    | `/api/bookmarks?q=&tag=` | List, optionally filtered by text and/or tag   |
| POST   | `/api/bookmarks`         | Create (auto-fetches title if none given)      |
| PUT    | `/api/bookmarks/{id}`    | Update                                         |
| DELETE | `/api/bookmarks/{id}`    | Delete                                         |
| GET    | `/api/tags`              | All tags in use, with bookmark counts          |
| POST   | `/api/fetch-title`       | Preview a URL's title (used by the Add dialog)  |

Interactive API docs are available at `/docs` while the server is running.

## Backup / reset

Everything is in `bookmarks.db`. Copy it to back up; delete it to start fresh
(a new empty one is created on the next launch).
