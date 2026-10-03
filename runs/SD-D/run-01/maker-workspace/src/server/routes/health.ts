import type { FastifyInstance } from 'fastify';
import type { Database } from '../db/database.js';

export async function healthRoutes(app: FastifyInstance, db: Database) {
  app.get('/api/v1/health', (_request, reply) => {
    try { db.prepare('SELECT 1').get(); return reply.send({ status: 'ready' }); }
    catch { return reply.code(503).send({ error: { code: 'NOT_READY', message: 'Database is not ready.' } }); }
  });
}
