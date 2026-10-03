import { Router } from 'express';
import type { BookmarkRepository } from '../repositories/bookmark-repository.js';
export function tagRouter(repo:BookmarkRepository){const r=Router();r.get('/',(_req,res)=>res.json(repo.allTags()));return r}
