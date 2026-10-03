import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { HttpUrlSchema } from '../../shared/contracts/api.js';
import { previewMetadata } from '../metadata/metadata-service.js';
import { UrlPolicyError } from '../metadata/url-policy.js';

export const metadataRoutes: FastifyPluginAsync = async (app) => {
  app.post('/metadata/preview', async (request, reply) => {
    const {url}=z.object({url:HttpUrlSchema}).parse(request.body);
    try { return {data:await previewMetadata(url,app.appConfig)}; }
    catch(error){ if(error instanceof UrlPolicyError) return reply.status(422).send({error:{code:error.code,message:error.message}}); throw error; }
  });
};
