# Stow

Private, single-account bookmark manager built for the Cycle 1 approved scenarios.

## Run

```sh
npm install
npm start
```

The server listens on `0.0.0.0:4000` by default. On first startup it creates the account and SQLite database. Defaults for local review are:

- Email: `you@example.com`
- Password: `bookmarks`

Set `STOW_EMAIL`, `STOW_PASSWORD`, and `STOW_DB_PATH` before the first startup to choose production values. Set `COOKIE_SECURE=1` behind HTTPS.

## Verify

```sh
npm test
npm run test:e2e
```

The browser suite uses the Chromium build preinstalled in the project environment. Design rationale, scenario mapping, and the Cycle 1 verification result are in `docs/`.
