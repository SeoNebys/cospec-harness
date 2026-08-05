# My Bookmarks

A single-user home for the links you save: **find** things back from a stray
word, **round up** a kind, **save** in a couple of taps, keep a self-cleaning
**reading pile**, and **tidy** without fear. One page, in your browser, no
install, no accounts, no syncing — your bookmarks live in this browser.

## Open it (so your bookmarks are kept)

Use the launcher for your computer — **double-click**:

- **Mac:** `start.command`
- **Windows:** `start.bat`
- **Linux:** `start.sh`  (or run `./start.sh`)

A small window opens ("My Bookmarks is running at http://localhost:4321/") and
your browser opens the app. Leave that window open while you use it. Open it the
same way every time and **your saved bookmarks are reliably kept between visits**
on this computer. (Requires [Node.js](https://nodejs.org) installed — the same
engine the app is built and tested with.)

On day one it's empty and shows you how to add your first link.

### Why not just double-click `index.html`?

You can — but browsers treat a double-clicked file as having no fixed "home", and
some of them won't reliably keep your saved bookmarks there. If you open the file
directly and the browser isn't saving durably, the app will **tell you** with a
warning (it never loses your data silently) and point you back to the launcher.
The launcher gives the app a stable local address, which is what makes saving
stick.

## What it does

- **Find** — type any words in any order; it looks in the title, the page
  summary, your own note and the site name, matching from the start of words.
- **Round up** — click a label to gather that kind; narrow with a search;
  "show all again" to clear.
- **Save** — paste a link; the title/site/summary fill in where possible; add
  your own note (also searchable) and labels. Re-pasting a saved link never
  makes a duplicate.
- **Reading pile** — tick "I still need to read this"; open the **📖 To read**
  pile; one tap to mark read and it drops out on its own.
- **Tidy** — edit on the card or in "Edit details" (including fixing a moved
  link); **Set aside** to tuck away reversibly; **Delete for good** for rubbish;
  **Undo** on both.
- **Order** — newest / oldest / A–Z, remembered between visits.

## Develop / test

```
npm install    # installs jsdom (test-only)
npm test       # runs unit, acceptance and UI tests with node --test
```

- `src/core.js` — pure domain logic (searching, ordering, links, metadata).
- `src/store.js` — collection state, persistence, operations.
- `src/app.js` — the browser UI.
- `tests/` — `core` (unit), `acceptance` (per-scenario via the store),
  `ui` (drives the real page in jsdom).
- `docs/` — design decisions and the scenario→code map.

## Known limitation

Auto-filling the title/summary from *any* pasted page needs a small fetch
helper (a static page can't read other sites directly). Today it recognises a
seeded set and otherwise fills the site name and lets you type the title. See
`docs/design-decisions.md`.
