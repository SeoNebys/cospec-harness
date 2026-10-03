# Trove

Trove is a self-contained personal bookmark library. It enriches saved links,
captures readable copies, prevents duplicates, searches personal context, and
supports tags, Read later, editing, and deliberate deletion.

## Run

```sh
npm install
npm start
```

The application listens on `0.0.0.0:4000` by default. Set `PORT` or
`TROVE_DATA_FILE` to override the port or persistent JSON data location.

## Test

```sh
npm run test:all
```

The tests use local fixture pages; they do not depend on external websites.
