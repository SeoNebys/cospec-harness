import type { FastifyInstance } from 'fastify';
import type { DB } from '../db/db.ts';
import { listTags } from '../models/tag.ts';

export function registerTagRoutes(app: FastifyInstance, db: DB): void {
  app.get('/api/tags', async (req) => {
    const { prefix } = req.query as { prefix?: string };
    return { tags: listTags(db, prefix) };
  });
}
