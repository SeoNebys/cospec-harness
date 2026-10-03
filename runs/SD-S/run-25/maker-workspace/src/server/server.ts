import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { closeDatabase, openDatabase } from './db/connection.js';
import { runMigrations } from './db/migrations.js';
import { BookmarkRepository } from './db/bookmark-repository.js';
import { registerBookmarkRoutes } from './routes/bookmarks.js';
import { registerMetadataRoutes } from './routes/metadata.js';
import { registerTagRoutes } from './routes/tags.js';
import { BookmarkService } from './services/bookmark-service.js';
import { createMetadataService } from './services/metadata-service.js';

const config = loadConfig();
const database = openDatabase(config.databasePath);
runMigrations(database);
const bookmarkService = new BookmarkService(new BookmarkRepository(database));
const metadataService = createMetadataService();

const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
const staticDir = config.nodeEnv === 'test' || config.nodeEnv === 'production'
  ? path.resolve(moduleDirectory, '../client')
  : undefined;

const app = createApp({
  staticDir,
  registerRoutes: (instance) => {
    registerBookmarkRoutes(instance, { bookmarkService });
    registerMetadataRoutes(instance, { metadataService });
    registerTagRoutes(instance, bookmarkService);
  },
});
const server = app.listen(config.port, config.host, () => {
  console.log(`Bookmark manager listening on http://${config.host}:${config.port}`);
});

server.on('error', (error) => {
  console.error('Bookmark manager failed to start', error.message);
  closeDatabase(database);
  process.exitCode = 1;
});

let shuttingDown = false;
function shutdown(signal: string): void {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`Received ${signal}; shutting down.`);
  const forceClose = setTimeout(() => {
    server.closeAllConnections();
  }, 5_000);
  forceClose.unref();
  server.close((error) => {
    clearTimeout(forceClose);
    closeDatabase(database);
    if (error) {
      console.error('Server shutdown failed', error.message);
      process.exitCode = 1;
    }
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
