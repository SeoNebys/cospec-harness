# Lattice

Lattice is a personal bookmark web app that captures page details, searches
titles/sites/descriptions/notes, organizes links with tags, and supports Read
later and Archive without creating duplicate copies.

## Run

```sh
npm install
npm start
```

The server listens on `0.0.0.0:4000` by default and stores the collection in
`data/bookmarks.json`. Set `PORT` or `NOOK_DATA_FILE` to override those defaults.

## Verify

```sh
PLAYWRIGHT_BROWSERS_PATH=/opt/playwright-browsers npm test
```
