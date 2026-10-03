export const EMPTY_STATE = Object.freeze({ bookmarks: [], collections: [] });

export function createId(prefix = 'item') {
  if (globalThis.crypto?.randomUUID) return `${prefix}-${globalThis.crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function normalizeText(value) {
  return String(value ?? '').trim();
}

export function parseWebAddress(value) {
  const address = normalizeText(value);
  if (!/^https?:\/\//i.test(address)) return null;

  try {
    const parsed = new URL(address);
    if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.hostname) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function normalizeWebAddress(value) {
  const parsed = parseWebAddress(value);
  if (!parsed) return null;
  parsed.hash = '';
  const normalized = parsed.href;
  return normalized.endsWith('/') && parsed.pathname === '/' && !parsed.search
    ? normalized.slice(0, -1)
    : normalized;
}

export function validateBookmarkDraft(draft, bookmarks = []) {
  const name = normalizeText(draft.name);
  const address = normalizeText(draft.url);
  const errors = {};

  if (!name) errors.name = 'Add a name so you can recognize this bookmark.';
  if (!parseWebAddress(address)) {
    errors.url = 'Enter a full web address beginning with http:// or https://.';
  }

  const normalized = normalizeWebAddress(address);
  const duplicate = normalized
    ? bookmarks.find((bookmark) => normalizeWebAddress(bookmark.url) === normalized)
    : null;

  if (duplicate) {
    errors.duplicate = `This web address is already saved as “${duplicate.name}”.`;
  }

  return { valid: Object.keys(errors).length === 0, errors, name, url: address };
}

export function addBookmark(state, draft, id = createId('bookmark')) {
  const validation = validateBookmarkDraft(draft, state.bookmarks);
  if (!validation.valid) return { state, errors: validation.errors };

  const bookmark = {
    id,
    name: validation.name,
    url: validation.url,
    collectionId: null
  };
  return {
    state: { ...state, bookmarks: [...state.bookmarks, bookmark] },
    bookmark,
    errors: {}
  };
}

export function validateCollectionName(name, collections = []) {
  const cleanName = normalizeText(name);
  const errors = {};
  if (!cleanName) errors.name = 'Add a name for this collection.';

  const duplicate = cleanName
    ? collections.find((collection) => collection.name.toLocaleLowerCase() === cleanName.toLocaleLowerCase())
    : null;
  if (duplicate) {
    errors.duplicate = `“${duplicate.name}” already exists. Add the selected bookmarks to it instead.`;
  }
  return { valid: Object.keys(errors).length === 0, errors, name: cleanName, duplicate };
}

export function createCollectionAndAssign(state, name, bookmarkIds, id = createId('collection')) {
  const validation = validateCollectionName(name, state.collections);
  if (!validation.valid) return { state, errors: validation.errors };
  const selected = new Set(bookmarkIds);
  const collection = { id, name: validation.name };
  return {
    state: {
      collections: [...state.collections, collection],
      bookmarks: state.bookmarks.map((bookmark) => selected.has(bookmark.id)
        ? { ...bookmark, collectionId: id }
        : bookmark)
    },
    collection,
    errors: {}
  };
}

export function assignToCollection(state, collectionId, bookmarkIds) {
  if (!state.collections.some((collection) => collection.id === collectionId)) return state;
  const selected = new Set(bookmarkIds);
  return {
    ...state,
    bookmarks: state.bookmarks.map((bookmark) => selected.has(bookmark.id)
      ? { ...bookmark, collectionId }
      : bookmark)
  };
}

export function deleteBookmarks(state, bookmarkIds) {
  const selected = new Set(bookmarkIds);
  return { ...state, bookmarks: state.bookmarks.filter((bookmark) => !selected.has(bookmark.id)) };
}

export function findBookmarks(state, { search = '', collectionId = 'all' } = {}) {
  const term = normalizeText(search).toLocaleLowerCase();
  return state.bookmarks.filter((bookmark) => {
    const inCollection = collectionId === 'all' || bookmark.collectionId === collectionId;
    const searchable = `${bookmark.name} ${bookmark.url}`.toLocaleLowerCase();
    return inCollection && (!term || searchable.includes(term));
  });
}

export function sanitizeState(value) {
  if (!value || !Array.isArray(value.bookmarks) || !Array.isArray(value.collections)) {
    return { bookmarks: [], collections: [] };
  }

  const collections = value.collections
    .filter((item) => item && typeof item.id === 'string' && typeof item.name === 'string')
    .map(({ id, name }) => ({ id, name }));
  const validCollectionIds = new Set(collections.map(({ id }) => id));
  const bookmarks = value.bookmarks
    .filter((item) => item && typeof item.id === 'string' && typeof item.name === 'string' && parseWebAddress(item.url))
    .map(({ id, name, url, collectionId }) => ({
      id,
      name,
      url,
      collectionId: validCollectionIds.has(collectionId) ? collectionId : null
    }));
  return { bookmarks, collections };
}
