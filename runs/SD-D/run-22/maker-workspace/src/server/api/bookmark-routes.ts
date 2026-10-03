import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { BookmarkInputSchema,BookmarkPatchSchema,ReadingStateInputSchema } from '../../shared/contracts/api.js';
import { parseSearchQuery, SearchParseError } from '../../shared/search/index.js';
import { describeSearch } from '../../shared/search/presentation.js';
import { BookmarkRepository,DuplicateBookmarkError } from '../repositories/bookmark-repository.js';
import { BookmarkService } from '../services/bookmark-service.js';

// Length belongs to the search parser so over-limit input receives the same
// stable HTTP 400 parse envelope as every other grammar error.
const Query=z.object({q:z.string().default(''),tag:z.union([z.string(),z.array(z.string())]).optional(),scope:z.enum(['all','unread-read-later']).default('all'),sort:z.enum(['createdAt','title']).default('createdAt'),order:z.enum(['asc','desc']).default('desc')});
const Id=z.object({id:z.uuid()});
export const bookmarkRoutes:FastifyPluginAsync=async(app)=>{
  const repository=new BookmarkRepository(app.database,app.runtime); const service=new BookmarkService(repository,app.appConfig);
  app.get('/bookmarks',async(request,reply)=>{const query=Query.parse(request.query);try{const ast=parseSearchQuery(query.q);const tags=query.tag?(Array.isArray(query.tag)?query.tag:[query.tag]):[];return{data:{items:repository.list({ast,selectedTags:tags,scope:query.scope,sort:query.sort,order:query.order}),query:{raw:query.q,ast,labels:describeSearch(ast)}}};}catch(error){if(error instanceof SearchParseError)return reply.status(400).send({error:error.toJSON()});throw error;}});
  app.post('/bookmarks',async(request,reply)=>{try{return reply.status(201).send({data:service.create(BookmarkInputSchema.parse(request.body))});}catch(error){if(error instanceof DuplicateBookmarkError)return reply.status(409).send({error:{code:'DUPLICATE_BOOKMARK',message:error.message,existingId:error.existingId}});throw error;}});
  app.patch('/bookmarks/:id',async(request,reply)=>{const{id}=Id.parse(request.params);try{const item=service.update(id,BookmarkPatchSchema.parse(request.body));return item?{data:item}:reply.status(404).send({error:{code:'NOT_FOUND',message:'Bookmark not found.'}});}catch(error){if(error instanceof DuplicateBookmarkError)return reply.status(409).send({error:{code:'DUPLICATE_BOOKMARK',message:error.message,existingId:error.existingId}});throw error;}});
  app.patch('/bookmarks/:id/reading-status',async(request,reply)=>{const{id}=Id.parse(request.params);const item=service.reading(id,ReadingStateInputSchema.parse(request.body));return item?{data:item}:reply.status(404).send({error:{code:'NOT_FOUND',message:'Bookmark not found.'}});});
  app.delete('/bookmarks/:id',async(request,reply)=>{const{id}=Id.parse(request.params);return service.delete(id)?reply.status(204).send():reply.status(404).send({error:{code:'NOT_FOUND',message:'Bookmark not found.'}});});
};
