import { createApp } from '../../src/server/app.js';
import { BookmarkRepository } from '../../src/server/repositories/bookmark-repository.js';
import { createBookmarkRouter } from '../../src/server/routes/bookmarks.js';
import { BookmarkService } from '../../src/server/services/bookmark-service.js';
import { createTestDatabase } from './database.js';

export function createTestServer(now?: () => string, createId?: () => string) {
  const testDatabase = createTestDatabase();
  const repository = new BookmarkRepository(testDatabase.database);
  const service = new BookmarkService(repository, now, createId);
  const app = createApp({ database: testDatabase.database, apiRouter: createBookmarkRouter(service) });
  return { app, service, repository, ...testDatabase };
}
