import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { DB } from '../db/db.ts';
import { notFound } from '../lib/errors.ts';
import * as Views from '../models/savedView.ts';

const viewSchema = z.object({
  name: z.string(),
  query: z.string().optional(),
  includeTags: z.array(z.string()).optional(),
  excludeTags: z.array(z.string()).optional(),
});

export function registerViewRoutes(app: FastifyInstance, db: DB): void {
  app.get('/api/views', async () => ({ views: Views.listViews(db) }));

  app.post('/api/views', async (req, reply) => {
    const body = viewSchema.parse(req.body);
    reply.code(201);
    return Views.createView(db, body);
  });

  app.patch('/api/views/:id', async (req) => {
    const { id } = req.params as { id: string };
    const body = viewSchema.partial().parse(req.body);
    const updated = Views.updateView(db, Number(id), body as Views.ViewInput);
    if (!updated) throw notFound('Saved view not found.');
    return updated;
  });

  app.delete('/api/views/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const ok = Views.deleteView(db, Number(id));
    if (!ok) throw notFound('Saved view not found.');
    reply.code(204);
    return null;
  });
}
