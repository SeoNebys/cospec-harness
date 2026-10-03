import type { FastifyInstance } from 'fastify';
import { AppError } from '../../shared/api/errors.js';

export function registerOriginProtection(app: FastifyInstance): void {
  app.addHook('preHandler', async (request) => {
    if (!['POST', 'PATCH', 'PUT', 'DELETE'].includes(request.method)) return;
    const origin = request.headers.origin;
    if (!origin) return;
    const host = request.headers.host;
    const expected = host ? `${request.protocol}://${host}` : undefined;
    if (!expected || origin !== expected) throw new AppError(403, 'ORIGIN_REJECTED', 'Cross-origin changes are not allowed.');
  });
}
