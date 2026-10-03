import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { DB } from '../db/db.ts';
import { getPreferences, updatePreferences } from '../models/preferences.ts';

const prefsSchema = z.object({
  defaultSort: z.string().optional(),
  itemsShown: z.number().optional(),
  textSize: z.string().optional(),
});

export function registerPreferenceRoutes(app: FastifyInstance, db: DB): void {
  app.get('/api/preferences', async () => getPreferences(db));
  app.patch('/api/preferences', async (req) => {
    const body = prefsSchema.parse(req.body);
    return updatePreferences(db, body);
  });
}
