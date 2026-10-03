import { Router } from 'express';
import { Repository, DuplicateError } from '../repository.js';
import { isValidHttpUrl } from '../validation.js';
import { fetchMetadata } from '../enrichment.js';

/**
 * Build the REST router. `enrich` is injectable for testing; defaults to the
 * real best-effort metadata fetch. Enrichment runs asynchronously so saving is
 * never blocked (FR-007, FR-008).
 */
export function createBookmarksRouter(db, { enrich = fetchMetadata, pending } = {}) {
  const repo = new Repository(db);
  const router = Router();

  function runEnrichment(id, url) {
    const p = Promise.resolve()
      .then(() => enrich(url))
      .then((meta) => {
        if (meta && meta.ok) {
          repo.updateEnrichment(id, meta, 'done');
        } else {
          repo.updateEnrichment(id, {}, 'failed');
        }
      })
      .catch(() => {
        try { repo.updateEnrichment(id, {}, 'failed'); } catch { /* ignore */ }
      });
    // Track in-flight enrichment so tests (and graceful shutdown) can drain it.
    if (pending) {
      pending.add(p);
      p.finally(() => pending.delete(p));
    }
  }

  // GET /api/bookmarks?q=&tag=
  router.get('/bookmarks', (req, res) => {
    const { q, tag } = req.query;
    const bookmarks = repo.listBookmarks({ q, tag });
    res.json({ bookmarks });
  });

  // POST /api/bookmarks
  router.post('/bookmarks', (req, res) => {
    const { url, title, note, tags } = req.body || {};
    if (!isValidHttpUrl(url)) {
      return res.status(400).json({
        error: { code: 'invalid_url', message: 'Please enter a valid http or https address.' },
      });
    }
    try {
      const bookmark = repo.createBookmark({ url, title, note, tags });
      runEnrichment(bookmark.id, bookmark.url);
      return res.status(201).json(bookmark);
    } catch (err) {
      if (err instanceof DuplicateError) {
        return res.status(409).json({
          error: { code: 'duplicate', message: err.message },
          existing: err.existing,
        });
      }
      throw err;
    }
  });

  // GET /api/bookmarks/:id
  router.get('/bookmarks/:id', (req, res) => {
    const bookmark = repo.getBookmark(Number(req.params.id));
    if (!bookmark) return notFound(res);
    res.json(bookmark);
  });

  // PATCH /api/bookmarks/:id
  router.patch('/bookmarks/:id', (req, res) => {
    const id = Number(req.params.id);
    const { url, title, description, note, tags } = req.body || {};
    if (url !== undefined && !isValidHttpUrl(url)) {
      return res.status(400).json({
        error: { code: 'invalid_url', message: 'Please enter a valid http or https address.' },
      });
    }
    try {
      const fields = {};
      if (url !== undefined) fields.url = url;
      if (title !== undefined) fields.title = title;
      if (description !== undefined) fields.description = description;
      if (note !== undefined) fields.note = note;
      if (tags !== undefined) fields.tags = tags;
      const updated = repo.updateBookmark(id, fields);
      if (!updated) return notFound(res);
      res.json(updated);
    } catch (err) {
      if (err instanceof DuplicateError) {
        return res.status(409).json({
          error: { code: 'duplicate', message: err.message },
          existing: err.existing,
        });
      }
      throw err;
    }
  });

  // POST /api/bookmarks/:id/refresh
  router.post('/bookmarks/:id/refresh', (req, res) => {
    const id = Number(req.params.id);
    const bookmark = repo.getBookmark(id);
    if (!bookmark) return notFound(res);
    repo.updateEnrichment(id, {}, 'pending');
    runEnrichment(id, bookmark.url);
    res.status(202).json({ enrichmentStatus: 'pending' });
  });

  // DELETE /api/bookmarks/:id
  router.delete('/bookmarks/:id', (req, res) => {
    const ok = repo.deleteBookmark(Number(req.params.id));
    if (!ok) return notFound(res);
    res.status(204).end();
  });

  // GET /api/tags?prefix=
  router.get('/tags', (req, res) => {
    res.json({ tags: repo.listTagNames(req.query.prefix) });
  });

  return router;
}

function notFound(res) {
  return res.status(404).json({
    error: { code: 'not_found', message: 'Bookmark not found.' },
  });
}
