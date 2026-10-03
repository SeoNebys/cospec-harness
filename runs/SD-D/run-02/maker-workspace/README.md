# Bookmark Manager

A single-user, same-device web app to save and manage bookmarks. Built with
Spec-Driven Development — see [`specs/001-bookmark-manager/`](specs/001-bookmark-manager/)
for the approved spec, plan, and tasks.

## What it does

- **Save** a link and automatically capture its title, description, favicon, and
  preview image; edit any field during save or later. Saving an existing address
  opens the existing bookmark instead of duplicating it.
- **Organize** with a Markdown note, shared-identity tags (one tag per name),
  read/unread state, and reversible archiving; permanently delete when done.
- **Browse** a normal list plus separate unread and archived views. Click a tag
  to filter.
- **Search** across title/description/note/address (case-insensitive) with
  `#tag`, `"exact phrases"`, and `AND`/`OR`/`NOT` + parentheses; sort results.
- **Bulk-edit** selected bookmarks, or everything matching the current view
  (all facets, across every page).
- **Save searches** (with included/excluded tags), take **snapshots**
  (self-contained HTML, or the original PDF), push pages to the **Internet
  Archive**, and **import/export** standard Netscape bookmark files.
- **Tune** default sort, items per page, and font size.

## Architecture

One Node.js process (Express) serves the built React UI and a JSON API on
`0.0.0.0:4000`. Data lives on the same device: SQLite (`better-sqlite3`) for
structured data and the filesystem (`data/`) for snapshots and cached images.
Page fetching uses `cheerio`; snapshots and E2E tests use Playwright 1.61.0.

```
server/   Express API, models, services (metadata, snapshot, archive.org, netscape), search engine
web/      React + Vite UI (built into web/dist, served by the server)
tests/    Playwright E2E specs and fixtures
data/     runtime SQLite DB, snapshots, cached images (created on first run)
```

## Run

```bash
npm install       # installs server + web workspaces
npm run build     # builds the React UI into web/dist
npm start         # serves the app on http://0.0.0.0:4000
```

Open http://localhost:4000 (reviewers use `http://maker:4000`).

## Test

```bash
npm test          # backend unit tests (search grammar, URL, Netscape, metadata safeguard)
npm run test:e2e  # Playwright end-to-end journeys, one per user story
```

The Internet Archive E2E check needs outbound access to archive.org; if it is
unreachable it verifies the recoverable-error path instead.

## Notes

- Only http/https addresses are supported.
- Delayed metadata never overwrites a title/description you entered — even if you
  edit it while the fetch is still running (per-field guard, see the spec's R13).
