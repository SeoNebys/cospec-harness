import type { Express } from 'express';

import type { BookmarkService } from '../services/bookmark-service.js';

export function registerTagRoutes(app: Express, bookmarkService: BookmarkService): void {
  app.get('/api/tags', (_request, response) => {
    response.json(bookmarkService.listTags());
  });
}
