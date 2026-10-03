import type { FastifyInstance } from 'fastify';
import { HealthSchema } from '../../shared/api/schemas.js';

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/health', { schema: { response: { 200: HealthSchema } } }, async () => ({ status: 'ok' as const }));
}
