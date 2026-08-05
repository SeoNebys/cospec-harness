# 🔖 Bookmarks

A single-user, local bookmark manager. FastAPI + SQLite backend, vanilla-JS
frontend. No accounts, no cloud — everything lives in a local `bookmarks.db`.

## Features

- Add / edit / delete bookmarks
- **Tags** with a clickable tag cloud for filtering
- **Full-text search** across title, URL, and notes
- **Auto-fetch** page title and favicon when you add a URL
- **Import / export** as JSON

## Setup

```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
```

## Run

```bash
.venv/bin/uvicorn main:app --reload
```

Then open <http://127.0.0.1:8000>.

## Project layout

| File               | Purpose                                  |
| ------------------ | ---------------------------------------- |
| `main.py`          | FastAPI app + REST API                   |
| `db.py`            | SQLite storage layer                     |
| `static/`          | Frontend (HTML / CSS / JS)               |
| `bookmarks.db`     | Data (created on first run, git-ignored) |

## API

| Method   | Path                    | Description                        |
| -------- | ----------------------- | ---------------------------------- |
| `GET`    | `/api/bookmarks?q=&tag=`| List, optionally search / filter   |
| `POST`   | `/api/bookmarks`        | Add (auto-fetches title if absent) |
| `PUT`    | `/api/bookmarks/{id}`   | Edit                               |
| `DELETE` | `/api/bookmarks/{id}`   | Delete                             |
| `GET`    | `/api/tags`             | List tags with counts              |
| `GET`    | `/api/export`           | Export all as JSON                 |
| `POST`   | `/api/import`           | Import a JSON array                |
