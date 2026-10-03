import { Router } from 'express';
import { titlePreviewInputSchema } from '../../shared/contracts/bookmarks.js';
import { rateLimit } from '../middleware/rate-limit.js';
import { fetchTitle } from './title-fetcher.js';

export function titlePreviewRoutes() {
  const router = Router();
  router.post('/', rateLimit(30, 60_000), async (request, response, next) => {
    try {
      const { url } = titlePreviewInputSchema.parse(request.body);
      response.json(await fetchTitle(url));
    } catch (error) {
      next(error);
    }
  });
  return router;
}
