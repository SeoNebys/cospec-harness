# Bookmark Manager

A single-user, single-device web app to save and manage bookmarks. Save a web
address and the app fetches the page's real **title, description, favicon, and
preview image in the background** — the bookmark shows up instantly and fills in
a moment later. Browse, keyword-search, tag/filter, edit, and delete. Saving a
duplicate address opens the existing bookmark for editing.

Built to the spec in [`specs/001-bookmark-manager/`](specs/001-bookmark-manager/).

## Run

```bash
npm install
npm start          # serves on http://0.0.0.0:4000
```

Open the app at `http://maker:4000` in the review environment. Bookmarks are
stored in a local SQLite file at `data/bookmarks.db` (created on first run) and
persist across restarts.

## Test

```bash
npm test           # unit + integration (offline; metadata fetch injected)
npm run test:e2e   # Playwright end-to-end happy path
```

## How it works

- **Server** (`src/`): Express JSON API + static hosting, single Node process.
  - `services/url.js` — address validation/normalization.
  - `services/metadata.js` — fetch + parse Open Graph/meta tags (8s timeout,
    HTML-only, size-capped).
  - `services/enrichment.js` — background enrichment; never blocks the save.
  - `models/bookmark.js` — SQLite data access (bookmarks, tags, search, filter).
  - `routes/bookmarks.js` — the API (`contracts/api.md`).
- **Frontend** (`public/`): dependency-free HTML/CSS/JS; polls pending
  bookmarks until their metadata arrives.
- **Storage**: SQLite file (`data/`). Favicons/previews are stored as links to
  the original images (no local caching in this version).

## Configuration

- `PORT` — HTTP port (default `4000`).
- `BOOKMARKS_DB` — SQLite file path (default `./data/bookmarks.db`).
- `METADATA_STUB=1` — use a synthetic metadata fetcher (used by e2e tests).
