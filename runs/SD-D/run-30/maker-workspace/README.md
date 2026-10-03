# Keepmark

A personal bookmark manager with safe page-detail retrieval, duplicate prevention, structured search, independent favorites and read-later states, formatted notes, and reversible archiving.

## Run locally

```bash
npm ci
npm run build
npm start
```

The server listens on `0.0.0.0:4000` by default. Runtime data is stored in `.data/bookmarks.sqlite`; set `BOOKMARK_DATA_DIR` or `DATABASE_PATH` to change it.

## Validate

```bash
npm test
npm run test:e2e
```

Metadata retrieval accepts public HTTP(S) pages only and enforces address, redirect, timeout, content-type, and byte limits. Missing metadata never prevents manual saving.
