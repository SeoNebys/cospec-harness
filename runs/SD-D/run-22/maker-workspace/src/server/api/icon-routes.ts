import type { FastifyPluginAsync } from 'fastify';
import fs from 'node:fs';
import { safeIconPath } from '../metadata/icon-cache.js';

const types:Record<string,string>={png:'image/png',jpg:'image/jpeg',gif:'image/gif',webp:'image/webp',ico:'image/x-icon'};
export const iconRoutes:FastifyPluginAsync=async(app)=>{
  app.get<{Params:{token:string}}>('/icons/:token',async(request,reply)=>{
    const file=safeIconPath(app.appConfig.ICON_CACHE_PATH,request.params.token);
    if(!file||!fs.existsSync(file)) return reply.status(404).send({error:{code:'NOT_FOUND',message:'Icon not found.'}});
    const ext=request.params.token.split('.').pop()!;
    return reply.type(types[ext]??'application/octet-stream').header('cache-control','public, max-age=31536000, immutable').send(fs.createReadStream(file));
  });
};
