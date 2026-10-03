import type { FastifyInstance } from 'fastify';
import type { Db } from '../db/client.js';
import { requireUser, problem } from '../auth/plugin.js';
import { getMedia } from '../metadata/media-cache.js';

export async function assetRoutes(app:FastifyInstance,db:Db):Promise<void>{
  app.get('/api/bookmarks/:id/assets/:kind',async(request,reply)=>{const user=requireUser(request);const {id,kind}=request.params as any;if(!['icon','preview'].includes(kind))return reply.code(404).send(problem(404,'Not found','Unknown asset.'));const row=db.prepare(`SELECT site_icon_url,preview_image_url FROM bookmarks WHERE user_id=? AND public_id=?`).get(user.id,id) as any;const url=kind==='icon'?row?.site_icon_url:row?.preview_image_url;if(!url)return reply.code(404).send(problem(404,'Not found','No image is available.'));try{const media=await getMedia(db,url,kind);return reply.header('content-type',media.mediaType).header('x-content-type-options','nosniff').header('cache-control','private,max-age=86400').send(media.bytes);}catch{return reply.code(404).send(problem(404,'Image unavailable','The publisher image could not be loaded safely.'));}});
}
