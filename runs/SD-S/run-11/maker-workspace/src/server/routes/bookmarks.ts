import { Router } from 'express';
import { bookmarkCreateSchema, bookmarkUpdateSchema, libraryQuerySchema } from '../../shared/schemas/bookmark.ts';
import type { BookmarkService } from '../services/bookmark-service.ts';

export function bookmarkRoutes(service:BookmarkService){const r=Router();
  r.get('/',(req,res)=>{const q=libraryQuerySchema.parse(req.query);const tags=q.tag?(Array.isArray(q.tag)?q.tag:[q.tag]).map(String):[];res.json(service.list({view:q.view,q:q.q,tags,favorite:q.favorite==='true',sort:q.sort}));});
  r.post('/',(req,res)=>res.status(201).json(service.create(bookmarkCreateSchema.parse(req.body))));
  r.get('/:id',(req,res)=>res.json(service.get(req.params.id!)));
  r.patch('/:id',(req,res)=>res.json(service.update(req.params.id!,bookmarkUpdateSchema.parse(req.body))));
  r.post('/:id/archive',(req,res)=>res.json(service.archive(req.params.id!)));
  r.post('/:id/restore',(req,res)=>res.json(service.restore(req.params.id!)));
  r.delete('/:id',(req,res)=>{service.delete(req.params.id!);res.status(204).end();});return r;}
