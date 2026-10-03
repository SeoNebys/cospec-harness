import { Router } from 'express';
import { z } from 'zod';

import type { BookmarkDatabase } from '../db/database.js';
import { AppError } from '../errors.js';
import { BookmarkRepository } from '../repositories/bookmark-repository.js';

const tagQuerySchema = z.object({
  archived: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
});

export function createTagsRouter(db: BookmarkDatabase): Router {
  const router = Router();
  const repository = new BookmarkRepository(db);
  router.get('/', (request, response) => {
    const result = tagQuerySchema.safeParse(request.query);
    if (!result.success) {
      throw new AppError(400, 'INVALID_QUERY', 'Check the tag filter values.');
    }
    response.json({ items: repository.listTags(result.data.archived) });
  });
  return router;
}
