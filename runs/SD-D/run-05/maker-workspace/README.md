# Bookmarks (MVP)

A private, local desktop app to save and manage bookmarks. Everything stays on
your own machine — no accounts, no sign-in, nothing uploaded.

> **Status: in progress.** Right now you can **save** bookmarks (with title,
> description, and site icon filled in for you automatically), **browse** your
> collection, **open** a bookmark in your browser, and — at save time — the app
> keeps a **readable copy** of the page (or the **PDF** itself), viewable in-app
> even offline or after the original is gone. You can **edit** a bookmark's
> title, address, and description; add a **formatted note** (bold, lists,
> links); **archive** (set aside) and **restore** bookmarks; and **permanently
> delete** them behind a confirmation. Re-saving a link you already have opens
> the existing one for editing instead of duplicating it. You can **tag**
> bookmarks (with reuse suggestions), **search** across title, description,
> notes, tags, and address (case-insensitive, with `"exact phrases"` and
> tag filters), and **save searches** by name to reopen later — archived
> bookmarks stay out of everyday results. You can **select many bookmarks at
> once** (or everything a search shows) and **add/remove a tag, mark read,
> archive, or delete** them in one go. You can **import** your existing browser
> bookmarks (with folder→tag mapping, dedupe, and an added/skipped summary) and
> **export** your whole collection to a portable file (preserving each
> bookmark's original saved date). You can mark bookmarks **read / unread ("read
> later")**, filter to just the unread ones, and choose the **sort order**
> (newest, oldest, or by title), which is remembered between sessions.

## Run the app (live window)

```bash
npm install          # install dependencies
npm run rebuild      # rebuild the database engine for the desktop runtime
npm run dev          # launch the app window
```

## Run the tests

The tests run in plain Node, which needs the database engine built for Node
rather than the desktop runtime. Switch it back with one command:

```bash
npm run rebuild:node # build the database engine for Node
npm test             # run the automated core-logic tests
```

> **Why two `rebuild` commands?** The local database engine (`better-sqlite3`)
> is a native component that must match whichever runtime is loading it — the
> desktop app (`npm run rebuild`) or Node for tests (`npm run rebuild:node`).
> Run the matching one when you switch between `npm run dev` and `npm test`.

## Build an installer (double-click app)

```bash
npm run package      # builds the app and produces an installer in release/
```

This produces a native installer for the machine you run it on:

- **macOS** → `release/Bookmarks-<version>.dmg`
- **Windows** → `release/Bookmarks Setup <version>.exe`
- **Linux** → `release/Bookmarks-<version>.AppImage`

electron-builder rebuilds the native database engine for the packaged app
automatically, so the installed app is self-contained — no `npm run rebuild`
needed for the packaged build. (Build each platform's installer on that
platform.)

## Where your data lives

The app stores everything in your operating system's per-user application data
folder (Electron's `userData` directory):

- `bookmarks.db` — the searchable index of your bookmarks
- `saved-copies/` — site icons now; readable page copies and PDFs later

To back up, copy that folder. To move to another machine, copy it across.
