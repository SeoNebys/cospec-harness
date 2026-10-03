# Keepsake

Keepsake is a personal bookmark manager. Paste a public HTTP(S) link to retrieve its title, description, and icon; adjust the details; organize it with tags; search with exact phrases and tag alternatives; and maintain an unread read-later queue.

## Run locally

Requires Node.js 24.

```bash
npm ci
npm run build
npm start
```

The server listens on `0.0.0.0:4000`. Bookmark data is stored in `data/bookmarks.sqlite`; validated page icons are cached in `data/icons/`. Back up the entire `data/` directory while the app is stopped.

## Development and validation

```bash
npm run dev
npm run typecheck
npm run lint
npm test
npm run build
npm run test:e2e
```

## Search syntax

- `Rome history` requires both terms across searchable bookmark fields.
- `"ancient Rome"` finds that exact phrase within one field.
- `tag:book` searches complete tag names only.
- `Rome tag:(article|book)` requires Rome and either tag.
- Multi-word tags use quotes, such as `tag:"science fiction"`.

## Metadata network policy

Metadata preview accepts only credential-free HTTP(S) URLs on standard ports. It rejects non-public IPv4/IPv6 destinations, validates every redirect, limits redirects, response size, and total time, and never executes destination scripts. Missing or failed metadata never prevents saving a valid URL. User-edited metadata is never refreshed silently.

The first release is intentionally single-user and has no authentication. Restrict network access to trusted users when deploying it beyond a local machine.

## Configuration

| Variable | Default | Purpose |
|----------|---------|---------|
| `HOST` | `0.0.0.0` | Listening interface |
| `PORT` | `4000` | HTTP port |
| `DATABASE_PATH` | `data/bookmarks.sqlite` | SQLite file |
| `ICON_CACHE_PATH` | `data/icons` | Validated icon cache |
| `METADATA_TIMEOUT_MS` | `5000` | Total preview timeout |
| `METADATA_HTML_MAX_BYTES` | `1048576` | Maximum HTML bytes |
| `METADATA_ICON_MAX_BYTES` | `262144` | Maximum icon bytes |
| `METADATA_MAX_REDIRECTS` | `5` | Redirect limit |

## API and design

The API contract and search grammar are documented in `specs/001-manage-bookmarks/contracts/`.
