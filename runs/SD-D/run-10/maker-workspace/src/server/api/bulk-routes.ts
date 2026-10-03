import type { FastifyInstance } from 'fastify';
import { bulkExecuteSchema, bulkPreviewSchema } from '../../shared/contracts/bulk.js';
import { requireUser } from '../auth/auth-plugin.js';
import type { BulkService } from '../domain/bulk-service.js';
export async function registerBulkRoutes(app: FastifyInstance, service: BulkService): Promise<void> {
  app.post('/api/bookmarks/bulk/preview', async (request) => {
    const body = bulkPreviewSchema.parse(request.body);
    return service.preview(requireUser(request).id, body.selection, body.action);
  });
  app.post('/api/bookmarks/bulk/execute', async (request) => {
    const body = bulkExecuteSchema.parse(request.body);
    return service.execute(requireUser(request).id, body.selection, body.action, body.confirmationToken);
  });
}
