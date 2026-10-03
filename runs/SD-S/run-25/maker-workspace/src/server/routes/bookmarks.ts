import type { Express, Request } from 'express';

import type { BookmarkService } from '../services/bookmark-service.js';
import { readingStateUpdateSchema } from '../../shared/schemas.js';

export interface BookmarkRouteDependencies {
  bookmarkService: BookmarkService;
}

function listQuery(request: Request): Record<string, unknown> {
  const tag = request.query.tag;
  return {
    ...(request.query.view === undefined ? {} : { view: request.query.view }),
    ...(request.query.query === undefined ? {} : { query: request.query.query }),
    ...(tag === undefined ? {} : { tag }),
    ...(request.query.sort === undefined ? {} : { sort: request.query.sort }),
  };
}

export function registerBookmarkRoutes(
  app: Express,
  { bookmarkService }: BookmarkRouteDependencies,
): void {
  app.get('/api/bookmarks', (request, response) => {
    response.json(bookmarkService.listBookmarks(listQuery(request)));
  });

  app.post('/api/bookmarks', (request, response) => {
    response.status(201).json(bookmarkService.createBookmark(request.body));
  });

  app.get('/api/bookmarks/:bookmarkId', (request, response) => {
    response.json(bookmarkService.getBookmark(request.params.bookmarkId ?? ''));
  });

  app.put('/api/bookmarks/:bookmarkId', (request, response) => {
    response.json(
      bookmarkService.replaceBookmark(request.params.bookmarkId ?? '', request.body),
    );
  });

  app.delete('/api/bookmarks/:bookmarkId', (request, response) => {
    bookmarkService.deleteBookmark(request.params.bookmarkId ?? '');
    response.status(204).send();
  });

  app.patch('/api/bookmarks/:bookmarkId/reading-state', (request, response) => {
    const input = readingStateUpdateSchema.parse(request.body);
    response.json(
      bookmarkService.updateReadingState(request.params.bookmarkId ?? '', input.readingState),
    );
  });
}
