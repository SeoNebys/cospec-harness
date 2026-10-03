import { Router } from 'express';
import { bookmarkInputSchema,bookmarkPatchSchema } from '@bookmarks/shared';
import type { BookmarkSort,BookmarkView } from '@bookmarks/shared';
import type { BookmarkRepository } from '../repositories/bookmark-repository.js';
import type { BookmarkService } from '../services/bookmark-service.js';
import { HttpProblem } from './problems.js';
import { validate } from './validate.js';
export function bookmarkRouter(repo:BookmarkRepository,service:BookmarkService){const r=Router();
 r.get('/',(req,res,next)=>{try{const view=(req.query.view||'active') as BookmarkView,sort=(req.query.sort||'newest') as BookmarkSort;if(!['active','favorites','read-later','archived'].includes(view)||!['newest','oldest','title'].includes(sort))throw new HttpProblem(400,'INVALID_FILTER','Unknown view or sort');const items=repo.list({view,sort,q:req.query.q as string|undefined,tag:req.query.tag as string|undefined});res.json({items,total:items.length})}catch(e){next(e)}});
 r.post('/',validate(bookmarkInputSchema),async(req,res,next)=>{try{const item=await service.create(req.body);res.status(201).json(item)}catch(e){if(e instanceof Error&&e.message.includes('UNIQUE constraint')){const {normalizeUrl}=await import('../services/url-normalizer.js');const existing=repo.findByNormalized(normalizeUrl(req.body.url).normalizedUrl);return next(new HttpProblem(409,'DUPLICATE_BOOKMARK','This bookmark already exists',{existingBookmarkId:existing?.id}))}next(e)}});
 r.get('/:id',(req,res,next)=>{const item=repo.get(String(req.params.id));if(!item)return next(new HttpProblem(404,'NOT_FOUND','Bookmark not found'));res.json(item)});
 r.patch('/:id',validate(bookmarkPatchSchema),(req,res,next)=>{try{const item=service.update(String(req.params.id),req.body);if(!item)return next(new HttpProblem(404,'NOT_FOUND','Bookmark not found'));res.json(item)}catch(e){next(e)}});
 r.delete('/:id',(req,res,next)=>{if(!repo.delete(String(req.params.id)))return next(new HttpProblem(404,'NOT_FOUND','Bookmark not found'));res.status(204).end()});
 r.get('/:id/media/:kind',(req,res,next)=>{const kind=String(req.params.kind);if(!['icon','preview'].includes(kind))return next(new HttpProblem(404,'NOT_FOUND','Media not found'));const media=repo.media(String(req.params.id),kind);if(!media)return next(new HttpProblem(404,'NOT_FOUND','Media not found'));res.set('Cache-Control','public,max-age=86400').type(media.content_type).send(media.bytes)});
 return r}
