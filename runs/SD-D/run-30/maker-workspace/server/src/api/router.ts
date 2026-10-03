import { Router } from 'express';
import type { Config } from '../config.js';
import type { BookmarkRepository } from '../repositories/bookmark-repository.js';
import type { BookmarkService } from '../services/bookmark-service.js';
import { bookmarkRouter } from './bookmark-routes.js';
import { metadataRouter } from './metadata-routes.js';
import { tagRouter } from './tag-routes.js';
export function apiRouter(repo:BookmarkRepository,service:BookmarkService,config:Config){const r=Router();r.get('/health',(_q,s)=>s.json({status:'ready'}));r.use('/metadata',metadataRouter(repo,config));r.use('/bookmarks',bookmarkRouter(repo,service));r.use('/tags',tagRouter(repo));return r}
