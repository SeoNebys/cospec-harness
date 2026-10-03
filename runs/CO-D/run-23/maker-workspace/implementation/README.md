# Kept

Kept is a personal bookmark library that saves readable metadata and durable page/PDF copies, then makes the collection searchable and manageable from a browser.

## Run

From `/work`:

```sh
npm start
```

Open `http://maker:4000` in the review environment. Data is persisted in `implementation/data/store.json` using atomic replacement writes.

## Test

```sh
npm test
```

The suite contains acceptance-oriented tests mapped to the approved Cycle 1 scenarios and focused domain/import/capture tests. See `scenario-map.md` and `verification-report.md`.

## Backup and restore

The full JSON download is self-contained: it includes bookmarks, saved page text and images, PDF bytes, labels, dates, status, saved searches, and comfort settings. Import that `.json` file to restore it. The browser HTML export is deliberately lighter and does not contain saved copies.

Remote retrieval accepts only HTTP(S) resources, rejects private/local network targets, rechecks redirects, and applies time and size limits.
