# Pinboard

A private, single-user bookmark manager for saving links with manually entered titles, notes, and tags. It supports search, tag and favorite filters, four sort orders, editing, and an archive-before-delete lifecycle with explicit permanent-delete confirmation.

## Requirements

- Node.js 24+
- npm

## Setup and validation

```bash
npm ci
npm run typecheck
npm test
npm run build
npm run test:e2e
```

Playwright is pinned to 1.61.0 so it uses the browser supplied by the project environment. The application has no external service dependency.

## Run the prepared application

```bash
npm start
```

The server listens on `0.0.0.0:4000`. Bookmark data is stored in `data/bookmarks.db`; set `BOOKMARK_DB_PATH` to use another explicit location. The production start command expects `npm run build` to have completed already.

Client review is available at `http://maker:4000/`. The health endpoint is `/api/health`.

## Version-one scope

Titles are required and entered manually. Automatic page titles, descriptions, thumbnails, and icons are intentionally deferred. Accounts, sharing, folders, imports/exports, browser extensions, external sync, offline mode, and link-health monitoring are also outside this version.

The approved behavior and validation steps live under `specs/001-bookmark-manager/`.
