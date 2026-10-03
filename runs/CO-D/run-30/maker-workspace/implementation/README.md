# Personal Bookmarks

A single-user web application for saving, finding, labeling, reading, archiving, and cleaning up bookmarks.

## Run

From `/work`:

```sh
npm start
```

The server listens on `0.0.0.0:4000` by default. Bookmark data is stored in `implementation/data/bookmarks.sqlite`.

Optional environment variables:

- `PORT` — HTTP port (default `4000`)
- `HOST` — bind address (default `0.0.0.0`)
- `BOOKMARKS_DB` — alternate SQLite database path

## Verify

```sh
npm test
npm run test:e2e
```

The browser test uses an isolated temporary database and deterministic page metadata.

