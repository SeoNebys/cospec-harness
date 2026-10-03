import express, { type Express } from 'express';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { AppDatabase } from './db/database.js';
import { errorHandler, notFound } from './api/errors.js';
import { IconStore } from './metadata/icon-store.js';
import { MetadataService } from './metadata/metadata-service.js';
import { BookmarkRepository } from './repositories/bookmark-repository.js';
import { bookmarkRouter, iconRouter } from './api/bookmark-routes.js';
import { metadataRouter } from './api/metadata-routes.js';
import { TagRepository } from './repositories/tag-repository.js';
import { tagRouter } from './api/tag-routes.js';
import { secureRequests } from './api/middleware.js';

export type AppDependencies = { db: AppDatabase };
export function createApp({ db }: AppDependencies): Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(secureRequests);
  app.use(express.json({ limit: '64kb' }));
  app.get('/api/health', (_req, res) => {
    db.prepare('SELECT 1').get();
    res.json({ status: 'ready' });
  });
  const icons = new IconStore(db);
  const bookmarks = new BookmarkRepository(db, icons);
  app.use('/api/metadata', metadataRouter(new MetadataService(icons)));
  app.use('/api/bookmarks', bookmarkRouter(bookmarks));
  app.use('/api/icons', iconRouter(bookmarks));
  app.use('/api/tags', tagRouter(new TagRepository(db)));
  const client = resolve(process.cwd(), 'dist/client');
  if (existsSync(client)) {
    app.use(express.static(client, { index: false }));
    app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(resolve(client, 'index.html')));
  }
  app.use('/api', notFound);
  app.use(errorHandler);
  return app;
}
