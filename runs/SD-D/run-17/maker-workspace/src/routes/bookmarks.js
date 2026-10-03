import express from 'express';
import * as Bookmark from '../models/bookmark.js';
import { addTagsToBookmark, removeTagsFromBookmark, pruneOrphanTags } from '../models/tag.js';
import { getPreferences } from '../models/preferences.js';
import { normalizeUrl } from '../services/url.js';
import { fetchMetadata } from '../services/metadata.js';
import { renderNote } from '../services/notes.js';
import { queryBookmarks } from '../services/listquery.js';
import { SearchError } from '../services/search.js';
import { createPageCopy, deletePageCopyFile } from '../services/pagecopy.js';
import { submitToArchive } from '../services/archiveorg.js';
import fs from 'node:fs';

const router = express.Router();

function withRenderedNote(bm) {
  if (!bm) return bm;
  return { ...bm, note_html: renderNote(bm.note) };
}

// Preview metadata WITHOUT creating a bookmark (T017 / FR-003).
router.post('/metadata', async (req, res) => {
  const url = normalizeUrl(req.body.url);
  if (!url) return res.status(400).json({ error: 'Please enter a valid web address.' });
  const meta = await fetchMetadata(url);
  res.json({ url, ...meta });
});

// Create a bookmark or, if the URL exists, return it for editing (FR-008).
router.post('/', async (req, res) => {
  const url = normalizeUrl(req.body.url);
  if (!url) return res.status(400).json({ error: 'Please enter a valid web address.' });

  const existing = Bookmark.getByUrl(url);
  if (existing) {
    return res.status(200).json({ duplicate: true, bookmark: withRenderedNote(existing) });
  }

  const supplied = req.body;
  let meta = { title: '', description: '', icon_url: '', preview_image_url: '' };
  // Fetch metadata only for fields the client did not supply.
  if (!supplied.title || !supplied.description || !supplied.icon_url || !supplied.preview_image_url) {
    meta = await fetchMetadata(url);
  }
  const created = Bookmark.create({
    url,
    title: supplied.title || meta.title,
    description: supplied.description || meta.description,
    note: supplied.note || '',
    icon_url: supplied.icon_url || meta.icon_url,
    preview_image_url: supplied.preview_image_url || meta.preview_image_url,
    tags: supplied.tags || [],
  });
  res.status(201).json({ bookmark: withRenderedNote(created) });
});

// List bookmarks (FR-004a/009/012/016/018).
router.get('/', (req, res) => {
  const prefs = getPreferences();
  const sort = req.query.sort || prefs.default_sort;
  let list;
  try {
    list = queryBookmarks({
      q: req.query.q,
      view: req.query.view || 'normal',
      include_tags: req.query.include_tags,
      exclude_tags: req.query.exclude_tags,
      sort,
    });
  } catch (e) {
    if (e instanceof SearchError) return res.status(400).json({ error: e.message });
    throw e;
  }
  const total = list.length;
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const pageSize = Math.max(1, parseInt(req.query.page_size, 10) || prefs.page_size);
  const start = (page - 1) * pageSize;
  const items = list.slice(start, start + pageSize);
  res.json({ items, total, page, page_size: pageSize, sort });
});

router.get('/:id', (req, res) => {
  const bm = Bookmark.getById(req.params.id);
  if (!bm) return res.status(404).json({ error: 'Bookmark not found.' });
  res.json({ bookmark: withRenderedNote(bm) });
});

// Update fields incl. note (Markdown) and tags (FR-004/006/013/025).
router.patch('/:id', (req, res) => {
  const bm = Bookmark.getById(req.params.id);
  if (!bm) return res.status(404).json({ error: 'Bookmark not found.' });
  const fields = {};
  for (const k of ['title', 'description', 'note']) {
    if (k in req.body) fields[k] = req.body[k];
  }
  if ('url' in req.body) {
    const url = normalizeUrl(req.body.url);
    if (!url) return res.status(400).json({ error: 'Please enter a valid web address.' });
    const other = Bookmark.getByUrl(url);
    if (other && other.id !== bm.id) {
      return res.status(409).json({ error: 'Another bookmark already uses that address.' });
    }
    fields.url = url;
  }
  if ('tags' in req.body) fields.tags = req.body.tags || [];
  const updated = Bookmark.update(bm.id, fields);
  pruneOrphanTags();
  res.json({ bookmark: withRenderedNote(updated) });
});

// Permanent delete: removes local page-copy file too (data-model.md).
router.delete('/:id', (req, res) => {
  const bm = Bookmark.getById(req.params.id);
  if (!bm) return res.status(404).json({ error: 'Bookmark not found.' });
  deletePageCopyFile(bm.page_copy_path);
  Bookmark.remove(bm.id);
  pruneOrphanTags();
  res.status(204).end();
});

router.post('/:id/read', (req, res) => respondOr404(res, Bookmark.setReadState(req.params.id, true)));
router.post('/:id/unread', (req, res) => respondOr404(res, Bookmark.setReadState(req.params.id, false)));
router.post('/:id/archive', (req, res) => respondOr404(res, Bookmark.setArchivedState(req.params.id, true)));
router.post('/:id/restore', (req, res) => respondOr404(res, Bookmark.setArchivedState(req.params.id, false)));

function respondOr404(res, bm) {
  if (!bm) return res.status(404).json({ error: 'Bookmark not found.' });
  res.json({ bookmark: bm });
}

// Bulk actions (FR-017). Carries all filter conditions through selectAll.
router.post('/bulk', async (req, res) => {
  const { ids, selectAll, action, payload } = req.body;
  let targetIds = [];
  if (Array.isArray(ids) && ids.length) {
    targetIds = ids.map(Number);
  } else if (selectAll) {
    try {
      const list = queryBookmarks({
        q: selectAll.q,
        view: selectAll.view || 'normal',
        include_tags: selectAll.include_tags,
        exclude_tags: selectAll.exclude_tags,
      });
      targetIds = list.map((b) => b.id);
    } catch (e) {
      if (e instanceof SearchError) return res.status(400).json({ error: e.message });
      throw e;
    }
  }
  let affected = 0;
  for (const id of targetIds) {
    const bm = Bookmark.getById(id);
    if (!bm) continue;
    switch (action) {
      case 'add_tags': addTagsToBookmark(id, payload?.tags || []); break;
      case 'remove_tags': removeTagsFromBookmark(id, payload?.tags || []); break;
      case 'mark_read': Bookmark.setReadState(id, true); break;
      case 'mark_unread': Bookmark.setReadState(id, false); break;
      case 'archive': Bookmark.setArchivedState(id, true); break;
      case 'restore': Bookmark.setArchivedState(id, false); break;
      case 'delete':
        deletePageCopyFile(bm.page_copy_path); // same cleanup as single delete (T038/T052)
        Bookmark.remove(id);
        break;
      default: return res.status(400).json({ error: 'Unknown bulk action.' });
    }
    affected++;
  }
  pruneOrphanTags();
  res.json({ affected });
});

// Create a preserved local copy (FR-021).
router.post('/:id/pagecopy', async (req, res) => {
  const bm = Bookmark.getById(req.params.id);
  if (!bm) return res.status(404).json({ error: 'Bookmark not found.' });
  try {
    const { path: filePath, kind } = await createPageCopy(bm.id, bm.url);
    const updated = Bookmark.setPageCopy(bm.id, filePath, kind);
    res.json({ bookmark: updated });
  } catch (e) {
    res.status(502).json({ error: 'Could not save a local copy of this page: ' + e.message });
  }
});

router.get('/:id/pagecopy', (req, res) => {
  const bm = Bookmark.getById(req.params.id);
  if (!bm || !bm.page_copy_path || !fs.existsSync(bm.page_copy_path)) {
    return res.status(404).json({ error: 'No saved copy for this bookmark.' });
  }
  res.type(bm.page_copy_kind === 'pdf' ? 'application/pdf' : 'text/html');
  res.sendFile(bm.page_copy_path);
});

// Submit to the Internet Archive (FR-022).
router.post('/:id/archiveorg', async (req, res) => {
  const bm = Bookmark.getById(req.params.id);
  if (!bm) return res.status(404).json({ error: 'Bookmark not found.' });
  try {
    const snapshot = await submitToArchive(bm.url);
    const updated = Bookmark.setArchiveOrgUrl(bm.id, snapshot);
    res.json({ bookmark: updated });
  } catch (e) {
    res.status(502).json({ error: 'The Internet Archive could not be reached: ' + e.message });
  }
});

export default router;
