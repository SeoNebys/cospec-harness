# Bookmark Manager

A single-user, local bookmark manager for web links. Save links (with best-effort
automatic title fetching), then browse, search, tag, annotate, edit, and delete
them. Everything is stored locally in a SQLite file and persists across restarts —
no sign-in, no cloud sync.

## Features

- **Save** a web link; the page title is fetched automatically when you leave it blank.
- **Validation** rejects anything that isn't a valid http/https address.
- **Duplicate warning** when you save a link you already have (with the option to keep it anyway).
- **Search** across title, address, notes, and tags.
- **Tags & notes** — organise bookmarks and filter the list by a tag.
- **Edit & delete** with a confirmation step before removal.
- **Local & durable** — stored in a SQLite file under `data/`, survives restarts.

## Requirements

- Node.js 20 LTS or newer

## Run

```bash
npm install
npm run dev
```

Then open the printed local URL (default `http://localhost:3000`) in your browser.
The local database is created automatically under `data/` on first run.

## Test

```bash
npm test
```

See `specs/001-bookmark-manager/` for the full specification, plan, and tasks.
