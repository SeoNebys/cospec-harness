// REST route handlers for /api (contracts/api.md).
import express from 'express';
import { normalizeUrl, InvalidUrlError } from '../lib/url.js';

/**
 * @param {import('../repository.js').BookmarkRepository} repo
 * @returns {import('express').Router}
 */
export function createBookmarksRouter(repo) {
  const router = express.Router();

  // GET /api/bookmarks?q=&tag=
  router.get('/bookmarks', (req, res) => {
    const { q = '', tag = '' } = req.query;
    const bookmarks = repo.listBookmarks({ q: String(q), tag: String(tag) });
    res.json({ bookmarks });
  });

  // GET /api/bookmarks/:id
  router.get('/bookmarks/:id', (req, res) => {
    const bookmark = repo.getBookmark(Number(req.params.id));
    if (!bookmark) return res.status(404).json({ error: 'Bookmark not found.' });
    res.json({ bookmark });
  });

  // POST /api/bookmarks
  router.post('/bookmarks', (req, res) => {
    const { url, title, notes, tags } = req.body ?? {};
    let normalized;
    try {
      normalized = normalizeUrl(url);
    } catch (err) {
      if (err instanceof InvalidUrlError) return res.status(400).json({ error: err.message });
      throw err;
    }
    const { bookmark, duplicate } = repo.createBookmark({
      url: normalized,
      title,
      notes,
      tags: Array.isArray(tags) ? tags : [],
    });
    res.status(201).json({ bookmark, duplicate });
  });

  // PUT /api/bookmarks/:id
  router.put('/bookmarks/:id', (req, res) => {
    const id = Number(req.params.id);
    if (!repo.getBookmark(id)) return res.status(404).json({ error: 'Bookmark not found.' });

    const body = req.body ?? {};
    const fields = {};
    if (Object.prototype.hasOwnProperty.call(body, 'url')) {
      try {
        fields.url = normalizeUrl(body.url);
      } catch (err) {
        if (err instanceof InvalidUrlError) return res.status(400).json({ error: err.message });
        throw err;
      }
    }
    for (const key of ['title', 'notes', 'tags']) {
      if (Object.prototype.hasOwnProperty.call(body, key)) fields[key] = body[key];
    }
    const bookmark = repo.updateBookmark(id, fields);
    res.json({ bookmark });
  });

  // DELETE /api/bookmarks/:id
  router.delete('/bookmarks/:id', (req, res) => {
    const deleted = repo.deleteBookmark(Number(req.params.id));
    if (!deleted) return res.status(404).json({ error: 'Bookmark not found.' });
    res.status(204).end();
  });

  // GET /api/tags
  router.get('/tags', (_req, res) => {
    res.json({ tags: repo.listTags() });
  });

  return router;
}
