import { createServer } from 'node:http';

import { createApp } from './app.js';
import { closeDatabase, openDatabase } from './db/database.js';

const db = openDatabase();
const app = createApp(db);
const port = Number(process.env.PORT ?? 4000);
const server = createServer(app);

server.listen(port, '0.0.0.0', () => {
  console.log(`Bookmark manager listening on http://0.0.0.0:${port}`);
});

const shutdown = () => {
  server.close(() => {
    closeDatabase(db);
    process.exit(0);
  });
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
