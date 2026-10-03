import { Router, Request, Response } from 'express';
import { getPreferences, updatePreferences } from '../models/preferences';

export const preferencesRouter = Router();

preferencesRouter.get('/', (_req: Request, res: Response) => {
  return res.json(getPreferences());
});

preferencesRouter.put('/', (req: Request, res: Response) => {
  return res.json(updatePreferences(req.body ?? {}));
});
