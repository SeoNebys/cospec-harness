# Bookmark Manager

A single-user, browser-based app to save and manage bookmarks: automatic page
information capture, tags, Markdown notes, powerful search, read-later, reversible
archiving, bulk actions, saved searches, sorting/display preferences, saved local
copies (self-contained HTML or the PDF itself) with optional Internet Archive
preservation, and import/export in the standard browser-bookmark HTML format.

Built with Spec-Driven Development — see `specs/001-bookmark-manager/` for the
spec, plan, and tasks.

## Requirements

- Node.js 24+ (uses the built-in `node:sqlite`)
- npm

## Run

```bash
npm install        # install dependencies
npm run build      # bundle the client into public/ (esbuild)
npm start          # start the server on 0.0.0.0:4000
```

Open http://localhost:4000 (in the review environment, http://maker:4000).

## Test

```bash
npm test           # unit tests (search parser, Markdown, metadata, import/export)
npm run test:e2e   # Playwright browser tests, one per user story
node --disable-warning=ExperimentalWarning tests/perf/seed.js   # perf check (~1,000 bookmarks)
```

E2e tests use local fixtures (no public internet) via `tests/e2e/helpers/servers.js`.

## Where data lives

- `data/bookmarks.db` — the SQLite database (bookmarks, tags, saved searches,
  preferences, saved-copy records).
- `data/snapshots/` — saved page copies: self-contained `.html` snapshots and
  stored `.pdf` files.

Everything is local; there are no accounts and no external database. Automatic
page information and saved copies fetch the live page over the network and degrade
gracefully when a page is unreachable; Internet Archive preservation depends on
that third-party service and reports failure honestly without affecting the
bookmark.

## Project layout

```
src/server/   Express API + node:sqlite storage (models, services, routes)
src/client/   Vanilla-JS single-page app (views, lib), bundled to public/
tests/        unit/ · integration-style e2e/ · perf/
specs/        Spec-Driven Development artifacts
```

See `specs/001-bookmark-manager/quickstart.md` for a per-story validation walkthrough.
