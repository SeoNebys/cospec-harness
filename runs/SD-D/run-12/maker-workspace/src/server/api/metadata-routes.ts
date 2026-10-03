import { Router } from 'express';
import { metadataRequestSchema } from '../../shared/schemas/api.js';
import type { MetadataService } from '../metadata/metadata-service.js';

export function metadataRouter(service:MetadataService) {
  const router = Router(); let active = 0;
  router.post('/', async (req,res,next) => { try { if (active >= 4) return res.status(429).json({type:'/problems/rate_limited',title:'rate limited',status:429,code:'rate_limited',detail:'Try again in a moment.'}); active++; const {requestId,url}=metadataRequestSchema.parse(req.body); res.json(await service.retrieve(requestId,url)); } catch(error){ next(error); } finally { active=Math.max(0,active-1); } });
  return router;
}
