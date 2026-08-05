import type { FastifyInstance } from 'fastify';
import type { DB } from '../db/connection';
import type { TagFilter } from '../../shared/types';
import {
  listSavedSearches,
  createSavedSearch,
  updateSavedSearch,
  deleteSavedSearch,
} from '../db/queries';

// Saved-search routes (FR-021). Stores the filter definition, not results — the
// client re-runs it against the live collection when applied.
export function registerSavedSearchRoutes(app: FastifyInstance, db: DB): void {
  app.get('/saved-searches', async () => {
    return { savedSearches: listSavedSearches(db) };
  });

  app.post<{ Body: { name?: unknown; queryText?: unknown; filter?: unknown } }>(
    '/saved-searches',
    async (req, reply) => {
      const body = req.body ?? {};
      if (typeof body.name !== 'string' || !body.name.trim()) {
        return reply
          .status(400)
          .send({ error: { code: 'invalid_name', message: 'A name is required.' } });
      }
      const savedSearch = createSavedSearch(db, {
        name: body.name.trim(),
        queryText: typeof body.queryText === 'string' ? body.queryText : '',
        filter: (body.filter ?? {}) as TagFilter,
      });
      return reply.status(201).send({ savedSearch });
    }
  );

  app.patch<{ Params: { id: string }; Body: Record<string, unknown> }>(
    '/saved-searches/:id',
    async (req, reply) => {
      const id = Number(req.params.id);
      const body = req.body ?? {};
      const patch: { name?: string; queryText?: string; filter?: TagFilter } = {};
      if (typeof body.name === 'string') patch.name = body.name;
      if (typeof body.queryText === 'string') patch.queryText = body.queryText;
      if (body.filter && typeof body.filter === 'object') patch.filter = body.filter as TagFilter;
      const savedSearch = updateSavedSearch(db, id, patch);
      if (!savedSearch) {
        return reply
          .status(404)
          .send({ error: { code: 'not_found', message: 'Saved search not found.' } });
      }
      return { savedSearch };
    }
  );

  app.delete<{ Params: { id: string } }>('/saved-searches/:id', async (req, reply) => {
    const id = Number(req.params.id);
    if (!deleteSavedSearch(db, id)) {
      return reply
        .status(404)
        .send({ error: { code: 'not_found', message: 'Saved search not found.' } });
    }
    return reply.status(204).send();
  });
}
