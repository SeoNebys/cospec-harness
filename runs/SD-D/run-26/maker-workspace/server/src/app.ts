import path from 'node:path';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import express, { type NextFunction, type Request, type Response } from 'express';
import { ZodError } from 'zod';
import type { AppConfig } from './config/index.js';
import { openDatabase } from './db/database.js';
import { createLogger } from './observability/logger.js';
import { securityHeaders } from './app/security.js';
import { healthRouter } from './routes/health.js';
import { SessionRepository } from './auth/session-repository.js';
import { SessionService } from './auth/session-service.js';
import { authRouter } from './auth/auth-routes.js';
import { requireCsrf, requireSession } from './auth/middleware.js';
import { BookmarkRepository } from './bookmarks/bookmark-repository.js';
import { BookmarkService } from './bookmarks/bookmark-service.js';
import { BulkService } from './bookmarks/bulk-service.js';
import { IconRepository } from './icons/icon-repository.js';
import { ProposalStore } from './metadata/proposal-store.js';
import { MetadataService } from './metadata/metadata-service.js';
import { metadataRouter } from './metadata/metadata-routes.js';
import { bookmarkRouter } from './bookmarks/bookmark-routes.js';
import { iconRouter } from './icons/icon-routes.js';
import { tagRouter } from './tags/tag-routes.js';
import { ImportRepository } from './import-export/import-repository.js';
import { ImportService } from './import-export/import-service.js';
import { importExportRouter } from './import-export/import-export-routes.js';
import { AppError } from '@shared/errors.js';
import { EnrichmentWorker } from './metadata/enrichment-worker.js';
import { SelectionService } from './bookmarks/selection-service.js';

export async function createApp(config: AppConfig) {
  const logger = createLogger(config.logLevel),
    db = openDatabase(config.dataDir),
    sessions = new SessionService(new SessionRepository(db)),
    bookmarks = new BookmarkRepository(db),
    bookmarkService = new BookmarkService(bookmarks),
    icons = new IconRepository(db),
    metadata = new MetadataService(bookmarks, icons, new ProposalStore()),
    bulk = new BulkService(db, bookmarks, new SelectionService(bookmarks)),
    imports = new ImportRepository(db),
    importService = new ImportService(db, bookmarks, bookmarkService, icons),
    worker = new EnrichmentWorker(db, bookmarks, metadata);
  worker.start();
  const app = express();
  if (config.trustProxy) app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    res.locals.requestId = String(req.get('x-request-id') ?? randomUUID());
    res.set('X-Request-ID', res.locals.requestId);
    next();
  });
  app.use(securityHeaders);
  app.use(express.json({ limit: '1mb' }));
  app.use(express.text({ type: ['text/html', 'application/x-netscape-bookmarks'], limit: '10mb' }));
  app.use('/health', healthRouter);
  app.use('/api/session', authRouter(sessions, config));
  app.use('/api', requireSession(sessions), requireCsrf(sessions));
  app.use('/api/metadata', metadataRouter(metadata));
  app.use('/api/bookmarks', bookmarkRouter(bookmarks, bookmarkService, metadata, bulk));
  app.use('/api/icons', iconRouter(icons));
  app.use('/api/tags', tagRouter(bookmarks));
  app.use('/api', importExportRouter(importService, imports, bookmarks));
  const client = path.resolve('dist/client');
  if (fs.existsSync(client)) {
    app.use(express.static(client, { index: false, maxAge: config.production ? '1y' : 0 }));
    app.get('*path', (req, res, next) =>
      req.path.startsWith('/api/') ? next() : res.sendFile(path.join(client, 'index.html'))
    );
  }
  app.use((req, _res, next) =>
    next(new AppError(404, 'NOT_FOUND', 'The requested resource was not found.'))
  );
  app.use((error: unknown, req: Request, res: Response, _next: NextFunction) => {
    let status = 500,
      code = 'INTERNAL_ERROR',
      message = 'Something went wrong.' as string,
      details: unknown;
    if (error instanceof AppError) {
      ({ status, code, message, details } = error);
    } else if (error instanceof ZodError) {
      status = 422;
      code = 'BAD_REQUEST';
      message = 'Check the highlighted values and try again.';
      details = error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
    } else if (error instanceof SyntaxError) {
      status = 400;
      code = 'BAD_REQUEST';
      message = 'The request body is not valid JSON.';
    }
    logger.error(
      {
        err: error instanceof Error ? { name: error.name, message: error.message } : String(error),
        requestId: res.locals.requestId,
        path: req.path
      },
      'request failed'
    );
    res.status(status).json({ error: { code, message, details, requestId: res.locals.requestId } });
  });
  return {
    app,
    db,
    close: () => {
      worker.stop();
      db.close();
    }
  };
}
