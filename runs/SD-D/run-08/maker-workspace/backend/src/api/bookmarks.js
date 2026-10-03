import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { SNAPSHOT_DIR } from '../db/index.js';
import * as Bookmarks from '../models/bookmarks.js';
import { setBookmarkTags, addBookmarkTags, removeBookmarkTags } from '../models/tags.js';
import { getPreferences } from '../models/preferences.js';
import { normalizeUrl, isValidWebUrl, fallbackTitle } from '../url/normalize.js';
import { searchIds } from '../services/search.js';
import { enrich } from '../services/enrichment.js';
import { captureSnapshot } from '../services/snapshot.js';
import { saveToArchiveOrg } from '../services/archiveOrg.js';
import { invalidUrl, duplicate, invalidQuery, notFound, validationError } from './errors.js';

const router = express.Router();

// ---- Background jobs (fire-and-forget; outcomes recorded and surfaced, FR-041) ----

export async function runEnrichment(id, url, opts = {}) {
  try {
    const result = await enrich(id, url);
    Bookmarks.setEnrichment(id, { ...result, ...opts });
  } catch {
    // enrichment is best-effort; fallback title already stored
  }
}

export async function runSnapshot(id, url) {
  Bookmarks.setSnapshot(id, { path: null, kind: null, status: 'pending' });
  try {
    const { path: p, kind } = await captureSnapshot(id, url);
    Bookmarks.setSnapshot(id, { path: p, kind, status: 'ready' });
  } catch {
    Bookmarks.setSnapshot(id, { path: null, kind: null, status: 'failed' });
  }
}

export async function runArchiveOrg(id, url) {
  Bookmarks.setArchiveOrg(id, { url: null, status: 'pending' });
  try {
    const archivedUrl = await saveToArchiveOrg(url);
    Bookmarks.setArchiveOrg(id, { url: archivedUrl, status: 'ready' });
  } catch {
    Bookmarks.setArchiveOrg(id, { url: null, status: 'failed' });
  }
}

function kickoff(id, url, opts = {}) {
  // Test hook: skip background browser/network jobs during automated runs.
  if (process.env.BOOKMARKS_DISABLE_JOBS === '1') return;
  // Do not block the response; each job records its own outcome.
  runEnrichment(id, url, opts);
  runSnapshot(id, url);
}

// ---- Query parsing helpers ----

function parseListOptions(req, { archived = false } = {}) {
  const prefs = getPreferences();
  const q = req.query.q ? String(req.query.q) : '';
  const splitTags = (v) =>
    v ? String(v).split(',').map((t) => t.trim()).filter(Boolean) : [];
  const sort = req.query.sort ? String(req.query.sort) : prefs.defaultSort;
  const pageSize = req.query.pageSize ? Number(req.query.pageSize) : prefs.itemsPerPage;
  const page = req.query.page ? Number(req.query.page) : 1;

  let matchIds = null;
  if (q.trim()) {
    matchIds = searchIds(q); // throws invalid_query on malformed
  }

  return {
    q,
    matchIds,
    includeTags: splitTags(req.query.includeTags),
    excludeTags: splitTags(req.query.excludeTags),
    unread: String(req.query.unread) === 'true',
    archived,
    sort,
    page: Number.isFinite(page) ? page : 1,
    pageSize: Number.isFinite(pageSize) ? pageSize : 25,
  };
}

// ---- Routes ----

const createSchema = z.object({
  url: z.string(),
  title: z.string().optional(),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
  note: z.string().optional(),
});

router.post('/', (req, res, next) => {
  try {
    const body = createSchema.parse(req.body);
    if (!isValidWebUrl(body.url)) throw invalidUrl();
    const urlKey = normalizeUrl(body.url);

    const existing = Bookmarks.getByUrlKey(urlKey);
    if (existing) throw duplicate(existing.id); // route to existing (FR-006)

    const id = Bookmarks.create({
      url: body.url.trim(),
      urlKey,
      title: body.title || fallbackTitle(body.url),
      description: body.description || '',
      note: body.note || null,
      tags: body.tags || [],
    });
    // Auto-collect only the fields the user did not provide (FR-004).
    kickoff(id, body.url.trim(), {
      overrideTitle: !body.title,
      overrideDescription: !body.description,
    });
    res.status(201).json(Bookmarks.getById(id));
  } catch (err) {
    if (err instanceof z.ZodError) return next(validationError());
    next(err);
  }
});

router.get('/', (req, res, next) => {
  try {
    const options = parseListOptions(req);
    res.json(Bookmarks.list(options));
  } catch (err) {
    if (err && err.code === 'invalid_query') return next(invalidQuery(err.message));
    next(err);
  }
});

router.get('/archived', (req, res, next) => {
  try {
    const options = parseListOptions(req, { archived: true });
    res.json(Bookmarks.list(options));
  } catch (err) {
    if (err && err.code === 'invalid_query') return next(invalidQuery(err.message));
    next(err);
  }
});

// Bulk actions (FR-026, FR-026a, FR-027).
const bulkSchema = z.object({
  target: z.object({
    ids: z.array(z.number()).optional(),
    filter: z.record(z.any()).optional(),
  }),
  action: z.enum(['addTags', 'removeTags', 'markRead', 'markUnread', 'archive', 'delete']),
  tags: z.array(z.string()).optional(),
});

router.post('/bulk', (req, res, next) => {
  try {
    const body = bulkSchema.parse(req.body);
    let ids = [];
    if (body.target.ids && body.target.ids.length) {
      ids = body.target.ids;
    } else if (body.target.filter) {
      const f = body.target.filter;
      const opts = {
        archived: !!f.archived,
        unread: !!f.unread,
        includeTags: f.includeTags || [],
        excludeTags: f.excludeTags || [],
        matchIds: f.q && String(f.q).trim() ? searchIds(String(f.q)) : null,
      };
      ids = Bookmarks.resolveIds(opts);
    }

    if ((body.action === 'addTags' || body.action === 'removeTags') && !body.tags) {
      throw validationError('tags are required for tag actions.');
    }

    for (const id of ids) {
      switch (body.action) {
        case 'addTags':
          addBookmarkTags(id, body.tags);
          break;
        case 'removeTags':
          removeBookmarkTags(id, body.tags);
          break;
        case 'markRead':
          Bookmarks.setReadState(id, false);
          break;
        case 'markUnread':
          Bookmarks.setReadState(id, true);
          break;
        case 'archive':
          Bookmarks.setArchived(id, true);
          break;
        case 'delete':
          removeWithFiles(id);
          break;
        default:
          break;
      }
    }
    res.json({ affected: ids.length });
  } catch (err) {
    if (err instanceof z.ZodError) return next(validationError());
    if (err && err.code === 'invalid_query') return next(invalidQuery(err.message));
    next(err);
  }
});

router.get('/:id', (req, res, next) => {
  const bm = Bookmarks.getById(Number(req.params.id));
  if (!bm) return next(notFound('Bookmark not found.'));
  res.json(bm);
});

const patchSchema = z.object({
  url: z.string().optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
  note: z.string().nullable().optional(),
});

router.patch('/:id', (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const row = Bookmarks.getRowById(id);
    if (!row) throw notFound('Bookmark not found.');
    const body = patchSchema.parse(req.body);

    const fields = {};
    if (body.url !== undefined) {
      if (!isValidWebUrl(body.url)) throw invalidUrl();
      const urlKey = normalizeUrl(body.url);
      const existing = Bookmarks.getByUrlKey(urlKey);
      if (existing && existing.id !== id) throw duplicate(existing.id);
      fields.url = body.url.trim();
      fields.url_key = urlKey;
    }
    if (body.title !== undefined) fields.title = body.title;
    if (body.description !== undefined) fields.description = body.description;
    if (body.note !== undefined) fields.note_md = body.note;

    if (Object.keys(fields).length) Bookmarks.updateFields(id, fields);
    if (body.tags !== undefined) setBookmarkTags(id, body.tags);

    // If the address changed, refresh the snapshot and favicon/preview for the new
    // page, but never override the user's title/description (FR-004).
    if (fields.url) {
      runSnapshot(id, fields.url);
      runEnrichment(id, fields.url, { overrideTitle: false, overrideDescription: false });
    }

    res.json(Bookmarks.getById(id));
  } catch (err) {
    if (err instanceof z.ZodError) return next(validationError());
    next(err);
  }
});

function removeWithFiles(id) {
  Bookmarks.remove(id);
  const dir = path.join(SNAPSHOT_DIR, String(id));
  fs.rmSync(dir, { recursive: true, force: true });
}

router.delete('/:id', (req, res, next) => {
  const id = Number(req.params.id);
  if (!Bookmarks.getRowById(id)) return next(notFound('Bookmark not found.'));
  removeWithFiles(id);
  res.status(204).end();
});

router.post('/:id/read-state', (req, res, next) => {
  const id = Number(req.params.id);
  if (!Bookmarks.getRowById(id)) return next(notFound('Bookmark not found.'));
  res.json(Bookmarks.setReadState(id, !!req.body.unread));
});

router.post('/:id/archive', (req, res, next) => {
  const id = Number(req.params.id);
  if (!Bookmarks.getRowById(id)) return next(notFound('Bookmark not found.'));
  res.json(Bookmarks.setArchived(id, true));
});

router.post('/:id/restore', (req, res, next) => {
  const id = Number(req.params.id);
  if (!Bookmarks.getRowById(id)) return next(notFound('Bookmark not found.'));
  res.json(Bookmarks.setArchived(id, false));
});

router.post('/:id/archive-org', (req, res, next) => {
  const id = Number(req.params.id);
  const row = Bookmarks.getRowById(id);
  if (!row) return next(notFound('Bookmark not found.'));
  runArchiveOrg(id, row.url); // out-of-band; sets pending then ready|failed
  res.json(Bookmarks.getById(id));
});

export default router;
