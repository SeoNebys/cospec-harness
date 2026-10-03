import type { FastifyInstance } from 'fastify';
import { metadataRequestSchema } from '../../shared/schemas.js';
import { fetchMetadata } from '../services/metadataFetcher.js';
import { InvalidUrlError, UnsafeUrlError } from '../services/urlPolicy.js';

export async function pageMetadataRoutes(app: FastifyInstance): Promise<void> {
  app.post('/api/page-metadata', async (request, reply) => {
    const parsed=metadataRequestSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({error:{code:'VALIDATION_ERROR',message:'Enter a valid web address.',field:'url'}});
    try { return await fetchMetadata(parsed.data.url); }
    catch (error) {
      if (error instanceof InvalidUrlError) return reply.code(400).send({error:{code:'INVALID_URL',message:error.message,field:'url'}});
      if (error instanceof UnsafeUrlError) return reply.code(403).send({error:{code:'UNSAFE_DESTINATION',message:error.message,field:'url'}});
      throw error;
    }
  });
}
