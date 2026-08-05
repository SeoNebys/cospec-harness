# Bookmark Manager

A personal, single-user bookmark manager that runs **entirely in your browser**.
No accounts, no login, no server — your bookmarks are saved locally on your own
computer (in the browser's IndexedDB) and work fully offline.

Built with React + TypeScript + Vite; local storage via Dexie (IndexedDB).

## What it does

- **Save** a web address as a bookmark, with an optional title, notes, and tags.
- **Browse** all saved bookmarks (most-recent-first) and **open** the original page.
- **Edit** a bookmark or **delete** it (with a confirmation step).
- **Organize & find**: assign tags, filter by tag, and search by keyword across
  title, address, and tags.

Titles default to the address when left blank (the app never fetches pages over
the network, so everything stays offline).

## Requirements

- Node.js 20+ and npm

## Run it (development)

```sh
npm install
npm run dev
```

Open the printed local URL (e.g. `http://localhost:5173`).

## Build a static version

```sh
npm run build      # outputs a static bundle to dist/
npm run preview    # serve the built bundle locally to check it
```

The contents of `dist/` are just static files — open them in any modern browser.

## Tests

```sh
npm test           # unit + component tests (Vitest / React Testing Library)
npm run test:e2e   # end-to-end smoke flow (Playwright)
```

> The Playwright end-to-end test needs a browser binary and its system
> libraries: `npx playwright install --with-deps chromium`. On minimal/sandboxed
> Linux without those OS libraries it cannot launch a browser; the unit and
> component suites cover the same behavior headlessly.

## Project layout

```
src/
├── models/      # Bookmark & Tag types, validation error
├── lib/         # URL normalization/validation, title fallback
├── data/        # Dexie database + bookmarkRepository (the data-layer contract)
└── components/  # BookmarkList, BookmarkItem, BookmarkForm, SearchBar, TagFilter, …
tests/
├── unit/        # url + repository logic
├── component/   # component behavior
└── e2e/         # Playwright smoke flow
```

The full specification, plan, and task breakdown live in
[`specs/001-bookmark-manager/`](specs/001-bookmark-manager/).
