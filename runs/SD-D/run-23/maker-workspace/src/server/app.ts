import path from 'node:path';
import fs from 'node:fs';
import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import { getDatabase, type Db } from './db/client.js';
import { registerAuth } from './auth/plugin.js';
import { sessionRoutes } from './api/session.js';
import { metadataRoutes } from './api/metadata.js';
import { bookmarkRoutes } from './api/bookmarks.js';
import { labelRoutes } from './api/labels.js';
import { savedViewRoutes } from './api/saved-views.js';
import { bulkRoutes } from './api/bulk-actions.js';
import { assetRoutes } from './api/assets.js';

export async function buildApp(db:Db=getDatabase()){
  const app=Fastify({logger:{redact:['req.headers.authorization','req.headers.cookie','res.headers.set-cookie']},bodyLimit:1024*1024});
  app.get('/api/health',async()=>({status:'ok'}));
  await registerAuth(app,db);
  await sessionRoutes(app,db);await metadataRoutes(app);await bookmarkRoutes(app,db);await labelRoutes(app,db);await savedViewRoutes(app,db);await bulkRoutes(app,db);await assetRoutes(app,db);
  const client=path.resolve(process.cwd(),'dist/client');
  if(fs.existsSync(client)){await app.register(fastifyStatic,{root:client,prefix:'/'});app.setNotFoundHandler((request,reply)=>{if(request.url.startsWith('/api/'))return reply.code(404).send({type:'urn:bookmark-manager:not-found',title:'Not found',status:404,detail:'No API route matches.',requestId:request.id});return reply.sendFile('index.html');});}
  return app;
}
