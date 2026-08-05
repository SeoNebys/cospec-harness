# Bookmark Manager

A single-user bookmark app that runs entirely on your own machine and is used in
your web browser. Save web pages, search and open them, organize them with tags,
and edit or delete them (with undo). No accounts, no sign-in, no hosting — all
your data stays in one local file.

Built with Spec-Driven Development; the full specification, plan, and tasks live
in [`specs/001-bookmark-manager/`](specs/001-bookmark-manager/).

## Requirements

- [Node.js](https://nodejs.org) LTS (v20+).

## Install & run

```sh
npm install
npm start
```

Then open the printed address (default <http://127.0.0.1:3000>) in your browser.
On first launch the app creates its database file and shows a short guide for
adding your first bookmark.

To run on a different port:

```sh
PORT=8080 npm start
```

## What you can do

- **Save** a bookmark by pasting a web address. If you leave the title blank, the
  app fetches the page's title for you (and falls back to the address if the page
  can't be reached). Invalid addresses are rejected with a clear message, and
  saving an address you already have offers to open the existing bookmark instead
  of creating a duplicate.
- **Find** bookmarks by typing a keyword — it matches titles, addresses, and
  tags. Click a bookmark to open it in a new browser tab.
- **Organize** with tags: add or remove tags on any bookmark, filter the list by
  a tag, and rename or remove a tag everywhere it's used.
- **Maintain**: edit a bookmark's title, address, and notes; delete one (with a
  confirmation step) and undo the deletion if it was a mistake.

## Your data & backups

All bookmarks and tags are stored in a single SQLite file:

```
data/bookmarks.sqlite
```

**Backing up is just copying that file.** To restore, put the file back. You can
point the app at a different database file with the `BOOKMARKS_DB` environment
variable:

```sh
BOOKMARKS_DB=/path/to/my-bookmarks.sqlite npm start
```

## Development

```sh
npm run dev        # build the UI and run the server, restarting on server changes
npm test           # unit + integration tests (Vitest)
npm run test:e2e   # end-to-end browser test (Playwright) — see note below
npm run lint       # lint
npm run format     # format with Prettier
```

The end-to-end test needs a browser the first time:

```sh
npx playwright install
npm run test:e2e
```

## Project layout

```
src/server/   local HTTP + JSON API, SQLite storage, title fetching
src/web/      React single-page UI (built to dist/web and served by the server)
tests/        unit, integration, and e2e tests
specs/        the specification, plan, and task breakdown (SDD artifacts)
```

## Performance & scale

Designed for a personal collection. Verified with 5,000 bookmarks: keyword
search and tag filtering return in a few milliseconds, well under the 1-second
target.
