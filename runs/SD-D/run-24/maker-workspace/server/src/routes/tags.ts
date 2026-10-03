import { Router, Request, Response } from 'express';
import { suggestTags, listAllTags, deleteTag } from '../models/tags';

export const tagsRouter = Router();

tagsRouter.get('/', (req: Request, res: Response) => {
  if (typeof req.query.query === 'string' && req.query.query.length) {
    return res.json({ tags: suggestTags(req.query.query) });
  }
  return res.json({ tags: listAllTags() });
});

tagsRouter.delete('/:id(\\d+)', (req: Request, res: Response) => {
  deleteTag(Number(req.params.id));
  return res.status(204).end();
});
