import type { Express } from 'express';

import { pageMetadataRequestSchema } from '../../shared/schemas.js';

export interface MetadataPreviewService {
  preview(url: string, options?: { signal?: AbortSignal }): Promise<unknown>;
}

export interface MetadataRouteDependencies {
  metadataService: MetadataPreviewService;
}

export function registerMetadataRoutes(
  app: Express,
  { metadataService }: MetadataRouteDependencies,
): void {
  app.post('/api/page-metadata', async (request, response) => {
    const input = pageMetadataRequestSchema.parse(request.body);
    response.json(await metadataService.preview(input.url));
  });
}
