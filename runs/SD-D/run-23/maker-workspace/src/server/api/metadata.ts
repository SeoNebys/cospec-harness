import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { problem } from '../auth/plugin.js';
import { previewMetadata } from '../metadata/service.js';
import { verifyPreviewAsset } from '../metadata/service.js';
import { safeFetch } from '../metadata/safe-fetch.js';
import { config } from '../config.js';

export async function metadataRoutes(app: FastifyInstance): Promise<void> {
  app.post('/api/metadata-preview', async (request, reply) => {
    const parsed = z.object({ url: z.string().min(1).max(4096) }).safeParse(request.body);
    if (!parsed.success) return reply.code(422).send(problem(422, 'Validation failed', 'Enter a web address.'));
    try { return await previewMetadata(parsed.data.url); }
    catch (error) { return reply.code(400).send(problem(400, 'Invalid web address', error instanceof Error ? error.message : 'The address is invalid.')); }
  });
  app.get('/api/metadata-preview-asset',async(request,reply)=>{const {url,token}=request.query as {url?:string;token?:string};if(!url||!token||!verifyPreviewAsset(url,token))return reply.code(404).send();try{const fetched=await safeFetch(url,{maxBytes:config.metadata.maxPreviewBytes,accept:'image/png,image/jpeg,image/webp,image/gif',allowedTypes:/^image\/(png|jpeg|webp|gif)$/i});return reply.header('content-type',fetched.contentType).header('x-content-type-options','nosniff').header('cache-control','private,max-age=300').send(fetched.body);}catch{return reply.code(404).send();}});
}
