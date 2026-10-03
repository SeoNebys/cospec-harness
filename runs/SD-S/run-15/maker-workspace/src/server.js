import express from 'express';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDatabase } from './db/connection.js';
import { createRouter } from './api/routes.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export function createApp(db) {
  const app = express();
  app.use(express.json());
  app.use('/api', createRouter(db));
  app.use(express.static(join(__dirname, 'web')));
  return app;
}

// Start the server only when run directly (not when imported by tests).
const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  const db = openDatabase();
  const app = createApp(db);
  const port = Number(process.env.PORT) || 4000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`Bookmark Manager listening on http://0.0.0.0:${port}`);
  });
}
