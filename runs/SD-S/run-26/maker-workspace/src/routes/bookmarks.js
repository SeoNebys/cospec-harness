// /api/bookmarks routes (contracts/api.md).
import express from 'express';
import { asyncHandler, HttpError } from '../util/errors.js';
import { isValidWebUrl } from '../util/url.js';
import { capturePage } from '../services/capture.js';
import * as Bookmark from '../models/bookmark.js';
import { listTags } from '../models/tag.js';

const router = express.Router();

// List / search / filter / sort (FR-011/012/013/014/016/023).
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { view, q, tag, sort, order } = req.query;
    const bookmarks = Bookmark.list({ view, q, tag, sort, order });
    res.json({ bookmarks, count: bookmarks.length });
  })
);

// Create, with duplicate-to-edit behavior (FR-002/003/006/018).
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { address, title, description, notes, tags } = req.body || {};
    if (!isValidWebUrl(address)) {
      throw new HttpError(400, 'Please enter a valid web address (http or https).');
    }
    const existing = Bookmark.findByNormalized(address);
    if (existing) {
      return res.status(200).json({ duplicate: true, bookmark: Bookmark.get(existing.id) });
    }
    const details = await capturePage(address);
    const bookmark = Bookmark.create({ address, title, description, notes, tags }, details);
    res.status(201).json(bookmark);
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const bookmark = Bookmark.get(Number(req.params.id));
    if (!bookmark) throw new HttpError(404, 'Bookmark not found.');
    res.json(bookmark);
  })
);

// Edit title/description/notes/tags/status (FR-004/014/015).
router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const { title, description, notes, tags, status } = req.body || {};
    if (status !== undefined && status !== 'read' && status !== 'unread') {
      throw new HttpError(400, "status must be 'read' or 'unread'.");
    }
    const fields = {};
    if (title !== undefined) fields.title = String(title);
    if (description !== undefined) fields.description = String(description);
    if (notes !== undefined) fields.notes = String(notes);
    if (tags !== undefined) fields.tags = tags;
    if (status !== undefined) fields.status = status;
    const bookmark = Bookmark.update(Number(req.params.id), fields);
    if (!bookmark) throw new HttpError(404, 'Bookmark not found.');
    res.json(bookmark);
  })
);

// Archive / restore (FR-016).
router.post(
  '/:id/archive',
  asyncHandler(async (req, res) => {
    const bookmark = Bookmark.setArchived(Number(req.params.id), true);
    if (!bookmark) throw new HttpError(404, 'Bookmark not found.');
    res.json(bookmark);
  })
);

router.post(
  '/:id/restore',
  asyncHandler(async (req, res) => {
    const bookmark = Bookmark.setArchived(Number(req.params.id), false);
    if (!bookmark) throw new HttpError(404, 'Bookmark not found.');
    res.json(bookmark);
  })
);

// Permanent delete (FR-017).
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const ok = Bookmark.remove(Number(req.params.id));
    if (!ok) throw new HttpError(404, 'Bookmark not found.');
    res.status(204).end();
  })
);

// Tag list for the filter control.
router.get(
  '/meta/tags',
  asyncHandler(async (req, res) => {
    res.json({ tags: listTags() });
  })
);

export default router;
