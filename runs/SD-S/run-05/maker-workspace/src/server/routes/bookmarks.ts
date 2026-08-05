import type { FastifyInstance } from 'fastify';
import type { DB } from '../db.js';
import {
  createBookmark,
  deleteBookmark,
  getBookmark,
  listBookmarks,
  restoreBookmark,
  updateBookmark,
} from '../services/bookmarks.js';
import { notFound } from '../services/errors.js';

// /api/bookmarks endpoints. Covers create, list/search, and detail
// (contracts/api.md). Edit, delete/undo are added in later story phases.
export function registerBookmarkRoutes(app: FastifyInstance, db: DB): void {
  app.get('/api/bookmarks', async (req) => {
    const query = req.query as {
      q?: string;
      tag?: string;
      sort?: 'created_desc' | 'created_asc' | 'title_asc';
    };
    return {
      bookmarks: listBookmarks(db, {
        q: query.q,
        tag: query.tag,
        sort: query.sort,
      }),
    };
  });

  app.get('/api/bookmarks/:id', async (req) => {
    const { id } = req.params as { id: string };
    const bookmark = getBookmark(db, Number(id));
    if (!bookmark) throw notFound();
    return bookmark;
  });

  app.patch('/api/bookmarks/:id', async (req) => {
    const { id } = req.params as { id: string };
    const body = (req.body ?? {}) as {
      url?: string;
      title?: string;
      description?: string;
      tags?: string[];
    };
    return updateBookmark(db, Number(id), {
      url: body.url,
      title: body.title,
      description: body.description,
      tags: body.tags,
    });
  });

  app.delete('/api/bookmarks/:id', async (req) => {
    const { id } = req.params as { id: string };
    return deleteBookmark(db, Number(id));
  });

  app.post('/api/bookmarks/:id/undo', async (req) => {
    const { id } = req.params as { id: string };
    return restoreBookmark(db, Number(id));
  });

  app.post('/api/bookmarks', async (req, reply) => {
    const body = (req.body ?? {}) as {
      url?: string;
      title?: string;
      description?: string;
      tags?: string[];
    };
    const bookmark = await createBookmark(db, {
      url: body.url ?? '',
      title: body.title,
      description: body.description,
      tags: body.tags,
    });
    return reply.code(201).send(bookmark);
  });
}
