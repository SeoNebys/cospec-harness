# 📚 Bookmark Manager

A personal, **local-first** app to save and manage your bookmarks. Everything stays on
your own computer — no account, no sign-in — and everything you've already saved works
even when you're offline.

It saves a link the moment you paste it, automatically grabs the page's title,
description, icon and preview, keeps its own readable copy of the page (or the original
PDF) so you can still read it if the page ever disappears, and lets you tag, search,
organize a read-later pile, archive, and import/export your collection.

---

## Getting started (the easy way)

You need [Node.js 20](https://nodejs.org) installed once. Then, from this folder:

```
npm run setup     # one time — installs everything
npm start         # start the app
```

`npm start` builds the app, starts the local helper, and **opens Bookmark Manager in your
browser automatically**. You'll see a message like:

```
  📚 Bookmark Manager is running.
  Open it here: http://127.0.0.1:4321
```

Leave that window open while you use the app. To stop, close the window (or press Ctrl-C).
Next time, just run `npm start` again — that's the whole ritual.

---

## Your data & backups

Everything you save lives in one place: the **`data/` folder** next to this README.

- `data/bookmarks.db` — your links, titles, descriptions, notes, tags, and settings.
- `data/snapshots/` — the saved copies of pages and PDFs.

**To back up or move to a new computer**, you have two easy options:

1. **Copy the `data/` folder.** That's a complete backup of everything, snapshots included.
2. **Use the app.** Go to **Import / Export → Download full backup**. You get a single file
   with all your links, notes, tags, and settings. On the new computer, use **Restore a
   backup file** to bring it all back.

You can also **Import** a bookmarks file exported from any browser, and **Export** yours in
the same browser-compatible format.

---

## What's inside

- `backend/` — the local helper service (fetching page details, snapshots, search, storage).
- `frontend/` — the app you use in your browser.
- `specs/001-bookmark-manager/` — the specification, plan, and task list this was built from.

Run the tests with `npm test`.

There are also browser click-through tests (Playwright). To run them once on your machine:

```
cd frontend
npx playwright install    # one time — downloads a test browser
npm run test:e2e
```

---

## Project layout & method

This app was built with **Spec-Driven Development**: the specification
(`specs/001-bookmark-manager/spec.md`) is the source of truth, followed by a plan, a task
breakdown, and then the implementation. See that folder to understand exactly what the app
does and why.
