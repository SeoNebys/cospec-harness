import path from 'node:path';
import express from 'express';
import cookieParser from 'cookie-parser';
import type { Config } from './config.js';
import type { Database } from './db/index.js';
import { AuthRepository } from './auth/auth-repository.js';
import { authRoutes } from './auth/auth-routes.js';
import { requireUser } from './middleware/require-user.js';
import { errorHandler, notFound } from './middleware/errors.js';
import { requestLog } from './middleware/request-log.js';
import { verifyOrigin } from './middleware/origin.js';
import { BookmarkRepository } from './bookmarks/bookmark-repository.js';
import { BookmarkService } from './bookmarks/bookmark-service.js';
import { bookmarkRoutes, tagRoutes } from './bookmarks/bookmark-routes.js';
import { titlePreviewRoutes } from './title-preview/title-preview-routes.js';

export function createApp(db: Database, config: Config) {
  const app = express();
  const auth = new AuthRepository(db);
  const bookmarks = new BookmarkRepository(db);
  const service = new BookmarkService(bookmarks);
  app.disable('x-powered-by');
  app.use(requestLog, express.json({ limit: '32kb' }), cookieParser(), verifyOrigin);
  app.get('/api/health', (_request, response) => response.json({ status: 'ready' }));
  app.use('/api/auth', authRoutes(auth, config));
  app.use('/api/bookmarks', requireUser(auth), bookmarkRoutes(bookmarks, service));
  app.use('/api/tags', requireUser(auth), tagRoutes(bookmarks));
  app.use('/api/title-previews', requireUser(auth), titlePreviewRoutes());
  app.use('/api', notFound);
  const client = path.resolve('dist/client');
  app.use(express.static(client));
  app.use((request, response, next) =>
    request.method === 'GET' ? response.sendFile(path.join(client, 'index.html')) : next(),
  );
  app.use(notFound, errorHandler);
  return app;
}
