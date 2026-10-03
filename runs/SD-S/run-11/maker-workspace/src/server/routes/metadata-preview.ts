import { Router } from 'express';import { metadataRequestSchema } from '../../shared/schemas/bookmark.ts';import { previewMetadata } from '../metadata/metadata-service.ts';
export function metadataRoutes(){const r=Router();r.post('/',async(req,res)=>{const {url}=metadataRequestSchema.parse(req.body);res.json(await previewMetadata(url));});return r;}
