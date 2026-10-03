# Trove

A single-user bookmark manager for saving web pages with useful context, organizing them with tags, searching, and maintaining a read-later queue.

## Run

```sh
npm start
```

The server listens on `0.0.0.0:4000` by default. Bookmark data is stored in `data/bookmarks.db`.

Optional environment variables:

- `PORT` — HTTP port, default `4000`
- `HOST` — bind address, default `0.0.0.0`
- `DB_PATH` — SQLite database path

## Test

```sh
npm test
```
