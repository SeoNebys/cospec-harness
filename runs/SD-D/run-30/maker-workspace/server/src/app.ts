import path from 'node:path';
import express from 'express';
import type { Config } from './config.js';
import type { Db } from './db/connection.js';
import { BookmarkRepository } from './repositories/bookmark-repository.js';
import { BookmarkService } from './services/bookmark-service.js';
import { apiRouter } from './api/router.js';
import { errorHandler } from './api/problems.js';
import { securityHeaders } from './api/security-headers.js';
export function createApp(db:Db,config:Config){const app=express();const repo=new BookmarkRepository(db),service=new BookmarkService(repo,config);app.disable('x-powered-by');app.use(securityHeaders);app.use(express.json({limit:'64kb'}));app.use('/api',apiRouter(repo,service,config));const client=path.resolve('client-dist');app.use(express.static(client));app.get('/{*path}',(_req,res)=>res.sendFile(path.join(client,'index.html')));app.use(errorHandler);return app}
