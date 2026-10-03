import { Router } from 'express';
import { normalizeAndValidateUrl } from '../services/urlValidate.js';
import { fetchMetadata } from '../services/metadata.js';
import { sanitizeNote } from '../services/sanitizeNote.js';
import { runQuery, runQueryIds } from '../services/query.js';
import { SearchSyntaxError } from '../services/search/parser.js';
import * as Bookmarks from '../models/bookmark.js';
import { setBookmarkTags } from '../models/tag.js';

const router = Router();

function parseTagList(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  return String(value)
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
}

// POST /api/metadata — fetch page metadata for review (FR-002).
router.post('/metadata', async (req, res) => {
  const check = normalizeAndValidateUrl(req.body?.url);
  if (!check.ok) return res.status(400).json({ error: check.error });
  const meta = await fetchMetadata(check.url);
  res.json(meta);
});

// POST /api/bookmarks — create, or resolve to the existing one (FR-001, FR-015).
router.post('/bookmarks', (req, res) => {
  const check = normalizeAndValidateUrl(req.body?.url);
  if (!check.ok) return res.status(400).json({ error: check.error });

  const existingRaw = Bookmarks.getRawByUrl(check.url);
  if (existingRaw) {
    return res.status(200).json({ existing: true, bookmark: Bookmarks.getById(existingRaw.id) });
  }
  const { noteHtml, noteText } = sanitizeNote(req.body?.noteHtml);
  const bookmark = Bookmarks.create({
    url: check.url,
    title: req.body?.title,
    description: req.body?.description,
    noteHtml,
    noteText,
    iconUrl: req.body?.iconUrl,
    previewImageUrl: req.body?.previewImageUrl,
    tags: req.body?.tags,
  });
  res.status(201).json(bookmark);
});

// GET /api/bookmarks — list with view/search/sort/tag filters (FR-005..009).
router.get('/bookmarks', (req, res) => {
  const view = req.query.view || 'normal';
  if (!['normal', 'read_later', 'archive'].includes(view)) {
    return res.status(400).json({ error: 'Unknown view.' });
  }
  try {
    const bookmarks = runQuery({
      view,
      q: req.query.q,
      includeTags: parseTagList(req.query.includeTags),
      excludeTags: parseTagList(req.query.excludeTags),
      sort: req.query.sort || 'newest',
    });
    res.json({ bookmarks, total: bookmarks.length });
  } catch (err) {
    if (err instanceof SearchSyntaxError) return res.status(400).json({ error: err.message });
    throw err;
  }
});

// POST /api/bookmarks/bulk — one action over a selection (FR-019, FR-020).
// Registered before '/bookmarks/:id' so "bulk" is not captured as an id.
router.post('/bookmarks/bulk', (req, res) => {
  const { select, action } = req.body || {};
  if (!select || !action || !action.type) {
    return res.status(400).json({ error: 'A selection and an action are required.' });
  }
  let ids = [];
  if (Array.isArray(select.ids)) {
    ids = select.ids;
  } else {
    try {
      ids = runQueryIds({
        view: select.view || 'normal',
        q: select.q,
        includeTags: parseTagList(select.includeTags),
        excludeTags: parseTagList(select.excludeTags),
        sort: 'newest',
      });
    } catch (err) {
      if (err instanceof SearchSyntaxError) return res.status(400).json({ error: err.message });
      throw err;
    }
  }

  let affected = 0;
  for (const id of ids) {
    const raw = Bookmarks.getRawById(id);
    if (!raw) continue;
    switch (action.type) {
      case 'addTags': {
        const current = Bookmarks.getById(id).tags;
        setBookmarkTags(id, [...new Set([...current, ...parseTagList(action.tags)])]);
        break;
      }
      case 'removeTags': {
        const remove = new Set(parseTagList(action.tags).map((t) => t.toLowerCase()));
        const current = Bookmarks.getById(id).tags.filter((t) => !remove.has(t.toLowerCase()));
        setBookmarkTags(id, current);
        break;
      }
      case 'markRead':
        Bookmarks.update(id, { isRead: true });
        break;
      case 'markUnread':
        Bookmarks.update(id, { isRead: false });
        break;
      case 'archive':
        Bookmarks.update(id, { isArchived: true });
        break;
      case 'restore':
        Bookmarks.update(id, { isArchived: false });
        break;
      case 'delete':
        Bookmarks.remove(id);
        break;
      default:
        return res.status(400).json({ error: `Unknown action: ${action.type}` });
    }
    affected++;
  }
  res.json({ affected });
});

// GET /api/bookmarks/:id
router.get('/bookmarks/:id', (req, res) => {
  const bookmark = Bookmarks.getById(Number(req.params.id));
  if (!bookmark) return res.status(404).json({ error: 'Bookmark not found.' });
  res.json(bookmark);
});

// PATCH /api/bookmarks/:id — edit fields incl. address (FR-003, FR-010).
router.patch('/bookmarks/:id', (req, res) => {
  const id = Number(req.params.id);
  const existing = Bookmarks.getRawById(id);
  if (!existing) return res.status(404).json({ error: 'Bookmark not found.' });

  const fields = {};
  if (req.body.url !== undefined) {
    const check = normalizeAndValidateUrl(req.body.url);
    if (!check.ok) return res.status(400).json({ error: check.error });
    const collision = Bookmarks.getRawByUrl(check.url);
    if (collision && collision.id !== id) {
      return res.status(409).json({ error: 'Another bookmark already uses that address.' });
    }
    fields.url = check.url;
  }
  for (const key of ['title', 'description', 'iconUrl', 'previewImageUrl']) {
    if (req.body[key] !== undefined) fields[key] = req.body[key];
  }
  if (req.body.noteHtml !== undefined) {
    const { noteHtml, noteText } = sanitizeNote(req.body.noteHtml);
    fields.noteHtml = noteHtml;
    fields.noteText = noteText;
  }
  if (req.body.tags !== undefined) fields.tags = req.body.tags;
  if (req.body.isRead !== undefined) fields.isRead = req.body.isRead;
  if (req.body.isArchived !== undefined) fields.isArchived = req.body.isArchived;

  res.json(Bookmarks.update(id, fields));
});

// POST /api/bookmarks/:id/status — set read/unread and/or archived INDEPENDENTLY
// (FR-016, FR-017). Setting one never changes the other.
router.post('/bookmarks/:id/status', (req, res) => {
  const id = Number(req.params.id);
  const existing = Bookmarks.getRawById(id);
  if (!existing) return res.status(404).json({ error: 'Bookmark not found.' });
  const fields = {};
  if (req.body.isRead !== undefined) fields.isRead = req.body.isRead;
  if (req.body.isArchived !== undefined) fields.isArchived = req.body.isArchived;
  res.json(Bookmarks.update(id, fields));
});

// DELETE /api/bookmarks/:id — permanent (FR-018). Cascade removes bookmark_tag
// links, captures, and snapshots; tag rows are never deleted here.
router.delete('/bookmarks/:id', (req, res) => {
  const ok = Bookmarks.remove(Number(req.params.id));
  if (!ok) return res.status(404).json({ error: 'Bookmark not found.' });
  res.status(204).end();
});

export default router;
