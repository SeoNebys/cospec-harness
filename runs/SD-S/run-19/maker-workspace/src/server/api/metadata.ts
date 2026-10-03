import { Router } from 'express';
import { metadataRequestSchema } from '../../shared/schemas.js';
import type { MetadataFetcher } from '../services/metadata-fetcher.js';

export function createMetadataRouter(metadataFetcher: Pick<MetadataFetcher, 'preview'>): Router {
  const router = Router();
  router.post('/', async (request, response) => {
    const { url } = metadataRequestSchema.parse(request.body);
    response.json(await metadataFetcher.preview(url));
  });
  return router;
}
