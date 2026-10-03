import { existsSync } from 'node:fs';
import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import type { DatabaseSync } from 'node:sqlite';
import { BookmarkRepository } from './db/bookmarkRepository.js';
import { bookmarkRoutes } from './routes/bookmarks.js';
import { healthRoutes } from './routes/health.js';
import { pageMetadataRoutes } from './routes/pageMetadata.js';

export async function buildApp(options: {db: DatabaseSync; clientPath?: string; logger?: boolean} ) {
  const app=Fastify({logger: options.logger ? {redact:['req.body.notes','req.body.description']} : false, bodyLimit: 32*1024});
  app.setErrorHandler((error,_request,reply)=>{ const failure=error as {statusCode?:number;message?:string}; app.log.error(error); const status=failure.statusCode && failure.statusCode<500 ? failure.statusCode : 500; reply.code(status).send({error:{code:status===500?'INTERNAL_ERROR':'BAD_REQUEST',message:status===500?'Something went wrong. Please try again.':failure.message||'Bad request.'}}); });
  await healthRoutes(app); await pageMetadataRoutes(app); await bookmarkRoutes(app,new BookmarkRepository(options.db));
  if(options.clientPath && existsSync(options.clientPath)) {
    await app.register(fastifyStatic,{root:options.clientPath,prefix:'/'});
    app.setNotFoundHandler((request,reply)=> request.url.startsWith('/api/') ? reply.code(404).send({error:{code:'NOT_FOUND',message:'Not found.'}}) : reply.sendFile('index.html'));
  }
  return app;
}
