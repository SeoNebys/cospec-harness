import express from 'express';
import { existsSync, statSync, createReadStream } from 'node:fs';
import { extname } from 'node:path';
import {
  createBookmark,
  getRow,
  updateBookmark,
  deleteBookmark,
  serialize,
} from '../models/bookmark.js';
import {
  addTagToBookmark,
  removeTagFromBookmark,
  pruneOrphanTags,
} from '../models/tag.js';
import { getSnapshot, upsertSnapshot } from '../models/snapshot.js';
import { getPreferences } from '../models/preferences.js';
import { resolveView } from '../lib/viewQuery.js';
import { captureMetadata } from '../services/metadata.js';
import { captureSnapshot, SnapshotError } from '../services/snapshot.js';
import { saveToInternetArchive, ArchiveError } from '../services/archiveOrg.js';
import { InvalidUrlError } from '../services/url.js';
import { SearchError } from '../search/parser.js';
import { DATA_DIR } from '../db/connection.js';

const asyncH = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

export function bookmarksRouter(db) {
  const router = express.Router();

  // Create (US1). Duplicate -> 200 with existing; else 201 + async metadata.
  router.post(
    '/',
    asyncH(async (req, res) => {
      let result;
      try {
        result = createBookmark(db, req.body || {});
      } catch (err) {
        if (err instanceof InvalidUrlError) {
          return res.status(400).json({ error: { code: err.code, message: err.message } });
        }
        throw err;
      }
      if (result.duplicate) {
        return res.status(200).json({ duplicate: true, bookmark: serialize(db, result.row) });
      }
      const id = result.row.id;
      const url = result.row.url;
      // Fire-and-forget metadata capture (non-blocking, FR-005).
      captureMetadata(db, id, url);
      return res.status(201).json({ duplicate: false, bookmark: serialize(db, result.row) });
    })
  );

  // List / search (US2, US4).
  router.get(
    '/',
    asyncH(async (req, res) => {
      const prefs = getPreferences(db);
      const descriptor = {
        view: req.query.view,
        q: req.query.q,
        tag: req.query.tag,
        includeTags: parseList(req.query.includeTags),
        excludeTags: parseList(req.query.excludeTags),
        sort: req.query.sort,
      };
      let resolved;
      try {
        resolved = resolveView(db, descriptor, prefs.default_sort);
      } catch (err) {
        if (err instanceof SearchError) {
          return res.status(400).json({ error: { code: err.code, message: err.message } });
        }
        throw err;
      }
      const total = resolved.rows.length;
      const page = Math.max(1, parseInt(req.query.page, 10) || 1);
      const pageSize = Math.max(1, parseInt(req.query.pageSize, 10) || prefs.items_per_page);
      const start = (page - 1) * pageSize;
      const slice = resolved.rows.slice(start, start + pageSize);
      res.json({
        items: slice.map((r) => serialize(db, r)),
        total,
        page,
        pageSize,
      });
    })
  );

  router.get(
    '/:id',
    asyncH(async (req, res) => {
      const row = getRow(db, Number(req.params.id));
      if (!row) return res.status(404).json({ error: { code: 'not_found', message: 'Bookmark not found.' } });
      res.json({ bookmark: serialize(db, row) });
    })
  );

  // Edit (US1/US3).
  router.patch(
    '/:id',
    asyncH(async (req, res) => {
      const id = Number(req.params.id);
      if (!getRow(db, id)) return res.status(404).json({ error: { code: 'not_found', message: 'Bookmark not found.' } });
      let row;
      try {
        row = updateBookmark(db, id, req.body || {});
      } catch (err) {
        if (err instanceof InvalidUrlError || err.code === 'validation' || err.code === 'duplicate_url') {
          return res.status(400).json({ error: { code: err.code, message: err.message } });
        }
        throw err;
      }
      res.json({ bookmark: serialize(db, row) });
    })
  );

  // Permanent delete (US3).
  router.delete(
    '/:id',
    asyncH(async (req, res) => {
      const ok = deleteBookmark(db, Number(req.params.id));
      if (!ok) return res.status(404).json({ error: { code: 'not_found', message: 'Bookmark not found.' } });
      res.status(204).end();
    })
  );

  // Bulk actions (US5) — respects the full active view descriptor (FR-027).
  router.post(
    '/bulk',
    asyncH(async (req, res) => {
      const { action, value, select } = req.body || {};
      const validActions = ['tag', 'untag', 'read', 'unread', 'archive', 'unarchive', 'delete'];
      if (!validActions.includes(action)) {
        return res.status(400).json({ error: { code: 'validation', message: 'Unknown bulk action.' } });
      }
      let ids = [];
      if (select && Array.isArray(select.ids)) {
        ids = select.ids.map(Number);
      } else if (select && select.matchView) {
        const prefs = getPreferences(db);
        try {
          const resolved = resolveView(db, select.matchView, prefs.default_sort);
          ids = resolved.rows.map((r) => r.id);
        } catch (err) {
          if (err instanceof SearchError) {
            return res.status(400).json({ error: { code: err.code, message: err.message } });
          }
          throw err;
        }
      } else {
        return res.status(400).json({ error: { code: 'validation', message: 'No selection provided.' } });
      }

      if (action === 'delete' && req.body.confirm !== true) {
        return res.status(400).json({ error: { code: 'confirm_required', message: 'Deletion must be confirmed.' } });
      }
      if ((action === 'tag' || action === 'untag') && (!value || !String(value).trim())) {
        return res.status(400).json({ error: { code: 'validation', message: 'A tag name is required.' } });
      }

      const run = db.transaction((idList) => {
        let affected = 0;
        for (const id of idList) {
          if (!getRow(db, id)) continue;
          switch (action) {
            case 'tag':
              addTagToBookmark(db, id, value);
              break;
            case 'untag':
              removeTagFromBookmark(db, id, value);
              break;
            case 'read':
              db.prepare('UPDATE bookmark SET read_state = ?, date_updated = ? WHERE id = ?').run('read', new Date().toISOString(), id);
              break;
            case 'unread':
              db.prepare('UPDATE bookmark SET read_state = ?, date_updated = ? WHERE id = ?').run('unread', new Date().toISOString(), id);
              break;
            case 'archive':
              db.prepare('UPDATE bookmark SET archived = 1, date_updated = ? WHERE id = ?').run(new Date().toISOString(), id);
              break;
            case 'unarchive':
              db.prepare('UPDATE bookmark SET archived = 0, date_updated = ? WHERE id = ?').run(new Date().toISOString(), id);
              break;
            case 'delete':
              db.prepare('DELETE FROM bookmark WHERE id = ?').run(id);
              break;
          }
          affected++;
        }
        pruneOrphanTags(db);
        return affected;
      });
      const affected = run(ids);
      res.json({ affected });
    })
  );

  // Favicon / preview (US1).
  router.get('/:id/favicon', asyncH(async (req, res) => serveImage(db, req, res, 'favicon')));
  router.get('/:id/preview', asyncH(async (req, res) => serveImage(db, req, res, 'preview')));

  // Snapshot capture + serve (US7).
  router.post(
    '/:id/snapshot',
    asyncH(async (req, res) => {
      const id = Number(req.params.id);
      const row = getRow(db, id);
      if (!row) return res.status(404).json({ error: { code: 'not_found', message: 'Bookmark not found.' } });
      try {
        const snap = await captureSnapshot(row.url, id);
        upsertSnapshot(db, id, snap);
        res.status(201).json({ snapshot: { kind: snap.kind, url: `/api/bookmarks/${id}/snapshot` } });
      } catch (err) {
        if (err instanceof SnapshotError) {
          return res.status(502).json({ error: { code: err.code, message: err.message } });
        }
        throw err;
      }
    })
  );

  router.get(
    '/:id/snapshot',
    asyncH(async (req, res) => {
      const id = Number(req.params.id);
      const snap = getSnapshot(db, id);
      if (!snap || !existsSync(snap.file_path) || !isInsideData(snap.file_path)) {
        return res.status(404).json({ error: { code: 'not_found', message: 'No snapshot available.' } });
      }
      res.setHeader('Content-Type', snap.kind === 'pdf' ? 'application/pdf' : 'text/html; charset=utf-8');
      createReadStream(snap.file_path).pipe(res);
    })
  );

  // Internet Archive save (US7).
  router.post(
    '/:id/archive-org',
    asyncH(async (req, res) => {
      const id = Number(req.params.id);
      const row = getRow(db, id);
      if (!row) return res.status(404).json({ error: { code: 'not_found', message: 'Bookmark not found.' } });
      try {
        const archivedUrl = await saveToInternetArchive(row.url);
        db.prepare('UPDATE bookmark SET internet_archive_url = ?, date_updated = ? WHERE id = ?').run(
          archivedUrl,
          new Date().toISOString(),
          id
        );
        res.json({ internet_archive_url: archivedUrl, bookmark: serialize(db, getRow(db, id)) });
      } catch (err) {
        if (err instanceof ArchiveError) {
          return res.status(502).json({ error: { code: err.code, message: err.message } });
        }
        throw err;
      }
    })
  );

  return router;
}

function parseList(v) {
  if (v == null) return [];
  if (Array.isArray(v)) return v;
  return String(v)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function isInsideData(p) {
  return p.startsWith(DATA_DIR);
}

function serveImage(db, req, res, kind) {
  const row = getRow(db, Number(req.params.id));
  if (!row) return res.status(404).end();
  const path = kind === 'favicon' ? row.favicon_path : row.preview_path;
  const url = kind === 'favicon' ? row.favicon_url : row.preview_url;
  if (path && existsSync(path) && isInsideData(path)) {
    res.setHeader('Content-Type', contentTypeFor(path));
    return createReadStream(path).pipe(res);
  }
  if (url) return res.redirect(url);
  return res.status(404).end();
}

function contentTypeFor(p) {
  const ext = extname(p).toLowerCase();
  const map = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.webp': 'image/webp',
    '.ico': 'image/x-icon',
  };
  return map[ext] || 'application/octet-stream';
}
