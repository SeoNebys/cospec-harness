# Keepsake

A single-user bookmark library that runs locally in a web browser and stores its data on disk.

## Run

```sh
npm install
npm start
```

The server listens on port `4000` by default. Set `PORT` or `KEEPSAKE_DATA_FILE` to use another port or library file.

## Test

```sh
npm test
npm run test:e2e
```

The production library lives at `data/library.json`. Complete backups downloaded from Library tools can restore every stored field and state.
