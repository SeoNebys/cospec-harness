import express, { NextFunction, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { WEB_DIST } from './config';
import { bookmarksRouter } from './routes/bookmarks';
import { tagsRouter } from './routes/tags';
import { filtersRouter } from './routes/filters';
import { preferencesRouter } from './routes/preferences';
import { metadataRouter } from './routes/metadata';
import { importExportRouter } from './routes/importexport';

export function createApp(): express.Express {
  const app = express();
  app.use(express.json({ limit: '5mb' }));

  app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

  app.use('/api/bookmarks', bookmarksRouter);
  app.use('/api/tags', tagsRouter);
  app.use('/api/filters', filtersRouter);
  app.use('/api/preferences', preferencesRouter);
  app.use('/api/metadata', metadataRouter);
  app.use('/api', importExportRouter);

  // Unknown API routes → JSON 404.
  app.use('/api', (_req, res) => res.status(404).json({ error: { code: 'not_found', message: 'Unknown endpoint.' } }));

  // Serve the built SPA and fall back to index.html for client-side routes.
  if (fs.existsSync(WEB_DIST)) {
    app.use(express.static(WEB_DIST));
    app.get('*', (_req, res) => res.sendFile(path.join(WEB_DIST, 'index.html')));
  }

  // Central error handler.
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    // eslint-disable-next-line no-console
    console.error(err);
    res.status(500).json({ error: { code: 'server_error', message: 'Something went wrong.' } });
  });

  return app;
}
