import { Router } from 'express';
import { normalizeUrl } from '../services/url-normalizer.js';
import { previewMetadata } from '../services/metadata-service.js';
import type { Config } from '../config.js';
import type { BookmarkRepository } from '../repositories/bookmark-repository.js';
import { HttpProblem } from './problems.js';
export function metadataRouter(repo:BookmarkRepository,config:Config){const r=Router();r.post('/preview',async(req,res,next)=>{try{const {normalizedUrl}=normalizeUrl(String(req.body?.url||''));const found=repo.findByNormalized(normalizedUrl);if(found)return res.status(303).location(`/bookmarks/${found.id}/edit`).json({existingBookmarkId:found.id});res.json(await previewMetadata(req.body.url,config))}catch(e){next(new HttpProblem(400,'INVALID_URL',e instanceof Error?e.message:'Invalid URL'))}});return r}
