import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDb } from './db.js';
import { buildApp } from './app.js';

// Local server entry. Opens the SQLite file, builds the app, and listens on
// localhost. Data lives in a single file so a backup is just a file copy.
const here = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT ?? 3000);

const dbPath = process.env.BOOKMARKS_DB ?? resolve(here, '../../data/bookmarks.sqlite');
if (dbPath !== ':memory:') mkdirSync(dirname(dbPath), { recursive: true });

const db = openDb(dbPath);
const app = buildApp(db);

app
  .listen({ port: PORT, host: '127.0.0.1' })
  .then((address) => {
    // eslint-disable-next-line no-console
    console.log(`Bookmark Manager running at ${address}`);
    if (dbPath !== ':memory:') {
      // eslint-disable-next-line no-console
      console.log(`Data file: ${dbPath} (copy this file to back up)`);
    }
  })
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
  });
