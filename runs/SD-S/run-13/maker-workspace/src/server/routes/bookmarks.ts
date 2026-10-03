import type { FastifyInstance } from 'fastify';
import { bookmarkInputSchema, bookmarkListQuerySchema, createBookmarkSchema } from '../../shared/schemas.js';
import { BookmarkNotFoundError, BookmarkRepository, DuplicateBookmarkError } from '../db/bookmarkRepository.js';
import { InvalidUrlError } from '../services/urlPolicy.js';

const validation = (reply:any, message='Check the highlighted fields.') => reply.code(400).send({error:{code:'VALIDATION_ERROR',message}});
export async function bookmarkRoutes(app: FastifyInstance, repository: BookmarkRepository): Promise<void> {
  app.get('/api/bookmarks', async (request, reply) => { const p=bookmarkListQuerySchema.safeParse(request.query); return p.success ? repository.list(p.data) : validation(reply); });
  app.post('/api/bookmarks', async (request, reply) => {
    const p=createBookmarkSchema.safeParse(request.body); if(!p.success) return validation(reply);
    try { return reply.code(201).send(repository.create(p.data)); }
    catch(error){ if(error instanceof DuplicateBookmarkError) return reply.code(409).send({error:{code:'DUPLICATE_BOOKMARK',message:error.message,existingBookmarkId:error.existingBookmarkId}}); if(error instanceof InvalidUrlError) return validation(reply,error.message); throw error; }
  });
  app.put<{Params:{bookmarkId:string}}>('/api/bookmarks/:bookmarkId', async (request, reply) => {
    const p=bookmarkInputSchema.safeParse(request.body); if(!p.success) return validation(reply);
    try { return repository.update(request.params.bookmarkId,p.data); }
    catch(error){ if(error instanceof BookmarkNotFoundError) return reply.code(404).send({error:{code:'NOT_FOUND',message:error.message}}); if(error instanceof DuplicateBookmarkError) return reply.code(409).send({error:{code:'DUPLICATE_BOOKMARK',message:error.message,existingBookmarkId:error.existingBookmarkId}}); if(error instanceof InvalidUrlError) return validation(reply,error.message); throw error; }
  });
  app.delete<{Params:{bookmarkId:string}}>('/api/bookmarks/:bookmarkId', async (request, reply) => {
    try { repository.delete(request.params.bookmarkId); return reply.code(204).send(); }
    catch(error){ if(error instanceof BookmarkNotFoundError) return reply.code(404).send({error:{code:'NOT_FOUND',message:error.message}}); throw error; }
  });
}
