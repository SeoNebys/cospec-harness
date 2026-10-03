import { Router } from 'express';
import { z } from 'zod';
import type { MetadataService } from './metadata-service.js';
export function metadataRouter(service: MetadataService) {
  return Router().post('/preview', async (req, res) =>
    res.json(await service.preview(z.object({ url: z.string() }).parse(req.body).url))
  );
}
