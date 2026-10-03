import { Router } from 'express';
export const healthRouter = Router().get('/ready', (_req, res) => res.json({ status: 'ready' }));
