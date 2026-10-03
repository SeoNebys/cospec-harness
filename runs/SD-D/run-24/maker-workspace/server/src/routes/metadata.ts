import { Router, Request, Response } from 'express';
import { fetchMetadata } from '../services/metadata';
import { isValidWebUrl } from '../services/normalizeUrl';

export const metadataRouter = Router();

// Fetch page metadata for the save dialog (does not create a bookmark).
metadataRouter.get('/', async (req: Request, res: Response) => {
  const url = typeof req.query.url === 'string' ? req.query.url : '';
  if (!isValidWebUrl(url)) {
    return res.status(400).json({ error: { code: 'invalid_url', message: 'Invalid web address.' } });
  }
  const meta = await fetchMetadata(url);
  return res.json({
    title: meta.title,
    description: meta.description,
    previewImageUrl: meta.previewRemoteUrl,
    iconUrl: meta.iconRemoteUrl,
    isPdf: meta.isPdf,
  });
});
