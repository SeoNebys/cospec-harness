import { Router } from 'express';
import { bookmarkIdSchema, bookmarkPatchSchema, bookmarkWriteSchema, listQuerySchema } from '../../shared/schemas/api.js';
import type { BookmarkRepository } from '../repositories/bookmark-repository.js';
import { SearchParseError } from '../search/parser.js';
import { AppError } from './errors.js';

export function bookmarkRouter(repository:BookmarkRepository) {
  const router=Router();
  router.get('/',(req,res,next)=>{try{const query=listQuerySchema.parse(req.query);const tags=query.tag===undefined?[]:Array.isArray(query.tag)?query.tag:[query.tag];res.json(repository.list({limit:query.limit,query:query.q,tags,favorite:query.favorite===undefined?undefined:query.favorite==='true',unread:query.unread===undefined?undefined:query.unread==='true',cursor:query.cursor}));}catch(error){if(error instanceof SearchParseError)return next(new AppError(422,'invalid_search',error.message,{query:String(req.query.q??''),error:{start:error.start,end:error.end,message:error.message}}));next(error);}});
  router.post('/',(req,res,next)=>{try{res.status(201).json(repository.create(bookmarkWriteSchema.parse(req.body)));}catch(error){next(error);}});
  router.get('/:id',(req,res,next)=>{try{res.json(repository.get(bookmarkIdSchema.parse(req.params.id)));}catch(error){next(error);}});
  router.patch('/:id',(req,res,next)=>{try{res.json(repository.update(bookmarkIdSchema.parse(req.params.id),bookmarkPatchSchema.parse(req.body)));}catch(error){next(error);}});
  router.delete('/:id',(req,res,next)=>{try{repository.delete(bookmarkIdSchema.parse(req.params.id));res.status(204).end();}catch(error){next(error);}});
  return router;
}
export function iconRouter(repository:BookmarkRepository) {
  const router=Router();
  router.get('/:id',(req,res,next)=>{try{const icon=repository.icon(Number(req.params.id));if(!icon)return res.status(404).json({type:'/problems/not_found',title:'not found',status:404,code:'not_found',detail:'Icon not found.'});res.set('Cache-Control','public,max-age=31536000,immutable').set('X-Content-Type-Options','nosniff').type(icon.contentType).send(icon.bytes);}catch(error){next(error);}});
  return router;
}
