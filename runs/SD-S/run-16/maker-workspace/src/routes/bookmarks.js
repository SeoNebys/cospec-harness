import { Router } from 'express';
import { validateAndNormalize, InvalidUrlError } from '../services/url.js';
import { titleFromUrl } from '../services/metadata.js';
import * as Bookmark from '../models/bookmark.js';
import { enqueue } from '../services/enrichment.js';

const router = Router();

function invalidUrl(res) {
  return res.status(400).json({ error: 'invalid_url', message: 'Enter a valid web address.' });
}

// GET /api/bookmarks?q=&tag=  (FR-005, FR-007, FR-014)
router.get('/bookmarks', (req, res) => {
  const bookmarks = Bookmark.list({ q: req.query.q, tag: req.query.tag });
  res.json({ bookmarks });
});

// GET /api/tags  (FR-014)
router.get('/tags', (_req, res) => {
  res.json({ tags: Bookmark.listTags() });
});

// GET /api/bookmarks/:id  (poll enrichment)
router.get('/bookmarks/:id', (req, res) => {
  const bookmark = Bookmark.getById(Number(req.params.id));
  if (!bookmark) return res.status(404).json({ error: 'not_found', message: 'Bookmark not found.' });
  res.json(bookmark);
});

// POST /api/bookmarks  (FR-001–FR-004, FR-011, choice A)
router.post('/bookmarks', (req, res) => {
  let normalized;
  try {
    normalized = validateAndNormalize(req.body?.url);
  } catch (err) {
    if (err instanceof InvalidUrlError) return invalidUrl(res);
    throw err;
  }

  const existing = Bookmark.findByNormalizedUrl(normalized.normalizedUrl);
  if (existing) {
    // Duplicate -> route the user to editing the existing bookmark (FR-011).
    return res.status(409).json({ error: 'duplicate', existing });
  }

  const bookmark = Bookmark.create({
    url: normalized.url,
    normalizedUrl: normalized.normalizedUrl,
    title: titleFromUrl(normalized.url),
    notes: req.body?.notes ?? null,
    tags: req.body?.tags ?? [],
  });

  // Fire-and-forget enrichment — response never waits (SC-007).
  enqueue(bookmark.id, normalized.url);

  res.status(201).json(bookmark);
});

// PUT /api/bookmarks/:id  (FR-009, FR-011)
router.put('/bookmarks/:id', (req, res) => {
  const id = Number(req.params.id);
  const current = Bookmark.getById(id);
  if (!current) return res.status(404).json({ error: 'not_found', message: 'Bookmark not found.' });

  const body = req.body ?? {};
  let urlFields = {};

  if (body.url !== undefined) {
    let normalized;
    try {
      normalized = validateAndNormalize(body.url);
    } catch (err) {
      if (err instanceof InvalidUrlError) return invalidUrl(res);
      throw err;
    }
    // Reject collision with a *different* bookmark (FR-011).
    const clash = Bookmark.findByNormalizedUrl(normalized.normalizedUrl);
    if (clash && clash.id !== id) {
      return res.status(409).json({ error: 'duplicate', existing: clash });
    }
    urlFields = { url: normalized.url, normalizedUrl: normalized.normalizedUrl };
  }

  const result = Bookmark.update(id, {
    ...urlFields,
    title: body.title,
    description: body.description,
    notes: body.notes,
    tags: body.tags,
  });

  if (result.changedUrl) {
    enqueue(id, urlFields.url);
  }

  res.json(result.bookmark);
});

// DELETE /api/bookmarks/:id  (FR-010)
router.delete('/bookmarks/:id', (req, res) => {
  const ok = Bookmark.remove(Number(req.params.id));
  if (!ok) return res.status(404).json({ error: 'not_found', message: 'Bookmark not found.' });
  res.status(204).end();
});

export default router;
