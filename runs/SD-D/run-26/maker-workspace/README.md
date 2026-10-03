# Larder

Larder is a private, single-owner bookmark manager. Paste a web address and it proposes the page title, description, and icon; you remain free to edit or remove every proposal. It includes read-later and archive collections, Boolean/phrase/tag search, safe formatted notes, bulk actions, and standard browser HTML import/export.

## Run locally

Requirements: Node.js 24 and npm.

```bash
npm ci
npm run build
npm start
```

The server listens on `0.0.0.0:4000`; open `http://maker:4000` in the shared review environment. The development/review password is `review-bookmarks`. This fallback is disabled when `NODE_ENV=production`.

For a private deployment, generate a password envelope interactively:

```bash
npm run hash-password
```

Set the result as `BOOKMARKS_PASSWORD_HASH`, set `NODE_ENV=production`, use HTTPS, set `COOKIE_SECURE=true`, and configure `TRUST_PROXY` only when the application is behind a trusted reverse proxy. All settings are documented in `.env.example`.

## Data, privacy, and backup

The SQLite database and locally normalized icons live in `BOOKMARKS_DATA_DIR` (default `./data`). Page metadata retrieval sends a bounded request to the address being saved and, when needed, its declared icon; it does not execute page JavaScript or load unrelated page resources. Private/local network destinations and unsafe redirects are blocked.

To back up, stop the server and copy the entire data directory. To restore, stop the server and replace that directory with the backup before starting again. Export from **Import / export** when you want a browser-readable portable copy rather than an operational backup.

Import accepts browser/Netscape bookmark HTML up to 10 MB. It previews new, duplicate, and invalid entries before committing. Browser folder paths become tags. Export includes every active and archived bookmark exactly once and carries Larder-specific fields in a versioned extension while remaining readable by browsers.

## Notes and search

Notes support paragraphs, `**bold**`, `*italic*`, ordered and unordered lists, and HTTP(S)/email links. Raw HTML, images, and unsafe protocols are suppressed.

Search matches titles, addresses, descriptions, visible note text, and tags. Use `"exact phrase"`, `tag:research`, implicit or uppercase `AND`, uppercase `OR`, uppercase `NOT`, and parentheses. Operator precedence is `NOT`, then `AND`, then `OR`.

## Validation

```bash
npm run lint
npm run format:check
npm run typecheck
npm test
npm run test:contract
npm run test:performance
npm run build
npm run test:e2e
```

Playwright is pinned to 1.61.0 and uses the Chromium already installed at `/opt/playwright-browsers`.
