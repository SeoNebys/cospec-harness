import type { FastifyInstance } from 'fastify';
import type { DB } from '../db/connection';
import { distinctTags } from '../db/queries';

// Tag routes. Powers the tag-filter UI and (in US3) tag suggestions. FR-012.
export function registerTagRoutes(app: FastifyInstance, db: DB): void {
  // GET /api/tags — distinct tag names with usage counts.
  app.get('/tags', async () => {
    return { tags: distinctTags(db) };
  });
}
