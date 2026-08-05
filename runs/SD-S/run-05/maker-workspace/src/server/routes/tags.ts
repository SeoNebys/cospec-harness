import type { FastifyInstance } from 'fastify';
import type { DB } from '../db.js';
import { listTags, renameTag, removeTag } from '../services/tags.js';

// /api/tags endpoints: list with counts, rename (with merge), remove.
// See contracts/api.md (FR-009, FR-010).
export function registerTagRoutes(app: FastifyInstance, db: DB): void {
  app.get('/api/tags', async () => {
    return { tags: listTags(db) };
  });

  app.patch('/api/tags/:id', async (req) => {
    const { id } = req.params as { id: string };
    const body = (req.body ?? {}) as { name?: string };
    renameTag(db, Number(id), body.name ?? '');
    return { tags: listTags(db) };
  });

  app.delete('/api/tags/:id', async (req) => {
    const { id } = req.params as { id: string };
    removeTag(db, Number(id));
    return { tags: listTags(db) };
  });
}
