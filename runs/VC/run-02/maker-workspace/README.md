# 🔖 Bookmarks

A simple, local web app to save and manage bookmarks — with tags, full-text
search, and auto-fetched page titles and favicons.

- **Backend:** FastAPI + SQLite (no ORM, no build step)
- **Frontend:** vanilla HTML/CSS/JS single-page app
- **Storage:** a single `bookmarks.db` file in the project root

## Setup

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Run

```bash
uvicorn app.main:app --reload
```

Then open http://127.0.0.1:8000 in your browser.

## Features

- **Add bookmarks** by URL. If you leave the title blank, the app fetches the
  page and uses its `<title>`. Favicons are fetched automatically.
- **Tags** — comma-separated when adding; click a tag to filter by it.
- **Search** — full-text search (SQLite FTS5) across title, URL, notes, and
  tags, ranked by relevance, with prefix matching (typing "pyth" finds
  "python"). Multiple words are AND-ed.
- **Notes** — an optional free-text description per bookmark.
- **Delete** — remove a bookmark; unused tags are cleaned up automatically.

## API

| Method | Path                     | Description                          |
|--------|--------------------------|--------------------------------------|
| GET    | `/api/bookmarks`         | List; supports `?search=` and `?tag=`|
| POST   | `/api/bookmarks`         | Create (auto-fetches title/favicon)  |
| PUT    | `/api/bookmarks/{id}`    | Update title/description/tags        |
| DELETE | `/api/bookmarks/{id}`    | Delete                               |
| GET    | `/api/tags`              | List tags with usage counts          |

## Configuration

Set `BOOKMARKS_DB` to change where the database file lives:

```bash
BOOKMARKS_DB=/path/to/my.db uvicorn app.main:app
```

## Tests

```bash
pip install pytest
python -m pytest
```

## Possible next steps

- Inline editing of saved bookmarks (the `PUT` endpoint already supports it)
- Authentication for multi-user / hosted deployments
- URL de-duplication across equivalent forms (trailing slash, `www.`)
