import { Router, Request, Response } from 'express';
import fs from 'fs';
import {
  create,
  list,
  getById,
  getRawById,
  update,
  remove,
  listMatchingIds,
  InvalidUrlError,
  UrlConflictError,
} from '../models/bookmarks';
import { addTagsToBookmark, removeTagsFromBookmark } from '../models/tags';
import { getCopy, upsertCopy } from '../models/preservedCopies';
import { enrichBookmark } from '../services/enrich';
import { findSnapshot, requestSnapshot } from '../services/archiveorg';
import { SearchSyntaxError } from '../search/parser';
import { ListQuery, SortOrder, ViewName } from '../types';
import { getDb } from '../db/connection';

export const bookmarksRouter = Router();

function parseListQuery(req: Request): ListQuery {
  return {
    q: typeof req.query.q === 'string' ? req.query.q : undefined,
    tag: typeof req.query.tag === 'string' ? req.query.tag : undefined,
    filterId: req.query.filterId ? Number(req.query.filterId) : undefined,
    view: (req.query.view as ViewName) || 'all',
    sort: (req.query.sort as SortOrder) || undefined,
    page: req.query.page ? Number(req.query.page) : undefined,
    pageSize: req.query.pageSize ? Number(req.query.pageSize) : undefined,
  };
}

// Create (or resolve duplicate).
bookmarksRouter.post('/', (req: Request, res: Response) => {
  const { url, title, description, tags, note_markdown, read } = req.body ?? {};
  if (typeof url !== 'string' || !url.trim()) {
    return res.status(400).json({ error: { code: 'invalid_url', message: 'A URL is required.' } });
  }
  try {
    const result = create({ url, title, description, tags, note_markdown, read });
    if (result.duplicate) {
      return res.status(200).json({ bookmark: result.bookmark, duplicate: true });
    }
    // Fire-and-forget enrichment (metadata images, local copy, Wayback).
    void enrichBookmark(result.bookmark.id, result.bookmark.url);
    return res.status(201).json({ bookmark: result.bookmark, duplicate: false });
  } catch (err) {
    if (err instanceof InvalidUrlError) {
      return res
        .status(400)
        .json({ error: { code: 'invalid_url', message: 'That is not a valid web address.' } });
    }
    throw err;
  }
});

// List with search / filter / sort / paging.
bookmarksRouter.get('/', (req: Request, res: Response) => {
  try {
    return res.json(list(parseListQuery(req)));
  } catch (err) {
    if (err instanceof SearchSyntaxError) {
      return res.status(400).json({ error: { code: 'bad_search', message: err.message } });
    }
    throw err;
  }
});

// Bulk actions (declared before /:id).
bookmarksRouter.post('/bulk', (req: Request, res: Response) => {
  const { target, action, payload, confirm } = req.body ?? {};
  let ids: number[] = [];
  try {
    if (target?.ids && Array.isArray(target.ids)) {
      ids = target.ids.map(Number);
    } else if (target?.allMatching) {
      ids = listMatchingIds({ ...target.allMatching });
    } else {
      return res.status(400).json({ error: { code: 'bad_target', message: 'No target provided.' } });
    }
  } catch (err) {
    if (err instanceof SearchSyntaxError) {
      return res.status(400).json({ error: { code: 'bad_search', message: err.message } });
    }
    throw err;
  }

  if (action === 'delete' && confirm !== true) {
    return res
      .status(400)
      .json({ error: { code: 'confirm_required', message: 'Bulk delete requires confirmation.' } });
  }

  const db = getDb();
  const tx = db.transaction(() => {
    for (const id of ids) {
      switch (action) {
        case 'addTags':
          addTagsToBookmark(id, payload?.tags ?? []);
          update(id, {});
          break;
        case 'removeTags':
          removeTagsFromBookmark(id, payload?.tags ?? []);
          update(id, {});
          break;
        case 'markRead':
          update(id, { read: true });
          break;
        case 'markReadLater':
          update(id, { read: false });
          break;
        case 'archive':
          update(id, { archived: true });
          break;
        case 'restore':
          update(id, { archived: false });
          break;
        case 'delete':
          remove(id);
          break;
        default:
          throw new Error('unknown_action');
      }
    }
  });
  try {
    tx();
  } catch (err) {
    if ((err as Error).message === 'unknown_action') {
      return res.status(400).json({ error: { code: 'bad_action', message: 'Unknown bulk action.' } });
    }
    throw err;
  }
  return res.json({ affected: ids.length });
});

bookmarksRouter.get('/:id(\\d+)', (req: Request, res: Response) => {
  const bm = getById(Number(req.params.id));
  if (!bm) return res.status(404).json({ error: { code: 'not_found', message: 'Not found.' } });
  return res.json(bm);
});

bookmarksRouter.patch('/:id(\\d+)', (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!getRawById(id)) return res.status(404).json({ error: { code: 'not_found', message: 'Not found.' } });
  try {
    return res.json(update(id, req.body ?? {}));
  } catch (err) {
    if (err instanceof InvalidUrlError) {
      return res.status(400).json({ error: { code: 'invalid_url', message: 'Invalid web address.' } });
    }
    if (err instanceof UrlConflictError) {
      return res
        .status(409)
        .json({ error: { code: 'url_conflict', message: 'Another bookmark already has that address.' } });
    }
    throw err;
  }
});

bookmarksRouter.delete('/:id(\\d+)', (req: Request, res: Response) => {
  remove(Number(req.params.id));
  return res.status(204).end();
});

// Serve the preserved local copy.
bookmarksRouter.get('/:id(\\d+)/copy', (req: Request, res: Response) => {
  const copy = getCopy(Number(req.params.id));
  if (!copy || copy.status !== 'available' || !copy.file_path || !fs.existsSync(copy.file_path)) {
    return res.status(404).json({ error: { code: 'no_copy', message: 'No local copy available.' } });
  }
  res.type(copy.type === 'pdf' ? 'application/pdf' : 'multipart/related');
  return res.sendFile(copy.file_path);
});

function serveImage(pathField: 'icon_path' | 'preview_image_path') {
  return (req: Request, res: Response) => {
    const row = getRawById(Number(req.params.id));
    const p = row?.[pathField];
    if (!p || !fs.existsSync(p)) {
      return res.status(404).json({ error: { code: 'no_image', message: 'Not available.' } });
    }
    return res.sendFile(p);
  };
}
bookmarksRouter.get('/:id(\\d+)/icon', serveImage('icon_path'));
bookmarksRouter.get('/:id(\\d+)/preview', serveImage('preview_image_path'));

// Refresh the Internet Archive snapshot (best-effort).
bookmarksRouter.post('/:id(\\d+)/archive-copy/refresh', async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const row = getRawById(id);
  if (!row) return res.status(404).json({ error: { code: 'not_found', message: 'Not found.' } });
  const snap = await findSnapshot(row.url);
  if (!snap.reachable) {
    return res
      .status(503)
      .json({ wayback_url: null, requested: false, message: 'Internet Archive is unreachable.' });
  }
  if (snap.wayback_url) {
    upsertCopy(id, { wayback_url: snap.wayback_url });
    return res.json({ wayback_url: snap.wayback_url, requested: false });
  }
  const requested = await requestSnapshot(row.url);
  return res.json({ wayback_url: null, requested });
});
