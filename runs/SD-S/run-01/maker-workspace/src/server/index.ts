import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';
import { getConfig } from './config.js';
import { openDatabase } from './db/connection.js';
import { runMigrations } from './db/migrate.js';
import { BookmarkRepository } from './repositories/bookmark-repository.js';
import { createBookmarkRouter } from './routes/bookmarks.js';
import { BookmarkService } from './services/bookmark-service.js';

const config = getConfig();
const database = openDatabase(config.databasePath);
runMigrations(database);
const repository = new BookmarkRepository(database);
const service = new BookmarkService(repository);

const clientDirectory = fileURLToPath(new URL('../../client', import.meta.url));
const app = createApp({ database, clientDirectory, apiRouter: createBookmarkRouter(service) });
const server = app.listen(config.port, config.host, () => {
  console.log(`Bookmark manager listening on http://${config.host}:${config.port}`);
});

function shutdown(): void {
  server.close(() => {
    database.close();
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
