# 🔖 Bookmark Manager

A simple, single-user local web app to save and manage bookmarks.
Built with **FastAPI** + **SQLite**, with a clean single-page frontend (no build step).

## Features

- **Add bookmarks by URL** — title & description are auto-fetched from the page
- **Tags** — organize and filter by tag (with counts in the sidebar)
- **Full-text search** — across title, description, notes, tags, and URL (SQLite FTS5)
- **Favorites** — star bookmarks and filter to them
- **Notes** — add your own notes to any bookmark
- **Import / Export** — JSON, plus **browser bookmark HTML import** (Chrome/Firefox/Safari exports); folder names become tags. Duplicate URLs are skipped on import.
- **Dark mode** — follows your system theme

## Setup

Requires Python 3.10+.

```bash
cd /work
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

## Run

```bash
uvicorn app:app --reload
```

Then open <http://127.0.0.1:8000>.

Data is stored in `bookmarks.db` (SQLite) in the project directory.

## API

| Method | Path                     | Description                          |
|--------|--------------------------|--------------------------------------|
| GET    | `/api/bookmarks`         | List/search (`?q=`, `?tag=`, `?favorite=`) |
| POST   | `/api/bookmarks`         | Create (auto-fetches metadata)       |
| GET    | `/api/bookmarks/{id}`    | Get one                              |
| PUT    | `/api/bookmarks/{id}`    | Update                               |
| DELETE | `/api/bookmarks/{id}`    | Delete                               |
| GET    | `/api/tags`              | List tags with counts                |
| GET    | `/api/export`            | Export all as JSON                   |
| POST   | `/api/import`            | Import from JSON                     |
| POST   | `/api/import/html`       | Import a browser bookmark HTML export |

Interactive API docs are available at <http://127.0.0.1:8000/docs>.

## Project layout

```
app.py              FastAPI backend + SQLite schema
static/index.html   Single-page frontend (HTML + CSS + JS)
requirements.txt    Python dependencies
bookmarks.db        SQLite database (created on first run)
```
