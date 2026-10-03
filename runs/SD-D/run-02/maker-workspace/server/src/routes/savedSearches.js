import express from 'express';
import {
  listSavedSearches,
  getSavedSearch,
  createSavedSearch,
  updateSavedSearch,
  deleteSavedSearch,
} from '../models/savedSearch.js';
import { getPreferences } from '../models/preferences.js';
import { resolveView } from '../lib/viewQuery.js';
import { serialize } from '../models/bookmark.js';
import { SearchError } from '../search/parser.js';

const asyncH = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

export function savedSearchesRouter(db) {
  const router = express.Router();

  router.get('/', (req, res) => res.json({ items: listSavedSearches(db) }));

  router.post(
    '/',
    asyncH((req, res) => {
      try {
        const saved = createSavedSearch(db, req.body || {});
        res.status(201).json({ savedSearch: saved });
      } catch (err) {
        if (err.code === 'validation') {
          return res.status(400).json({ error: { code: err.code, message: err.message } });
        }
        throw err;
      }
    })
  );

  router.patch(
    '/:id',
    asyncH((req, res) => {
      try {
        const saved = updateSavedSearch(db, Number(req.params.id), req.body || {});
        if (!saved) return res.status(404).json({ error: { code: 'not_found', message: 'Saved search not found.' } });
        res.json({ savedSearch: saved });
      } catch (err) {
        if (err.code === 'validation') {
          return res.status(400).json({ error: { code: err.code, message: err.message } });
        }
        throw err;
      }
    })
  );

  router.delete('/:id', (req, res) => {
    const ok = deleteSavedSearch(db, Number(req.params.id));
    if (!ok) return res.status(404).json({ error: { code: 'not_found', message: 'Saved search not found.' } });
    res.status(204).end();
  });

  // Run a saved search and return list-shaped results (FR-031).
  router.get(
    '/:id/results',
    asyncH((req, res) => {
      const saved = getSavedSearch(db, Number(req.params.id));
      if (!saved) return res.status(404).json({ error: { code: 'not_found', message: 'Saved search not found.' } });
      const prefs = getPreferences(db);
      const descriptor = {
        view: saved.view_scope,
        q: saved.query_text,
        includeTags: saved.include_tags,
        excludeTags: saved.exclude_tags,
        sort: saved.sort,
      };
      try {
        const resolved = resolveView(db, descriptor, prefs.default_sort);
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const pageSize = Math.max(1, parseInt(req.query.pageSize, 10) || prefs.items_per_page);
        const start = (page - 1) * pageSize;
        res.json({
          items: resolved.rows.slice(start, start + pageSize).map((r) => serialize(db, r)),
          total: resolved.rows.length,
          page,
          pageSize,
          savedSearch: saved,
        });
      } catch (err) {
        if (err instanceof SearchError) {
          return res.status(400).json({ error: { code: err.code, message: err.message } });
        }
        throw err;
      }
    })
  );

  return router;
}
