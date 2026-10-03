import express from 'express';
import path from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { BookmarkRepository } from './repositories/bookmark-repository.ts';
import { BookmarkService } from './services/bookmark-service.ts';
import { bookmarkRoutes } from './routes/bookmarks.ts';
import { tagRoutes } from './routes/tags.ts';
import { metadataRoutes } from './routes/metadata-preview.ts';
import { errorHandler, requestId } from './middleware/errors.ts';
import { sameOrigin, securityHeaders } from './middleware/security.ts';

export async function createApp(db:DatabaseSync,production=process.env.NODE_ENV==='production'){
  const app=express();const service=new BookmarkService(new BookmarkRepository(db));
  app.set('trust proxy',false);app.use(requestId,securityHeaders,express.json({limit:'64kb'}));
  app.use('/api',sameOrigin);app.use('/api/bookmarks',bookmarkRoutes(service));app.use('/api/tags',tagRoutes(service));app.use('/api/metadata-preview',metadataRoutes());
  if(production){const client=path.resolve('dist/client');app.use(express.static(client));app.get('*splat',(_req,res)=>res.sendFile(path.join(client,'index.html')));}
  else {const {createServer}=await import('vite');const vite=await createServer({server:{middlewareMode:true},appType:'spa'});app.use(vite.middlewares);}
  app.use(errorHandler);return app;
}
