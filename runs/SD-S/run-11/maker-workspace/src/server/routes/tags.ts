import { Router } from 'express';import type { BookmarkService } from '../services/bookmark-service.ts';
export function tagRoutes(service:BookmarkService){const r=Router();r.get('/',(req,res)=>res.json({items:service.tags(req.query.view==='archived'?'archived':'active')}));return r;}
