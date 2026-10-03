import * as model from '../models/bookmark.js';
import { normalizeUrl, fallbackTitle, fetchPageTitle } from './url.js';

// Business rules for bookmarks. Errors carry a machine `code` and HTTP `status`
// consumed by the route layer and mapped to the contract error shape.

class ServiceError extends Error {
  constructor(code, message, status) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

function cleanTags(tags) {
  if (!Array.isArray(tags)) return [];
  return tags.map((t) => (typeof t === 'string' ? t.trim() : '')).filter(Boolean);
}

/**
 * Create a bookmark: validate/normalize url, derive title when missing,
 * attach tags, and warn (without blocking) on a duplicate url.
 * @returns {Promise<{ bookmark: object, warnings: string[] }>}
 */
export async function createBookmark(input = {}) {
  const url = normalizeUrl(input.url);
  if (!url) {
    throw new ServiceError('invalid_url', 'Enter a valid web address.', 400);
  }

  const warnings = [];
  if (model.findByUrl(url)) warnings.push('duplicate_url');

  let title = typeof input.title === 'string' ? input.title.trim() : '';
  if (title === '') {
    title = (await fetchPageTitle(url)) || fallbackTitle(url);
  }

  const note =
    typeof input.note === 'string' && input.note.trim() !== ''
      ? input.note.trim()
      : null;

  const bookmark = model.create({ url, title, note, tags: cleanTags(input.tags) });
  return { bookmark, warnings };
}

/** List bookmarks with optional keyword/tag filtering. */
export function listBookmarks({ q, tag } = {}) {
  return model.list({ q, tag });
}

/** All tag names. */
export function listTags() {
  return model.listTags();
}

/** Fetch one bookmark or throw not_found. */
export function getBookmark(id) {
  const bookmark = model.getById(id);
  if (!bookmark) throw new ServiceError('not_found', 'Bookmark not found.', 404);
  return bookmark;
}

/** Update title/note/tags. url is not editable (FR-007). */
export function updateBookmark(id, input = {}) {
  if (!model.getById(id)) {
    throw new ServiceError('not_found', 'Bookmark not found.', 404);
  }

  const patch = {};
  if (input.title !== undefined) {
    const title = typeof input.title === 'string' ? input.title.trim() : '';
    if (title === '') {
      throw new ServiceError('invalid_title', 'Title cannot be empty.', 400);
    }
    patch.title = title;
  }
  if (input.note !== undefined) {
    patch.note =
      typeof input.note === 'string' && input.note.trim() !== ''
        ? input.note.trim()
        : null;
  }
  if (input.tags !== undefined) {
    patch.tags = cleanTags(input.tags);
  }

  return model.update(id, patch);
}

/** Delete a bookmark or throw not_found. */
export function deleteBookmark(id) {
  const removed = model.remove(id);
  if (!removed) throw new ServiceError('not_found', 'Bookmark not found.', 404);
}

export { ServiceError };
