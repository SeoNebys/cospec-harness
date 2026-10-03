import type { FastifyInstance } from 'fastify';
import { bulkActionSchema } from '../../shared/schemas/api.js';
import type { BulkActionService } from '../services/bulkActionService.js';

export function bulkActionRoutes(app: FastifyInstance, service: BulkActionService): void {
  app.post('/api/bookmarks/bulk-actions', (request) => service.apply(bulkActionSchema.parse(request.body)));
}
