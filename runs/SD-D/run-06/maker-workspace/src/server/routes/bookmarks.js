import { Router } from 'express';
import * as repo from '../db/bookmarks.repo.js';
import {
  setBookmarkTags, addBookmarkTags, removeBookmarkTags,
} from '../db/tags.repo.js';
import { normalizeUrl, InvalidUrlError } from '../services/normalizeUrl.js';
import { findByNormalizedUrl } from '../services/duplicates.js';
import { captureMetadata } from '../services/metadata.js';
import { preserveLocal } from '../services/preserve.js';
import { resolveMatchingIds, SearchSyntaxError } from '../services/search/index.js';
import { getView } from '../db/views.repo.js';

const router = Router();

function hostTitle(normalized) {
  try { return new URL(normalized).hostname; } catch { return normalized; }
}

// Fire async, best-effort capture + preservation without blocking the response.
// Disabled in tests (DISABLE_CAPTURE=1) to avoid launching a browser / network.
function kickoffCapture(bookmark, { keepTitle }) {
  if (process.env.DISABLE_CAPTURE === '1') return;
  captureMetadata(bookmark.id, bookmark.url, { keepTitle }).catch(() => {});
  preserveLocal(bookmark.id, bookmark.url).catch(() => {});
}

// POST /api/bookmarks — save, or route to the existing bookmark (FR-001/FR-007)
router.post('/', (req, res, next) => {
  try {
    const { url, title, description, tags, notesMarkdown } = req.body || {};
    let normalized, canonical;
    try {
      ({ normalized, url: canonical } = normalizeUrl(url));
    } catch (e) {
      if (e instanceof InvalidUrlError) {
        return res.status(400).json({ error: { code: 'invalid_url', message: e.message } });
      }
      throw e;
    }

    const existing = findByNormalizedUrl(normalized);
    if (existing) {
      // Never create a copy or silently overwrite (FR-007).
      return res.status(200).json({ bookmark: repo.serialize(existing), duplicate: true });
    }

    const providedTitle = title && String(title).trim();
    const created = repo.create({
      url: canonical,
      normalized,
      title: providedTitle || hostTitle(normalized),
      description: description ?? null,
      notesMarkdown: notesMarkdown ?? null,
    });
    if (Array.isArray(tags)) setBookmarkTags(created.id, tags);

    kickoffCapture(created, { keepTitle: !!providedTitle });
    return res.status(201).json({ bookmark: repo.serialize(repo.getById(created.id)) });
  } catch (e) {
    next(e);
  }
});

// GET /api/bookmarks — list / browse (FR-005/FR-010/FR-016/FR-018/FR-021)
router.get('/', (req, res, next) => {
  try {
    const { view, tag, sort, page, pageSize } = req.query;
    const result = repo.list({
      view: view || 'all',
      tag: tag || null,
      sort: sort || 'newest',
      page: page || 1,
      pageSize: pageSize || 25,
    });
    res.json(result);
  } catch (e) {
    next(e);
  }
});

// GET /api/bookmarks/:id
router.get('/:id', (req, res) => {
  const row = repo.getById(Number(req.params.id));
  if (!row) return res.status(404).json({ error: { code: 'not_found', message: 'Bookmark not found' } });
  res.json({ bookmark: repo.serialize(row) });
});

// PATCH /api/bookmarks/:id — edit address/title/description/tags/notes (FR-004)
router.patch('/:id', (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const row = repo.getById(id);
    if (!row) return res.status(404).json({ error: { code: 'not_found', message: 'Bookmark not found' } });

    const { url, title, description, tags, notesMarkdown } = req.body || {};
    const fields = {};
    let recapture = false;

    if (url !== undefined) {
      let normalized, canonical;
      try {
        ({ normalized, url: canonical } = normalizeUrl(url));
      } catch (e) {
        if (e instanceof InvalidUrlError) {
          return res.status(400).json({ error: { code: 'invalid_url', message: e.message } });
        }
        throw e;
      }
      if (normalized !== row.normalized_url) {
        const clash = findByNormalizedUrl(normalized);
        if (clash && clash.id !== id) {
          return res.status(409).json({
            error: { code: 'duplicate', message: 'Another bookmark already has this address' },
            existingId: clash.id,
          });
        }
        fields.url = canonical;
        fields.normalized_url = normalized;
        recapture = true;
      }
    }
    if (title !== undefined) fields.title = String(title);
    if (description !== undefined) fields.description = description ?? null;
    if (notesMarkdown !== undefined) fields.notes_markdown = notesMarkdown ?? null;

    const updated = repo.updateFields(id, fields);
    if (Array.isArray(tags)) setBookmarkTags(id, tags);

    if (recapture) kickoffCapture(repo.getById(id), { keepTitle: true });
    res.json({ bookmark: repo.serialize(repo.getById(id)) });
  } catch (e) {
    next(e);
  }
});

// POST /api/bookmarks/:id/read — set read status (FR-015)
router.post('/:id/read', (req, res) => {
  const id = Number(req.params.id);
  if (!repo.getById(id)) return res.status(404).json({ error: { code: 'not_found', message: 'Bookmark not found' } });
  const isRead = !!(req.body && req.body.isRead);
  repo.updateFields(id, { is_read: isRead ? 1 : 0 });
  res.json({ bookmark: repo.serialize(repo.getById(id)) });
});

// POST /api/bookmarks/:id/archive — archive / restore (FR-017/FR-019)
router.post('/:id/archive', (req, res) => {
  const id = Number(req.params.id);
  if (!repo.getById(id)) return res.status(404).json({ error: { code: 'not_found', message: 'Bookmark not found' } });
  const archived = !!(req.body && req.body.archived);
  repo.updateFields(id, { is_archived: archived ? 1 : 0 });
  res.json({ bookmark: repo.serialize(repo.getById(id)) });
});

// DELETE /api/bookmarks/:id?confirm=true — permanent delete (FR-020)
router.delete('/:id', (req, res) => {
  const id = Number(req.params.id);
  if (String(req.query.confirm) !== 'true') {
    return res.status(400).json({ error: { code: 'confirmation_required', message: 'Deletion must be confirmed' } });
  }
  if (!repo.getById(id)) return res.status(404).json({ error: { code: 'not_found', message: 'Bookmark not found' } });
  repo.remove(id);
  res.status(204).end();
});

// POST /api/bookmarks/bulk — bulk actions over a selection (FR-022/FR-023)
router.post('/bulk', (req, res, next) => {
  try {
    const { selection = {}, action, tags, confirm } = req.body || {};

    // Resolve the target ids. "Select all matching" (FR-022) covers the ENTIRE
    // current search/filter/saved-view, not just the ids visible on one page.
    let ids = [];
    const hasMatchSelector =
      selection.matchQuery !== undefined || selection.matchView !== undefined ||
      selection.matchTag !== undefined || selection.matchViewId !== undefined ||
      selection.matchIncludedTags !== undefined || selection.matchExcludedTags !== undefined;

    if (Array.isArray(selection.ids) && selection.ids.length) {
      ids = selection.ids.map(Number);
    } else if (selection.matchViewId !== undefined && selection.matchViewId !== null) {
      const view = getView(Number(selection.matchViewId));
      if (view) {
        ids = resolveMatchingIds({
          q: view.searchText || null,
          includedTags: view.includedTags,
          excludedTags: view.excludedTags,
          view: 'all',
        });
      }
    } else if (hasMatchSelector) {
      const includedTags = Array.isArray(selection.matchIncludedTags)
        ? selection.matchIncludedTags
        : (selection.matchTag ? [selection.matchTag] : []);
      ids = resolveMatchingIds({
        q: selection.matchQuery || null,
        view: selection.matchView || 'all',
        includedTags,
        excludedTags: Array.isArray(selection.matchExcludedTags) ? selection.matchExcludedTags : [],
      });
    }

    if (action === 'delete' && confirm !== true) {
      return res.status(400).json({ error: { code: 'confirmation_required', message: 'Bulk delete must be confirmed' } });
    }

    let affected = 0;
    for (const id of ids) {
      if (!repo.getById(id)) continue;
      switch (action) {
        case 'addTags': addBookmarkTags(id, tags || []); break;
        case 'removeTags': removeBookmarkTags(id, tags || []); break;
        case 'markRead': repo.updateFields(id, { is_read: 1 }); break;
        case 'markUnread': repo.updateFields(id, { is_read: 0 }); break;
        case 'archive': repo.updateFields(id, { is_archived: 1 }); break;
        case 'restore': repo.updateFields(id, { is_archived: 0 }); break;
        case 'delete': repo.remove(id); break;
        default:
          return res.status(400).json({ error: { code: 'bad_action', message: `Unknown action: ${action}` } });
      }
      affected++;
    }
    res.json({ affected });
  } catch (e) {
    if (e instanceof SearchSyntaxError) {
      return res.status(400).json({ error: { code: 'bad_query', message: e.message } });
    }
    next(e);
  }
});

export default router;
