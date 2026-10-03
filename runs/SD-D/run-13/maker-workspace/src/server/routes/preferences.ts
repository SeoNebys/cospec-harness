import type { FastifyPluginAsync } from 'fastify';
import { ValidationError } from '../../shared/api/errors.js';
import { PreferenceRepository } from '../db/repositories/preference-repository.js';

export const preferenceRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/preferences', async () => new PreferenceRepository(app.db).get());
  app.patch('/api/preferences', async (request) => {
    const body = (request.body || {}) as any; const fields: any = {};
    if (!Object.keys(body).length || Object.keys(body).some((key) => !['sortField','sortDirection'].includes(key))) throw new ValidationError('Include a valid preference to update.');
    if (body.sortField !== undefined && !['title','createdAt','updatedAt'].includes(body.sortField)) throw new ValidationError('Choose a valid sort field.');
    if (body.sortDirection !== undefined && !['asc','desc'].includes(body.sortDirection)) throw new ValidationError('Choose a valid sort direction.');
    if (body.sortField !== undefined) fields.sortField = body.sortField; if (body.sortDirection !== undefined) fields.sortDirection = body.sortDirection;
    return new PreferenceRepository(app.db).update(fields);
  });
};
