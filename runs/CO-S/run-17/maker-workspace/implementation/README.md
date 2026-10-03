# Keepwell

Keepwell is a personal bookmark library. It stores its data locally in `implementation/data/bookmarks.json` by default.

## Run

```sh
npm start
```

The server listens on `0.0.0.0:4000` by default. Set `PORT` or `KEEPWELL_DATA_FILE` to override the port or data-file location.

## Test

```sh
npm test
npm run test:e2e
```

The browser suite uses the image-provided Playwright 1.61.0 installation and an isolated temporary data file.
