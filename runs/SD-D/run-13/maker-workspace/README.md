# Keepsake Bookmark Manager

Keepsake is a private, single-user bookmark manager for saving links with automatic page details, reusable tags, rich notes, read-later state, advanced search, and a reversible archive.

## Run it

Requirements: Node.js 24 and npm.

```bash
npm ci
npm run db:migrate
npm run build
npm start
```

The server binds to `0.0.0.0:4000`. In the review environment, open **http://maker:4000**. Configuration is documented in `.env.example`.

Bookmark data and processed page images live in `data/bookmarks.sqlite3` by default. On a graceful shutdown, the server checkpoints SQLite and writes `data/backups/bookmarks-latest.sqlite3`. Back up the entire `data` directory while the server is stopped, or use the generated backup database.

## Using search

- `accessibility` finds partial text in titles, links, descriptions, notes, and tags.
- `"design systems"` finds that exact contiguous phrase.
- `tag:research` and `tag:"work notes"` match exact tags.
- `accessibility AND tag:research`, `design OR usability`, and parentheses combine conditions.

Search, tag, favorite, and view filters combine. Archived bookmarks are excluded from Active and To Read, but stay searchable in Archive. Sorting by title, date added, or date updated persists across restarts.

## Security and privacy

There is no account, cloud sync, analytics, or third-party metadata proxy. Page-detail retrieval blocks local/private/special-use destinations, validates every redirect, permits only standard web ports, pins a vetted public address for the connection, limits time and decoded bytes, and never forwards browser credentials or cookies. Remote images are decoded and re-encoded as bounded static PNG/WebP files before storage. Rich notes use a strict document model and never render arbitrary HTML.

## Quality checks

```bash
npm run lint
npm run typecheck
npm run test:unit
npm run test:integration
npm run test:contract
npm run test:performance
PLAYWRIGHT_BROWSERS_PATH=/opt/playwright-browsers npm run test:e2e
npm run build
```

The browser suite covers desktop Chromium, a phone/touch profile, and an exact 320px viewport. The product intentionally does not include accounts, cross-device sync, import/export, browser extensions, folders, or offline page copies in this release.
