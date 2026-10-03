// Server entry point — listens on 0.0.0.0:4000 (project runtime conventions).
import { openDatabase } from './db.js';
import { createApp } from './app.js';

const PORT = Number(process.env.PORT) || 4000;
const HOST = '0.0.0.0';

const db = openDatabase();
const app = createApp(db);

const server = app.listen(PORT, HOST, () => {
  console.log(`Bookmark Manager listening on http://${HOST}:${PORT}`);
});

function shutdown() {
  server.close(() => {
    db.close();
    process.exit(0);
  });
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
